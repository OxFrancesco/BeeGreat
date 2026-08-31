import 'react'

// The design system drives themed visuals (comb progress, mood colors, mind
// hex grids, shimmer spread) through CSS custom properties set from inline
// styles. React's CSSProperties does not know about `--*` keys, so declare
// them once here instead of asserting at every style object.
declare module 'react' {
  interface CSSProperties {
    [customProperty: `--${string}`]: string | number | undefined
  }
}
