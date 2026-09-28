import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import vocabulary from "../data/vocabulary.json" with { type: "json" };

import {
  shuffleArray,
  buildQuestions,
  normalizeEnglish,
  normalizeArabic,
  levenshtein,
  analyzeEnglish,
  audioHash
} from "../js/utils.js";

test(
  "vocabulary source contains exactly 38 entries",
  () => {
    assert.equal(
      vocabulary.length,
      38
    );

    assert.equal(
      vocabulary[0].en,
      "accompany"
    );

    assert.equal(
      vocabulary.at(-1).en,
      "dominant"
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
      38
    );

    assert.equal(
      enAr.length,
      38
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
  "mixed mode splits 38 words into 19 + 19",
  () => {
    const mixed =
      buildQuestions(
        vocabulary,
        "mixed",
        () => 0
      );

    assert.equal(
      mixed.length,
      38
    );

    assert.equal(
      mixed.filter(
        q => q.direction === "ar-en"
      ).length,
      19
    );

    assert.equal(
      mixed.filter(
        q => q.direction === "en-ar"
      ).length,
      19
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
      38
    );
  }
);
