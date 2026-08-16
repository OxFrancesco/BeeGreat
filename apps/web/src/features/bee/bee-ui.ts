import {
  extractBeeUi,
  type UIComponent,
} from '@beegreat/tool-presentation'

// The beeui contract (schema, parsing, scrubbing) lives in
// @beegreat/tool-presentation so every client shares one vocabulary.
export {
  endOfLocalDay,
  firstFocusPreviewSchema,
  formatHighlightExpiry,
  uiComponentSchema,
  type FirstFocusPreview,
  type UIComponent,
} from '@beegreat/tool-presentation'

/** Splits Bee's response into conversational copy and validated web UI. */
export function extractBeeUI(text: string): {
  spoken: string
  components: Array<UIComponent>
} {
  const { spoken, components } = extractBeeUi(text)
  // The web app is BeeGreat itself: skip cards this build cannot render yet.
  return {
    spoken,
    components: components.filter(
      (component): component is UIComponent => component.type !== 'unsupported',
    ),
  }
}
