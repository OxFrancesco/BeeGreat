import { Composition } from "remotion";
import { Explainer } from "./Explainer";
import { DURATION, FPS, HEIGHT, WIDTH } from "./timeline";

export function Root() {
  return (
    <Composition
      id="PecuExplainer"
      component={Explainer}
      durationInFrames={Math.round(DURATION * FPS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
}
