# Live data without recurring Netlify deploys

BONES & VEINS separates public-safe machine health from private Google data.

## BONES & VEINS health stream

The hourly GitHub Action scans registered public URLs and commits only public-site health evidence to `data/health.json` and the public-safe machine ledger.

The deployed dashboard reads that JSON directly from the repository raw-data endpoint configured in `config/runtime.json`. Therefore an hourly health update does **not** require a Netlify rebuild/deploy.

Until the repository exists, the browser falls back to the bundled local snapshot automatically.

## Google Search Console stream

Search Console analytics are private operator data. They are not committed to the public health stream.

The primary Page-1 integration uses Google Identity Services in the operator's browser. The operator explicitly clicks **CONNECT GOOGLE**, grants the read-only Search Console scope, and the dashboard calls Search Console with the temporary access token for that browser session.

No Google client secret or Search Console access token is stored in static files.

## Optional offline Google archive

A server/offline OAuth implementation remains available in `scripts/search-console.mjs` and an example private workflow is preserved under `docs/examples/`. It must only be enabled when a private storage target has been selected. It must never commit private Search Console data into a public repository.
