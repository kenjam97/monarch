import { DECK, handClass } from '../poker/cards';
import { gridClass } from '../poker/ranges';

export const CARD_SOURCES = ['hole', 'flop', 'turn', 'river'] as const;
export type CardSource = typeof CARD_SOURCES[number];
export type FrequencyRow = { hole: string[]; board: string[] };
export type CardCount = { card: string; count: number };
export type CardSample = { hands: number; slots: number; cards: CardCount[] };
export type StartingCount = { hand: string; count: number; combinations: number; example: string[] };
export type Frequencies = { total: number; known: number; missing: number; starting: StartingCount[]; sources: Record<CardSource, CardSample> };

const valid = (cards: string[]) => cards.every(card => DECK.includes(card)) && new Set(cards).size === cards.length;
export function cardFrequencies(rows: Iterable<FrequencyRow>): Frequencies {
 const starting = Array.from({ length: 169 }, (_, i): StartingCount => {
  const hand = gridClass(Math.floor(i / 13), i % 13);
  return { hand, count: 0, combinations: hand.length === 2 ? 6 : hand.endsWith('s') ? 4 : 12, example: [] };
 });
 const classes = new Map(starting.map(cell => [cell.hand, cell]));
 const sources = Object.fromEntries(CARD_SOURCES.map(source => [source, { hands: 0, slots: 0, cards: DECK.map(card => ({ card, count: 0 })) }])) as Frequencies['sources'];
 const lookup = Object.fromEntries(CARD_SOURCES.map(source => [source, new Map(sources[source].cards.map(cell => [cell.card, cell]))])) as Record<CardSource, Map<string, CardCount>>;
 const add = (source: CardSource, cards: string[]) => {
  sources[source].hands++; sources[source].slots += cards.length;
  for (const card of cards) lookup[source].get(card)!.count++;
 };
 let total = 0, known = 0;
 for (const { hole, board } of rows) {
  total++;
  if (hole.length === 2 && valid(hole)) {
   known++; add('hole', hole);
   const cell = classes.get(handClass(hole))!; cell.count++;
   if (!cell.example.length) cell.example = [...hole];
  }
  // Each street owns only its newly dealt cards. A summary/showdown repetition
  // cannot add observations because the canonical board is read once per hand.
  if (board.length > 5 || !valid(board)) continue;
  if (board.length >= 3) add('flop', board.slice(0, 3));
  if (board.length >= 4) add('turn', board.slice(3, 4));
  if (board.length === 5) add('river', board.slice(4, 5));
 }
 return { total, known, missing: total - known, starting, sources };
}
