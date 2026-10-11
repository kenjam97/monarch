export const SOUNDTRACKS = [
 { title: "Ocean's Eleven", year: '2001', uri: 'spotify:album:2DJNWr05IjdfLzH0tjUrs1' },
 { title: "Ocean's Twelve", year: '2004', uri: 'spotify:album:4r3g8g5VCM1RyawlPCcFRg' },
 { title: "Ocean's Thirteen", year: '2007', uri: 'spotify:album:20ItSmVKGIrTMyjGKklC6S' },
];
// Public application identifier; PKCE uses no client secret.
const DEFAULT_CLIENT = 'ec28e8ea7e434745b828954b5d830438';
const CLIENT = 'monarch.spotify.client', TOKEN = 'monarch.spotify.session', PENDING = 'monarch.spotify.pending';
const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';
type Token = { access_token: string; refresh_token: string; expires: number; client: string };
type Pending = { verifier: string; state: string; redirect: string; client: string; route: string; at: number };
function read<T>(key: string): T | null { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } }
export function spotifyClient() { return localStorage.getItem(CLIENT) || DEFAULT_CLIENT; }
export function saveSpotifyClient(client: string) { if (!/^[a-f\d]{32}$/i.test(client.trim())) throw new Error('Enter the Client ID from your Spotify app settings.'); localStorage.setItem(CLIENT, client.trim()); }
export function spotifyConnected() { return Boolean(read<Token>(TOKEN)?.refresh_token); }
export function disconnectSpotify() { sessionStorage.removeItem(TOKEN); sessionStorage.removeItem(PENDING); }
export function parseSpotifyLink(value: string): string | null {
 const uri = value.trim(); if (/^spotify:(album|playlist|track):[a-zA-Z\d]{22}$/.test(uri)) return uri;
 try { const url = new URL(uri); if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com') return null; const match = url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?(album|playlist|track)\/([a-zA-Z\d]{22})\/?$/); return match ? `spotify:${match[1]}:${match[2]}` : null; } catch { return null; }
}
export function spotifyLink(uri: string) { const parsed = parseSpotifyLink(uri); return parsed ? `https://open.spotify.com/${parsed.split(':').slice(1).join('/')}` : 'https://open.spotify.com'; }
export function playBody(uri: string) { const parsed = parseSpotifyLink(uri); if (!parsed) throw new Error('Use a Spotify album, playlist or track link.'); return parsed.startsWith('spotify:track:') ? { uris: [parsed] } : { context_uri: parsed }; }
export function validCallback(pending: Pending | null, state: string | null, now = Date.now()) { return Boolean(pending && state && pending.state === state && pending.at <= now && now - pending.at < 600000); }
export function redirectUri() { return `${location.origin}/spotify-callback`; }
function random() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join(''); }
export async function authorizeSpotify() {
 const client = spotifyClient(); if (!client) throw new Error('Add your Spotify Client ID under Connection.');
 const verifier = random(), state = random(), redirect = redirectUri();
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
 const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
 const pending: Pending = { verifier, state, redirect, client, route: location.hash || '#home', at: Date.now() };
 sessionStorage.setItem(PENDING, JSON.stringify(pending));
 location.assign('https://accounts.spotify.com/authorize?' + new URLSearchParams({ client_id: client, response_type: 'code', redirect_uri: redirect, scope: SCOPES, code_challenge_method: 'S256', code_challenge: challenge, state }));
}
async function exchange(body: Record<string, string>, refresh = ''): Promise<Token> {
 const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
 const result = await response.json();
 if (!response.ok) { if (response.status === 400 || response.status === 401) disconnectSpotify(); throw new Error('Spotify sign-in expired or was declined. Connect again.'); }
 if (!result.access_token || !(result.refresh_token || refresh)) throw new Error('Spotify did not return a playback session. Connect again.');
 const token = { access_token: result.access_token, refresh_token: result.refresh_token || refresh, expires: Date.now() + Number(result.expires_in) * 1000, client: body.client_id };
 sessionStorage.setItem(TOKEN, JSON.stringify(token)); return token;
}
export async function finishSpotifyLogin() {
 if (location.pathname !== '/spotify-callback') return false;
 const query = new URLSearchParams(location.search), pending = read<Pending>(PENDING);
 // Remove the one-time authorization code before rendering or loading resources.
 history.replaceState(null, '', '/' + (pending?.route.startsWith('#') ? pending.route : '#home'));
 sessionStorage.removeItem(PENDING);
 if (!validCallback(pending, query.get('state'))) throw new Error('Spotify sign-in could not be verified. Connect again.');
 if (query.has('error')) throw new Error('Spotify connection was cancelled.');
 const code = query.get('code'); if (!code) throw new Error('Spotify did not return an authorization code.');
 await exchange({ client_id: pending!.client, grant_type: 'authorization_code', code, redirect_uri: pending!.redirect, code_verifier: pending!.verifier });
 return true;
}
let refreshing: Promise<Token> | undefined;
export async function spotifyToken(force = false) {
 const token = read<Token>(TOKEN); if (!token) throw new Error('Connect Spotify to play music.');
 if (!force && token.expires > Date.now() + 60000) return token.access_token;
 if (!refreshing) refreshing = exchange({ client_id: token.client, grant_type: 'refresh_token', refresh_token: token.refresh_token }, token.refresh_token).finally(() => { refreshing = undefined; });
 return (await refreshing).access_token;
}
export async function spotifyApi<T = any>(path: string, method = 'GET', body?: unknown, retry = true): Promise<T> {
 if (!path.startsWith('/me/player')) throw new Error('Unsupported Spotify operation.');
 const response = await fetch('https://api.spotify.com/v1' + path, { method, headers: { Authorization: `Bearer ${await spotifyToken()}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
 if (response.status === 401 && retry) { await spotifyToken(true); return spotifyApi(path, method, body, false); }
 if (response.status === 204) return null as T;
 if (!response.ok) {
  if (response.status === 404) throw new Error('Open Spotify on your computer, then refresh the device list.');
  if (response.status === 403) throw new Error('Spotify has not enabled this playback request. Check Premium and the allowed users in your Spotify app settings.');
  if (response.status === 429) throw new Error('Spotify needs a short pause. Try again in a moment.');
  throw new Error('Spotify could not complete the request. Try again.');
 }
 // Playback commands may acknowledge with an empty or opaque 200 body.
 // Only read endpoints return data the application consumes.
 if (method !== 'GET') return null as T;
 return await response.json();
}
export type SpotifyTrack = { id: string; name: string; uri: string; artists: { name: string }[]; album: { images: { url: string }[] } };
export type PlaybackState = { paused: boolean; position: number; duration: number; track_window: { current_track: SpotifyTrack }; disallows?: Record<string, boolean> };
export type SpotifyPlayer = {
 connect: () => Promise<boolean>; disconnect: () => void; activateElement: () => Promise<void>;
 addListener: (event: string, handler: (value: any) => void) => void;
 getCurrentState: () => Promise<PlaybackState | null>; setVolume: (value: number) => Promise<void>;
 pause: () => Promise<void>; resume: () => Promise<void>; seek: (value: number) => Promise<void>; nextTrack: () => Promise<void>; previousTrack: () => Promise<void>;
};
type SDK = { Player: new (options: { name: string; volume: number; getOAuthToken: (callback: (token: string) => void) => void }) => SpotifyPlayer };
declare global { interface Window { Spotify?: SDK; onSpotifyWebPlaybackSDKReady?: () => void } }
let loading: Promise<SDK> | undefined;
export function loadSpotifySDK(): Promise<SDK> {
 if (window.Spotify) return Promise.resolve(window.Spotify);
 if (!loading) loading = new Promise<SDK>((resolve, reject) => {
  const script = document.createElement('script'); script.src = 'https://sdk.scdn.co/spotify-player.js'; script.async = true;
  const timeout = setTimeout(() => { loading = undefined; script.remove(); reject(new Error('Spotify could not load. Check your connection and try again.')); }, 15000);
  window.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timeout); resolve(window.Spotify!); };
  script.onerror = () => { clearTimeout(timeout); script.remove(); loading = undefined; reject(new Error('Spotify could not load. Check your connection and try again.')); };
  document.head.append(script);
 });
 return loading;
}
