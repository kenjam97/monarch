import type { SoundCue } from './model';

// Original, short material sounds. No samples, music, or film recordings.
// Render once per variation, then reuse buffers without work in the animation loop.
export function synthesize(cue: SoundCue, sampleRate: number, seed = 7): Float32Array {
 const duration = cue === 'cut' ? .32 : cue === 'card' || cue === 'fold' ? .3 : cue === 'chips' ? .29 : .19;
 const data = new Float32Array(Math.ceil(duration * sampleRate));
 let random = seed >>> 0, low = 0, previous = 0;
 const noise = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 2147483648 - 1; };
 const mode = (t: number, f: number, decay: number) => t < 0 ? 0 : Math.sin(2 * Math.PI * f * t) * Math.exp(-t / decay);
 const impact = (t: number, f: number) => t < 0 ? 0 : (.10 * mode(t, f, .016) + .048 * mode(t, f * 1.73, .012) + .032 * mode(t, f * 2.37, .008));
 for (let i = 0; i < data.length; i++) {
  const t = i / sampleRate, n = noise(); low += .09 * (n - low);
  const brush = n - previous; previous = n;
  let value = 0;
  if (cue === 'card' || cue === 'fold') {
   const center = cue === 'card' ? .075 : .12, envelope = Math.exp(-Math.pow((t - center) / .042, 2));
   value = .12 * (low * 2 + brush * .13) * envelope;
   if (cue === 'card') value += .07 * mode(t - .12, 210, .025) + .035 * mode(t - .12, 740, .012);
  } else if (cue === 'chips') {
   for (const [at, weight] of [[0, 1], [.047, .7], [.116, .45]]) value += weight * impact(t - at, 2250 + (seed % 13) * 29);
   value += .04 * mode(t, 185, .035);
  } else if (cue === 'cut') {
   value = .11 * low * Math.sin(Math.PI * t / duration) ** 3 + .025 * mode(t, 120, .07);
  } else if (cue === 'tap') {
   value = .07 * mode(t, 640, .009) + .03 * mode(t, 1380, .006) + .035 * low * Math.exp(-t / .008);
  } else if (cue === 'incorrect') {
   value = .085 * mode(t, 260, .026) + .038 * low * Math.exp(-t / .035);
  } else {
   value = .6 * impact(t, 1750) + .32 * impact(t - .065, cue === 'correct' ? 2450 : 1750);
  }
  // Tiny leading/trailing ramps avoid a discontinuity at buffer boundaries.
  data[i] = value * Math.min(1, t / .0015, (duration - t) / .008);
 }
 return data;
}
