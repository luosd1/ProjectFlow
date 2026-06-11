# ProjectFlow Logo Design

Date: 2026-06-11
Status: Integrated into frontend

## Goal

Create a black ProjectFlow brand system that feels closer to experimental monochrome wordmarks than SaaS app icons. The system should express flow through custom letterform rhythm, contour repetition, and a square icon that works for favicon/app-icon use.

## Approved Direction

Primary direction: black experimental wordmark plus square outline icon.

The logo should behave more like the reference sheet provided by the user: bold black type, compact marks, custom letter construction, and a stronger editorial/design-studio feel. The selected wordmark uses `FLOW` as the dominant contour form and `PROJECT` as a sparse support label. The selected icon uses a dark front `F` with layered offset contours transitioning into a lighter `P`.

## Visual Constraints

- Use black on white for the exploration. No blue.
- SVG source files should use `currentColor` so the default renders black while staying themeable.
- Prefer custom wordmark structure over generic app-icon symbols.
- Keep enough bold mass for small-size use, but optimize this set for brand feel first.
- Avoid water-wave, liquid blob, generic AI sparkle, or dense node-network aesthetics.
- Avoid gradients in the base SVG assets.
- Avoid loose pipe-like strokes, speech-bubble silhouettes, wrench/tool silhouettes, generic data-stream icons, beverage-like wave marks, and blue SaaS icon styling.

## Wordmark Variant Set

Generated six focused lockup variants based on the selected contour `FLOW` treatment:

1. PROJECT Above: solid `PROJECT` above contour `FLOW`.
2. PROJECT Below: solid `PROJECT` below contour `FLOW`.
3. Side Label: vertical solid `PROJECT` beside contour `FLOW`.
4. Solid Tab: solid black `PROJECT` tab above contour `FLOW`.
5. Sparse PROJECT: spaced solid `PROJECT` above contour `FLOW`.
6. Tucked Below: solid `PROJECT` tucked under contour `FLOW`.

## Final Selection

Selected final wordmark: variant 5, Sparse PROJECT.

Canonical asset: `frontend/public/brand/projectflow-logo-final.svg`.

The selected wordmark keeps `FLOW` as the dominant experimental contour wordmark and uses `PROJECT` as smaller solid support type.

Selected final icon: 03 Tall Bridge.

Canonical icon asset: `frontend/public/brand/projectflow-icon-final.svg`.

The selected icon keeps a black outline-box feeling, with `F` in the foreground and a smoother multi-layer transition into a lighter `P` behind it.

## Frontend Integration

- `frontend/public/favicon.svg` now uses the selected square icon.
- `frontend/src/app/layout.tsx` exposes the SVG favicon, PNG app icon, and Apple touch icon metadata.
- `frontend/src/components/brand-logo.tsx` provides the reusable wordmark/icon component.
- `frontend/src/components/app-shell.tsx` uses the final wordmark in desktop and mobile navigation.
- `frontend/src/components/projectflow-home.tsx` uses the final wordmark and icon in the landing page and product preview.

## Deliverables

- Final selected SVG: `frontend/public/brand/projectflow-logo-final.svg`.
- Final selected icon SVG: `frontend/public/brand/projectflow-icon-final.svg`.
- PNG exports:
  - `frontend/public/brand/projectflow-logo-final-2304x1024.png`
  - `frontend/public/brand/projectflow-icon-final-1024.png`
- Final brand presentation page: `frontend/public/brand/projectflow-brand-showcase.html`.
- Final generated showcase PNGs under `frontend/public/brand/showcase/`.

Old exploratory variants and temporary comparison pages were removed after final integration.

## Verification

- SVG assets are valid XML.
- Final SVG assets rely on `currentColor` for fills and strokes.
- The frontend metadata includes the new favicon and app icon.
- `npm run lint` passes with two pre-existing warnings.
- `npm run build` passes.
- Playwright verified desktop navigation, mobile navigation, homepage hero, rendered logo dimensions, and icon metadata links.
