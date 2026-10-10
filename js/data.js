const VOCABULARY_URL = new URL("../data/vocabulary.json", import.meta.url);

function validateVocabulary(vocabulary) {
  if (!Array.isArray(vocabulary) || vocabulary.length === 0) {
    throw new Error("Vocabulary must be a non-empty array.");
  }

  vocabulary.forEach((item, index) => {
    if (
      !item ||
      typeof item.ar !== "string" ||
      typeof item.en !== "string" ||
      !item.ar.trim() ||
      !item.en.trim()
    ) {
      throw new Error(
        "Invalid vocabulary item at index " + index + "."
      );
    }
  });

  return vocabulary;
}

export async function loadVocabulary() {
  let response;

  try {
    response = await fetch(VOCABULARY_URL, {
      cache: "no-store"
    });
  } catch (cause) {
    throw new Error(
      "Network error while loading vocabulary from " + VOCABULARY_URL.href,
      { cause }
    );
  }

  if (!response.ok) {
    throw new Error(
      "Could not load vocabulary.json (HTTP " +
      response.status +
      ") from " +
      VOCABULARY_URL.href
    );
  }

  let vocabulary;

  try {
    vocabulary = await response.json();
  } catch (cause) {
    throw new Error("Vocabulary file is not valid JSON.", { cause });
  }

  return validateVocabulary(vocabulary);
}
