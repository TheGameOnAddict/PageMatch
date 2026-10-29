# PageMatch

[Open PageMatch on iPhone](https://thegameonaddict.github.io/PageMatch/)

An offline-capable, browser-local PWA that matches a catalog's printed page ID to its physical PDF page. Import a text-based PDF, photograph an upright paper page including the footer, then recognize the page and verify its PDF preview. Header OCR can corroborate catalog text. The selected catalog narrows the search; searching all catalogs requires care with shared IDs and revisions. Ambiguous, duplicate and approximate matches require a choice. Manual printed-ID lookup is available.

## iPhone setup

1. Open the link in Safari while online. Wait for **Offline ready**; the first download includes the OCR model and engine.
2. Share → Add to Home Screen → Add. Open PageMatch from its icon.
3. Import the full catalog PDF from Files into this installed app. Wait for indexing to finish. The PDF and index are stored on this device, in this browser/app. Storage may differ between Safari and Home Screen apps.
4. Keep **Selected catalog** chosen. Use **Choose / take photo** for a high-resolution rear-camera photograph, or **Open camera** and allow camera access. Keep the page flat, upright and fully framed, with the header and footer legible.
5. Tap **Recognize catalog & page**. Confirm the printed ID, catalog revision and rendered PDF page. For the supplied local test catalog, `1H18` should open physical PDF page **190 of 389**. This repository does not contain that catalog.
6. To check offline use, wait for Offline ready, enable airplane mode, close/reopen the installed app, then try lookup and OCR. Do not clear website data. iOS may evict storage under space pressure, so retain the original PDF in Files.

If camera permission is denied, use Choose / take photo or allow Safari camera access in iPhone Settings. If OCR finds no reliable match, retake a sharper photo or enter the printed page ID manually. PDFs must have selectable text and supported bottom-center IDs such as `1H18`. Scanned-only PDF indexing, perspective correction, variable training and QR generation are not implemented.

## Privacy

PDF bytes, camera/photo pixels, extracted text, OCR and indexes stay in the browser. There is no upload endpoint, analytics or remote AI. All runtime libraries, workers, WASM and language data are served under this app's own origin and cached for offline use. CSP limits network requests to the same origin and permits WASM compilation. The host sees requests for public application assets. Local catalog storage is not encrypted by this app. Never commit private catalogs, photos or test renders to this public repository.

## Development and deployment

Use Node 22 or newer. Run `npm ci`, `npm run check`, `npm test`, `npm run build`, then `npm run preview`. Preview: `http://127.0.0.1:4173/PageMatch/`. The Windows and Linux build copies all runtime assets into `dist`. Asset hashes invalidate stale offline caches. LSTM-only OCR engines include SIMD and non-SIMD variants.

Push source to `main`; `.github/workflows/pages.yml` checks, tests, builds and deploys to GitHub Pages through Actions. Pages must use GitHub Actions as its source. `package-lock.json` pins the dependency tree. Keep `.local`, `dist`, `node_modules`, PDFs and archives out of Git.

## Validation limits

Automated tests cover exact/approximate matches, shared revision IDs, duplicates, footer geometry and catalog header corroboration. Local fixture validation confirms a 389-page catalog with `1H18` at PDF page 190. OCR tests using a PDF rendering do not establish real printed-photo accuracy. Physical iPhone camera, permissions, storage pressure and airplane-mode behavior require device verification. Always visually confirm matches.
