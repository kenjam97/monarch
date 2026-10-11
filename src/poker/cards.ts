import type { Card } from './types';
export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';
export const rank = (c: Card) => RANKS.indexOf(c[0]) + 2;
export const rankLabel = (r: number) => RANKS[(r === 1 ? 14 : r) - 2];
export const DECK = [...RANKS].flatMap(r => [...SUITS].map(s => r+s));
export function cards(text: string): Card[] {
  if (!text.trim()) return [];
  const result = text.trim().split(/\s+/).map(c => c.replace(/^10/, 'T').slice(0,-1).toUpperCase()+c.slice(-1).toLowerCase());
  validateCards(result); return result;
}
export function validateCards(cs: Card[]) {
  if (cs.some(c => !/^[2-9TJQKA][cdhs]$/.test(c))) throw new Error('Invalid card. Use ranks 2 through A and suits c, d, h, s.');
  if (new Set(cs).size !== cs.length) throw new Error('Duplicate card in the same hand.');
}
export function handClass(hole: Card[]) {
  if (hole.length !== 2) return 'Unknown';
  const [a,b] = [...hole].sort((a,b) => rank(b)-rank(a));
  return a[0]+b[0]+(a[0] === b[0] ? '' : a[1]===b[1] ? 's' : 'o');
}
export function shuffledDeck(random = Math.random) {
  const d = [...DECK]; for (let i=d.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; } return d;
}
