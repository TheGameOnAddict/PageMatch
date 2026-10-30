# PageMatch

[Open PageMatch on iPhone](https://thegameonaddict.github.io/PageMatch/)

A browser-local catalog scanner with two screens. **Setup** holds your PDF library and an empty space reserved for future QR/report formulas. Swipe left (or tap **Scan pages**) to open the camera. The top selector defaults to **All catalogs** and can restrict matching to an individual catalog. The shutter captures and recognizes in one step. Results open expanded; swipe down to minimize, tap the handle or swipe up to expand again, and use **Retake** to return to the camera. Photos and manual page-ID entry remain available.

## iPhone setup

1. Open the link in Safari while online. Wait for **Offline ready**; the first download includes the OCR model and engine.
2. Share → Add to Home Screen → Add. Open PageMatch from its icon.
3. On Setup, tap **Add PDF** and import your catalog from Files. Wait for indexing. PDFs and indexes stay on this device; storage may differ between Safari and Home Screen apps.
4. Swipe left or tap **Scan pages**. Allow camera access. Keep the page upright and fully in frame, with its header and bottom-center printed ID readable. Choose a specific catalog at the top if desired; the default searches all catalogs.
5. Tap the bottom shutter to capture and recognize. If the live camera is unavailable, use **Photos** or tap the shutter to choose/take a photo through the native picker.
6. The result sheet opens expanded with a match banner and PDF preview. Expand the banner to see the matching evidence. Check the catalog revision and page. Tap **Retake** for another capture. Swipe right or tap the top-left arrow to return to Setup.
7. For the supplied local test catalog, `1H18` should open physical PDF page **190 of 389**. This repository does not contain that catalog.
8. To check offline use, wait for Offline ready, enable airplane mode, close/reopen the installed app, then try lookup and OCR. Keep the original PDF in Files. iOS may evict local storage under space pressure.

## Matching and privacy

Header OCR compares model identifiers and distinguishing words against actual candidate PDF page headings to separate catalogs sharing a printed ID. Generic manufacturer/document words cannot identify a catalog. Unclear headings get a focused second OCR pass. Same-model revisions, duplicate page IDs and approximate matches require confirmation. Existing imports continue working without re-importing.

PDFs must have selectable text and supported bottom-center IDs such as `1H18`. Scanned-only PDF indexing, perspective correction, QR generation and report formulas are not implemented. The formulas panel is a placeholder only.

PDF bytes, camera/photo pixels, extracted text, OCR and indexes stay in the browser. There is no upload endpoint, analytics or remote AI. Runtime libraries, workers, WASM and language data are served from the app's own origin and cached for offline use. The camera stays ready behind captured results for seamless retakes, and stops when returning to Setup or backgrounding the app. A retake holds the captured image until decoded live frames have stable dimensions; the result sheet slides down as the feed resumes. Local catalogs are not encrypted by this app. Never commit private catalogs, photos or test renders to this repository.

## Development and deployment

Use Node 22 or newer. Run `npm ci`, `npm run check`, `npm test`, `npm run build`, then `npm run preview`. Preview: `http://127.0.0.1:4173/PageMatch/`. The build copies all runtime assets into `dist`; asset hashes invalidate stale offline caches.

Push source to `main`; `.github/workflows/pages.yml` checks, tests, builds and deploys through GitHub Actions. Keep `.local`, `dist`, `node_modules`, PDFs and archives out of Git. `ui.js` handles screen navigation and sheet gestures; `main.js` handles local storage, capture, OCR and previews. Desktop alternatives: navigation buttons, Alt+Right/Alt+Left, sheet toggle button, Escape to minimize/close.

Tests cover page matching, catalog disambiguation and gesture thresholds. Browser checks use local PDF-render fixtures and synthetic competing catalogs. Physical iPhone camera permissions, touch feel and airplane-mode behavior still require device testing.

## Refreshing the app

While online, use **Refresh app** at the bottom of Setup, or open https://thegameonaddict.github.io/PageMatch/?v=0.9.0. This refreshes the application without clearing catalog PDFs or indexes. Each release uses matching versioned scripts, styles and OCR asset paths. Online page navigation checks the server first; offline navigation, including version-query URLs, falls back to the cached app. Do not clear Safari website data to update: that can delete your local catalogs.

## Guided pattern setup (v0.9.0)

Tap **Set up patterns**. Choose a catalog and two different physical PDF pages with comparable tables, or let the app find two table pages. Two printed IDs that refer to the same PDF page do not count as two examples.

In the full-screen trainer, tap a suggested column or pieces on the PDF. Zoom in for small text. Tap additional examples in the same column to widen the capture area, including indented values. For a touching value like 41-35, open **Select only part**, tap the first and last character, and use that selection. Name the pattern, inspect all captured values, and confirm on both pages. Changing the selection or filtering resets both confirmations. **Remove unwanted values** keeps the existing example refinement controls available. Keep the pattern, then repeat for other fields.

Select patterns that belong together and tap **Group selected patterns**. Give the group a name and choose the pattern that starts it, either when its value changes or each time a value appears. Additional groups nest inside earlier groups. Choose the row-start pattern (for example, Part number) and preview both pages. Choose which fields appear in each row. Save only becomes useful after every pattern has passed both page confirmations; publication also enforces this in the data layer. Unsaved work remains in memory while the app stays open, and is lost on reload.

New checked sets can be reopened from Setup or **Arrange or refine** below a matched page. Earlier pattern sets remain available through their existing editor; no migration or deletion is required. A new set is separate from existing sets, so both will appear until you choose to change the older set. Existing sets retain their previous single-page behavior.

Selections learn horizontal text areas inside matching table columns. Character positions within PDF text runs are estimated; inspect the highlights and captured values, especially with proportional fonts, changing indentation, or a different layout. Two examples improve checking but do not guarantee every later page. Pages with no matching table produce a missing-pattern result. This is local layout and example learning, not remote AI training. Camera matching still identifies the source PDF page; values come from that PDF's selectable text. Scanned-only PDFs, photo highlight alignment, QR generation, reports and exports remain future work.

Groups join values by their physical row positions. Blank group markers carry forward within the current page; groups never carry from a previous page. Excluded rows do not shift neighboring values. Before relying on a result, check the source page and the grouped preview.
