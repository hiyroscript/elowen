/* Loaded synchronously in the head so the first paint uses the chosen theme. */
(function () {
  "use strict";
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let button;
  function apply() {
    const theme =
      ElowenStore.get().preferences.theme ??
      (system.matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#24211d" : "#eee8de");
    if (button) {
      const action =
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
      button.setAttribute("aria-label", action);
      button.title = action;
    }
  }
  apply();
  system.addEventListener("change", apply);
  window.addEventListener("elowen:restore", apply);
  document.addEventListener("DOMContentLoaded", () => {
    button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    // Fixed local SVG markup, never user or imported content.
    button.innerHTML =
      '<svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg><svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.8 8.8 0 0 1 9.8 3.5a8.8 8.8 0 1 0 10.7 10.7Z"/></svg>';
    button.addEventListener("click", () => {
      ElowenStore.get().preferences.theme =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      apply();
      ElowenStore.save();
    });
    document.querySelector(".site-header nav").append(button);
    apply();
  });
})();
