import { state } from "./state.js";
import { loadVocabulary } from "./data.js";
import {
  startExam,
  submitAnswer,
  skipQuestion,
  showExitConfirm,
  hideExitConfirm,
  confirmExitExam,
  speakCurrent,
  toggleMobileQuestions,
  closeMobileQuestions
} from "./exam.js";
import {
  startPractice,
  exitPractice,
  speakPracticeCurrent,
  practicePrevious,
  practiceNext
} from "./practice.js";
import { renderStats } from "./stats.js";
import { stopCurrentAudio } from "./audio.js";
import { initializeHandwriting, clearHandwriting, recognizeHandwriting } from "./handwriting.js";

let actionsBound = false;
let initializationPromise = null;

function setInteractionEnabled(enabled) {
  document
    .querySelectorAll(
      '[data-action="start-exam"], [data-action="start-practice"]'
    )
    .forEach(button => {
      button.disabled = !enabled;
    });
}

function setLoadingState() {
  const modeScreen = document.getElementById("modeScreen");
  const loadingState = document.getElementById("loadingState");
  const loadError = document.getElementById("loadError");

  modeScreen?.setAttribute("aria-busy", "true");
  modeScreen?.setAttribute("data-loading", "true");

  if (loadingState) loadingState.hidden = false;
  if (loadError) loadError.hidden = true;

  setInteractionEnabled(false);
}

function setReadyState() {
  const modeScreen = document.getElementById("modeScreen");
  const loadingState = document.getElementById("loadingState");
  const loadError = document.getElementById("loadError");

  modeScreen?.setAttribute("aria-busy", "false");
  modeScreen?.setAttribute("data-loading", "false");

  if (loadingState) loadingState.hidden = true;
  if (loadError) loadError.hidden = true;

  setInteractionEnabled(true);
}

function setErrorState(error) {
  const modeScreen = document.getElementById("modeScreen");
  const loadingState = document.getElementById("loadingState");
  const loadError = document.getElementById("loadError");
  const errorMessage = document.getElementById("loadErrorDetails");

  modeScreen?.setAttribute("aria-busy", "false");
  modeScreen?.setAttribute("data-loading", "false");

  if (loadingState) loadingState.hidden = true;
  if (loadError) loadError.hidden = false;

  if (errorMessage) {
    errorMessage.textContent =
      error instanceof Error ? error.message : String(error);
  }

  setInteractionEnabled(false);
}

function bindActions() {
  if (actionsBound) return;
  actionsBound = true;

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    switch (target.dataset.action) {
      case "start-exam":
        startExam(target.dataset.mode);
        break;
      case "start-practice":
        startPractice();
        break;
      case "exit-practice":
        exitPractice();
        break;
      case "speak-practice":
        speakPracticeCurrent();
        break;
      case "practice-previous":
        practicePrevious();
        break;
      case "practice-next":
        practiceNext();
        break;
      case "toggle-mobile-questions":
        toggleMobileQuestions();
        break;
      case "close-mobile-questions":
        closeMobileQuestions();
        break;
      case "show-exit-confirm":
        showExitConfirm();
        break;
      case "hide-exit-confirm":
        hideExitConfirm();
        break;
      case "confirm-exit":
        confirmExitExam();
        break;
      case "speak-exam":
        speakCurrent();
        break;
      case "skip-question":
        skipQuestion();
        break;
      case "submit-answer":
        void submitAnswer();
        break;
      case "clear-handwriting":
        clearHandwriting();
        break;
      case "recognize-handwriting":
        void recognizeHandwriting();
        break;
      case "restart":
        location.reload();
        break;
      case "retry-load":
        void initialize();
        break;
      default:
        break;
    }
  });

  document.addEventListener("keydown", event => {
    const modal = document.getElementById("exitModal");

    if (modal && modal.classList.contains("open")) {
      if (event.key === "Escape") {
        event.preventDefault();
        hideExitConfirm();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = [
        modal.querySelector(".exit-modal-no"),
        modal.querySelector(".exit-modal-yes")
      ].filter(Boolean);

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    const examScreen = document.getElementById("examScreen");
    if (
      event.key === "Escape" &&
      examScreen?.classList.contains("mobile-questions-open")
    ) {
      event.preventDefault();
      closeMobileQuestions();
    }
  });

  const answerInput = document.getElementById("answerInput");
  answerInput?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void submitAnswer();
  });
}

async function initialize() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    bindActions();
    setLoadingState();

    try {
      // Keep non-essential UI initialization from blocking vocabulary loading.
      try {
        renderStats();
      } catch (error) {
        console.warn("Could not render statistics:", error);
      }

      try {
        initializeHandwriting();
      } catch (error) {
        console.warn("Could not initialize handwriting input:", error);
      }

      const vocabulary = await loadVocabulary();
      state.vocabulary = vocabulary;

      const count = document.getElementById("vocabCount");
      if (count) count.textContent = String(vocabulary.length);

      setReadyState();
    } catch (error) {
      console.error("Vocabulary initialization failed:", error);
      state.vocabulary = [];
      setErrorState(error);
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

window.addEventListener("beforeunload", () => {
  stopCurrentAudio();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
});

void initialize();
