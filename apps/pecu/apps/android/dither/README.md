# Dither Kit for Kotlin

A native Android / Jetpack Compose port of Dither Kit 0.1.0. It draws Android
bitmaps and Compose controls without a WebView, JavaScript runtime, or chart
service. Add `implementation(project(":dither"))` from Pecu's Android build.
Minimum Android API is 26. The standalone release artifact is
`dither/build/outputs/aar/dither-release.aar`.

> This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.

## Use

Give every chart a bounded size. Data is immutable, keyed by unique series names.
Keep quantities as decimals in the application and convert only chart coordinates
to `Double`. A null or non-finite value is unavailable, not a fabricated zero in
the tooltip. Missing points do not paint a value.

```kotlin
val state = rememberChartState()
val series = listOf(
  Area("stocks", "Stocks", DitherColor.Orange),
  Area("tokens", "Tokens", DitherColor.Blue, AreaVariant.Hatched),
)
AreaChart(
  data = listOf(
    ChartRow("Mon", mapOf("stocks" to 12.0, "tokens" to 8.0)),
    ChartRow("Tue", mapOf("stocks" to 18.0, "tokens" to 11.0)),
  ),
  series = series,
  modifier = Modifier.fillMaxWidth().height(220.dp),
  options = ChartOptions(stackType = StackType.Stacked),
  state = state,
  description = "Portfolio value over time",
)
Legend(series, state = state)
```

Use `LineChart`, `BarChart` or `RadarChart` with the same rows and series.
`PieChart` takes `List<PieDatum>` and `Pie(innerRadius = .6)` for a donut.
`Sparkline` takes a plain `List<Double>`. The module also exports `DitherAvatar`,
`DitherButton`, and `DitherGradient`.

## Port coverage

| Upstream files / features | Kotlin implementation |
| --- | --- |
| area, line, bar, pie, radar and sparkline roots | `Charts.kt` |
| contexts, config, series registration | Typed `ChartRow`, `Series`, `PieDatum`, `ChartOptions`, `ChartState` |
| palette, gradient/dotted/hatched/solid textures | `ChartModel.kt`, `DitherPainter.kt` |
| default, stacked, percent bands; signed values | `Geometry.kt` |
| point/band scales, nice domains, ticks, resampling | `Geometry.kt` |
| polar angles, donut hole, radar polygons and hit testing | `Geometry.kt`, `ChartGeometry` |
| grid, axes, reference lines, dot/active dot, stroke variants | Typed options and native Compose draw layer |
| selection, hover focus, controlled crosshair | `ChartState`, `markerIndex`, callbacks, touch scrub and mouse input |
| tooltip formatters and selected-series dimming | `Legend.kt` |
| legend and block legend | Wrapping Compose rows with keyboard focus and accessible toggle state |
| entrance, replay, hover lift, pie pop and sparkles | Lifecycle-aware Compose animations; reduced-motion support |
| low/high/aura/custom bloom and three blend modes | `BloomPainter.kt` with bounded separable blur |
| deterministic avatars, hue and mirror overrides | `PixelComponents.kt` |
| dither button, enabled/pressed/hover state | `PixelComponents.kt` |
| four-direction gradients, transparent/two-color ramps | `PixelComponents.kt` |
| registry CLI, React hooks, CSS className | Replaced by Gradle, Compose state and `Modifier`; no JavaScript tooling ships |

## Native choices

The rendering formulas, colors, stack calculations and deterministic seeds follow
the pinned source in `SOURCE.json`. Native layout adapts to density and font scale;
this is not a byte-for-byte browser screenshot renderer. Axis labels fit the
available width and legends occupy document flow rather than obscuring the plot.
Touch selects a point and keeps its tooltip visible; swipe horizontally to scrub,
and use the legend to select or clear a series. Keyboard arrows and TalkBack
custom actions step through values. Escape or the clear action resets selection.

Tooltips use a native overlay. `FrostedGlass` uses a translucent Material surface
rather than a CSS backdrop filter. Bloom uses three bounded box-blur passes
instead of a browser Gaussian filter. These differences are explicit platform
adaptations. Financial screens default to no entrance animation; set `animate`,
`animationDuration` and `replayToken` to enable the upstream sweep/grow recipes.
Android's animation setting and `reducedMotion` disable movement. Sparkles animate
only during active pointer interaction or explicit `hovered` input, and stop when
the host lifecycle is not started. A retained touch marker does not run a timer.

Chart buffers are capped at 520 by 200 cells, independent of screen density.
Geometry and buffers are retained between frames. Idle charts reuse their bitmap;
bloom buffers are allocated only when enabled. No GPU renderer or network calls
are required. Host test timings do not establish phone frame rate or battery use.

## Verify

From the repository root, regenerate upstream vectors after `codeview setup dither-kit`:

```sh
bun apps/pecu/apps/android/dither/scripts/upstream-fixtures.mjs
```

From `apps/pecu/apps/android`:

```sh
./gradlew :dither:testDebugUnitTest :app:testDebugUnitTest \
  :app:lintDebug :dither:lintDebug :dither:assembleRelease :app:assembleBenchmark
```

The vectors come from the upstream TypeScript geometry, random generator and
canvas painter. Native tests compare those values, draw every chart/texture,
exercise touch and accessibility controls, and capture phone/tablet and light/dark
renders. Native graphics tests run through Robolectric, not a physical Fold.
Licensing and source attribution ship in both the AAR and consuming APK assets.
