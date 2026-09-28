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

function bindActions() {
  document.addEventListener(
    "click",
    event => {
      const target =
        event.target.closest(
          "[data-action]"
        );

      if (!target) return;

      switch (target.dataset.action) {
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
  } catch (error) {
    console.error(error);

    const count =
      document.getElementById(
        "vocabCount"
      );

    if (count) {
      count.textContent = "!";
      count.title =
        "تعذر تحميل قائمة الكلمات.";
    }

    alert(
      "حصلت مشكلة في تحميل الكلمات. راجع الاتصال وحاول تحديث الصفحة."
    );
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
