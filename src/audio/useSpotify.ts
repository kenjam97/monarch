import { useEffect, useRef, useState } from 'react';
import { authorizeSpotify, disconnectSpotify, finishSpotifyLogin, loadSpotifySDK, playBody, spotifyApi, spotifyConnected, spotifyToken, type PlaybackState, type SpotifyPlayer, type SpotifyTrack } from './spotify';
type Device = { id: string; name: string; type: string; is_restricted: boolean; volume_percent?: number };
const DEVICE = 'monarch.spotify.device';
function savedDevice() { try { return localStorage.getItem(DEVICE) || 'browser'; } catch { return 'browser'; } }
export function useSpotify(volume: number, enabled: boolean) {
 const [connected, setConnected] = useState(spotifyConnected), [ready, setReady] = useState(''), [error, setError] = useState(''), [status, setStatus] = useState('');
 const [state, setState] = useState<PlaybackState | null>(null), [devices, setDevices] = useState<Device[]>([]), [device, setDevice] = useState(savedDevice), [busy, setBusy] = useState(false), [position, setPosition] = useState(0), [retry, setRetry] = useState(0);
 const player = useRef<SpotifyPlayer | null>(null), latest = useRef({ volume, enabled, ready, device, state }), stamp = useRef(performance.now()), pending = useRef(false), mounted = useRef(true);
 latest.current = { volume, enabled, ready, device, state };
 const report = (e: unknown) => { if (mounted.current) { setError(e instanceof Error ? e.message : 'Spotify is unavailable. Try reconnecting.'); if (!spotifyConnected()) setConnected(false); } };
 const accept = (value: PlaybackState | null) => { stamp.current = performance.now(); setState(value); setPosition(value?.position ?? 0); };
 async function run(task: () => Promise<void>) { if (pending.current) return; pending.current = true; setBusy(true); setError(''); try { await task(); } catch (e) { report(e); } finally { pending.current = false; if (mounted.current) setBusy(false); } }
 async function refreshDevices() { const result = await spotifyApi<{ devices: Device[] }>('/me/player/devices'); setDevices(result.devices.filter(d => !d.is_restricted)); }
 useEffect(() => { mounted.current = true; void finishSpotifyLogin().then(done => { if (done && mounted.current) { setConnected(true); window.dispatchEvent(new HashChangeEvent('hashchange')); } }).catch(report); return () => { mounted.current = false; }; }, []);
 useEffect(() => {
  if (!connected) return;
  let live = true, instance: SpotifyPlayer | undefined;
  setStatus('Connecting to Spotify.'); setReady('');
  void loadSpotifySDK().then(async sdk => {
   if (!live) return;
   instance = new sdk.Player({ name: 'Monarch', volume: latest.current.enabled ? latest.current.volume : 0, getOAuthToken: callback => { void spotifyToken().then(callback).catch(report); } });
   player.current = instance;
   instance.addListener('ready', ({ device_id }: { device_id: string }) => { if (live) { setReady(device_id); setStatus('Connected to Spotify.'); void refreshDevices().catch(report); } });
   instance.addListener('not_ready', () => { if (live) { setReady(''); setStatus('Spotify is offline.'); } });
   instance.addListener('player_state_changed', (value: PlaybackState | null) => { if (live && latest.current.device === 'browser') accept(value); });
   instance.addListener('initialization_error', () => { if (live) { setStatus('Choose a Spotify device.'); if (latest.current.device === 'browser') setError('This browser cannot play protected audio. Open Spotify on your computer and select it below.'); void refreshDevices().catch(report); } });
   instance.addListener('authentication_error', () => { if (live) { setConnected(false); disconnectSpotify(); setError('Spotify sign-in expired. Connect again.'); } });
   instance.addListener('account_error', () => { if (live) setError('Playback requires Spotify Premium on the connected account.'); });
   instance.addListener('playback_error', () => { if (live && latest.current.device === 'browser') setError('This browser could not play the track. Choose your Spotify app under Play through.'); });
   instance.addListener('autoplay_failed', () => { if (live && latest.current.device === 'browser') setError('Press Play to allow music in this browser.'); });
   if (!await instance.connect() && live) setStatus('Choose a Spotify device or retry the connection.');
  }).catch(report);
  return () => { live = false; instance?.disconnect(); player.current = null; };
 }, [connected, retry]);
 useEffect(() => {
  if (!connected) return;
  const timer = setTimeout(() => {
   const level = enabled ? volume : 0;
   if (device === 'browser') void player.current?.setVolume(level).catch(report);
   // Remote volume changes are explicit and apply only to the chosen device.
   else void spotifyApi(`/me/player/volume?volume_percent=${Math.round(level * 100)}&device_id=${encodeURIComponent(device)}`, 'PUT').catch(report);
  }, 160);
  return () => clearTimeout(timer);
 }, [volume, enabled, device, ready, connected]);
 useEffect(() => {
  if (!connected || (device === 'browser' && !ready)) return;
  let live = true, polling = false;
  const poll = async () => {
   if (document.hidden || polling) return;
   polling = true;
   try {
    // SDK events are irregular. Reconcile the clock and track after seeking,
    // returning to the tab, or changing the active Spotify device.
    if (device === 'browser') {
     const value = await player.current?.getCurrentState();
     if (live) accept(value ?? null);
    } else {
     const value = await spotifyApi('/me/player');
     if (live) accept(value?.item && value.device?.id === device ? { paused: !value.is_playing, position: value.progress_ms, duration: value.item.duration_ms, track_window: { current_track: value.item }, disallows: value.actions?.disallows } : null);
    }
   } catch (e) { if (live) report(e); } finally { polling = false; }
  };
  const reconcile = () => { void poll(); };
  reconcile(); const timer = setInterval(reconcile, 4000);
  document.addEventListener('visibilitychange', reconcile);
  return () => { live = false; clearInterval(timer); document.removeEventListener('visibilitychange', reconcile); };
 }, [connected, device, ready]);
 useEffect(() => { const timer = setInterval(() => { const value = latest.current.state; if (value) setPosition(Math.min(value.duration, value.position + (value.paused ? 0 : performance.now() - stamp.current))); }, 500); return () => clearInterval(timer); }, []);
 function target() { const id = latest.current.device === 'browser' ? latest.current.ready : latest.current.device; if (!id) throw new Error('Spotify is still connecting. If it stays unavailable, choose your Spotify app below.'); return `device_id=${encodeURIComponent(id)}`; }
 function play(uri: string) {
  if (!connected) { setError('Connect Spotify to play the soundtracks.'); return; }
  // Activate synchronously within the original click; required by mobile browsers.
  if (device === 'browser') void player.current?.activateElement().catch(report);
  void run(async () => { await spotifyApi('/me/player/play?' + target(), 'PUT', playBody(uri)); });
 }
 function toggle() {
  if (device === 'browser') void player.current?.activateElement().catch(report);
  void run(async () => { if (latest.current.device === 'browser' && latest.current.state) { if (latest.current.state.paused) await player.current!.resume(); else await player.current!.pause(); } else await spotifyApi('/me/player/' + (latest.current.state?.paused ? 'play' : 'pause') + '?' + target(), 'PUT'); });
 }
 function skip(direction: number) { void run(async () => { if (latest.current.device === 'browser') { target(); if (direction > 0) await player.current!.nextTrack(); else await player.current!.previousTrack(); } else await spotifyApi('/me/player/' + (direction > 0 ? 'next' : 'previous') + '?' + target(), 'POST'); }); }
 function seek(ms: number) { void run(async () => { if (latest.current.device === 'browser') { target(); await player.current!.seek(ms); } else await spotifyApi(`/me/player/seek?position_ms=${Math.round(ms)}&${target()}`, 'PUT'); setPosition(ms); }); }
 function disconnect() { void player.current?.pause().catch(() => {}); player.current?.disconnect(); disconnectSpotify(); setConnected(false); setReady(''); accept(null); setStatus(''); setError(''); }
 const track: SpotifyTrack | undefined = state?.track_window.current_track;
 const deviceName = device === 'browser' ? 'Monarch' : devices.find(d => d.id === device)?.name || 'Spotify';
 return { connected, ready, status, error, state, track, position, busy, devices, device, deviceName, setDevice: (id: string) => { accept(null); setError(''); setDevice(id); try { localStorage.setItem(DEVICE, id); } catch {} }, play, toggle, skip, seek, connect: () => run(authorizeSpotify), disconnect, refresh: () => run(refreshDevices), retry: () => setRetry(v => v + 1), setError };
}
