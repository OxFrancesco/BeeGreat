import { loadFont } from "@remotion/fonts";
import inter from "../../../theme/fonts/inter.ttf";
import jetbrainsMono from "../../../theme/fonts/jetbrains-mono.ttf";

/** The theme's bundled Inter and JetBrains Mono. `loadFont` holds rendering until both are ready. */
export const fontsLoaded = Promise.all([
  loadFont({ family: "Inter", url: inter, weight: "100 900" }),
  loadFont({ family: "JetBrains Mono", url: jetbrainsMono, weight: "100 800" }),
]);
