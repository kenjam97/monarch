import type { Hand } from './types';

/** An automatic practice sequence must never advance into its answer or showdown. */
export function practiceStop(hand: Hand): number {
  const decision = hand.actions.findIndex(a => a.street === 'river' && a.player === hand.hero && ['fold', 'check', 'call', 'bet', 'raise'].includes(a.kind));
  if (decision >= 0) return decision;
  const first = hand.actions.findIndex(a => a.player === hand.hero && ['fold', 'check', 'call', 'bet', 'raise'].includes(a.kind));
  return first >= 0 ? first : 0;
}

/** Opening folds cut quickly. Streets, bets and the last decision get longer holds. */
export function actionHold(hand: Hand, count: number): number {
  const action = hand.actions[count - 1];
  if (!action) return 1250;
  if (action.kind === 'deal') return action.street === 'flop' ? 4100 : 1800;
  if (action.kind === 'fold' || action.kind.endsWith('blind')) return 260;
  return 760;
}
