import { describe, expect, it } from 'vitest';
import { actionSound, defaults, preferences, steppedSound, type SoundCue } from '../src/audio/model';
import { synthesize } from '../src/audio/synthesis';

describe('sound settings and playback boundaries', () => {
 it('recovers corrupt settings and clamps real levels without accepting invalid values', () => {
  expect(preferences(null)).toEqual(defaults);
  expect(preferences('broken')).toEqual(defaults);
  expect(preferences({ effects: Infinity, music: -1, track: 7, enabled: 'false' })).toEqual({ ...defaults, music: 0 });
  expect(preferences({ effects: 3, music: .42, enabled: false })).toMatchObject({ effects: 1, music: .42, enabled: false });
 });
 it('sounds only the new action, never past actions during seeking or data refreshes', () => {
  const actions = [{ kind: 'deal' }, { kind: 'bet' }, { kind: 'call' }, { kind: 'show' }];
  expect(steppedSound(1, 2, actions)).toBe('chips');
  expect(steppedSound(2, 2, actions)).toBeUndefined();
  expect(steppedSound(2, 0, actions)).toBeUndefined();
  expect(steppedSound(0, 4, actions)).toBeUndefined();
  expect(steppedSound(3, 4, actions)).toBe('card');
  expect(actionSound({ kind: 'unknown' })).toBeUndefined();
 });

});
describe('original sound buffers', () => {
 const cues: SoundCue[] = ['card', 'chips', 'fold', 'tap', 'cut', 'confirm', 'correct', 'incorrect'];
 for (const rate of [44100, 48000]) it(`renders finite, audible buffers with headroom and clean edges at ${rate} Hz`, () => {
  for (const cue of cues) {
   const data = synthesize(cue, rate), peak = data.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
   expect(data.every(Number.isFinite)).toBe(true);
   expect(data.length).toBeLessThan(rate / 2);
   expect(peak).toBeGreaterThan(.01);
   expect(peak).toBeLessThan(.25);
   expect(Math.abs(data[0])).toBe(0);
   expect(Math.abs(data[data.length - 1])).toBeLessThan(.001);
   const rms = Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
   expect(rms).toBeGreaterThan(.001);
   expect(Math.abs(data.reduce((sum, x) => sum + x, 0) / data.length)).toBeLessThan(.002);
  }
 });
 it('varies material details without changing cue duration', () => {
  const one = synthesize('chips', 48000, 1), two = synthesize('chips', 48000, 2);
  expect(one.length).toBe(two.length);
  expect(one.some((value, i) => value !== two[i])).toBe(true);
 });
});

