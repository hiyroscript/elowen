"use strict";
window.ElowenUI = {
  notify(message) {
    const notice = document.querySelector("#notice");
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      notice.hidden = true;
    }, 7000);
  },
  confirm(title, description, action = "Continue") {
    const dialog = document.querySelector("#confirm-dialog");
    document.querySelector("#confirm-title").textContent = title;
    document.querySelector("#confirm-description").textContent = description;
    dialog.querySelector('[value="confirm"]').textContent = action;
    dialog.returnValue = "";
    dialog.showModal();
    return new Promise((resolve) =>
      dialog.addEventListener(
        "close",
        () => resolve(dialog.returnValue === "confirm"),
        { once: true },
      ),
    );
  },
};
function showStorageWarning(message) {
  const warning = document.querySelector("#storage-warning");
  warning.textContent = message;
  warning.hidden = !message;
}
showStorageWarning(ElowenStore.warning());
window.addEventListener("elowen:storage", (event) =>
  showStorageWarning(event.detail),
);
if (
  "serviceWorker" in navigator &&
  ["https:", "http:"].includes(location.protocol)
) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // Offline support is optional; the website still works without it.
    }),
  );
}
