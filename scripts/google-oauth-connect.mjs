/**
 * One-time Google Search Console OAuth bootstrap.
 *
 * Usage (run locally, never in the public dashboard):
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-oauth-connect.mjs
 *
 * On Windows PowerShell:
 *   $env:GOOGLE_CLIENT_ID="..."
 *   $env:GOOGLE_CLIENT_SECRET="..."
 *   node scripts/google-oauth-connect.mjs
 *
 * This starts a localhost callback, prints an authorization URL, and tries to
 * open the user's browser. After consent it exchanges the code and prints the
 * refresh token that must be stored as the GitHub secret GOOGLE_REFRESH_TOKEN.
 */
import http from 'node:http';
import { exec } from 'node:child_process';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running this helper.');
}

const host = '127.0.0.1';
const port = Number(process.env.GOOGLE_OAUTH_PORT || 53682);
const redirectUri = `http://${host}:${port}/oauth2/callback`;
const scope = 'https://www.googleapis.com/auth/webmasters.readonly';
const state = crypto.randomUUID();

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope,
  access_type: 'offline',
  prompt: 'consent',
  state
}).toString();

function tryOpen(url) {
  const quoted = JSON.stringify(url);
  if (process.platform === 'win32') exec(`start "" ${quoted}`);
  else if (process.platform === 'darwin') exec(`open ${quoted}`);
  else exec(`xdg-open ${quoted}`);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirectUri);
  if (u.pathname !== '/oauth2/callback') {
    res.writeHead(404).end('Not found');
    return;
  }
  if (u.searchParams.get('state') !== state) {
    res.writeHead(400).end('Invalid OAuth state');
    server.close();
    return;
  }
  const error = u.searchParams.get('error');
  if (error) {
    res.writeHead(400, { 'content-type': 'text/plain' }).end(`Google authorization failed: ${error}`);
    server.close();
    return;
  }
  const code = u.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('No authorization code returned');
    server.close();
    return;
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end('Token exchange failed. Check the terminal.');
    console.error(token);
    server.close();
    return;
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<h1>BONES &amp; VEINS authorized</h1><p>You can close this tab and return to the terminal.</p>');
  console.log('\nGOOGLE SEARCH CONSOLE AUTHORIZATION COMPLETE');
  console.log('Redirect URI used:', redirectUri);
  console.log('Store these as GitHub repository secrets:');
  console.log('GOOGLE_CLIENT_ID=', clientId);
  console.log('GOOGLE_CLIENT_SECRET=', clientSecret);
  console.log('GOOGLE_REFRESH_TOKEN=', token.refresh_token || '[Google did not return a refresh token; revoke prior consent and run again]');
  server.close();
});

server.listen(port, host, () => {
  console.log('BONES & VEINS Google Search Console authorization');
  console.log('OAuth redirect URI that must exist on the Google OAuth client:');
  console.log(redirectUri);
  console.log('\nOpen this URL if the browser does not open automatically:\n');
  console.log(authUrl.toString());
  tryOpen(authUrl.toString());
});
