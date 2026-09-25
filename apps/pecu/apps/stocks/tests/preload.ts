import { Window } from "happy-dom";

// Radix chooses its browser effects when imported, before per-test hooks run.
const window = new Window({ url: "https://pecu.app/agent" });
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
