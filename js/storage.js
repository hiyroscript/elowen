(function (root) {
  "use strict";
  const KEY = "elowen.data.v1";
  const defaults = () => ({
    calculator: { expression: "", result: null, memory: null, history: [] },
    preferences: { angle: "deg", scientific: false, theme: null },
  });
  const numberOrNull = (value) =>
    value === null || (typeof value === "number" && Number.isFinite(value));
  function validate(data) {
    const c = data?.calculator,
      p = data?.preferences;
    if (
      !c ||
      !p ||
      typeof c.expression !== "string" ||
      c.expression.length > 2000 ||
      !numberOrNull(c.result) ||
      !numberOrNull(c.memory) ||
      !Array.isArray(c.history) ||
      c.history.length > 500 ||
      !["deg", "rad"].includes(p.angle) ||
      typeof p.scientific !== "boolean" ||
      (p.theme !== undefined &&
        p.theme !== null &&
        !["light", "dark"].includes(p.theme))
    )
      throw Error("This backup contains invalid Elowen data.");
    const history = c.history.map((item) => {
      if (
        !item ||
        typeof item.expression !== "string" ||
        item.expression.length > 2000 ||
        typeof item.result !== "number" ||
        !Number.isFinite(item.result) ||
        !["deg", "rad"].includes(item.angle)
      )
        throw Error("This backup contains invalid history.");
      return {
        expression: item.expression,
        result: item.result,
        angle: item.angle,
      };
    });
    return {
      calculator: {
        expression: c.expression,
        result: c.result,
        memory: c.memory,
        history,
      },
      preferences: {
        angle: p.angle,
        scientific: p.scientific,
        theme: p.theme ?? null,
      },
    };
  }
  function parseBackup(text) {
    if (text.length > 2 * 1024 * 1024)
      throw Error("Backup must be smaller than 2 MB.");
    let backup;
    try {
      backup = JSON.parse(text);
    } catch {
      throw Error("Choose a valid JSON backup file.");
    }
    if (
      backup?.format !== "elowen-backup" ||
      backup.version !== 1 ||
      typeof backup.exportedAt !== "string" ||
      !Number.isFinite(Date.parse(backup.exportedAt))
    )
      throw Error("This is not a supported Elowen backup (version 1).");
    return validate(backup.data);
  }
  let state = defaults(),
    warning = "";
  try {
    const saved = root.localStorage?.getItem(KEY);
    if (saved) state = validate(JSON.parse(saved));
  } catch {
    warning =
      "Saved data could not be loaded. You can still calculate; export a backup to keep your work.";
  }
  function persist() {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(state));
      warning = "";
    } catch {
      warning =
        "Browser storage is unavailable or full. Export a backup to keep this session’s work.";
    }
    if (root.dispatchEvent)
      root.dispatchEvent(
        new CustomEvent("elowen:storage", { detail: warning }),
      );
  }
  const api = {
    defaults,
    validate,
    parseBackup,
    get: () => state,
    warning: () => warning,
    save: persist,
    replace: (data) => {
      state = validate(data);
      persist();
      root.dispatchEvent?.(new Event("elowen:restore"));
    },
    clear: () => {
      try {
        root.localStorage.removeItem(KEY);
      } catch {
        throw Error(
          "Browser storage could not be cleared. Try clearing this site’s data in your browser settings.",
        );
      }
      state = defaults();
      warning = "";
      root.dispatchEvent?.(new Event("elowen:restore"));
      root.dispatchEvent?.(new CustomEvent("elowen:storage", { detail: "" }));
    },
    export: () =>
      JSON.stringify(
        {
          format: "elowen-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          data: state,
        },
        null,
        2,
      ),
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ElowenStore = api;
})(globalThis);
