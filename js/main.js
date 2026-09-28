import { state } from "./state.js";
import { loadVocabulary } from "./data.js";
import {
  startExam,
  submitAnswer,
  skipQuestion,
  showExitConfirm,
  hideExitConfirm,
  confirmExitExam,
  speakCurrent
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

let actionsBound = false;

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
  const modeScreen =
    document.getElementById("modeScreen");

  const loadingState =
    document.getElementById("loadingState");

  const loadError =
    document.getElementById("loadError");

  modeScreen?.setAttribute(
    "aria-busy",
    "true"
  );
  modeScreen?.setAttribute(
    "data-loading",
    "true"
  );

  if (loadingState) {
    loadingState.hidden = false;
  }

  if (loadError) {
    loadError.hidden = true;
  }

  setInteractionEnabled(false);
}

function setReadyState() {
  const modeScreen =
    document.getElementById("modeScreen");

  const loadingState =
    document.getElementById("loadingState");

  const loadError =
    document.getElementById("loadError");

  modeScreen?.setAttribute(
    "aria-busy",
    "false"
  );
  modeScreen?.setAttribute(
    "data-loading",
    "false"
  );

  if (loadingState) {
    loadingState.hidden = true;
  }

  if (loadError) {
    loadError.hidden = true;
  }

  setInteractionEnabled(true);
}

function setErrorState() {
  const modeScreen =
    document.getElementById("modeScreen");

  const loadingState =
    document.getElementById("loadingState");

  const loadError =
    document.getElementById("loadError");

  modeScreen?.setAttribute(
    "aria-busy",
    "false"
  );
  modeScreen?.setAttribute(
    "data-loading",
    "false"
  );

  if (loadingState) {
    loadingState.hidden = true;
  }

  if (loadError) {
    loadError.hidden = false;
  }

  setInteractionEnabled(false);
}

function bindActions() {
  if (actionsBound) return;

  actionsBound = true;

  document.addEventListener(
    "click",
    event => {
      const target =
        event.target.closest(
          "[data-action]"
        );

      if (!target) return;

      const action =
        target.dataset.action;

      switch (action) {
        case "start-exam":
          startExam(
            target.dataset.mode
          );
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
          submitAnswer();
          break;

        case "restart":
          location.reload();
          break;

        case "retry-load":
          initialize();
          break;

        default:
          break;
      }
    }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape") {
        return;
      }

      const modal =
        document.getElementById(
          "exitModal"
        );

      if (
        modal &&
        modal.classList.contains("open")
      ) {
        hideExitConfirm();
      }
    }
  );

  const answerInput =
    document.getElementById(
      "answerInput"
    );

  if (answerInput) {
    answerInput.addEventListener(
      "keydown",
      event => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        submitAnswer();
      }
    );
  }
}

async function initialize() {
  bindActions();
  renderStats();
  setLoadingState();

  try {
    state.vocabulary =
      await loadVocabulary();

    const count =
      document.getElementById(
        "vocabCount"
      );

    if (count) {
      count.textContent =
        state.vocabulary.length;
    }

    setReadyState();
  } catch (error) {
    console.error(
      "Vocabulary initialization failed:",
      error
    );

    state.vocabulary = [];
    setErrorState();
  }
}

window.addEventListener(
  "beforeunload",
  () => {
    stopCurrentAudio();

    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
  }
);

initialize();
