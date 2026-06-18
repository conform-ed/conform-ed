# conform-ed brand kit

The mark is a checkmark held inside square brackets: `[✓]`. The brackets read as
code, spec sections, and test cases — the things a conformance suite actually
operates on — and the check is the universal signal for _passes / conforms_. The
same check stands in for the hyphen in the wordmark, so `conform✓ed` draws the
name's double meaning: it conforms, it checks out.

The teal check is the one expressive element. Everything else stays in ink and
paper neutrals so the identity reads as precise rather than decorative.

## Files

```
svg/      vector source — scale freely, ship on the docs site
avatar/   square, full-bleed marks for the GitHub org (PNG + SVG)
favicon/  favicon.svg, favicon.ico, sized PNGs, apple-touch-icon
```

Each mark ships in a light variant (for light backgrounds) and a `-dark`
variant (for dark backgrounds), plus a single-colour `-mono` icon.

## Colour

| Token       | Hex       | Use                                  |
| ----------- | --------- | ------------------------------------ |
| ink         | `#0E1726` | brackets, wordmark, dark backgrounds |
| paper       | `#F7FAF9` | marks on dark surfaces               |
| teal        | `#14B8A6` | the check — on light backgrounds     |
| teal-bright | `#2DD4BF` | the check — on dark backgrounds      |
| mute        | `#8A94A0` | secondary text / captions            |

Tokens are provided as `brand-tokens.ts` and `brand-tokens.css`.

## Type

The wordmark is **JetBrains Mono SemiBold**, outlined to paths in the supplied
SVGs so it renders identically without the font installed. For docs-site body
and UI, JetBrains Mono (or any clean monospace) keeps the register consistent.

## Usage

- **GitHub org avatar:** upload `avatar/avatar-dark-512.png` (or the light one).
  GitHub masks the corners, so these are full-bleed squares by design.
- **Favicon / docs site head:**

  ```html
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  ```

- **Header logo:** use a horizontal lockup; switch to the `-dark` variant via
  `prefers-color-scheme`.

### Clear space & minimum size

Keep clear space around any lockup equal to about half the icon's height. The
icon stays legible down to 16px (the favicon is proof). Don't set the wordmark
below ~90px wide.

### Don't

- Recolour the check to anything but the approved teal (or teal-bright on dark).
- Add shadows, gradients, or outlines to the mark.
- Stretch, rotate, or rearrange the icon and wordmark.
- Place the light mark on a dark or busy background — use the `-dark` variant.
- Re-typeset the wordmark in another font; use the outlined SVGs.

## Animated hero, banner & social

```
animated/   conformed-hero.svg, -dark        — mark assembles (check draws in)
animated/   conformed-hero-meme.svg, -dark   — mark assembles, then tagline + rule sweep in
banner/     conformed-readme-banner.svg + .png (+@2x) — top-of-README banner
opengraph/  conformed-og-{meme,checked,proveit}.svg + .png — 1200×630 social cards
```

- **Animated hero** uses CSS keyframes and respects `prefers-reduced-motion`.
  Its resting state is the finished logo, so it still reads where animation is
  unsupported. GitHub strips animation from SVGs in markdown — use this on the
  self-hosted docs site, not in the README.
- **README banner:** embed the PNG (GitHub sanitises SVG); the SVG is the source.
- **OpenGraph (1200×630):** set `og:image` / `twitter:image` to one of the cards.
  Taglines (no enumerated standards list — it would go stale as the suite grows):
  meme: "All your conformance are belong to us",
  checked: "It conforms. We checked.",
  proveit: "Make your LMS prove it."
