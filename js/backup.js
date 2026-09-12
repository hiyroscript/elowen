"use strict";
document.querySelector("#export-data").addEventListener("click", () => {
  const blob = new Blob([ElowenStore.export()], { type: "application/json" });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `elowen-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  ElowenUI.notify(
    "Backup download started. Keep the file somewhere you can find it.",
  );
});
document
  .querySelector("#import-data")
  .addEventListener("click", async (event) => {
    const input = document.querySelector("#import-file"),
      file = input.files[0];
    if (!file) {
      ElowenUI.notify("Choose an Elowen JSON backup first.");
      input.focus();
      return;
    }
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw Error("Backup must be smaller than 2 MB.");
      const data = ElowenStore.parseBackup(await file.text());
      if (
        !(await ElowenUI.confirm(
          "Replace your local data?",
          `This backup will replace your current history, memory, expression, and preferences with ${data.calculator.history.length} saved calculations. Export your current work first if you want to keep it.`,
          "Restore backup",
        ))
      )
        return;
      ElowenStore.replace(data);
      input.value = "";
      ElowenUI.notify(
        ElowenStore.warning()
          ? "Backup loaded for this session. Browser storage is unavailable; keep your backup."
          : "Backup restored. Your work is ready in the calculator.",
      );
    } catch (error) {
      ElowenUI.notify(error.message);
    } finally {
      button.disabled = false;
    }
  });
document.querySelector("#clear-data").addEventListener("click", async () => {
  if (
    await ElowenUI.confirm(
      "Clear all local Elowen data?",
      "This removes your history, memory, current calculation, and preferences from this browser. Downloaded backups are unaffected. This cannot be undone.",
      "Clear local data",
    )
  ) {
    try {
      ElowenStore.clear();
      ElowenUI.notify("Local Elowen data cleared. You have a fresh start.");
    } catch (error) {
      ElowenUI.notify(error.message);
    }
  }
});
