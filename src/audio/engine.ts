import { defaults, type SoundCue, type SoundPreferences } from './model';
import { synthesize } from './synthesis';

export class AudioEngine {
 private context?: AudioContext;
 private effects?: GainNode;
 private master?: GainNode;
 private analyser?: AnalyserNode;
 private buffers = new Map<string, AudioBuffer>();
 private voices = new Set<AudioBufferSourceNode>();
 private last = new Map<string, number>();
 private variation = 0;
 private prefs = defaults;
 private hidden = false;
 private disposed = false;
 get state() { return this.context?.state ?? 'suspended'; }
 async unlock() {
  if (this.disposed) return;
  if (!this.context) {
   const context = this.context = new AudioContext();
   this.master = context.createGain(); this.effects = context.createGain();
   const limiter = context.createDynamicsCompressor();
   limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 8;
   this.analyser = context.createAnalyser(); this.analyser.fftSize = 256;
   this.effects.connect(this.master);
   this.master.connect(limiter); limiter.connect(this.analyser); this.analyser.connect(context.destination);
   this.apply(true);
  }
  if (this.context.state === 'suspended') await this.context.resume();
 }
 configure(prefs: SoundPreferences) { this.prefs = prefs; this.apply(); if (!prefs.enabled || prefs.effects === 0) this.stopEffects(); }
 setHidden(hidden: boolean) { this.hidden = hidden; this.apply(); if (hidden) this.stopEffects(); }
 private apply(immediate = false) {
  if (!this.context) return;
  const t = this.context.currentTime;
  for (const [node, target] of [[this.master, this.prefs.enabled && !this.hidden ? 1 : 0], [this.effects, this.prefs.effects * 2.2]] as const) {
   node!.gain.cancelScheduledValues(t);
   if (immediate) node!.gain.setValueAtTime(target, t);
   else node!.gain.setTargetAtTime(target, t, .055);
  }
 }
 play(cue: SoundCue, count = 1) {
  const context = this.context;
  if (!context || context.state !== 'running' || !this.prefs.enabled || !this.prefs.effects || this.hidden) return;
  const now = context.currentTime;
  // Rapid controls stay tactile without layering dozens of identical sounds.
  if (now - (this.last.get(cue) ?? -10) < (cue === 'tap' ? .055 : .09)) return;
  this.last.set(cue, now);
  for (let i = 0; i < Math.min(5, Math.max(1, count)); i++) {
   const variant = this.variation++ % 3, key = `${cue}:${variant}`;
   let buffer = this.buffers.get(key);
   if (!buffer) { const samples = synthesize(cue, context.sampleRate, variant + 17); buffer = context.createBuffer(1, samples.length, context.sampleRate); buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0); this.buffers.set(key, buffer); }
   const voice = context.createBufferSource(), pan = context.createStereoPanner();
   voice.buffer = buffer; pan.pan.value = count > 1 ? -.22 + i * .11 : 0;
   voice.connect(pan); pan.connect(this.effects!); this.voices.add(voice);
   voice.onended = () => { this.voices.delete(voice); voice.disconnect(); pan.disconnect(); };
   voice.start(now + i * .11);
  }
 }
 stopEffects() { for (const voice of this.voices) { try { voice.stop(); } catch {} } this.voices.clear(); }
 level() { if (!this.analyser) return 0; const values = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(values); return Math.min(1, Math.sqrt(values.reduce((s, x) => s + x * x, 0) / values.length) * 5); }
 dispose() { this.disposed = true; this.stopEffects(); void this.context?.close(); }
}
