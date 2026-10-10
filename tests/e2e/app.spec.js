import { test, expect } from "@playwright/test";

async function loadVocabulary(page) {
  return page.evaluate(
    async () => {
      const response =
        await fetch("./data/vocabulary.json");

      if (!response.ok) {
        throw new Error(
          "Failed to load vocabulary fixture."
        );
      }

      return response.json();
    }
  );
}

async function answerCurrentQuestion(
  page,
  vocabulary
) {
  const question =
    (
      await page
        .locator("#questionText")
        .innerText()
    ).trim();

  const badge =
    await page
      .locator("#modeBadge")
      .innerText();

  const item =
    vocabulary.find(
      word =>
        word.ar === question ||
        word.en === question
    );

  expect(item).toBeTruthy();

  const answer =
    badge.includes("عربي → إنجليزي")
      ? item.en
      : item.ar;

  await page
    .locator("#answerInput")
    .fill(answer);

  await page
    .locator('[data-action="submit-answer"]')
    .click();
}

async function installMockTesseract(
  page,
  { delayMs = 0, failFirst = 0 } = {}
) {
  await page.addInitScript(() => {
    Math.random = () => 0;
    window.__ocrText = "dominant";
  });

  await page.route(
    "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/+esm",
    route =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript",
        headers: {
          "access-control-allow-origin": "*"
        },
        body: `
          let attempts = 0;
          export const PSM = { SINGLE_WORD: 8, SINGLE_LINE: 7 };
          export async function createWorker() {
            attempts++;
            if (attempts <= ${failFirst}) {
              throw new Error("mock OCR failure");
            }
            return {
              setParameters: async () => {},
              recognize: async image => {
                await new Promise(resolve => setTimeout(resolve, ${delayMs}));
                const context = image.getContext("2d");
                const pixels = context.getImageData(0, 0, image.width, image.height).data;
                let ink = false;
                for (let i = 0; i < pixels.length; i += 4) {
                  if (pixels[i] < 232 || pixels[i + 1] < 232 || pixels[i + 2] < 232) {
                    ink = true;
                    break;
                  }
                }
                window.__ocrSawInk = ink;
                return { data: { text: window.__ocrText, confidence: 99 } };
              },
              terminate: async () => {}
            };
          }
        `
      })
  );
}

async function startHandwritingExam(page) {
  await page.goto("/");
  await page
    .locator('[data-action="start-exam"][data-mode="ar-en"]')
    .click();
  await page
    .locator('[data-answer-method="handwriting"]')
    .click();

  const canvas = page.locator("#handwritingCanvas");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + 20, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 100, bounds.y + 65, { steps: 5 });
  await page.mouse.up();
}

async function countCanvasInk(page) {
  return page.locator("#handwritingCanvas").evaluate(canvas => {
    const pixels = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 232 || pixels[i + 1] < 232 || pixels[i + 2] < 232) count++;
    }
    return count;
  });
}

test(
  "home page loads the vocabulary and exposes accessible controls",
  async ({ page }) => {
    // Keep browser-side startup failures visible in CI logs.
    page.on("pageerror", error => {
      console.log("[browser page error]", error.stack || error.message);
    });
    page.on("console", message => {
      if (message.type() === "error") {
        console.log("[browser console error]", message.text());
      }
    });
    page.on("requestfailed", request => {
      console.log("[request failed]", request.url(), request.failure()?.errorText || "");
    });

    await page.goto("/");

    await expect(
      page.locator("#vocabCount")
    ).toHaveText("38");

    await expect(
      page.locator("#loadingState")
    ).toBeHidden();

    await expect(
      page.locator("#loadError")
    ).toBeHidden();

    await expect(
      page.locator('[data-action="start-practice"]')
    ).toBeEnabled();

    // Check the exam input's accessible name while its label is visible.
    await page
      .locator('[data-action="start-exam"][data-mode="ar-en"]')
      .click();

    await expect(
      page.locator("#examScreen")
    ).toBeVisible();

    await expect(
      page.locator("#answerInput")
    ).toHaveAccessibleName("اكتب الترجمة:");

    await expect(
      page.locator("body")
    ).not.toContainText("undefined");

    const inlineHandlers =
      await page.locator("[onclick]").count();

    expect(inlineHandlers).toBe(0);
  }
);

