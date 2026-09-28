import {
  getGeneratedAudioUrl
} from "./utils.js";

let currentAudio = null;
let availableVoices = [];

function updateSpeakerState(
  speaker,
  speaking
) {
  if (!speaker) return;

  speaker.classList.toggle(
    "speaking",
    speaking
  );

  speaker.setAttribute(
    "aria-label",
    speaking
      ? "إيقاف النطق"
      : "تشغيل النطق الإنجليزي"
  );

  speaker.setAttribute(
    "aria-pressed",
    speaking ? "true" : "false"
  );
}

export function stopCurrentAudio() {
  if (currentAudio) {
    const audio = currentAudio;
    currentAudio = null;

    // Detach handlers before clearing the source.
    // Clearing src can fire "error" and must not trigger TTS fallback
    // when the stop was intentional (for example, while changing questions).
    audio.onplay = null;
    audio.onended = null;
    audio.onerror = null;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    } catch (error) {
      console.warn(
        "Could not stop generated audio:",
        error
      );
    }
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  updateSpeakerState(
    document.getElementById("speakerBtn"),
    false
  );

  updateSpeakerState(
    document.getElementById("practiceSpeakerBtn"),
    false
  );
}

function loadSpeechVoices() {
  if (!("speechSynthesis" in window)) {
    availableVoices = [];
    return [];
  }

  availableVoices =
    window.speechSynthesis.getVoices() || [];

  return availableVoices;
}

if ("speechSynthesis" in window) {
  loadSpeechVoices();

  window.speechSynthesis.addEventListener(
    "voiceschanged",
    loadSpeechVoices
  );
}

function getEnglishVoice() {
  const voices =
    availableVoices.length
      ? availableVoices
      : loadSpeechVoices();

  if (!voices.length) return null;

  return (
    voices.find(voice =>
      voice.default &&
      /^en(-|_)/i.test(
        voice.lang || ""
      )
    ) ||
    voices.find(voice =>
      /^en-US$/i.test(
        voice.lang || ""
      )
    ) ||
    voices.find(voice =>
      /^en-GB$/i.test(
        voice.lang || ""
      )
    ) ||
    voices.find(voice =>
      /^en/i.test(
        voice.lang || ""
      )
    ) ||
    null
  );
}

function speakWithNativeFallback(
  text,
  speaker
) {
  if (
    !("speechSynthesis" in window) ||
    !("SpeechSynthesisUtterance" in window)
  ) {
    updateSpeakerState(
      speaker,
      false
    );

    alert(
      "الصوت الجاهز مش متاح حاليًا، والمتصفح كمان لا يدعم النطق الصوتي."
    );

    return;
  }

  const synth =
    window.speechSynthesis;

  synth.cancel();
  synth.resume();
  loadSpeechVoices();

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang = "en-US";
  utterance.rate = 0.78;
  utterance.pitch = 1;

  const voice = getEnglishVoice();

  if (voice) {
    utterance.voice = voice;
    utterance.lang =
      voice.lang || "en-US";
  }

  utterance.onstart =
    () =>
      updateSpeakerState(
        speaker,
        true
      );

  utterance.onend =
    () =>
      updateSpeakerState(
        speaker,
        false
      );

  utterance.onerror =
    event => {
      console.warn(
        "Native speech fallback error:",
        event?.error || "unknown"
      );

      updateSpeakerState(
        speaker,
        false
      );
    };

  try {
    synth.speak(utterance);
  } catch (error) {
    console.warn(
      "Native speech fallback failed:",
      error
    );

    updateSpeakerState(
      speaker,
      false
    );
  }
}

export function speakText(
  text,
  speaker
) {
  if (!text || !speaker) return;

  if (currentAudio) {
    stopCurrentAudio();
    return;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  updateSpeakerState(
    speaker,
    true
  );

  const audio =
    new Audio(
      getGeneratedAudioUrl(text)
    );

  audio.preload = "auto";
  currentAudio = audio;

  let fallbackStarted = false;

  const cleanup = () => {
    if (currentAudio === audio) {
      currentAudio = null;
    }

    updateSpeakerState(
      speaker,
      false
    );
  };

  const fallback = () => {
    if (fallbackStarted) return;

    fallbackStarted = true;
    cleanup();

    console.warn(
      "Generated audio unavailable; using native TTS fallback."
    );

    speakWithNativeFallback(
      text,
      speaker
    );
  };

  audio.onplay =
    () =>
      updateSpeakerState(
        speaker,
        true
      );

  audio.onended = cleanup;
  audio.onerror = fallback;

  try {
    const playResult =
      audio.play();

    if (
      playResult &&
      typeof playResult.catch ===
        "function"
    ) {
      playResult.catch(fallback);
    }
  } catch (error) {
    console.warn(
      "Generated audio play failed:",
      error
    );

    fallback();
  }
}

export function setSpeakerVisibility(
  visible
) {
  const speaker =
    document.getElementById(
      "speakerBtn"
    );

  if (!speaker) return;

  speaker.hidden = !visible;

  speaker.setAttribute(
    "aria-hidden",
    visible ? "false" : "true"
  );

  speaker.tabIndex =
    visible ? 0 : -1;

  if (!visible) {
    stopCurrentAudio();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}
