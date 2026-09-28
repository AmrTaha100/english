const VOCABULARY_URL = "./data/vocabulary.json";

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
  const response = await fetch(
    VOCABULARY_URL,
    { cache: "no-cache" }
  );

  if (!response.ok) {
    throw new Error(
      "Could not load vocabulary.json (HTTP " +
      response.status +
      ")."
    );
  }

  return validateVocabulary(
    await response.json()
  );
}
