const STATS_KEY =
  "vocabularyMasterStats_v1";

export function loadStats() {
  try {
    const saved =
      localStorage.getItem(STATS_KEY);

    if (!saved) {
      return {
        attempts: 0,
        bestPercent: 0,
        averagePercent: 0,
        lastPercent: 0
      };
    }

    const stats =
      JSON.parse(saved);

    return {
      attempts:
        Number(stats.attempts) || 0,
      bestPercent:
        Number(stats.bestPercent) || 0,
      averagePercent:
        Number(stats.averagePercent) || 0,
      lastPercent:
        Number(stats.lastPercent) || 0
    };
  } catch (error) {
    console.warn(
      "Could not load saved statistics:",
      error
    );

    return {
      attempts: 0,
      bestPercent: 0,
      averagePercent: 0,
      lastPercent: 0
    };
  }
}

export function renderStats(
  stats = loadStats()
) {
  const attempts =
    document.getElementById(
      "statAttempts"
    );

  const best =
    document.getElementById(
      "statBest"
    );

  const average =
    document.getElementById(
      "statAverage"
    );

  const last =
    document.getElementById(
      "statLast"
    );

  if (attempts) {
    attempts.textContent =
      stats.attempts;
  }

  if (best) {
    best.textContent =
      stats.bestPercent + "%";
  }

  if (average) {
    average.textContent =
      stats.averagePercent + "%";
  }

  if (last) {
    last.textContent =
      stats.lastPercent + "%";
  }
}

export function saveAttemptStats(
  percent
) {
  const current = loadStats();
  const attempts =
    current.attempts + 1;

  const averagePercent =
    Math.round(
      (
        current.averagePercent *
          current.attempts +
        percent
      ) / attempts
    );

  const updated = {
    attempts,
    bestPercent: Math.max(
      current.bestPercent,
      percent
    ),
    averagePercent,
    lastPercent: percent
  };

  try {
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.warn(
      "Could not save statistics:",
      error
    );
  }

  renderStats(updated);
  return updated;
}
