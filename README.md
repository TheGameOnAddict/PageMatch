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

While online, use **Refresh app** at the bottom of Setup, or open https://thegameonaddict.github.io/PageMatch/?v=0.4.2. This refreshes the application without clearing catalog PDFs or indexes. Each release uses matching versioned scripts, styles and OCR asset paths. Online page navigation checks the server first; offline navigation, including version-query URLs, falls back to the cached app. Do not clear Safari website data to update: that can delete your local catalogs.

## Local extraction templates (v0.5.0)

In Setup, open the template editor, choose a catalog and physical PDF page, then load it. Drag a region, enter a field name (letters, numbers, underscores), and add it. Capture all lines or the first line; an optional literal pattern such as "Part: *" extracts the text in place of the asterisk. Save the template to this browser. Use Move page and zoom for small regions on phones.

Select a saved template and load another physical PDF page to test the same regions. The scan result also offers Capture fields from this page: select your saved template to apply it to that matched page. Review values are editable temporarily; they are not saved as reports. Templates are scoped to the local catalog and persist in IndexedDB alongside the catalog library (schema migration preserves imports).

This release extracts selectable PDF text from fixed normalized regions. It does not train a machine-learning model, align photo regions, detect highlighted rows, or join separate columns into structured table rows. The camera identifies the PDF page, whose text supplies the values. QR generation, report formulas and exports remain future work. No document or extracted value is uploaded. If another older tab blocks the storage update, close the other PageMatch tabs and refresh.
