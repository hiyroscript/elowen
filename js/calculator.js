"use strict";
const expression = document.querySelector("#expression");
const result = document.querySelector("#result");
const errorBox = document.querySelector("#calc-error");
const angle = document.querySelector("#angle");
const scientific = document.querySelector("#scientific");
let completed = false;
const current = () => ElowenStore.get().calculator;
function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
  expression.removeAttribute("aria-invalid");
}
function fail(error) {
  errorBox.textContent = error.message;
  errorBox.hidden = false;
  expression.setAttribute("aria-invalid", "true");
}
function saveExpression() {
  current().expression = expression.value;
  ElowenStore.save();
}
function drawMemory() {
  const memory = current().memory;
  document.querySelector("#memory-status").textContent =
    memory === null ? "Memory empty" : `M · ${ElowenMath.format(memory)}`;
  document.querySelector('[data-memory="MR"]').disabled = memory === null;
  document.querySelector('[data-memory="MC"]').disabled = memory === null;
}
function drawHistory() {
  const list = document.querySelector("#history-list");
  list.replaceChildren();
  document.querySelector("#history-empty").hidden =
    current().history.length > 0;
  document.querySelector("#clear-history").disabled = !current().history.length;
  current().history.forEach((item) => {
    const li = document.createElement("li"),
      button = document.createElement("button");
    const exp = document.createElement("span"),
      value = document.createElement("span"),
      mode = document.createElement("small");
    exp.className = "history-expression";
    exp.textContent = item.expression;
    value.className = "history-result";
    value.textContent = "= " + ElowenMath.format(item.result);
    mode.textContent = item.angle.toUpperCase();
    button.setAttribute(
      "aria-label",
      `Reuse result ${ElowenMath.format(item.result)} from ${item.expression}`,
    );
    button.append(exp, value, mode);
    li.append(button);
    list.append(li);
    button.addEventListener("click", () => {
      expression.value = String(item.result);
      current().result = item.result;
      result.textContent = ElowenMath.format(item.result);
      completed = true;
      clearError();
      saveExpression();
      expression.focus();
      expression.setSelectionRange(
        expression.value.length,
        expression.value.length,
      );
    });
  });
}
function restore() {
  expression.value = current().expression;
  result.textContent =
    current().result === null ? "0" : ElowenMath.format(current().result);
  angle.value = ElowenStore.get().preferences.angle;
  scientific.open = ElowenStore.get().preferences.scientific;
  completed = current().result !== null;
  clearError();
  drawMemory();
  drawHistory();
}
function evaluate() {
  try {
    const value = ElowenMath.calculate(expression.value, angle.value);
    current().result = value;
    current().expression = expression.value;
    current().history.unshift({
      expression: expression.value,
      result: value,
      angle: angle.value,
    });
    current().history = current().history.slice(0, 500);
    result.textContent = ElowenMath.format(value);
    completed = true;
    clearError();
    ElowenStore.save();
    drawHistory();
  } catch (error) {
    completed = false;
    fail(error);
  }
}
function edited() {
  clearError();
  completed = false;
  current().result = null;
  result.textContent = "—";
  saveExpression();
}
function replaceRange(
  text,
  start = expression.selectionStart,
  end = expression.selectionEnd,
) {
  if (expression.value.length - (end - start) + text.length > 2000) {
    fail(Error("Expression is too long."));
    return;
  }
  expression.setRangeText(text, start, end, "end");
  edited();
}
function insert(key) {
  clearError();
  if (key === "equals") {
    evaluate();
    return;
  }
  if (key === "clear") {
    expression.value = "";
    current().result = null;
    result.textContent = "0";
    completed = false;
    saveExpression();
    return;
  }
  const start = expression.selectionStart,
    end = expression.selectionEnd,
    selected = expression.value.slice(start, end);
  if (key === "backspace") {
    replaceRange("", start === end ? Math.max(0, start - 1) : start, end);
    return;
  }
  if (key === "entry") {
    if (selected) replaceRange("");
    else {
      const match = expression.value
        .slice(0, start)
        .match(/(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$|[a-zA-Z]+$|.$/);
      replaceRange("", start - (match?.[0].length || 0), start);
    }
    return;
  }
  if (key === "sign" || key === "reciprocal" || key === "^2") {
    const value =
      selected ||
      (completed ? String(current().result) : expression.value) ||
      "0";
    replaceRange(
      key === "sign"
        ? `-(${value})`
        : key === "^2"
          ? `(${value})^2`
          : `1/(${value})`,
      selected ? start : 0,
      selected ? end : expression.value.length,
    );
    return;
  }
  const isFunction = /[a-z]+\($/.test(key);
  if (isFunction && (selected || completed)) {
    const value = selected || String(current().result);
    replaceRange(
      key + value + ")",
      selected ? start : 0,
      selected ? end : expression.value.length,
    );
    return;
  }
  if (completed) {
    if (/^[+\-*/^!%]/.test(key))
      expression.value =
        current().result < 0
          ? `(${current().result})`
          : String(current().result);
    else expression.value = "";
    expression.setSelectionRange(
      expression.value.length,
      expression.value.length,
    );
  }
  replaceRange(key);
}
// Preserve the expression cursor for mouse/touch controls while retaining keyboard focus.
for (const button of document.querySelectorAll("[data-key], [data-memory]")) {
  button.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") event.preventDefault();
  });
}
document
  .querySelectorAll("[data-key]")
  .forEach((button) =>
    button.addEventListener("click", () => insert(button.dataset.key)),
  );
