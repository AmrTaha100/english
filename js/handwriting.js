let canvas = null;
let context = null;
let panel = null;
let answerInput = null;
let questionLabel = null;
let statusEl = null;
let recognizeButton = null;
let clearButton = null;
let methodButtons = [];
let isDrawing = false;
let hasInk = false;
let lastPoint = null;
let activePointerId = null;
const workers = new Map();
const workerPromises = new Map();
let tesseractModulePromise = null;
let resizeTimer = null;

const ORIGINAL_LABEL = "اكتب الترجمة:";
const ORIGINAL_PLACEHOLDER = "اكتب إجابتك هنا...";

function getElements() {
  return {
    answerArea: document.querySelector(".answer-area"),
    answerInput: document.getElementById("answerInput"),
    questionLabel: document.querySelector(".question-label"),
    canvas: document.getElementById("handwritingCanvas"),
    panel: document.getElementById("handwritingPanel"),
    status: document.getElementById("handwritingStatus"),
    recognizeButton: document.querySelector('[data-action="recognize-handwriting"]'),
    clearButton: document.querySelector('[data-action="clear-handwriting"]'),
    methodButtons: [
      ...document.querySelectorAll("[data-answer-method]")
    ]
  };
}

function setStatus(message, type = "idle") {
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.dataset.status = type;
}

function buildControls(answerArea, input) {
  if (!answerArea || !input || document.getElementById("handwritingPanel")) {
    return;
  }

  const wrapper = document.createElement("div");

  wrapper.innerHTML = `
    <div
      class="answer-method"
      role="group"
      aria-label="طريقة الإجابة">

      <button
        class="answer-method-btn active"
        type="button"
        data-answer-method="keyboard"
        aria-pressed="true">

        ⌨️ الكيبورد

      </button>

      <button
        class="answer-method-btn"
        type="button"
        data-answer-method="handwriting"
        aria-pressed="false">

        ✍️ باليد

      </button>

    </div>

    <div
      class="handwriting-panel"
      id="handwritingPanel"
      hidden>

      <div class="handwriting-heading">
        <span>✍️ اكتب بإيدك</span>
        <small id="handwritingStatus" data-status="idle">
          اكتب الكلمة بإيدك داخل المربع.
        </small>
      </div>

      <canvas
        id="handwritingCanvas"
        class="handwriting-canvas"
        aria-label="منطقة الكتابة باليد">
      </canvas>

      <div class="handwriting-actions">
        <button
          class="btn btn-secondary"
          type="button"
          data-action="clear-handwriting">

          🗑️ مسح

        </button>

        <button
          class="btn btn-primary"
          type="button"
          data-action="recognize-handwriting">

          ✨ تحويل لنص

        </button>
      </div>

      <div class="handwriting-result-label">
        <span>النص المقروء</span>
        <span>ممكن تعدّله قبل التأكيد</span>
      </div>
    </div>
  `;

  answerArea.insertBefore(wrapper, input);
}

function applyCanvasScale() {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return;
  }

  const dpr = Math.max(
    1,
    Math.min(window.devicePixelRatio || 1, 2)
  );

  canvas.width = Math.max(
    1,
    Math.round(rect.width * dpr)
  );
  canvas.height = Math.max(
    1,
    Math.round(rect.height * dpr)
  );

  context = canvas.getContext("2d", {
    alpha: false
  });

  context.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3.2;
  context.strokeStyle = "#111827";

  clearCanvas(false);
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function drawPoint(point) {
  if (!context || !lastPoint) {
    return;
  }

  context.beginPath();
  context.moveTo(
    lastPoint.x,
    lastPoint.y
  );
  context.lineTo(
    point.x,
    point.y
  );
  context.stroke();

  lastPoint = point;
  hasInk = true;
}

function beginDrawing(event) {
  if (!canvas || !context) {
    return;
  }

  isDrawing = true;
  activePointerId = event.pointerId;
  lastPoint = getPoint(event);

  try {
    canvas.setPointerCapture(
      event.pointerId
    );
  } catch {
    // Optional browser feature.
  }

  context.beginPath();
  context.fillStyle = "#111827";
  context.arc(
    lastPoint.x,
    lastPoint.y,
    context.lineWidth / 2,
    0,
    Math.PI * 2
  );
  context.fill();

  hasInk = true;

  setStatus(
    "كمّل الكتابة، وبعدها اضغط «تحويل لنص».",
    "idle"
  );

  event.preventDefault();
}

