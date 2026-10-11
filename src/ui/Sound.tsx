import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { AudioEngine } from '../audio/engine';
import { preferences, sound, type SoundCue, type SoundPreferences } from '../audio/model';
import { useSpotify } from '../audio/useSpotify';
import { SOUNDTRACKS, parseSpotifyLink, redirectUri, saveSpotifyClient, spotifyClient, spotifyLink } from '../audio/spotify';
const STORAGE = 'monarch.sound.v1';
function saved() { try { return preferences(JSON.parse(localStorage.getItem(STORAGE) || '{}')); } catch { return preferences(null); } }
type SoundState = { prefs: SoundPreferences; update: (patch: Partial<SoundPreferences>) => void; open: () => void; engine: AudioEngine; spotify: ReturnType<typeof useSpotify>; unlocked: boolean; lastCue: string };
const SoundContext = createContext<SoundState | null>(null);
function useSound() { return useContext(SoundContext)!; }
export function SoundProvider({ children }: { children: ReactNode }) {
 const [engine] = useState(() => new AudioEngine()), [prefs, setPrefs] = useState(saved), [opened, setOpened] = useState(() => location.pathname === '/spotify-callback'), [unlocked, setUnlocked] = useState(false), [lastCue, setLastCue] = useState('');
 const spotify = useSpotify(prefs.music, prefs.enabled), latest = useRef(prefs); latest.current = prefs;
 function update(patch: Partial<SoundPreferences>) { setPrefs(p => { const next = preferences({ ...p, ...patch }); engine.configure(next); return next; }); }
 useEffect(() => { try { localStorage.setItem(STORAGE, JSON.stringify(prefs)); } catch {} engine.configure(prefs); }, [prefs, engine]);
 useEffect(() => {
  let live = true;
  const gesture = () => { if (latest.current.enabled) void engine.unlock().then(() => { if (live) setUnlocked(engine.state === 'running'); }).catch(() => {}); };
  const cue = (event: Event) => { const detail = (event as CustomEvent).detail; if (!detail || !['card','chips','fold','tap','cut','confirm','correct','incorrect'].includes(detail.cue)) return; engine.play(detail.cue, detail.count); setLastCue(detail.cue); };
  const click = (event: MouseEvent) => {
   const elements = event.composedPath().filter((node): node is HTMLElement => node instanceof HTMLElement);
   if (elements.some(e => e.dataset.sound === 'none')) return;
   const control = elements.find(e => e.matches('button,a,summary,input[type=checkbox],input[type=radio]'));
   if (!control || control.matches(':disabled,[aria-disabled=true]')) return;
   if (control instanceof HTMLAnchorElement && control.hash && control.hash !== location.hash) return;
   sound((control.dataset.sound as SoundCue) || 'tap');
  };
  const change = (event: Event) => { if ((event.target as Element)?.matches('select')) sound('tap'); };
  let route = location.hash.split('?')[0];
  const navigate = () => { const next = location.hash.split('?')[0]; if (route !== next) { engine.stopEffects(); sound('cut'); route = next; } };
  const pauseScene = () => engine.stopEffects(), visibility = () => engine.setHidden(document.hidden);
  document.addEventListener('pointerdown', gesture, true); document.addEventListener('keydown', gesture, true); document.addEventListener('click', click, true); document.addEventListener('change', change, true); document.addEventListener('visibilitychange', visibility);
  window.addEventListener('hashchange', navigate); window.addEventListener('monarch:sound', cue); window.addEventListener('monarch:pause', pauseScene);
  return () => { live = false; document.removeEventListener('pointerdown', gesture, true); document.removeEventListener('keydown', gesture, true); document.removeEventListener('click', click, true); document.removeEventListener('change', change, true); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('hashchange', navigate); window.removeEventListener('monarch:sound', cue); window.removeEventListener('monarch:pause', pauseScene); engine.dispose(); };
 }, [engine]);
 return <SoundContext.Provider value={{ prefs, update, open: () => setOpened(true), engine, spotify, unlocked, lastCue }}>{children}<SoundDialog open={opened} close={() => setOpened(false)}/></SoundContext.Provider>;
}
export function SoundButton() { const { prefs, open, spotify } = useSound(); return <button className="sound-trigger" onClick={open} aria-haspopup="dialog" aria-label="Sound and music">{prefs.enabled ? <Volume2 size={15}/> : <VolumeX size={15}/>}<span>Sound</span>{spotify.state && !spotify.state.paused && <i aria-hidden="true"/>}</button>; }
export function SpotifyNowPlaying() { const { spotify: s } = useSound(); if (!s.track) return null; return <a className="spotify-now" href={spotifyLink(s.track.uri)} target="_blank" rel="noopener noreferrer">{s.track.album.images[0] && <img src={s.track.album.images[0].url} alt="Album cover"/>}<span><b>{s.track.name}</b><small>{s.track.artists.map(a => a.name).join(', ')} · Spotify</small></span></a>; }
export function SoundSettings() { const { prefs, update, open, spotify: s } = useSound(); return <section className="panel"><h2>Sound</h2><label className="checkbox"><input type="checkbox" checked={prefs.enabled} onChange={e => update({ enabled: e.target.checked })}/>Sound on</label><p>{s.connected ? 'Spotify connected. Cards, chips and interface effects enabled.' : "Ocean's soundtracks through Spotify Premium. Separate card and interface effects."}</p><button className="text-button" onClick={open}>Music and levels ↗</button></section>; }
function time(ms: number) { const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function SoundMeter() { const { engine } = useSound(), ref = useRef<HTMLSpanElement>(null); useEffect(() => { let frame = 0, peak = 0; const tick = () => { const level = engine.level(); peak = Math.max(peak, level); if (ref.current) { ref.current.style.setProperty('--level', String(level)); ref.current.dataset.peak = peak.toFixed(4); } frame = requestAnimationFrame(tick); }; tick(); return () => cancelAnimationFrame(frame); }, [engine]); return <span ref={ref} className="sound-meter" aria-hidden="true"><i/></span>; }
function SoundDialog({ open, close }: { open: boolean; close: () => void }) {
 const audio = useSound(), s = audio.spotify, dialog = useRef<HTMLDialogElement>(null), [client, setClient] = useState(spotifyClient), [configured, setConfigured] = useState(() => Boolean(spotifyClient())), [link, setLink] = useState('');
 useEffect(() => { if (open) { dialog.current?.showModal(); window.dispatchEvent(new Event('monarch:pause')); } else if (dialog.current?.open) { dialog.current.close(); window.dispatchEvent(new Event('monarch:resume')); } }, [open]);
 return <dialog ref={dialog} className="sound-room" aria-labelledby="sound-title" data-audio-state={audio.unlocked ? 'running' : 'waiting'} data-audio-cue={audio.lastCue} onCancel={e => { e.preventDefault(); close(); }} onClose={close}>
 {open && <><div className="sound-heading"><span className="signature">Monarch</span><button onClick={close} aria-label="Close sound">Close <X size={19}/></button></div><div className="sound-layout">
 <section className="sound-score"><h2 id="sound-title">Music.</h2>
 {s.track ? <a className="spotify-art" href={spotifyLink(s.track.uri)} target="_blank" rel="noopener noreferrer">{s.track.album.images[0] && <img src={s.track.album.images[0].url} alt="Album cover"/>}</a> : <div className="record-art" aria-hidden="true"><div className="record-disc"><span>m.</span></div><span className="record-needle"/></div>}
 <div className="now-playing"><p>{s.track ? `${s.state?.paused ? 'Paused' : 'Playing'} on ${s.deviceName}` : 'Spotify Premium'}</p><h3>{s.track?.name ?? "Ocean's Eleven, Twelve & Thirteen."}</h3><p>{s.track ? s.track.artists.map(a => a.name).join(', ') : s.connected ? s.status : 'Connect Spotify, then choose a soundtrack.'}</p></div>
 <div className="music-transport" data-sound="none"><button disabled={!s.track || s.busy || s.state?.disallows?.skipping_prev} aria-label="Previous track" onClick={() => s.skip(-1)}><SkipBack size={18}/></button><button className="music-play" disabled={!s.track || s.busy} onClick={s.toggle}>{s.state && !s.state.paused ? <Pause size={20}/> : <Play size={20}/>} {s.state && !s.state.paused ? 'Pause music' : 'Play music'}</button><button disabled={!s.track || s.busy || s.state?.disallows?.skipping_next} aria-label="Next track" onClick={() => s.skip(1)}><SkipForward size={18}/></button></div>
 <div className="music-position"><span>{time(s.position)}</span><input type="range" aria-label="Track position" min="0" max={s.state?.duration || 1} step="1000" value={s.position} disabled={!s.track || s.busy || s.state?.disallows?.seeking} onChange={e => s.seek(+e.target.value)}/><span>{time(s.state?.duration || 0)}</span></div>
 <a className="spotify-credit" href={s.track ? spotifyLink(s.track.uri) : 'https://open.spotify.com'} target="_blank" rel="noopener noreferrer">Spotify ↗</a>
 </section><section className="sound-mix"><div className="sound-mix-heading"><h3>Levels.</h3><SoundMeter/></div>
 <label className="sound-switch"><span>Sound on</span><input type="checkbox" checked={audio.prefs.enabled} onChange={e => audio.update({ enabled: e.target.checked })}/></label>
 <label className="sound-level"><span>Music <b>{Math.round(audio.prefs.music * 100)}%</b></span><input aria-label="Music volume" type="range" min="0" max="100" value={Math.round(audio.prefs.music * 100)} onChange={e => audio.update({ music: +e.target.value / 100 })}/></label>
 <label className="sound-level"><span>Effects <b>{Math.round(audio.prefs.effects * 100)}%</b></span><input aria-label="Effects volume" type="range" min="0" max="100" value={Math.round(audio.prefs.effects * 100)} onChange={e => audio.update({ effects: +e.target.value / 100 })}/></label>
 <div className="sound-audition" data-sound="none"><span>Listen</span>{([{ cue: 'card', title: 'Cards', count: 3 }, { cue: 'chips', title: 'Chips', count: 1 }, { cue: 'cut', title: 'Cut', count: 1 }] as const).map(item => <button key={item.cue} disabled={!audio.prefs.enabled} onClick={() => sound(item.cue, item.count)}>{item.title} ↗</button>)}</div>
 <div className="music-library-heading"><h3>Soundtracks.</h3></div><ol className="music-library soundtrack-list">{SOUNDTRACKS.map((album, i) => <li key={album.uri}><button disabled={!s.connected || s.busy} onClick={() => s.play(album.uri)}><small>{String(i + 11)}</small><span>{album.title}<em>{album.year}</em></span><Play size={13}/></button><a href={spotifyLink(album.uri)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${album.title} on Spotify`}>↗</a></li>)}</ol>
 {!s.connected ? <button className="spotify-connect" disabled={s.busy || !configured} onClick={s.connect}>Connect Spotify <span>↗</span></button> : <div className="spotify-device"><label>Play through<select aria-label="Spotify device" value={s.device} onChange={e => s.setDevice(e.target.value)}><option value="browser">Monarch{!s.ready ? ' (connecting)' : ''}</option>{s.devices.filter(d => d.id !== s.ready).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><button className="text-button" onClick={s.refresh}>Refresh devices ↺</button><form onSubmit={e => { e.preventDefault(); const uri = parseSpotifyLink(link); if (uri) s.play(uri); else s.setError('Paste a Spotify album, playlist or track link.'); }}><label>Another album or playlist<input type="url" aria-label="Spotify link" value={link} onChange={e => setLink(e.target.value)} placeholder="https://open.spotify.com/..."/></label><button className="text-button" disabled={!link || s.busy}>Play ↗</button></form></div>}
 {s.error && <p className="sound-error" role="alert">{s.error}</p>}
 <details className="spotify-connection"><summary>Connection</summary><p>Register Monarch in your Spotify developer account, then add its Client ID here.</p><a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">Spotify app settings ↗</a><label>Redirect address<input readOnly aria-label="Spotify redirect address" value={redirectUri()} onFocus={e => e.target.select()}/></label><label>Client ID<input aria-label="Spotify Client ID" value={client} spellCheck={false} autoComplete="off" onChange={e => setClient(e.target.value)}/></label><button className="text-button" onClick={() => { try { saveSpotifyClient(client); setConfigured(true); s.setError(''); setClient(client.trim()); } catch (e) { s.setError((e as Error).message); } }}>Save connection</button>{s.connected && <><button className="text-button" onClick={s.retry}>Retry player</button><button className="text-button" onClick={s.disconnect}>Disconnect Spotify</button></>}</details>
 </section></div></>}
 </dialog>;
}
