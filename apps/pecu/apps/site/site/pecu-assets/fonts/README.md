# Pecu website fonts

These WOFF2 subsets come from `apps/pecu/theme/fonts/inter.ttf` and
`jetbrains-mono.ttf`. Their OFL licenses are included beside the files.
The family names and weight ranges match the existing theme. The subset covers
Latin, punctuation, currency signs, arrows and mathematical symbols. Other glyphs
use the theme's fallback fonts.

Regenerate with fontTools and Brotli:

```sh
pyftsubset apps/pecu/theme/fonts/inter.ttf --output-file=apps/pecu/apps/site/site/pecu-assets/fonts/inter.woff2 --flavor=woff2 --unicodes='U+0000-024F,U+2000-206F,U+20A0-20CF,U+2190-22FF,U+FE00-FE0F,U+FF00-FFEF' --layout-features='*'
pyftsubset apps/pecu/theme/fonts/jetbrains-mono.ttf --output-file=apps/pecu/apps/site/site/pecu-assets/fonts/jetbrains-mono.woff2 --flavor=woff2 --unicodes='U+0000-024F,U+2000-206F,U+20A0-20CF,U+2190-22FF,U+FE00-FE0F,U+FF00-FFEF' --layout-features='*'
```

This is an independent project and is not affiliated with, endorsed by, sponsored
by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow
Protocol. References describe compatibility or source attribution only. All
trademarks belong to their respective owners.
