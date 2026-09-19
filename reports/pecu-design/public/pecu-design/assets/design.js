const feedback = document.querySelector("#design-feedback");
let feedbackTimer;
function announce(text) {
  feedback.textContent = text;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    feedback.textContent = "";
  }, 3500);
}
for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      announce("Copied " + button.dataset.copy);
    } catch {
      announce("Couldn't copy. Select the value below the swatch.");
    }
  });
}
for (const button of document.querySelectorAll("[data-demo]"))
  button.addEventListener("click", () => announce("Sample action completed."));
const search = document.querySelector("#component-search");
search.addEventListener("input", () => {
  let visible = 0;
  for (const row of document.querySelectorAll("[data-search]")) {
    row.hidden = !row.dataset.search
      .toLowerCase()
      .includes(search.value.trim().toLowerCase());
    if (!row.hidden) visible++;
  }
  document.querySelector("#empty-search").hidden = visible !== 0;
});
const states = {
  pending: "Waiting for confirmation",
  executing: "Sample submitted, waiting for receipt",
  succeeded: "Sample completed",
  failed: "Sample failed. Check the status before retrying.",
  cancelled: "Sample cancelled",
  expired: "Sample expired",
};
const state = document.querySelector("#preview-state");
function updatePreview(value) {
  state.value = value;
  document.querySelector(".pecu-confirmation").dataset.state = value;
  document.querySelector("#preview-status").textContent = states[value];
  document.querySelector("#preview-actions").hidden = value !== "pending";
  document.querySelector("#preview-actions").style.setProperty("display", value === "pending" ? "grid" : "none", "important");
}
state.addEventListener("change", () => updatePreview(state.value));
for (const button of document.querySelectorAll("[data-preview]"))
  button.addEventListener("click", () => {
    updatePreview(button.dataset.preview);
    announce("Sample only. Nothing was sent.");
  });
for (const card of document.querySelectorAll("[data-sample-card]")) {
  card.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.closest(".pecu-confirmation-actions")) {
      const cancelled = button.textContent.trim() === "Cancel";
      const value = cancelled ? "cancelled" : "executing";
      card.querySelector(".pecu-confirmation").dataset.state = value;
      card.querySelector(".pecu-confirmation-status").textContent = states[value];
      card.querySelector(".pecu-confirmation-actions").style.setProperty("display", "none", "important");
      if (card.dataset.sampleCard === "swap") state.value = value;
      announce("Sample only. Nothing was sent.");
    } else {
      const value = button.closest("dd")?.querySelector("span")?.textContent ?? `/confirm ${card.querySelector("code").textContent}`;
      try { await navigator.clipboard.writeText(value); announce("Copied sample value."); }
      catch { announce("Couldn't copy the sample value."); }
    }
  });
}
for (const button of document.querySelectorAll(".pecu-thread-open"))
  button.addEventListener("click", () => {
    for (const other of document.querySelectorAll(".pecu-thread-open")) {
      other.setAttribute("aria-pressed", String(other === button));
      other.closest("li").classList.toggle("is-active", other === button);
    }
  });
document
  .querySelector("#sample-composer")
  .addEventListener("submit", (event) => {
    event.preventDefault();
    document.querySelector("#sample-reply").textContent =
      "Sample received. This composer is not connected to Pecu.";
    document.querySelector("#sample-message").value = "";
  });
