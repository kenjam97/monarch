import { DECK, rank, validateCards } from './cards';
import { evaluate, straightHigh, STRAIGHTS } from './evaluator';
import type { Card } from './types';
export type StraightKind = 'No straight draw' | 'Gutshot' | 'Open-ended' | 'Double-gutshot' | 'Made straight';
export interface Completion { rank: number; sequence: number[] }
export function straightDraw(hole: Card[], board: Card[]) {
  const cs=[...hole,...board]; validateCards(cs);
  const ranks=new Set(cs.map(rank));
  if(straightHigh([...ranks])) return {kind:'Made straight' as StraightKind, completions:[] as Completion[], outs:[] as Card[], shared:straightHigh(board.map(rank))>0};
  const completions: Completion[]=[];
  if(board.length>=3&&board.length<5) for(const seq of STRAIGHTS) { const missing=seq.filter(r=>!ranks.has(r)); if(missing.length===1) completions.push({rank:missing[0],sequence:seq}); }
  const distinct=[...new Set(completions.map(c=>c.rank))];
  const open=completions.some(a=>completions.some(b=>{
    if(a.rank===b.rank) return false;
    const coreA=a.sequence.filter(r=>r!==a.rank).sort((a,b)=>a-b), coreB=b.sequence.filter(r=>r!==b.rank).sort((a,b)=>a-b);
    return coreA.join()===coreB.join() && coreA.every((r,i)=>i===0||r===coreA[i-1]+1) && coreA[0]>=2 && coreA[3]<14;
  }));
  const kind: StraightKind = !distinct.length?'No straight draw':distinct.length===1?'Gutshot':open?'Open-ended':'Double-gutshot';
  return {kind,completions,outs:DECK.filter(c=>distinct.includes(rank(c))&&!cs.includes(c)),shared:completions.length>0&&completions.every(c=>c.sequence.filter(r=>r!==c.rank).every(r=>board.some(b=>rank(b)===r)))};
}
export function features(hole: Card[],board: Card[]) {
  validateCards([...hole,...board]);
  const cs=[...hole,...board], made=cs.length>=5?evaluate(cs):null, br=board.map(rank), hr=hole.map(rank);
  const suits=[...new Set(cs.map(c=>c[1]))];
  const flushDraws=board.length<5&&board.length>=3?suits.filter(s=>cs.filter(c=>c[1]===s).length===4).map(s=>({suit:s,shared:!hole.some(c=>c[1]===s),outs:DECK.filter(c=>c[1]===s&&!cs.includes(c))})):[];
  let pairRelation='';
  if(hr.length===2&&br.length) {
    if(hr[0]===hr[1]) pairRelation=hr[0]>Math.max(...br)?'Overpair':hr[0]<Math.min(...br)?'Underpair':'Pocket pair';
    else {const hits=hr.filter(r=>br.includes(r)); if(hits.length) {const h=Math.max(...hits),unique=[...new Set(br)].sort((a,b)=>b-a);pairRelation=h===unique[0]?'Top pair':h===unique.at(-1)?'Bottom pair':'Middle pair';}}
  }
  return {made,straight:straightDraw(hole,board),flushDraws,pairRelation,overcards:hr.filter(r=>br.length&&r>Math.max(...br)).length,boardPaired:new Set(br).size<br.length,boardTexture:board.length?`${new Set(br).size<br.length?'Paired':'Unpaired'} · ${Math.max(...['c','d','h','s'].map(s=>board.filter(c=>c[1]===s).length))>=3?'three or more of one suit':new Set(board.map(c=>c[1])).size===board.length?'rainbow':'two-tone'}`:'Preflop'};
}
