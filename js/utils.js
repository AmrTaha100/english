export function shuffleArray(array, random = Math.random) {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] =
      [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function buildQuestions(
  vocabulary,
  mode,
  random = Math.random
) {
  const shuffledVocabulary =
    shuffleArray(vocabulary, random);

  if (mode === "ar-en") {
    return shuffledVocabulary.map(item => ({
      ...item,
      direction: "ar-en"
    }));
  }

  if (mode === "en-ar") {
    return shuffledVocabulary.map(item => ({
      ...item,
      direction: "en-ar"
    }));
  }

  const splitIndex =
    Math.ceil(shuffledVocabulary.length / 2);

  const arEn =
    shuffledVocabulary
      .slice(0, splitIndex)
      .map(item => ({
        ...item,
        direction: "ar-en"
      }));

  const enAr =
    shuffledVocabulary
      .slice(splitIndex)
      .map(item => ({
        ...item,
        direction: "en-ar"
      }));

  return shuffleArray(
    [...arEn, ...enAr],
    random
  );
}

export function normalizeEnglish(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeArabic(text) {
  return String(text)
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ");
}

export function alignEnglish(user, correct) {
  const rows = correct.length + 1;
  const cols = user.length + 1;

  const matrix =
    Array.from(
      { length: rows },
      () => Array(cols).fill(0)
    );

  for (let i = 0; i < rows; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j < cols; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const substitution =
        matrix[i - 1][j - 1] +
        (correct[i - 1] === user[j - 1] ? 0 : 1);

      const insertion =
        matrix[i][j - 1] + 1;

      const deletion =
        matrix[i - 1][j] + 1;

      matrix[i][j] =
        Math.min(
          substitution,
          insertion,
          deletion
        );
    }
  }

  const operations = [];
  let i = correct.length;
  let j = user.length;

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      correct[i - 1] === user[j - 1] &&
      matrix[i][j] ===
        matrix[i - 1][j - 1]
    ) {
      i--;
      j--;
      continue;
    }

    if (
      i > 0 &&
      j > 0 &&
      matrix[i][j] ===
        matrix[i - 1][j - 1] + 1
    ) {
      operations.unshift({
        type: "wrong",
        user: user[j - 1],
        correct: correct[i - 1]
      });

      i--;
      j--;
      continue;
    }

    if (
      j > 0 &&
      matrix[i][j] ===
        matrix[i][j - 1] + 1
    ) {
      operations.unshift({
        type: "extra",
        user: user[j - 1]
      });

      j--;
      continue;
    }

    operations.unshift({
      type: "missing",
      correct: correct[i - 1]
    });

    i--;
  }

  return operations;
}

export function levenshtein(a, b) {
  const matrix =
    Array.from(
      { length: b.length + 1 },
      () => Array(a.length + 1).fill(0)
    );

  for (let i = 0; i <= b.length; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] =
          matrix[i - 1][j - 1];
      } else {
        matrix[i][j] =
          Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + 1
          );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function analyzeEnglish(user, correct) {
  const u =
    normalizeEnglish(user).replace(/\s/g, "");

  const c =
    normalizeEnglish(correct).replace(/\s/g, "");

  if (u === c) {
    return "الإجابة صحيحة تمامًا.";
  }

  if (u.length === c.length) {
    for (let i = 0; i < c.length - 1; i++) {
      if (
        u[i] === c[i + 1] &&
        u[i + 1] === c[i]
      ) {
        let sameBefore = true;
        let sameAfter = true;

        for (let j = 0; j < i; j++) {
          if (u[j] !== c[j]) {
            sameBefore = false;
            break;
          }
        }

        for (let j = i + 2; j < c.length; j++) {
          if (u[j] !== c[j]) {
            sameAfter = false;
            break;
          }
        }

        if (sameBefore && sameAfter) {
          return (
            `🔄 حرفين متبدلين في الترتيب: "${u[i]}${u[i + 1]}" بدل "${c[i]}${c[i + 1]}".`
          );
        }
      }
    }
  }

  const alignment =
    alignEnglish(u, c);

  const missing = [];
  const extra = [];
  const wrong = [];

  alignment.forEach(op => {
    if (op.type === "missing") {
      missing.push(op.correct);
    } else if (op.type === "extra") {
      extra.push(op.user);
    } else if (op.type === "wrong") {
      wrong.push(
        `"${op.user}"→"${op.correct}"`
      );
    }
  });

  const distance =
    levenshtein(u, c);

  const parts = [
    `❌ فيه ${distance} تعديل${distance === 1 ? "" : "ات"} تقريبًا.`
  ];

  if (missing.length) {
    parts.push(
      `➕ حروف ناقصة: ${[...new Set(missing)].join(", ")}.`
    );
  }

  if (extra.length) {
    parts.push(
      `➖ حروف زيادة: ${[...new Set(extra)].join(", ")}.`
    );
  }

  if (wrong.length) {
    parts.push(
      `🔤 حروف مكتوبة غلط: ${wrong.join("، ")}.`
    );
  }

  if (!missing.length && !extra.length && !wrong.length) {
    parts.push("راجع ترتيب الحروف والتهجئة.");
  }

  return parts.join("\n");
}

export function normalizeAudioText(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function audioHash(text) {
  const normalized =
    normalizeAudioText(text) +
    "|en|normal|v5";

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;

  for (let i = 0; i < normalized.length; i++) {
    const code =
      normalized.charCodeAt(i);

    h1 = Math.imul(
      h1 ^ code,
      0x01000193
    );

    h2 = Math.imul(
      h2 ^ (code + i + 1),
      0x85ebca6b
    );
  }

  h1 = Math.imul(
    h1 ^ (h1 >>> 16),
    0x7feb352d
  );

  h1 = Math.imul(
    h1 ^ (h1 >>> 15),
    0x846ca68b
  );

  h2 = Math.imul(
    h2 ^ (h2 >>> 16),
    0x7feb352d
  );

  h2 = Math.imul(
    h2 ^ (h2 >>> 15),
    0x846ca68b
  );

  return (
    (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0")
  );
}

export function getGeneratedAudioUrl(text) {
  return "audio/" +
    audioHash(text) +
    ".mp3";
}
