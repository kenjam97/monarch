import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseSpotifyLink, playBody, spotifyApi, spotifyLink, spotifyToken, validCallback } from '../src/audio/spotify';
const album = '2DJNWr05IjdfLzH0tjUrs1';
describe('Spotify references', () => {
 it('accepts share links without passing arbitrary origins to the player', () => {
  expect(parseSpotifyLink(`https://open.spotify.com/album/${album}?si=abc`)).toBe(`spotify:album:${album}`);
  expect(parseSpotifyLink(`https://open.spotify.com/intl-en/album/${album}`)).toBe(`spotify:album:${album}`);
  expect(parseSpotifyLink(`https://open.spotify.com.attacker.test/album/${album}`)).toBeNull();
  expect(parseSpotifyLink('javascript:alert(1)')).toBeNull();
  expect(parseSpotifyLink(`spotify:artist:${album}`)).toBeNull();
  expect(spotifyLink(`spotify:album:${album}`)).toBe(`https://open.spotify.com/album/${album}`);
 });
 it('distinguishes tracks from album and playlist contexts', () => {
  expect(playBody(`spotify:album:${album}`)).toEqual({ context_uri: `spotify:album:${album}` });
  expect(playBody(`spotify:track:${album}`)).toEqual({ uris: [`spotify:track:${album}`] });
  expect(() => playBody('invalid')).toThrow();
 });
 it('rejects mismatched and expired authorization callbacks', () => {
  const pending = { state: 'random', verifier: 'secret', client: 'id', redirect: 'url', route: '#home', at: 1000 };
  expect(validCallback(pending, 'random', 2000)).toBe(true);
  expect(validCallback(pending, 'wrong', 2000)).toBe(false);
  expect(validCallback(pending, 'random', 601001)).toBe(false);
  expect(validCallback(null, 'random', 2000)).toBe(false);
  expect(validCallback(pending, 'random', 0)).toBe(false);
 });
});
function storage() { const data = new Map<string, string>(); vi.stubGlobal('sessionStorage', { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) }); return data; }
afterEach(() => vi.unstubAllGlobals());
describe('Spotify session and request lifecycle', () => {
 it('refreshes once for concurrent requests and retains a refresh token when not rotated', async () => {
  const data = storage(); data.set('monarch.spotify.session', JSON.stringify({ access_token: 'expired', refresh_token: 'refresh', client: 'client', expires: 1 }));
  const fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: 'new', expires_in: 3600 }), { status: 200 })); vi.stubGlobal('fetch', fetch);
  expect(await Promise.all([spotifyToken(), spotifyToken()])).toEqual(['new', 'new']);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(data.get('monarch.spotify.session')!).refresh_token).toBe('refresh');
 });
 it('accepts empty playback responses and never sends credentials to arbitrary endpoints', async () => {
  const data = storage(); data.set('monarch.spotify.session', JSON.stringify({ access_token: 'token', refresh_token: 'refresh', client: 'client', expires: Date.now() + 3600000 }));
  const fetch = vi.fn(async () => new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetch);
  expect(await spotifyApi('/me/player/play?device_id=local', 'PUT', playBody(`spotify:album:${album}`))).toBeNull();
  await expect(spotifyApi('https://elsewhere.test')).rejects.toThrow('Unsupported');
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('reports device, permission and rate failures without claiming playback succeeded', async () => {
  const data = storage(); data.set('monarch.spotify.session', JSON.stringify({ access_token: 'token', refresh_token: 'refresh', client: 'client', expires: Date.now() + 3600000 }));
  for (const status of [403, 404, 429]) { vi.stubGlobal('fetch', async () => new Response(null, { status })); await expect(spotifyApi('/me/player')).rejects.toThrow(); }
 });
 it('accepts successful command acknowledgements without trying to parse opaque bodies', async () => {
  const data = storage(); data.set('monarch.spotify.session', JSON.stringify({ access_token: 'token', refresh_token: 'refresh', client: 'client', expires: Date.now() + 3600000 }));
  for (const body of ['', 'opaque-command-acknowledgement']) {
   vi.stubGlobal('fetch', async () => new Response(body, { status: 200 }));
   await expect(spotifyApi('/me/player/pause?device_id=local', 'PUT')).resolves.toBeNull();
   await expect(spotifyApi('/me/player/next?device_id=local', 'POST')).resolves.toBeNull();
  }
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ devices: [] }), { status: 200 }));
  await expect(spotifyApi('/me/player/devices')).resolves.toEqual({ devices: [] });
 });
});
