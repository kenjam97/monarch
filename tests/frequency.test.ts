import { describe, expect, it } from 'vitest';
import { cardFrequencies, type FrequencyRow } from '../src/analysis/frequency';
import { DECK } from '../src/poker/cards';

describe('observed card frequencies', () => {
 it('keeps empty samples explicit, with all cells present', () => {
  const result = cardFrequencies([]);
  expect(result).toMatchObject({ total: 0, known: 0, missing: 0 });
  expect(result.starting).toHaveLength(169);
  expect(result.sources.hole.cards).toHaveLength(52);
  expect(result.starting.every(cell => cell.count === 0 && !cell.example.length)).toBe(true);
 });
 it('counts all 1,326 possible deals against independent combinatorial totals', () => {
  const rows: FrequencyRow[] = [];
  for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) rows.push({ hole: [DECK[a], DECK[b]], board: [] });
  const result = cardFrequencies(rows);
  expect(result.known).toBe(1326);
  expect(result.sources.hole.slots).toBe(2652);
  expect(result.sources.hole.cards.every(cell => cell.count === 51)).toBe(true);
  expect(result.starting.filter(cell => cell.hand.length === 2)).toHaveLength(13);
  expect(result.starting.filter(cell => cell.hand.endsWith('s'))).toHaveLength(78);
  expect(result.starting.filter(cell => cell.hand.endsWith('o'))).toHaveLength(78);
  for (const cell of result.starting) expect(cell.count).toBe(cell.hand.length === 2 ? 6 : cell.hand.endsWith('s') ? 4 : 12);
  expect(result.starting.reduce((sum, cell) => sum + cell.combinations, 0)).toBe(1326);
 });
 it('uses eligible hands per street and counts only newly dealt board cards', () => {
  const result = cardFrequencies([
   { hole: ['As', 'Qd'], board: ['Qs', '8h', '4s', '2c', '9h'] },
   { hole: ['Ah', 'Kd'], board: [] },
   { hole: [], board: ['Qs', '8h', '4s'] },
   { hole: ['Kh', 'Kc'], board: ['Qs', '8h', '4s', '2c'] },
  ]);
  expect(result).toMatchObject({ total: 4, known: 3, missing: 1 });
  expect(result.sources.flop).toMatchObject({ hands: 3, slots: 9 });
  expect(result.sources.turn).toMatchObject({ hands: 2, slots: 2 });
  expect(result.sources.river).toMatchObject({ hands: 1, slots: 1 });
  expect(result.sources.flop.cards.find(c => c.card === 'Qs')?.count).toBe(3);
  expect(result.sources.turn.cards.find(c => c.card === 'Qs')?.count).toBe(0);
  expect(result.sources.river.cards.find(c => c.card === '9h')?.count).toBe(1);
  expect(result.starting.find(c => c.hand === 'AQo')?.example).toEqual(['As', 'Qd']);
 });
 it('does not invent frequencies for incomplete or invalid cards', () => {
  const result = cardFrequencies([
   { hole: ['As'], board: ['2h', '3h'] },
   { hole: ['As', 'As'], board: ['2h', '2h', '3h'] },
   { hole: ['back', 'Qd'], board: [] },
  ]);
  expect(result.missing).toBe(3);
  expect(result.known).toBe(0);
  expect(result.sources.flop.hands).toBe(0);
 });
});
