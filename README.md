# PageMatch

[Open PageMatch on iPhone](https://thegameonaddict.github.io/PageMatch/)

A browser-local catalog scanner with two screens. **Setup** holds your PDF library and an empty space reserved for future QR/report formulas. Swipe left (or tap **Scan pages**) to open the camera. The top selector defaults to **All catalogs** and can restrict matching to an individual catalog. The shutter captures and recognizes in one step. Results slide up over the lower half of the camera; tap the handle or swipe up to expand, swipe down to minimize, and use **Retake** to return to the camera. Photos and manual page-ID entry remain available.

## iPhone setup

1. Open the link in Safari while online. Wait for **Offline ready**; the first download includes the OCR model and engine.
2. Share → Add to Home Screen → Add. Open PageMatch from its icon.
3. On Setup, tap **Add PDF** and import your catalog from Files. Wait for indexing. PDFs and indexes stay on this device; storage may differ between Safari and Home Screen apps.
4. Swipe left or tap **Scan pages**. Allow camera access. Keep the page upright and fully in frame, with its header and bottom-center printed ID readable. Choose a specific catalog at the top if desired; the default searches all catalogs.
5. Tap the bottom shutter to capture and recognize. If the live camera is unavailable, use **Photos** or tap the shutter to choose/take a photo through the native picker.
6. The result sheet opens halfway up. Tap its heading or swipe up to see the PDF preview and manual correction. Check the catalog revision and page. Tap **Retake** for another capture. Swipe right or tap the top-left arrow to return to Setup.
7. For the supplied local test catalog, `1H18` should open physical PDF page **190 of 389**. This repository does not contain that catalog.
8. To check offline use, wait for Offline ready, enable airplane mode, close/reopen the installed app, then try lookup and OCR. Keep the original PDF in Files. iOS may evict local storage under space pressure.

## Matching and privacy

Header OCR compares model identifiers and distinguishing words against actual candidate PDF page headings to separate catalogs sharing a printed ID. Generic manufacturer/document words cannot identify a catalog. Unclear headings get a focused second OCR pass. Same-model revisions, duplicate page IDs and approximate matches require confirmation. Existing imports continue working without re-importing.

PDFs must have selectable text and supported bottom-center IDs such as `1H18`. Scanned-only PDF indexing, perspective correction, variable training, QR generation and report formulas are not implemented. The formulas panel is a placeholder only.

PDF bytes, camera/photo pixels, extracted text, OCR and indexes stay in the browser. There is no upload endpoint, analytics or remote AI. Runtime libraries, workers, WASM and language data are served from the app's own origin and cached for offline use. The camera stays ready behind captured results for seamless retakes, and stops when returning to Setup or backgrounding the app. A retake holds the captured image until decoded live frames have stable dimensions; the result sheet slides down as the feed resumes. Local catalogs are not encrypted by this app. Never commit private catalogs, photos or test renders to this repository.

## Development and deployment

Use Node 22 or newer. Run `npm ci`, `npm run check`, `npm test`, `npm run build`, then `npm run preview`. Preview: `http://127.0.0.1:4173/PageMatch/`. The build copies all runtime assets into `dist`; asset hashes invalidate stale offline caches.

Push source to `main`; `.github/workflows/pages.yml` checks, tests, builds and deploys through GitHub Actions. Keep `.local`, `dist`, `node_modules`, PDFs and archives out of Git. `ui.js` handles screen navigation and sheet gestures; `main.js` handles local storage, capture, OCR and previews. Desktop alternatives: navigation buttons, Alt+Right/Alt+Left, sheet toggle button, Escape to minimize/close.

Tests cover page matching, catalog disambiguation and gesture thresholds. Browser checks use local PDF-render fixtures and synthetic competing catalogs. Physical iPhone camera permissions, touch feel and airplane-mode behavior still require device testing.

## Refreshing the app

While online, use **Refresh app** at the bottom of Setup, or open https://thegameonaddict.github.io/PageMatch/?v=0.8.0. This refreshes the application without clearing catalog PDFs or indexes. Each release uses matching versioned scripts, styles and OCR asset paths. Online page navigation checks the server first; offline navigation, including version-query URLs, falls back to the cached app. Do not clear Safari website data to update: that can delete your local catalogs.

## Suggested extraction patterns (v0.6.0)

Open **Find useful patterns** in Setup. PageMatch checks up to 20 indexed pages for a useful table automatically. You can enter a printed ID (such as 1H18) or physical PDF page and tap Scan page. A scan result can open the same workflow directly.

Suggestions show repeated table columns, colon-labeled values, headings and bottom-center page IDs. Inspect the samples or expand all values, tap Name & confirm, give the pattern a friendly name, and confirm. Each confirmation saves immediately in this browser; no region drawing, field syntax or manual template save is required. Use Saved to review confirmed patterns on another scanned page. Skip hides a suggestion for the current scan.

Confirmed column rules rediscover matching headers on the next page, including when columns shift horizontally. A missing pattern is shown explicitly. Detection is a local heuristic for text-based PDFs, not a guarantee for every layout. Sparse values are independent lists, not joined table records; all values require review. Photo recognition identifies the source PDF page, whose text supplies values. Highlight detection, photo alignment, QR, report formulas and exports remain future work.

Older region templates remain available under Other saved pattern sets. All imports and patterns stay in IndexedDB locally.

## Refine with examples (v0.7.0)

Tap Refine on a suggestion or a saved pattern. Mark correct examples Keep and wrong examples Not this. The preview shows kept, review and excluded counts before you save. On suggestions, Use this refinement updates the preview; Name & confirm saves the pattern and teaching together. Saved patterns offer Save refinement directly.

Exact rejected examples are excluded. Two distinct kept/rejected examples with the same character-and-length format teach that format for subsequent pages. Unfamiliar or conflicting formats remain visible for review; explicit kept exceptions take priority. This is local example-based format filtering, not semantic proof that a value is a valid part. Excluded values remain inspectable and teachable. Clear teaching and save to undo the filter. No PDF, photo or teaching examples leave the browser.

## Split patterns and arrange page results (v0.8.0)

In a saved pattern, Separate can split every line into two fields using words or a literal delimiter, or move selected whole examples into a separate pattern. The preview shows both pieces; short/unsplit values can be assigned to either side. Originals remain as hidden source patterns, so derived patterns can be split further without losing their source. Whole-value separation reuses exact examples and formats supported by two distinct examples.

Arrange page results lets users choose ordered group levels (for example Figure then Index), choose the field that starts each record, select/reorder the displayed fields and choose whether groups start at every marker or only a changed marker. Blank group markers continue within the current page; leading rows with no marker are flagged Unassigned. Group nesting is user-defined, with up to eight levels. Save an arrangement to apply it automatically below the matched PDF preview. Refinements preserve it; excluded anchor rows are omitted without shifting neighboring descriptions/quantities. Missing cells stay blank, and a rejected group marker creates an unassigned boundary rather than joining a previous group.

Page-match results open expanded, can swipe down to half height, and show a compact expandable catalog/page banner. Match details contain the OCR evidence and physical PDF page. The PDF is followed by all visible saved catalog patterns or their saved arrangements. Discover more patterns opens suggestions; Arrange or refine opens the correct saved set. Changes refresh the underlying result on closing the editor. Scan options are tucked away.

This is geometric row association for selectable PDF text, not automatic semantic understanding of every table. Preview the arrangement against the source page. No guessing by zipping arrays with missing cells. Header/label patterns lacking row geometry are not used to fabricate records. All documents, layouts, teaching and extracted values remain local.
