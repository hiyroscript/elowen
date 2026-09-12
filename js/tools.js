"use strict";
// Keep this registry in sync with the accessible, server-rendered cards in index.html.
const tools = [
  {
    id: "calculator",
    name: "Elowen Calculator",
    description: "Everyday arithmetic and advanced calculations",
    url: "calculator.html",
    icon: "calculator",
    keywords: ["math", "scientific", "numbers", "arithmetic"],
  },
];
const search = document.querySelector("#tool-search");
const clearSearch = document.querySelector("#clear-search");
function filterTools() {
  const query = search.value.trim().toLowerCase();
  let count = 0;
  for (const tool of tools) {
    const match = [tool.name, tool.description, ...tool.keywords]
      .join(" ")
      .toLowerCase()
      .includes(query);
    document.querySelector(`[data-tool="${tool.id}"]`).hidden = !match;
    if (match) count++;
  }
  clearSearch.hidden = !search.value;
  document.querySelector("#tool-count").textContent =
    `${count} ${count === 1 ? "tool" : "tools"}`;
  document.querySelector("#no-tools").hidden = count !== 0;
}
search.addEventListener("input", filterTools);
clearSearch.addEventListener("click", () => {
  search.value = "";
  filterTools();
  search.focus();
});
search.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    search.value = "";
    filterTools();
  }
});
filterTools();
