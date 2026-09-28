import { state } from "./state.js";
import {
  buildQuestions,
  normalizeEnglish,
  normalizeArabic,
  analyzeEnglish
} from "./utils.js";
import {
  setSpeakerVisibility,
  speakText,
  stopCurrentAudio
} from "./audio.js";
import { saveAttemptStats } from "./stats.js";

let lastFocusedElement = null;

function getElements() {
  return {
    modeScreen:
      document.getElementById("modeScreen"),
    examScreen:
      document.getElementById("examScreen"),
    resultsScreen:
      document.getElementById("resultsScreen"),
    questionText:
      document.getElementById("questionText"),
    answerInput:
      document.getElementById("answerInput"),
    questionGrid:
      document.getElementById("questionGrid"),
    progressText:
      document.getElementById("progressText"),
    sideCounter:
      document.getElementById("sideCounter"),
    modeBadge:
      document.getElementById("modeBadge")
  };
}

function ensureVocabulary() {
  if (state.vocabulary.length) {
    return true;
  }

  alert(
    "لسه الكلمات بتتحمل، جرّب تاني بعد لحظة."
  );

  return false;
}

export function startExam(selectedMode) {
  if (!ensureVocabulary()) return;

  if (
    !["ar-en", "en-ar", "mixed"]
      .includes(selectedMode)
  ) {
    return;
  }

  state.mode = selectedMode;
  state.currentIndex = 0;
  state.answered = [];
  state.results = [];
  state.questions =
    buildQuestions(
      state.vocabulary,
      selectedMode
    );

  state.answered =
    new Array(state.questions.length)
      .fill(false);

  setSpeakerVisibility(false);

  const el = getElements();

  el.modeScreen.style.display = "none";
  el.examScreen.style.display = "block";
  el.resultsScreen.style.display = "none";

  // On phones, the home screen may have been scrolled down to the mode card.
  // Start the exam from the top instead of inheriting that scroll position.
  if (window.innerWidth <= 900) {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto"
    });
  }

  createQuestionGrid();
  showQuestion();
}

export function showExitConfirm() {
  const modal =
    document.getElementById("exitModal");

  if (!modal) return;

  lastFocusedElement = document.activeElement;
  modal.classList.add("open");
  modal.setAttribute(
    "aria-hidden",
    "false"
  );
  document.body.classList.add("modal-open");

  const noButton =
    modal.querySelector(
      ".exit-modal-no"
    );

  if (noButton) {
    setTimeout(
      () => noButton.focus(),
      30
    );
  }
}

export function hideExitConfirm(
  restoreFocus = true
) {
  const modal =
    document.getElementById("exitModal");

  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute(
    "aria-hidden",
    "true"
  );
  document.body.classList.remove("modal-open");

  if (
    restoreFocus &&
    lastFocusedElement &&
    typeof lastFocusedElement.focus === "function"
  ) {
    lastFocusedElement.focus();
  }

  lastFocusedElement = null;
}

