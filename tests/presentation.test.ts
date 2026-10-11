import { describe, expect, it } from 'vitest';
import { parseHand } from '../src/import/gg';
import { SAMPLE_HAND } from '../src/import/sample';
import { practiceStop } from '../src/poker/presentation';
import { decisionFacts, snapshot } from '../src/poker/replay';

describe('automatic practice presentation', () => {
  const hand = parseHand(SAMPLE_HAND);
  it('stops before the river answer and does not expose opponents or payouts', () => {
    const stop = practiceStop(hand), state = snapshot(hand, stop);
    expect(hand.actions[stop]).toMatchObject({ player: hand.hero, street: 'river', kind: 'call' });
    expect(state.last).toMatchObject({ kind: 'bet', street: 'river' });
    expect(state.seats.filter(s => s.name !== hand.hero).every(s => !s.revealed.length)).toBe(true);
    expect(state.seats.every(s => s.collected === 0)).toBe(true);
    expect(decisionFacts(hand, stop).call / hand.bigBlind).toBe(18);
  });
  it('uses the first decision when a hand has no river decision', () => {
    const shorter = { ...hand, actions: hand.actions.filter(a => a.street === 'preflop') };
    const stop = practiceStop(shorter);
    expect(shorter.actions[stop]).toMatchObject({ player: hand.hero, kind: 'raise' });
    expect(snapshot(shorter, stop).last?.player).not.toBe(hand.hero);
  });
  it('does not start a sequence without a study decision', () => {
    expect(practiceStop({ ...hand, hero: 'Absent player' })).toBe(0);
  });
});
