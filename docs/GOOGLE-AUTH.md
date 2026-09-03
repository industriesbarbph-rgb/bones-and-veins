# Google Search Console authorization

BONES & VEINS uses interactive browser authorization for Google Search Console.

## Scope

`https://www.googleapis.com/auth/webmasters.readonly`

Configured Search Console property:

`sc-domain:barbph.com`

## Browser flow

The public OAuth Client ID is stored in `config/runtime.json`. This value is intentionally public and is not a secret.

When the operator presses **CONNECT GOOGLE**, Google Identity Services opens Google's authorization UI. After consent, Google returns a short-lived read-only access token to the browser.

BONES & VEINS keeps that token in JavaScript memory only for the active browser session. It is not written to localStorage, committed to GitHub, or placed in static files.

## What is not used

Page 1 does not use or require a Google Client Secret, refresh token, server-side OAuth exchange, or scheduled private Search Console sync.

Google data remains clearly labeled **GOOGLE SEARCH CONSOLE** and is loaded only after explicit operator authorization.