export function confirmExitExam() {
  setSpeakerVisibility(false);
  hideExitConfirm(false);

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  state.mode = null;
  state.questions = [];
  state.currentIndex = 0;
  state.answered = [];
  state.results = [];

  const el = getElements();

  el.examScreen.style.display = "none";
  el.resultsScreen.style.display = "none";
  el.modeScreen.style.display = "flex";

  el.modeScreen
    .querySelector('[data-action="start-exam"]')
    ?.focus();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

export function createQuestionGrid() {
  const el = getElements();
  el.questionGrid.innerHTML = "";

  state.questions.forEach((_, index) => {
    const btn =
      document.createElement("button");

    btn.type = "button";
    btn.className = "q-number";
    btn.textContent = index + 1;

    btn.addEventListener(
      "click",
      () => {
        if (!state.answered[index]) {
          return;
        }

        state.currentIndex = index;
        showQuestion();
      }
    );

    el.questionGrid.appendChild(btn);
  });
}

export function showQuestion() {
  stopCurrentAudio();

  const q =
    state.questions[state.currentIndex];

  if (!q) return;

  const el = getElements();

  [...el.questionGrid.children]
    .forEach((node, index) => {
      node.classList.toggle(
        "current",
        index === state.currentIndex
      );

      if (
        index === state.currentIndex &&
        window.innerWidth <= 850
      ) {
        const grid = el.questionGrid;
        const targetLeft =
          node.offsetLeft -
          (grid.clientWidth - node.offsetWidth) / 2;

        grid.scrollTo({
          left: Math.max(0, targetLeft),
          behavior: "smooth"
        });
      }
    });

  el.progressText.textContent =
    "السؤال " +
    (state.currentIndex + 1) +
    " من " +
    state.questions.length;

  el.sideCounter.textContent =
    (state.currentIndex + 1) +
    " / " +
    state.questions.length;

  if (q.direction === "ar-en") {
    el.modeBadge.textContent =
      "🧠 عربي → إنجليزي";

    el.questionText.textContent =
      q.ar;

    el.questionText.classList.remove(
      "english"
    );

    el.answerInput.classList.add(
      "english-input"
    );

    el.answerInput.dir = "ltr";
    el.answerInput.lang = "en";
    el.answerInput.placeholder =
      "اكتب الترجمة بالإنجليزي...";
  } else {
    el.modeBadge.textContent =
      "🇬🇧 إنجليزي → عربي";

    el.questionText.textContent =
      q.en;

    el.questionText.classList.add(
      "english"
    );

    el.answerInput.classList.remove(
      "english-input"
    );

    el.answerInput.dir = "rtl";
    el.answerInput.lang = "ar";
    el.answerInput.placeholder =
      "اكتب الترجمة بالعربي...";
  }

  el.answerInput.enterKeyHint = "done";
  el.answerInput.inputMode = "text";
  el.answerInput.value = "";

  // Do not auto-focus text inputs on phones.
  // Mobile browsers may scroll/resize the viewport to reveal a focused
  // input and that can hide the question as soon as the exam starts.
  if (window.innerWidth > 900) {
    el.answerInput.focus();
  }
}

function findNextUnanswered() {
  if (!state.questions.length) {
    return -1;
  }

  for (
    let offset = 1;
    offset <= state.questions.length;
    offset++
  ) {
    const index =
      (
        state.currentIndex +
        offset
      ) % state.questions.length;

    if (!state.answered[index]) {
      return index;
    }
  }

  return -1;
}

export function submitAnswer() {
  const q =
    state.questions[state.currentIndex];

  if (!q) return;

  const el = getElements();
  const userAnswer =
    el.answerInput.value.trim();

  if (!userAnswer) {
    el.answerInput.focus();
    return;
  }

  const correctAnswer =
    q.direction === "ar-en"
      ? q.en
      : q.ar;

  const correct =
    q.direction === "ar-en"
      ? normalizeEnglish(userAnswer) ===
        normalizeEnglish(correctAnswer)
      : normalizeArabic(userAnswer) ===
        normalizeArabic(correctAnswer);

  state.results[state.currentIndex] = {
    ...q,
    userAnswer,
    correctAnswer,
    correct
  };

  state.answered[state.currentIndex] =
    true;

  updateQuestionStatus(
    state.currentIndex,
    correct
  );

  const next = findNextUnanswered();

  if (next === -1) {
    finishExam();
    return;
  }

  state.currentIndex = next;
  showQuestion();
}

export function skipQuestion() {
  if (!state.questions.length) {
    return;
  }

  const next = findNextUnanswered();

  if (next !== -1) {
    state.currentIndex = next;
    showQuestion();
  }
}

function updateQuestionStatus(
  index,
  correct
) {
  const node =
    getElements()
      .questionGrid.children[index];

  if (!node) return;

  node.classList.remove(
    "current",
    "correct",
    "wrong"
  );

  node.classList.add(
    correct ? "correct" : "wrong"
  );
}

function renderResults() {
  const container =
    document.getElementById(
      "resultList"
    );

  if (!container) return;

  container.innerHTML = "";

  state.results.forEach(
    (result, index) => {
      if (!result) return;

      const item =
        document.createElement("div");

      item.className =
        "result-item " +
        (
          result.correct
            ? "correct"
            : "wrong"
        );

      const word =
        document.createElement("div");

      word.className =
        "result-word";

      word.textContent =
        (index + 1) +
        ". " +
        (
          result.direction === "ar-en"
            ? result.ar
            : result.en
        );

      const answer =
        document.createElement("div");

      answer.className =
        "result-answer";

      const userLabel =
        document.createTextNode(
          "إجابتك: "
        );

      const userValue =
        document.createElement("b");

      userValue.dir =
        result.direction === "ar-en"
          ? "ltr"
          : "rtl";

      userValue.textContent =
        result.userAnswer ||
        "لم تتم الإجابة";

      const correctLabel =
        document.createTextNode(
          "الإجابة الصحيحة: "
        );

      const correctValue =
        document.createElement("b");

      correctValue.dir =
        result.direction === "ar-en"
          ? "ltr"
          : "rtl";

      correctValue.textContent =
        result.correctAnswer;

      answer.appendChild(userLabel);
      answer.appendChild(userValue);
      answer.appendChild(
        document.createElement("br")
      );
      answer.appendChild(
        correctLabel
      );
      answer.appendChild(correctValue);

      item.appendChild(word);
      item.appendChild(answer);

      if (
        !result.correct &&
        result.direction === "ar-en"
      ) {
        const analysis =
          document.createElement(
            "div"
          );

        analysis.className =
          "error-analysis";

        analysis.style.whiteSpace =
          "pre-line";

        analysis.textContent =
          analyzeEnglish(
            result.userAnswer,
            result.correctAnswer
          );

        item.appendChild(analysis);
      }

      container.appendChild(item);
    }
  );
}

function renderDirectionScores(
  arEnCorrect,
  arEnTotal,
  enArCorrect,
  enArTotal
) {
  const container =
    document.getElementById(
      "directionScores"
    );

  if (!container) return;

  if (state.mode !== "mixed") {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="direction-card">
      <h3>🧠 عربي → إنجليزي</h3>
      <div class="direction-score">
        ${arEnCorrect} / ${arEnTotal}
      </div>
    </div>
    <div class="direction-card">
      <h3>🇬🇧 إنجليزي → عربي</h3>
      <div class="direction-score">
        ${enArCorrect} / ${enArTotal}
      </div>
    </div>
  `;
}

export function finishExam() {
  stopCurrentAudio();
  setSpeakerVisibility(false);

  const el = getElements();

  el.examScreen.style.display = "none";
  el.resultsScreen.style.display = "block";

  let totalCorrect = 0;
  let arEnCorrect = 0;
  let arEnTotal = 0;
  let enArCorrect = 0;
  let enArTotal = 0;

  state.results.forEach(result => {
    if (!result) return;

    if (result.correct) {
      totalCorrect++;
    }

    if (result.direction === "ar-en") {
      arEnTotal++;

      if (result.correct) {
        arEnCorrect++;
      }
    } else {
      enArTotal++;

      if (result.correct) {
        enArCorrect++;
      }
    }
  });

  const total =
    state.questions.length;

  const percent =
    total
      ? Math.round(
          (totalCorrect / total) * 100
        )
      : 0;

  saveAttemptStats(percent);

  document.getElementById(
    "finalScore"
  ).textContent =
    totalCorrect + " / " + total;

  document.getElementById(
    "finalPercent"
  ).textContent =
    percent + "%";

  renderDirectionScores(
    arEnCorrect,
    arEnTotal,
    enArCorrect,
    enArTotal
  );

  renderResults();

  document
    .querySelector('[data-action="restart"]')
    ?.focus();
}

export function speakCurrent() {
  const q =
    state.questions[state.currentIndex];

  if (!q) return;

  speakText(
    q.en,
    document.getElementById(
      "speakerBtn"
    )
  );
}
