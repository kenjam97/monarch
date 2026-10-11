import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../src/audio/engine';
import { defaults } from '../src/audio/model';
class Parameter {
 value = 0;
 cancelScheduledValues() {}
 setValueAtTime(value: number) { this.value = value; }
 setTargetAtTime(value: number) { this.value = value; }
}
class Node {
 gain = new Parameter(); pan = new Parameter(); threshold = new Parameter(); knee = new Parameter(); ratio = new Parameter();
 connect() {} disconnect() {}
}
class Voice extends Node { started = -1; stopped = false; onended?: () => void; start(time: number) { this.started = time; } stop() { this.stopped = true; this.onended?.(); } }
class Context {
 static current: Context;
 state = 'suspended'; currentTime = 10; sampleRate = 44100; destination = new Node(); gains: Node[] = []; voices: Voice[] = []; sources = 0;
 constructor() { Context.current = this; }
 async resume() { this.state = 'running'; }
 async close() { this.state = 'closed'; }
 createGain() { const node = new Node(); this.gains.push(node); return node; }
 createDynamicsCompressor() { return new Node(); }
 createAnalyser() { return Object.assign(new Node(), { fftSize: 256, getFloatTimeDomainData: (data: Float32Array) => data.fill(0) }); }
 createMediaElementSource() { this.sources++; return new Node(); }
 createBuffer() { return { copyToChannel() {} }; }
 createBufferSource() { const voice = new Voice(); this.voices.push(voice); return voice; }
 createStereoPanner() { return new Node(); }
}
class Media { src = ''; paused = true; pause() { this.paused = true; } load() {} removeAttribute() { this.src = ''; } }
function setup() { vi.stubGlobal('Audio', Media); vi.stubGlobal('AudioContext', Context); return new AudioEngine(); }
afterEach(() => vi.unstubAllGlobals());
describe('audio output lifecycle', () => {
 it('drops cues before the first gesture instead of releasing a backlog', async () => {
  const engine = setup(); engine.play('card', 3); await engine.unlock();
  expect(Context.current.voices).toHaveLength(0);
  engine.play('card', 3);
  expect(Context.current.voices.map(v => v.started)).toEqual([10, 10.11, 10.22]);
  engine.play('card', 3); expect(Context.current.voices).toHaveLength(3);
  await engine.unlock(); expect(Context.current.gains).toHaveLength(2);
 });
 it('cancels scheduled cards on mute and does not sound in a hidden tab', async () => {
  const engine = setup(); await engine.unlock(); engine.play('card', 5);
  engine.configure({ ...defaults, enabled: false });
  expect(Context.current.voices.every(v => v.stopped)).toBe(true);
  expect(Context.current.gains[0].gain.value).toBe(0);
  engine.configure(defaults); engine.setHidden(true); engine.play('chips');
  expect(Context.current.voices).toHaveLength(5);
  engine.setHidden(false); engine.play('chips'); expect(Context.current.voices).toHaveLength(6);
  engine.dispose(); expect(Context.current.state).toBe('closed');
 });
 it('changes effects volume without requiring a music connection', async () => {
  const engine = setup(); await engine.unlock(); engine.configure({ ...defaults, effects: .8 });
  expect(Context.current.gains[1].gain.value).toBeCloseTo(.8 * 2.2);
  engine.configure({ ...defaults, effects: 0 }); engine.play('chips');
  expect(Context.current.voices).toHaveLength(0);
 });
});
