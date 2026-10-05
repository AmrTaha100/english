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
        : "اكتب الترجمة"
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

    const result =
      await worker.recognize(canvas);

    const text =
      normalizeRecognizedText(
        result?.data?.text
      );

    if (!text) {
      setStatus(
        "مش قادر أقرأ الكتابة. اكتب أوضح وجرب تاني.",
        "error"
      );
      return "";
    }

    if (answerInput) {
      answerInput.value = text;
    }

    setStatus(
      "✅ اتقريت. راجع النص لو محتاج تعدّل حاجة، وبعدها أكد الإجابة.",
      "success"
    );

    return text;
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
