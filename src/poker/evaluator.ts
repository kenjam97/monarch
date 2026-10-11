import { rank, validateCards } from './cards';
import type { Card } from './types';
export const STRAIGHTS = Array.from({length:10},(_,i) => Array.from({length:5},(_,j) => i+j+1).map(r => r===1 ? 14 : r));
export const HAND_NAMES = ['High card','One pair','Two pair','Three of a kind','Straight','Flush','Full house','Four of a kind','Straight flush'];
export interface Evaluation { category: number; name: string; score: number[]; cards: Card[]; straightHigh?: number }
export const compare = (a: number[], b: number[]) => { for(let i=0;i<Math.max(a.length,b.length);i++) { const d=(a[i]??0)-(b[i]??0); if(d) return d; } return 0; };
export function straightHigh(rs: number[]) { const set=new Set(rs); let high=0; for(const seq of STRAIGHTS) if(seq.every(r=>set.has(r))) high=seq[4]; return high; }
function five(cs: Card[]): Evaluation {
  const rs=cs.map(rank).sort((a,b)=>b-a), counts=new Map<number,number>(); rs.forEach(r=>counts.set(r,(counts.get(r)??0)+1));
  const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  const flush=cs.every(c=>c[1]===cs[0][1]), high=straightHigh(rs);
  let category=0, kickers=rs;
  if(flush&&high) {category=8;kickers=[high];}
  else if(groups[0][1]===4) {category=7;kickers=groups.map(g=>g[0]);}
  else if(groups[0][1]===3&&groups[1]?.[1]===2) {category=6;kickers=groups.map(g=>g[0]);}
  else if(flush) category=5;
  else if(high) {category=4;kickers=[high];}
  else if(groups[0][1]===3) {category=3;kickers=groups.map(g=>g[0]);}
  else if(groups[0][1]===2&&groups[1]?.[1]===2) {category=2;kickers=groups.map(g=>g[0]);}
  else if(groups[0][1]===2) {category=1;kickers=groups.map(g=>g[0]);}
  return {category,name:HAND_NAMES[category],score:[category,...kickers],cards:cs,straightHigh:high||undefined};
}
export function evaluate(cs: Card[]): Evaluation {
  validateCards(cs); if(cs.length<5||cs.length>7) throw new Error('Evaluation requires five to seven cards.');
  let best: Evaluation | undefined;
  for(let a=0;a<cs.length-4;a++) for(let b=a+1;b<cs.length-3;b++) for(let c=b+1;c<cs.length-2;c++) for(let d=c+1;d<cs.length-1;d++) for(let e=d+1;e<cs.length;e++) {
    const v=five([cs[a],cs[b],cs[c],cs[d],cs[e]]); if(!best||compare(v.score,best.score)>0) best=v;
  } return best!;
}