test(
  "loading failure shows a retry state and recovers",
  async ({ page }) => {
    let fail = true;

    await page.route(
      "**/data/vocabulary.json",
      async route => {
        if (fail) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: "{}"
          });
          return;
        }

        await route.continue();
      }
    );

    await page.goto("/");

    await expect(
      page.locator("#loadError")
    ).toBeVisible();

    await expect(
      page.locator('[data-action="start-practice"]')
    ).toBeDisabled();

    fail = false;

    await page
      .locator('[data-action="retry-load"]')
      .click();

    await expect(
      page.locator("#vocabCount")
    ).toHaveText("38");

    await expect(
      page.locator("#loadError")
    ).toBeHidden();

    await expect(
      page.locator('[data-action="start-practice"]')
    ).toBeEnabled();
  }
);

test(
  "exam completes all 38 shuffled questions",
  async ({ page }) => {
    await page.goto("/");

    const vocabulary =
      await loadVocabulary(page);

    const sourceOrder =
      vocabulary.map(
        word => word.ar
      );

    await page
      .locator(
        '[data-action="start-exam"][data-mode="ar-en"]'
      )
      .click();

    await expect(
      page.locator("#examScreen")
    ).toBeVisible();

    await expect(
      page.locator("#speakerBtn")
    ).toBeHidden();

    const seen = [];

    for (
      let i = 0;
      i < vocabulary.length;
      i++
    ) {
      seen.push(
        (
          await page
            .locator("#questionText")
            .innerText()
        ).trim()
      );

      await answerCurrentQuestion(
        page,
        vocabulary
      );
    }

    await expect(
      page.locator("#resultsScreen")
    ).toBeVisible();

    expect(new Set(seen).size).toBe(38);

    expect(
      seen.some(
        (word, index) =>
          word !== sourceOrder[index]
      )
    ).toBeTruthy();

    await expect(
      page.locator("#finalScore")
    ).toHaveText("38 / 38");
  }
);

test(
  "mixed mode keeps an even 19/19 split",
  async ({ page }) => {
    await page.goto("/");

    const vocabulary =
      await loadVocabulary(page);

    await page
      .locator(
        '[data-action="start-exam"][data-mode="mixed"]'
      )
      .click();

    const directions = [];

    for (
      let i = 0;
      i < vocabulary.length;
      i++
    ) {
      directions.push(
        await page
          .locator("#modeBadge")
          .innerText()
      );

      await answerCurrentQuestion(
        page,
        vocabulary
      );
    }

    expect(
      directions.filter(
        value =>
          value.includes("عربي → إنجليزي")
      ).length
    ).toBe(19);

    expect(
      directions.filter(
        value =>
          value.includes("إنجليزي → عربي")
      ).length
    ).toBe(19);

    await expect(
      page.locator("#finalScore")
    ).toHaveText("38 / 38");
  }
);

test(
  "practice mode navigates words and keeps pronunciation control visible",
  async ({ page }) => {
    await page.goto("/");

    await page
      .locator('[data-action="start-practice"]')
      .click();

    await expect(
      page.locator("#practiceScreen")
    ).toBeVisible();

    await expect(
      page.locator("#practiceSpeakerBtn")
    ).toBeVisible();

    await expect(
      page.locator("#practiceProgress")
    ).toHaveText("1 / 38");

    await page
      .locator('[data-action="practice-next"]')
      .click();

    await expect(
      page.locator("#practiceProgress")
    ).toHaveText("2 / 38");

    await page
      .locator('[data-action="practice-previous"]')
      .click();

    await expect(
      page.locator("#practiceProgress")
    ).toHaveText("1 / 38");
  }
);