function continueDrawing(event) {
  if (
    !isDrawing ||
    event.pointerId !== activePointerId
  ) {
    return;
  }

  drawPoint(getPoint(event));
  event.preventDefault();
}

function endDrawing(event) {
  if (
    !isDrawing ||
    (
      event &&
      event.pointerId !== activePointerId
    )
  ) {
    return;
  }

  isDrawing = false;
  lastPoint = null;

  try {
    canvas.releasePointerCapture(
      activePointerId
    );
  } catch {
    // Already released.
  }

  activePointerId = null;

  if (hasInk) {
    setStatus(
      "الكتابة جاهزة. اضغط «تحويل لنص».",
      "ready"
    );
  }
}

function clearCanvas(showMessage = true) {
  if (!canvas || !context) {
    return;
  }

  context.save();
  context.setTransform(
    1,
    0,
    0,
    1,
    0,
    0
  );
  context.fillStyle = "#f8fafc";
  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );
  context.restore();

  const dpr = Math.max(
    1,
    Math.min(window.devicePixelRatio || 1, 2)
  );

  context.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3.2;
  context.strokeStyle = "#111827";

  hasInk = false;
  isDrawing = false;
  lastPoint = null;
  activePointerId = null;

  if (showMessage) {
    setStatus(
      "المربع فاضي. اكتب الكلمة بإيدك.",
      "idle"
    );
  }
}

function setMethod(method) {
  const handwriting =
    method === "handwriting";

  methodButtons.forEach(button => {
    const active =
      button.dataset.answerMethod === method;

    button.classList.toggle(
      "active",
      active
    );

    button.setAttribute(
      "aria-pressed",
      active ? "true" : "false"
    );
  });

  if (panel) {
    panel.hidden = !handwriting;
  }

  if (questionLabel) {
    questionLabel.textContent =
      handwriting
        ? "النص المقروء:"
        : ORIGINAL_LABEL;
  }

  if (answerInput) {
    answerInput.setAttribute(
      "aria-label",
      handwriting
        ? "النص المقروء من الكتابة اليدوية ويمكن تعديله"
        : ORIGINAL_LABEL
    );

    answerInput.placeholder =
      handwriting
        ? "هيظهر هنا النص اللي اتقرا من الكتابة..."
        : ORIGINAL_PLACEHOLDER;
  }

  if (handwriting) {
    setStatus(
      hasInk
        ? "الكتابة جاهزة. اضغط «تحويل لنص»."
        : "اكتب الكلمة بإيدك داخل المربع.",
      hasInk ? "ready" : "idle"
    );

    window.requestAnimationFrame(() => {
      if (!panel.hidden) {
        applyCanvasScale();
      }
    });

    void prepareHandwritingLanguage(
      getExpectedLanguage()
    );
  }
}

async function loadTesseract() {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import(
      "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/+esm"
    );
  }

  return tesseractModulePromise;
}

async function getWorker(language) {
  if (workers.has(language)) {
    return workers.get(language);
  }

  if (!workerPromises.has(language)) {
    workerPromises.set(
      language,
      (async () => {
        const { createWorker } =
          await loadTesseract();

        const worker =
          await createWorker(
            language,
            1
          );

        const { PSM } =
          await loadTesseract();

        await worker.setParameters({
          tessedit_pageseg_mode:
            language === "eng"
              ? PSM.SINGLE_WORD
              : PSM.SINGLE_LINE,
          user_defined_dpi: "300",
          preserve_interword_spaces: "0",
          ...(language === "eng"
            ? {
                tessedit_char_whitelist:
                  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-'"
              }
            : {})
        });

        workers.set(
          language,
          worker
        );

        return worker;
      })()
    );
  }

  try {
    return await workerPromises.get(
      language
    );
  } catch (error) {
    workerPromises.delete(
      language
    );
    throw error;
  }
}

