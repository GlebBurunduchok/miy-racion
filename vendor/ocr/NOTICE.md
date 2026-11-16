# OCR dependencies

- Tesseract.js 6.0.1, naptha/tesseract.js — Apache-2.0, LICENSE-tesseract.md. Browser API and worker from the official npm package through jsDelivr.
- tesseract.js-core 6.0.0 — Apache-2.0, LICENSE-core. All four wasm.js builds and companion .wasm binaries are included so the engine selects a compatible implementation. The wasm.js distributions also embed their wasm binary.
- Language data: @tesseract.js-data/ukr, /rus and /eng, 4.0.0_best_int (official Tesseract.js language packages), Apache-2.0. Source: https://github.com/naptha/tessdata and https://github.com/tesseract-ocr/tessdata_best . Models stay on the device.

Documentation: https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md
API: https://github.com/naptha/tesseract.js/blob/master/docs/api.md

No OCR service or secret API key is used. Standalone HTML downloads its OCR dependencies from the engine's configured CDN; source/index.html uses the bundled local files.
