const fs = require("fs");
const path = require("path");
const googleTTS = require("@sefinek/google-tts-api");

const ROOT = path.resolve(__dirname, "..");
const VOCAB_FILE = path.join(
  ROOT,
  "data",
  "vocabulary.json"
);
const AUDIO_DIR = path.join(
  ROOT,
  "audio"
);
const AUDIO_VERSION = "v5";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeAudioText(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function audioHash(text) {
  const normalized =
    normalizeAudioText(text) +
    "|en|normal|" +
    AUDIO_VERSION;

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
    (h1 >>> 0)
      .toString(16)
      .padStart(8, "0") +
    (h2 >>> 0)
      .toString(16)
      .padStart(8, "0")
  );
}

function audioFileName(text) {
  return audioHash(text) + ".mp3";
}

function loadVocabulary() {
  const raw =
    fs.readFileSync(
      VOCAB_FILE,
      "utf8"
    );

  const vocabulary =
    JSON.parse(raw);

  if (
    !Array.isArray(vocabulary) ||
    vocabulary.length === 0
  ) {
    throw new Error(
      "Vocabulary must be a non-empty array."
    );
  }

  vocabulary.forEach(
    (item, index) => {
      if (
        !item ||
        typeof item.ar !== "string" ||
        typeof item.en !== "string" ||
        !item.ar.trim() ||
        !item.en.trim()
      ) {
        throw new Error(
          "Invalid vocabulary item at index " +
          index +
          "."
        );
      }
    }
  );

  return vocabulary;
}

async function generateAudio(
  text,
  outputPath
) {
  let lastError = null;

  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {
    try {
      const base64 =
        await googleTTS.getAudioBase64(
          text,
          {
            lang: "en",
            slow: false,
            host:
              process.env.TTS_HOST ||
              "https://translate.google.com",
            timeout: 20000
          }
        );

      const audio =
        Buffer.from(
          base64,
          "base64"
        );

      if (audio.length < 512) {
        throw new Error(
          "TTS returned an unexpectedly small audio payload."
        );
      }

      const tempPath =
        outputPath + ".tmp";

      fs.writeFileSync(
        tempPath,
        audio
      );

      fs.renameSync(
        tempPath,
        outputPath
      );

      return;
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        await sleep(
          500 * attempt
        );
      }
    }
  }

  throw lastError;
}

async function main() {
  const vocabulary =
    loadVocabulary();

  fs.mkdirSync(
    AUDIO_DIR,
    { recursive: true }
  );

  const uniqueEnglishTexts = [
    ...new Map(
      vocabulary.map(item => [
        normalizeAudioText(item.en),
        item.en.trim()
      ])
    ).values()
  ];

  const expectedFiles =
    new Set(
      uniqueEnglishTexts.map(
        audioFileName
      )
    );

  let deleted = 0;
  let reused = 0;
  let generated = 0;

  for (
    const file of
    fs.readdirSync(AUDIO_DIR)
  ) {
    if (
      file
        .toLowerCase()
        .endsWith(".mp3") &&
      !expectedFiles.has(file)
    ) {
      fs.unlinkSync(
        path.join(
          AUDIO_DIR,
          file
        )
      );

      deleted++;
    }
  }

  for (
    let i = 0;
    i < uniqueEnglishTexts.length;
    i++
  ) {
    const text =
      uniqueEnglishTexts[i];

    const file =
      audioFileName(text);

    const outputPath =
      path.join(
        AUDIO_DIR,
        file
      );

    if (
      fs.existsSync(
        outputPath
      ) &&
      fs.statSync(
        outputPath
      ).size >= 512
    ) {
      reused++;

      console.log(
        "[" +
        (i + 1) +
        "/" +
        uniqueEnglishTexts.length +
        "] Reused " +
        file
      );

      continue;
    }

    console.log(
      "[" +
      (i + 1) +
      "/" +
      uniqueEnglishTexts.length +
      "] Generating: " +
      text
    );

    await generateAudio(
      text,
      outputPath
    );

    generated++;

    if (
      i <
      uniqueEnglishTexts.length - 1
    ) {
      await sleep(250);
    }
  }

  console.log("");
  console.log(
    "Audio synchronization complete."
  );
  console.log(
    "Vocabulary items: " +
    vocabulary.length
  );
  console.log(
    "Unique English phrases: " +
    uniqueEnglishTexts.length
  );
  console.log(
    "Reused: " +
    reused
  );
  console.log(
    "Generated: " +
    generated
  );
  console.log(
    "Deleted stale audio: " +
    deleted
  );
}

main().catch(error => {
  console.error("");
  console.error(
    "Audio generation failed:"
  );
  console.error(error);
  process.exitCode = 1;
});
