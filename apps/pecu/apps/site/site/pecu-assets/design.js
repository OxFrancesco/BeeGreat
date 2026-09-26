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
const state = document.querySelector("#preview-state");
const planState = document.querySelector("#plan-state");
const offscreen = typeof IntersectionObserver === "undefined"
  ? undefined
  : new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.toggleAttribute("data-offscreen", !entry.isIntersecting);
  });
function watchPlans(root) {
  for (const plan of root.querySelectorAll(".pecu-plan")) offscreen?.observe(plan);
}
function updatePreview(card, value) {
  const template = card.querySelector(`template[data-preview-state="${value}"]`);
  card.querySelector("[data-sample-content]").replaceChildren(template.content.cloneNode(true));
  if (card.dataset.sampleCard === "swap") state.value = value;
  if (card.dataset.sampleCard === "pool" && planState) planState.value = value;
  watchPlans(card);
}
state.addEventListener("change", () =>
  updatePreview(document.querySelector('[data-sample-card="swap"]'), state.value),
);
planState?.addEventListener("change", () =>
  updatePreview(document.querySelector('[data-sample-card="pool"]'), planState.value),
);
watchPlans(document);
// Pointing at a transaction highlights the edges it moves, as in the Agent.
function highlight(step, index) {
  const plan = step.closest(".pecu-plan");
  for (const item of plan.querySelectorAll("[data-step]")) item.toggleAttribute("data-active", index !== undefined && item.dataset.step === index);
}
document.addEventListener("pointerover", (event) => {
  const step = event.target.closest?.(".pecu-plan-step");
  if (step) highlight(step, step.dataset.step);
});
document.addEventListener("pointerout", (event) => {
  const step = event.target.closest?.(".pecu-plan-step");
  if (step && !step.contains(event.relatedTarget)) highlight(step, undefined);
});
for (const card of document.querySelectorAll("[data-sample-card]")) {
  card.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.closest(".pecu-confirmation-actions")) {
      const currentState = card.querySelector(".pecu-confirmation").dataset.state;
      const value = button.textContent.trim() === "Cancel"
        ? "cancelled"
        : currentState === "executing" ? "succeeded" : "executing";
      updatePreview(card, value);
      announce("Sample only. Nothing was sent.");
    } else {
      const value = button.closest("dd")?.querySelector(".pecu-expand-address")?.getAttribute("aria-label")
        ?? button.closest("dd")?.querySelector("span")?.textContent
        ?? button.closest(".pecu-plan-step-meta")?.querySelector(".pecu-expand-address")?.getAttribute("aria-label")
        ?? button.closest(".pecu-plan-step-meta")?.querySelector("[title]")?.title
        ?? `/confirm ${card.querySelector("code").textContent}`;
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