test(
  "double submission during delayed handwriting OCR processes only once",
  async ({ page }) => {
    await installMockTesseract(page, { delayMs: 500 });
    await startHandwritingExam(page);

    const submit = page.locator('[data-action="submit-answer"]');
    await submit.click();
    await expect(submit).toBeDisabled();
    await page.locator("#answerInput").press("Enter");
    await submit.evaluate(button => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await expect(page.locator("#progressText"))
      .toHaveText("السؤال 2 من 38");
    await expect(page.locator(".q-number.correct, .q-number.wrong"))
      .toHaveCount(1);
  }
);

test(
  "OCR finishing after Skip cannot write into or answer the next question",
  async ({ page }) => {
    await installMockTesseract(page, { delayMs: 500 });
    await startHandwritingExam(page);

    await page.locator('[data-action="submit-answer"]').click();
    await page.locator('[data-action="skip-question"]').click();

    const nextQuestion = await page.locator("#questionText").innerText();
    await expect(page.locator("#progressText"))
      .toHaveText("السؤال 2 من 38");
    await expect(page.locator("#answerInput")).toHaveValue("");

    await page.waitForTimeout(650);

    await expect(page.locator("#questionText"))
      .toHaveText(nextQuestion);
    await expect(page.locator("#answerInput")).toHaveValue("");
    await expect(page.locator(".q-number.correct, .q-number.wrong"))
      .toHaveCount(0);
  }
);

test(
  "failed handwriting OCR unlocks submission so the user can retry",
  async ({ page }) => {
    await installMockTesseract(page, { failFirst: 2 });
    await startHandwritingExam(page);

    const submit = page.locator('[data-action="submit-answer"]');
    await submit.click();
    await expect(page.locator("#handwritingStatus"))
      .toContainText("حصلت مشكلة");
    await expect(submit).toBeEnabled();
    await expect(page.locator("#progressText"))
      .toHaveText("السؤال 1 من 38");

    await submit.click();
    await expect(page.locator("#progressText"))
      .toHaveText("السؤال 2 من 38");
    await expect(page.locator(".q-number.correct, .q-number.wrong"))
      .toHaveCount(1);
  }
);

test(
  "handwriting and empty-canvas state survive resize and OCR sees preserved ink",
  async ({ page }) => {
    await installMockTesseract(page);
    await startHandwritingExam(page);

    await page.locator('[data-action="clear-handwriting"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await expect(page.locator("#handwritingCanvas"))
      .toBeVisible();
    const canvasSize = await page.locator("#handwritingCanvas").evaluate(c => ({
      bitmapWidth: c.width,
      cssWidth: c.getBoundingClientRect().width,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    }));
    expect(canvasSize.bitmapWidth)
      .toBe(Math.round(canvasSize.cssWidth * canvasSize.dpr));
    await page.locator('[data-action="recognize-handwriting"]').click();
    await expect(page.locator("#handwritingStatus"))
      .toContainText("اكتب كلمة الأول");
    expect(await countCanvasInk(page)).toBe(0);

    const canvas = page.locator("#handwritingCanvas");
    const bounds = await canvas.boundingBox();
    await page.mouse.move(bounds.x + 12, bounds.y + 20);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 90, bounds.y + 75, { steps: 5 });
    await page.mouse.up();
    const inkBeforeResize = await countCanvasInk(page);
    expect(inkBeforeResize).toBeGreaterThan(0);

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(200);
    expect(await countCanvasInk(page)).toBeGreaterThan(0);

    await page.locator('[data-action="recognize-handwriting"]').click();
    await expect(page.locator("#answerInput")).toHaveValue("dominant");
    expect(await page.evaluate(() => window.__ocrSawInk)).toBe(true);
  }
);

test(
  "one remaining unanswered question can be skipped to results",
  async ({ page }) => {
    await page.addInitScript(() => {
      Math.random = () => 0;
    });
    await page.goto("/");
    const vocabulary = await loadVocabulary(page);
    await page
      .locator('[data-action="start-exam"][data-mode="ar-en"]')
      .click();

    for (let i = 0; i < vocabulary.length - 1; i++) {
      await answerCurrentQuestion(page, vocabulary);
    }

    await page.locator('[data-action="skip-question"]').click();
    await expect(page.locator("#resultsScreen")).toBeVisible();
    await expect(page.locator("#finalScore")).toHaveText("37 / 38");
    await expect(page.locator(".result-item")).toHaveCount(38);
    await expect(page.locator(".result-item.wrong").last())
      .toContainText("لم تتم الإجابة");
  }
);

test(
  "multiple skips complete without a loop and deferred questions remain answerable",
  async ({ page }) => {
    await page.addInitScript(() => {
      Math.random = () => 0;
    });
    await page.goto("/");
    const vocabulary = await loadVocabulary(page);
    await page
      .locator('[data-action="start-exam"][data-mode="ar-en"]')
      .click();

    const skippedQuestion = await page.locator("#questionText").innerText();
    await page.locator('[data-action="skip-question"]').click();

    for (let i = 0; i < vocabulary.length - 1; i++) {
      await answerCurrentQuestion(page, vocabulary);
    }

    await expect(page.locator("#questionText"))
      .toHaveText(skippedQuestion);
    await answerCurrentQuestion(page, vocabulary);
    await expect(page.locator("#resultsScreen")).toBeVisible();
    await expect(page.locator("#finalScore")).toHaveText("38 / 38");

    await page.locator('[data-action="restart"]').click();
    await expect(page.locator("#modeScreen")).toBeVisible();
    await page
      .locator('[data-action="start-exam"][data-mode="ar-en"]')
      .click();

    for (let i = 0; i < vocabulary.length; i++) {
      await page.locator('[data-action="skip-question"]').click();
    }

    await expect(page.locator("#resultsScreen")).toBeVisible();
    await expect(page.locator("#finalScore")).toHaveText("0 / 38");
    await expect(page.locator(".result-item")).toHaveCount(38);
    await expect(page.locator(".result-item.wrong").first())
      .toContainText("لم تتم الإجابة");
  }
);
