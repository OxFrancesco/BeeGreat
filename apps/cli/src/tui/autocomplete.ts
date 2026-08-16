import type { BoxRenderable, TextRenderable } from "@opentui/core";

import { type BeeCommand, commandSuggestions } from "./commands";
import { palette } from "./theme";

type InputBridge = {
  getValue(): string;
  setValue(value: string): void;
};

/** Owns the slash-command suggestion state and its dropdown rendering. */
export function createAutocomplete(
  box: BoxRenderable,
  rows: TextRenderable[],
  input: InputBridge,
) {
  let suggestions: BeeCommand[] = [];
  let selectedSuggestion = 0;

  function render() {
    box.visible = suggestions.length > 0;
    rows.forEach((row, index) => {
      const suggestion = suggestions[index];
      row.visible = suggestion !== undefined;
      if (!suggestion) return;
      const selected = index === selectedSuggestion;
      row.content = `${selected ? "›" : " "} ${suggestion.name.padEnd(9)} ${suggestion.description}`;
      row.fg = selected ? palette.honeyInk : palette.inkSoft;
      row.bg = selected ? palette.honeySurface : palette.surfaceMuted;
    });
  }

  function update() {
    suggestions = commandSuggestions(input.getValue());
    selectedSuggestion = 0;
    render();
  }

  function hide() {
    suggestions = [];
    selectedSuggestion = 0;
    render();
  }

  function complete() {
    const suggestion = suggestions[selectedSuggestion];
    if (!suggestion) return false;
    input.setValue(suggestion.name);
    hide();
    return true;
  }

  function move(direction: -1 | 1) {
    selectedSuggestion =
      (selectedSuggestion + direction + suggestions.length) %
      suggestions.length;
    render();
  }

  return {
    update,
    hide,
    complete,
    move,
    get active() {
      return suggestions.length > 0;
    },
    get firstName() {
      return suggestions[0]?.name;
    },
  };
}
