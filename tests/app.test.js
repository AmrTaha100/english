import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import vocabulary from "../data/vocabulary.json" with { type: "json" };

import {
  shuffleArray,
  findNextUnskipped,
  buildQuestions,
  normalizeEnglish,
  normalizeArabic,
  levenshtein,
  analyzeEnglish,
  audioHash
} from "../js/utils.js";

test(
  "vocabulary source contains exactly 57 entries",
  () => {
    assert.equal(
      vocabulary.length,
      57
    );

    assert.equal(
      vocabulary[0].en,
      "compromise"
    );

    assert.equal(
      vocabulary.at(-1).en,
      "order"
    );
  }
);

test(
  "skip navigation resolves one-question and multiple-skipped cases",
  () => {
    const oneQuestion = [{}];

    assert.equal(
      findNextUnskipped(
        oneQuestion,
        [false],
        [true],
        0
      ),
      -1
    );

    const multipleQuestions = [{}, {}, {}];

    assert.equal(
      findNextUnskipped(
        multipleQuestions,
        [false, false, false],
        [true, false, false],
        0
      ),
      1
    );

    assert.equal(
      findNextUnskipped(
        multipleQuestions,
        [false, false, false],
        [true, true, true],
        2
      ),
      -1
    );

    assert.equal(
      findNextUnskipped(
        multipleQuestions,
        [false, true, false],
        [true, false, true],
        2
      ),
      -1
    );
  }
);

test(
  "shuffle preserves every vocabulary item",
  () => {
    const shuffled =
      shuffleArray(
        vocabulary,
        () => 0.5
      );

    assert.equal(
      shuffled.length,
      vocabulary.length
    );

    assert.deepEqual(
      shuffled
        .map(item => item.en)
        .sort(),
      vocabulary
        .map(item => item.en)
        .sort()
    );
  }
);

test(
  "exam modes preserve the full vocabulary",
  () => {
    const arEn =
      buildQuestions(
        vocabulary,
        "ar-en",
        () => 0
      );

    const enAr =
      buildQuestions(
        vocabulary,
        "en-ar",
        () => 0
      );

    assert.equal(
      arEn.length,
      57
    );

    assert.equal(
      enAr.length,
      57
    );

    assert.ok(
      arEn.every(
        q => q.direction === "ar-en"
      )
    );

    assert.ok(
      enAr.every(
        q => q.direction === "en-ar"
      )
    );
  }
);

test(
  "mixed mode splits 57 words into 29 + 28",
  () => {
    const mixed =
      buildQuestions(
        vocabulary,
        "mixed",
        () => 0
      );

    assert.equal(
      mixed.length,
      57
    );

    assert.equal(
      mixed.filter(
        q => q.direction === "ar-en"
      ).length,
      29
    );

    assert.equal(
      mixed.filter(
        q => q.direction === "en-ar"
      ).length,
      28
    );
  }
);

test(
  "normalization handles common formatting differences",
  () => {
    assert.equal(
      normalizeEnglish(
        "  Hello   World  "
      ),
      "hello world"
    );

    assert.equal(
      normalizeArabic(
        "  كَلِمَات   "
      ),
      "كلمات"
    );
  }
);

test(
  "Levenshtein distance handles basic spelling changes",
  () => {
    assert.equal(
      levenshtein(
        "helo",
        "hello"
      ),
      1
    );

    assert.equal(
      levenshtein(
        "hello",
        "hello"
      ),
      0
    );
  }
);

test(
  "English error analyzer detects adjacent swaps",
  () => {
    assert.match(
      analyzeEnglish(
        "hlelo",
        "hello"
      ),
      /متبدلين/
    );
  }
);

test(
  "audio hash is deterministic",
  () => {
    assert.equal(
      audioHash("accompany"),
      audioHash("  Accompany  ")
    );

    assert.notEqual(
      audioHash("accompany"),
      audioHash("amphibious")
    );
  }
);

test(
  "project data file is valid JSON",
  async () => {
    const raw =
      await fs.readFile(
        new URL(
          "../data/vocabulary.json",
          import.meta.url
        ),
        "utf8"
      );

    const parsed =
      JSON.parse(raw);

    assert.equal(
      parsed.length,
      57
    );
  }
);
