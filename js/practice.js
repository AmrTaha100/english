import { state } from "./state.js";
import {
  setSpeakerVisibility,
  speakText,
  stopCurrentAudio
} from "./audio.js";

function getElements() {
  return {
    modeScreen:
      document.getElementById("modeScreen"),
    examScreen:
      document.getElementById("examScreen"),
    resultsScreen:
      document.getElementById(
        "resultsScreen"
      ),
    practiceScreen:
      document.getElementById(
        "practiceScreen"
      ),
    practiceArabic:
      document.getElementById(
        "practiceArabic"
      ),
    practiceEnglish:
      document.getElementById(
        "practiceEnglish"
      ),
    practiceProgress:
      document.getElementById(
        "practiceProgress"
      )
  };
}

export function startPractice() {
  if (!state.vocabulary.length) {
    alert(
      "لسه الكلمات بتتحمل، جرّب تاني بعد لحظة."
    );
    return;
  }

  stopCurrentAudio();

  state.mode = null;
  state.questions = [];
  state.currentIndex = 0;
  state.answered = [];
  state.results = [];
  state.practiceIndex = 0;

  setSpeakerVisibility(false);

  const el = getElements();

  el.modeScreen.style.display = "none";
  el.examScreen.style.display = "none";
  el.resultsScreen.style.display = "none";
  el.practiceScreen.style.display = "block";

  showPracticeWord();
}

export function exitPractice() {
  stopCurrentAudio();

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  const el = getElements();

  el.practiceScreen.style.display = "none";
  el.resultsScreen.style.display = "none";
  el.examScreen.style.display = "none";
  el.modeScreen.style.display = "flex";

  state.practiceIndex = 0;

  el.modeScreen
    .querySelector('[data-action="start-exam"]')
    ?.focus();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

export function showPracticeWord() {
  stopCurrentAudio();

  const item =
    state.vocabulary[
      state.practiceIndex
    ];

  if (!item) return;

  const el = getElements();

  el.practiceArabic.textContent =
    item.ar;

  el.practiceEnglish.textContent =
    item.en;

  el.practiceProgress.textContent =
    (state.practiceIndex + 1) +
    " / " +
    state.vocabulary.length;
}

export function practicePrevious() {
  if (!state.vocabulary.length) {
    return;
  }

  state.practiceIndex =
    state.practiceIndex <= 0
      ? state.vocabulary.length - 1
      : state.practiceIndex - 1;

  showPracticeWord();
}

export function practiceNext() {
  if (!state.vocabulary.length) {
    return;
  }

  state.practiceIndex =
    state.practiceIndex >=
    state.vocabulary.length - 1
      ? 0
      : state.practiceIndex + 1;

  showPracticeWord();
}

export function speakPracticeCurrent() {
  const item =
    state.vocabulary[
      state.practiceIndex
    ];

  if (!item) return;

  speakText(
    item.en,
    document.getElementById(
      "practiceSpeakerBtn"
    )
  );
}
