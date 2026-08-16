import { extractBeeUi, type UIComponent } from '@beegreat/tool-presentation';

// The beeui contract (schema, parsing, scrubbing) lives in
// @beegreat/tool-presentation so every client shares one vocabulary
// (see packages/agent/src/agents/bee.md for the agent-side prompt).
export { uiComponentSchema, type UIComponent } from '@beegreat/tool-presentation';

/** Splits agent text into the spoken/displayed sentence and validated UI components. */
export function extractBeeUI(text: string): {
  spoken: string;
  components: UIComponent[];
} {
  const { spoken, components } = extractBeeUi(text);
  // The mobile app is BeeGreat itself: skip cards this build cannot render yet.
  return {
    spoken,
    components: components.filter(
      (component): component is UIComponent => component.type !== 'unsupported',
    ),
  };
}
