export type SoundCue = 'card' | 'chips' | 'fold' | 'tap' | 'cut' | 'confirm' | 'correct' | 'incorrect';
export type SoundPreferences = { enabled: boolean; effects: number; music: number };
export const defaults: SoundPreferences = { enabled: true, effects: .48, music: .28 };
export function preferences(value: unknown): SoundPreferences {
 const p = value && typeof value === 'object' ? value as Partial<SoundPreferences> : {};
 const level = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
 return { enabled: typeof p.enabled === 'boolean' ? p.enabled : defaults.enabled, effects: level(p.effects, defaults.effects), music: level(p.music, defaults.music) };
}
export type ActionSound = { kind: string; cards?: readonly string[] };
export function actionSound(action?: ActionSound): SoundCue | undefined {
 if (!action) return;
 if (['bet', 'raise', 'call', 'small-blind', 'big-blind', 'ante', 'collect', 'return'].includes(action.kind)) return 'chips';
 if (['deal', 'show'].includes(action.kind)) return 'card';
 if (action.kind === 'fold') return 'fold';
 if (action.kind === 'check') return 'tap';
}
// Seeking never replays the intervening actions, and data refreshes stay silent.
export function steppedSound(previous: number, current: number, actions: readonly ActionSound[]) {
 return current === previous + 1 ? actionSound(actions[current - 1]) : undefined;
}
export function sound(cue: SoundCue, count = 1) {
 window.dispatchEvent(new CustomEvent('monarch:sound', { detail: { cue, count } }));
}
