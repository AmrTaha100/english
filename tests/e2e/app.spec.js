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
    badge.includes("عربي")
      ? item.en
      : item.ar;

  await page
    .locator("#answerInput")
    .fill(answer);

  await page
    .locator('[data-action="submit-answer"]')
    .click();
}

test(
  "home page loads the vocabulary and exposes accessible controls",
  async ({ page }) => {
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
          value.includes("عربي")
      ).length
    ).toBe(19);

    expect(
      directions.filter(
        value =>
          value.includes("إنجليزي")
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