function normalizeRecognizedText(text) {
  return String(text || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[|¦~`]+/g, "")
    .trim();
}

function getExpectedLanguage() {
  const badge =
    document.getElementById("modeBadge");

  return (
    badge?.textContent.includes("عربي → إنجليزي")
      ? "eng"
      : "ara"
  );
}

export async function prepareHandwritingLanguage(
  language
) {
  if (!["eng", "ara"].includes(language)) {
    return;
  }

  try {
    await getWorker(language);
  } catch (error) {
    console.warn(
      "Could not prepare handwriting OCR:",
      error
    );
  }
}

function getInkBounds(sourceCanvas) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  if (!width || !height) {
    return null;
  }

  const sourceContext = sourceCanvas.getContext("2d", {
    willReadFrequently: true
  });

  if (!sourceContext) {
    return null;
  }

  const pixels = sourceContext.getImageData(
    0,
    0,
    width,
    height
  ).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];

      if (
        r < 232 ||
        g < 232 ||
        b < 232
      ) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY
  };
}

function createOcrCanvas(sourceCanvas, binary = false) {
  const bounds = getInkBounds(sourceCanvas);

  if (!bounds) {
    return null;
  }

  const sourceWidth =
    bounds.maxX - bounds.minX + 1;
  const sourceHeight =
    bounds.maxY - bounds.minY + 1;

  const padding =
    Math.max(
      35,
      Math.round(
        Math.min(sourceWidth, sourceHeight) * 0.12
      )
    );

  const croppedWidth =
    sourceWidth + padding * 2;
  const croppedHeight =
    sourceHeight + padding * 2;

  const targetHeight =
    binary ? 420 : 380;

  const maxWidth = 1700;
  const scale = Math.min(
    targetHeight / croppedHeight,
    maxWidth / croppedWidth
  );

  const targetWidth =
    Math.max(
      420,
      Math.round(
        croppedWidth * scale
      )
    );

  const output =
    document.createElement("canvas");

  output.width = targetWidth;
  output.height = targetHeight;

  const outputContext =
    output.getContext("2d", {
      alpha: false
    });

  if (!outputContext) {
    return null;
  }

  outputContext.fillStyle =
    "#ffffff";

  outputContext.fillRect(
    0,
    0,
    targetWidth,
    targetHeight
  );

  outputContext.imageSmoothingEnabled =
    true;

  outputContext.imageSmoothingQuality =
    "high";

  outputContext.drawImage(
    sourceCanvas,
    bounds.minX,
    bounds.minY,
    sourceWidth,
    sourceHeight,
    padding * scale,
    padding * scale,
    sourceWidth * scale,
    sourceHeight * scale
  );

  if (!binary) {
    return output;
  }

  const image =
    outputContext.getImageData(
      0,
      0,
      targetWidth,
      targetHeight
    );

  const data = image.data;

  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    const gray =
      0.299 * data[i] +
      0.587 * data[i + 1] +
      0.114 * data[i + 2];

    const value =
      gray < 220
        ? 20
        : 255;

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  outputContext.putImageData(
    image,
    0,
    0
  );

  return output;
}

async function recognizeCandidate(
  worker,
  image,
  language
) {
  const result =
    await worker.recognize(
      image,
      {},
      {
        text: true
      }
    );

  const text =
    normalizeRecognizedText(
      result?.data?.text
    );

  const confidence =
    Number(
      result?.data?.confidence
    ) || 0;

  return {
    text,
    confidence
  };
}

function normalizeForComparison(text, language) {
  const value =
    String(text || "");

  if (language === "eng") {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9'\- ]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return value
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseCandidate(candidates, language) {
  const valid =
    candidates.filter(
      candidate => candidate.text
    );

  if (!valid.length) {
    return {
      text: "",
      confidence: 0
    };
  }

  valid.sort(
    (a, b) =>
      b.confidence - a.confidence
  );

  const best =
    valid[0];

  // When two preprocessing passes agree, prefer the shared text.
  const comparable =
    normalizeForComparison(
      best.text,
      language
    );

  const agreement =
    valid.find(
      candidate =>
        normalizeForComparison(
          candidate.text,
          language
        ) === comparable
    );

  return agreement || best;
}

export async function recognizeHandwriting(
  language = getExpectedLanguage()
) {
  if (!hasInk || !canvas) {
    setStatus(
      "اكتب كلمة الأول وبعدين حوّلها لنص.",
      "error"
    );
    return "";
  }

  if (!["eng", "ara"].includes(language)) {
    setStatus(
      "لغة الكتابة غير مدعومة حاليًا.",
      "error"
    );
    return "";
  }

  if (recognizeButton) {
    recognizeButton.disabled = true;
  }

  if (clearButton) {
    clearButton.disabled = true;
  }

  setStatus(
    language === "ara"
      ? "⏳ جاري قراءة الكتابة العربية..."
      : "⏳ جاري قراءة الكتابة الإنجليزية...",
    "loading"
  );

  try {
    const worker =
      await getWorker(language);

    setStatus(
      "⏳ جاري تحسين الصورة وقراءة الكتابة...",
      "loading"
    );

    const primaryImage =
      createOcrCanvas(
        canvas,
        false
      );

    const binaryImage =
      createOcrCanvas(
        canvas,
        true
      );

    if (!primaryImage) {
      setStatus(
        "مش لاقي كتابة واضحة. اكتب الكلمة وجرب تاني.",
        "error"
      );
      return "";
    }

    const candidates = [];

    const first =
      await recognizeCandidate(
        worker,
        primaryImage,
        language
      );

    candidates.push(first);

    if (
      !first.text ||
      first.confidence < 78
    ) {
      const second =
        binaryImage
          ? await recognizeCandidate(
              worker,
              binaryImage,
              language
            )
          : null;

      if (second) {
        candidates.push(second);
      }
    }

    const chosen =
      chooseCandidate(
        candidates,
        language
      );

    if (!chosen.text) {
      setStatus(
        "مش قادر أقرأ الكتابة. اكتب أوضح وجرب تاني.",
        "error"
      );
      return "";
    }

    if (answerInput) {
      answerInput.value =
        chosen.text;
    }

    const confidenceNote =
      chosen.confidence >= 82
        ? "✅"
        : "⚠️";

    setStatus(
      confidenceNote +
        " اتقريت. راجع النص قبل تأكيد الإجابة.",
      chosen.confidence >= 82
        ? "success"
        : "ready"
    );

    return chosen.text;
  } catch (error) {
    console.error(
      "Handwriting OCR failed:",
      error
    );

    setStatus(
      "حصلت مشكلة في قراءة الكتابة. جرّب تاني.",
      "error"
    );

    return "";
  } finally {
    if (recognizeButton) {
      recognizeButton.disabled = false;
    }

    if (clearButton) {
      clearButton.disabled = false;
    }
  }
}

export function clearHandwriting() {
  clearCanvas(true);

  if (answerInput) {
    answerInput.value = "";
  }
}

export function prepareHandwritingForQuestion() {
  if (
    canvas &&
    !context &&
    canvas.getBoundingClientRect().width > 0
  ) {
    applyCanvasScale();
  }

  clearCanvas(false);

  if (answerInput) {
    answerInput.value = "";
  }

  setStatus(
    "اكتب الكلمة بإيدك داخل المربع.",
    "idle"
  );
}

// OCR output is never replaced with the expected answer.
// Recognition cleanup only improves the image and OCR configuration.
// The user remains responsible for reviewing the detected text.

export function isHandwritingMode() {
  const active =
    methodButtons.find(button =>
      button.classList.contains("active")
    );

  return (
    active?.dataset.answerMethod ===
    "handwriting"
  );
}

export function initializeHandwriting() {
  const initial =
    getElements();

  if (
    !initial.answerArea ||
    !initial.answerInput
  ) {
    return;
  }

  buildControls(
    initial.answerArea,
    initial.answerInput
  );

  const elements =
    getElements();

  answerInput =
    elements.answerInput;
  questionLabel =
    elements.questionLabel;
  panel =
    elements.panel;
  canvas =
    elements.canvas;
  statusEl =
    elements.status;
  recognizeButton =
    elements.recognizeButton;
  clearButton =
    elements.clearButton;
  methodButtons =
    elements.methodButtons;

  if (
    !canvas ||
    !panel ||
    !answerInput
  ) {
    return;
  }

  applyCanvasScale();

  methodButtons.forEach(button => {
    button.addEventListener(
      "click",
      () => {
        setMethod(
          button.dataset.answerMethod
        );
      }
    );
  });

  canvas.addEventListener(
    "pointerdown",
    beginDrawing
  );
  canvas.addEventListener(
    "pointermove",
    continueDrawing
  );
  canvas.addEventListener(
    "pointerup",
    endDrawing
  );
  canvas.addEventListener(
    "pointercancel",
    endDrawing
  );

  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(
        resizeTimer
      );

      resizeTimer =
        window.setTimeout(
          () => {
            applyCanvasScale();
          },
          120
        );
    }
  );

  window.addEventListener(
    "beforeunload",
    () => {
      workers.forEach(
        worker => {
          void worker.terminate();
        }
      );
    }
  );

  setMethod("keyboard");
}
