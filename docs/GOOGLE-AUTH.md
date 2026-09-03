# Google Search Console authorization

BONES & VEINS uses **interactive browser authorization** as its primary Search Console connection.

## Primary Page-1 flow

- OAuth Client ID is public configuration in `config/runtime.json`.
- Scope is read-only: `https://www.googleapis.com/auth/webmasters.readonly`.
- Search Console property: `sc-domain:barbph.com`.
- The operator clicks **CONNECT GOOGLE** in BONES & VEINS.
- Google shows the real consent dialog.
- The temporary access token stays in browser memory for that session and is not committed to GitHub or embedded in static files.
- No Google client secret is required in the public dashboard.

Authorized JavaScript origin for the deployed dashboard:

`https://seohealth.barbph.com`

## Optional offline/archive mode

`scripts/google-oauth-connect.mjs`, `scripts/search-console.mjs`, and the workflow example under `docs/examples/` are preserved only for a future private/offline archive path. That mode requires a Google client secret and refresh token stored securely, never in Page 1 or the public repository.

The public dashboard must never commit private Search Console analytics or OAuth tokens into its public health stream.
