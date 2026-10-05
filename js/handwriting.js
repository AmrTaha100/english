let canvas = null;
let context = null;
let panel = null;
let answerInput = null;
let statusEl = null;
let recognizeButton = null;
let clearButton = null;
let methodButtons = [];
let isDrawing = false;
let hasInk = false;
let lastPoint = null;
let activePointerId = null;
let currentWorkerLanguage = null;
let currentWorkerPromise = null;
let tesseractModulePromise = null;

function getElements() {
  return {
    canvas: document.getElementById("handwritingCanvas"),
    panel: document.getElementById("handwritingPanel"),
    answerInput: document.getElementById("answerInput"),
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

function setupContext() {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));

  context = canvas.getContext("2d", { alpha: false });
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  if (!context || !lastPoint) return;

  context.beginPath();
  context.moveTo(lastPoint.x, lastPoint.y);
  context.lineTo(point.x, point.y);
  context.stroke();

  lastPoint = point;
  hasInk = true;
}

function beginDrawing(event) {
  if (!canvas || !context) return;

  isDrawing = true;
  activePointerId = event.pointerId;
  lastPoint = getPoint(event);

  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is optional.
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
  setStatus("كمّل الكتابة، وبعدها اضغط «تحويل لنص».", "idle");
  event.preventDefault();
}

function continueDrawing(event) {
  if (
    !isDrawing ||
    !canvas ||
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
    (event && event.pointerId !== activePointerId)
  ) {
    return;
  }

  isDrawing = false;
  lastPoint = null;

  try {
    canvas.releasePointerCapture(activePointerId);
  } catch {
    // Pointer capture may already be released.
  }

  activePointerId = null;

  if (hasInk) {
    setStatus("الكتابة جاهزة. اضغط «تحويل لنص».", "ready");
  }
}

function clearCanvas(showMessage = true) {
  if (!canvas || !context) return;

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();

  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3.2;
  context.strokeStyle = "#111827";

  hasInk = false;
  isDrawing = false;
  lastPoint = null;
  activePointerId = null;

  if (showMessage) {
    setStatus("المربع فاضي. اكتب الكلمة بإيدك.", "idle");
  }
}

function setMethod(method) {
  const handwriting = method === "handwriting";

  methodButtons.forEach(button => {
    const active = button.dataset.answerMethod === method;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  if (panel) {
    panel.hidden = !handwriting;
  }

  if (answerInput) {
    answerInput.hidden = false;
    answerInput.setAttribute(
      "aria-label",
      handwriting
        ? "النص المقروء من الكتابة اليدوية ويمكن تعديله"
        : "اكتب الترجمة"
    );
  }

  if (handwriting) {
    setStatus(
      hasInk
        ? "الكتابة جاهزة. اضغط «تحويل لنص»."
        : "اكتب الكلمة بإيدك داخل المربع.",
      hasInk ? "ready" : "idle"
    );
  }
}

function getExpectedLanguage() {
  const badge = document.getElementById("modeBadge");
  const value = badge?.textContent || "";
  return value.includes("إنجليزي") ? "ara" : "eng";
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
  if (
    currentWorkerPromise &&
    currentWorkerLanguage === language
  ) {
    return currentWorkerPromise;
  }

  currentWorkerLanguage = language;

  currentWorkerPromise = (async () => {
    const { createWorker } = await loadTesseract();
    return createWorker(language, 1);
  })();

  try {
    return await currentWorkerPromise;
  } catch (error) {
    currentWorkerPromise = null;
    currentWorkerLanguage = null;
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

export async function prepareHandwritingLanguage(language) {
  if (!["eng", "ara"].includes(language)) return;

  try {
    await getWorker(language);
  } catch (error) {
    console.warn("Could not prepare handwriting OCR:", error);
  }
}

export async function recognizeHandwriting(language = getExpectedLanguage()) {
  if (!hasInk || !canvas) {
    setStatus("اكتب كلمة الأول وبعدين حوّلها لنص.", "error");
    return "";
  }

  if (!["eng", "ara"].includes(language)) {
    setStatus("لغة الكتابة غير مدعومة حاليًا.", "error");
    return "";
  }

  if (recognizeButton) recognizeButton.disabled = true;
  if (clearButton) clearButton.disabled = true;

  setStatus(
    language === "ara"
      ? "⏳ جاري قراءة الكتابة العربية..."
      : "⏳ جاري قراءة الكتابة الإنجليزية...",
    "loading"
  );

  try {
    const worker = await getWorker(language);
    const result = await worker.recognize(canvas);
    const text = normalizeRecognizedText(result?.data?.text);

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
    console.error("Handwriting OCR failed:", error);
    setStatus(
      "حصلت مشكلة في قراءة الكتابة. جرّب تاني.",
      "error"
    );
    return "";
  } finally {
    if (recognizeButton) recognizeButton.disabled = false;
    if (clearButton) clearButton.disabled = false;
  }
}

export function clearHandwriting() {
  clearCanvas(true);
  if (answerInput) answerInput.value = "";
  answerInput?.focus();
}

export function prepareHandwritingForQuestion() {
  clearCanvas(false);
  if (answerInput) answerInput.value = "";
  setStatus("اكتب الكلمة بإيدك داخل المربع.", "idle");
}

export function isHandwritingMode() {
  const active = methodButtons.find(button =>
    button.classList.contains("active")
  );
  return active?.dataset.answerMethod === "handwriting";
}

export function initializeHandwriting() {
  const elements = getElements();

  canvas = elements.canvas;
  panel = elements.panel;
  answerInput = elements.answerInput;
  statusEl = elements.status;
  recognizeButton = elements.recognizeButton;
  clearButton = elements.clearButton;
  methodButtons = elements.methodButtons;

  if (!canvas || !panel || !answerInput) return;

  setupContext();

  methodButtons.forEach(button => {
    button.addEventListener("click", () => {
      setMethod(button.dataset.answerMethod);
    });
  });

  canvas.addEventListener("pointerdown", beginDrawing);
  canvas.addEventListener("pointermove", continueDrawing);
  canvas.addEventListener("pointerup", endDrawing);
  canvas.addEventListener("pointercancel", endDrawing);
  canvas.addEventListener("pointerleave", event => {
    if (isDrawing && event.buttons === 0) {
      endDrawing(event);
    }
  });

  clearButton?.addEventListener("click", clearHandwriting);

  recognizeButton?.addEventListener("click", () => {
    void recognizeHandwriting();
  });

  window.addEventListener("resize", () => {
    setupContext();
  });

  setMethod("keyboard");
}