expression.addEventListener("input", edited);
angle.addEventListener("change", () => {
  ElowenStore.get().preferences.angle = angle.value;
  edited();
});
scientific.addEventListener("toggle", () => {
  ElowenStore.get().preferences.scientific = scientific.open;
  ElowenStore.save();
});
document.querySelectorAll("[data-memory]").forEach((button) =>
  button.addEventListener("click", () => {
    try {
      const action = button.dataset.memory;
      if (action === "MC") current().memory = null;
      else if (action === "MR") {
        insert(`(${String(current().memory)})`);
        return;
      } else {
        const value =
          completed && current().result !== null
            ? current().result
            : ElowenMath.calculate(expression.value, angle.value);
        const memory =
          action === "MS"
            ? value
            : (current().memory ?? 0) + (action === "M-" ? -value : value);
        if (!Number.isFinite(memory))
          throw Error("Memory value is outside the supported range.");
        current().memory = memory;
      }
      clearError();
      drawMemory();
      ElowenStore.save();
      ElowenUI.notify(
        current().memory === null
          ? "Memory cleared."
          : `Memory: ${ElowenMath.format(current().memory)}`,
      );
    } catch (error) {
      fail(error);
    }
  }),
);
document.querySelector("#clear-history").addEventListener("click", async () => {
  if (
    await ElowenUI.confirm(
      "Clear calculation history?",
      "This removes all calculation history in this browser. Your current calculation and memory will stay.",
      "Clear history",
    )
  ) {
    current().history = [];
    ElowenStore.save();
    drawHistory();
    ElowenUI.notify("Calculation history cleared.");
  }
});
document.addEventListener("keydown", (event) => {
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.isComposing ||
    document.querySelector("dialog[open]")
  )
    return;
  const target = event.target;
  if (
    target !== expression &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  )
    return;
  if (event.key === "Escape") {
    event.preventDefault();
    insert("clear");
    return;
  }
  if (
    event.key === "=" ||
    (event.key === "Enter" &&
      (target === expression || !target.closest("button, a, summary")))
  ) {
    event.preventDefault();
    evaluate();
    return;
  }
  if (target === expression) return;
  if (/^[0-9.+\-*/^()%!]$/.test(event.key)) {
    event.preventDefault();
    insert(event.key);
  } else if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    insert("backspace");
  }
});
window.addEventListener("elowen:restore", restore);
restore();
