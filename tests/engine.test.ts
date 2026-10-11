import { describe,it,expect } from 'vitest';
import { DECK,cards,handClass,rank,validateCards } from '../src/poker/cards';
import { compare,evaluate,straightHigh } from '../src/poker/evaluator';
import { features,straightDraw } from '../src/poker/draws';
import { decisionFacts,positions,potOdds,snapshot } from '../src/poker/replay';
import { parseHand } from '../src/import/gg';
import { river,headsUp,sidePot,preflop } from './fixtures';
describe('legal cards and canonical classes',()=>{
 it('has 52 unique cards and normalizes ten',()=>{expect(DECK.length).toBe(52);expect(new Set(DECK).size).toBe(52);expect(cards('10h as')).toEqual(['Th','As']);});
 it.each(['As As','1c 2h','AX','10z'])('rejects %s',s=>expect(()=>cards(s)).toThrow());
 it.each([['Ah Kh','AKs'],['Kc As','AKo'],['2h 2s','22']])('canonicalizes %s', (s,c)=>expect(handClass(cards(s))).toBe(c));
});
describe('best five of seven',()=>{
 it.each([
 ['Ah Kd 8c 5s 3d',0,'High card'],['Ah Ad 8c 5s 3d',1,'One pair'],['Ah Ad 8c 8s 3d',2,'Two pair'],['Ah Ad Ac 5s 3d',3,'Three of a kind'],['As 2d 3c 4s 5h',4,'Straight'],['Ah Jh 8h 5h 3h',5,'Flush'],['Ah Ad Ac 5s 5d',6,'Full house'],['Ah Ad Ac As 3d',7,'Four of a kind'],['9h Th Jh Qh Kh',8,'Straight flush'],
 ])('evaluates %s',(s,c,n)=>{expect(evaluate(cards(s)).category).toBe(c);expect(evaluate(cards(s)).name).toBe(n);});
 it('accepts wheel and broadway but never wraps QKA23',()=>{expect(straightHigh([14,2,3,4,5])).toBe(5);expect(straightHigh([10,11,12,13,14])).toBe(14);expect(straightHigh([12,13,14,2,3])).toBe(0);});
 it('finds six-high over a wheel',()=>expect(evaluate(cards('As 2d 3c 4s 5h 6d Kh')).score).toEqual([4,6]));
 it('selects best full house from two trips',()=>expect(evaluate(cards('Ah Ad Ac Ks Kh Kd 2s')).score).toEqual([6,14,13]));
 it('selects highest two of three pairs and correct kicker',()=>expect(evaluate(cards('Ah Ad Kc Ks Qh Qd 2s')).score).toEqual([2,14,13,12]));
 it('flush ranks beat a straight in another suit',()=>expect(evaluate(cards('2h 4h 6h 8h Th 5s 7c')).category).toBe(5));
 it('uses the board when it is best',()=>{const a=evaluate(cards('2c 3c As Ks Qs Js Ts')),b=evaluate(cards('Ah Ad As Ks Qs Js Ts'));expect(a.cards).toEqual(cards('As Ks Qs Js Ts'));expect(compare(a.score,b.score)).toBe(0);});
 it('compares kickers and pair ranks lexicographically',()=>{expect(compare(evaluate(cards('As Ad Kc Qh 7s')).score,evaluate(cards('Ah Ac Kd Jh 9s')).score)).toBeGreaterThan(0);});
 it('rejects duplicate or wrong-length inputs',()=>{expect(()=>evaluate(cards('As Ks'))).toThrow();expect(()=>evaluate(['As','As','Ks','Qs','Js'])).toThrow();});
});
describe('explicit legal straight completions',()=>{
 const cases:[string,string,string,number[]][]=[['7s 6s','5h 4d Qc','Open-ended',[3,8]],['Qh Ts','Kd Jc 7h','Open-ended',[9,14]],['As 2d','3h 4c Kh','Gutshot',[5]],['Jh Qd','Kc As 3s','Gutshot',[10]],['Jc 9d','Th 7s Kc','Double-gutshot',[8,12]],['2s 3d','4h 5c Kd','Open-ended',[6,14]],['As 2d','3h 5c Kh','Gutshot',[4]],['As Kd','Qh 2c 3d','No straight draw',[]],['8s 7d','6h 3c 2d','No straight draw',[]],['As Ks','Qh Jc Td','Made straight',[]],['7s 6d','5h 4c 3d','Made straight',[]],['Ah Ad','8h 8c 2d','No straight draw',[]],['Js 9d','Th 7c Kd 2h','Double-gutshot',[8,12]],['As Kd','2h 3c 4d 7h','Gutshot',[5]]];
 it.each(cases)('%s on %s is %s',(h,b,kind,rs)=>{const d=straightDraw(cards(h),cards(b));expect(d.kind).toBe(kind);expect([...new Set(d.completions.map(c=>c.rank))].sort((a,b)=>a-b)).toEqual(rs.sort((a,b)=>a-b));expect(d.outs.length).toBe(rs.length*4);});
 it('reports no future draw on a completed river',()=>expect(straightDraw(cards('7s 6s'),cards('5h 4d Qc Kc Ah')).kind).toBe('No straight draw'));
 it('reports shared board draws',()=>expect(straightDraw(cards('Ah Ad'),cards('5c 6d 7s 8h')).shared).toBe(true));
 it('does not double-count the same rank in multiple sequences',()=>{const d=straightDraw(cards('9s Ts'),cards('7h 8d Qc'));expect(d.kind).toBe('Open-ended');expect(new Set(d.outs).size).toBe(d.outs.length);});
 it('matches an independent rank-mask oracle for every five- and six-rank subset',()=>{
   function oracle(rs:number[]){let mask=0;rs.forEach(r=>mask|=1<<(r-2));if((mask&0x100f)===0x100f)return true;for(let low=0;low<=8;low++)if((mask&(31<<low))===(31<<low))return true;return false;}
   for(let mask=0;mask<8192;mask++){const rs=Array.from({length:13},(_,i)=>i+2).filter(r=>mask&(1<<(r-2)));if(rs.length!==5&&rs.length!==6)continue;const cs=rs.map((r,i)=>'23456789TJQKA'[r-2]+'cdhs'[i%4]),d=straightDraw(cs.slice(0,2),cs.slice(2));if(oracle(rs)){expect(d.kind).toBe('Made straight');continue;}const expected=Array.from({length:13},(_,i)=>i+2).filter(r=>!rs.includes(r)&&oracle([...rs,r]));expect([...new Set(d.completions.map(c=>c.rank))].sort((a,b)=>a-b)).toEqual(expected);expect(d.outs.length).toBe(expected.length*4);}
 });
});
describe('flush and pair features',()=>{
 it('recognizes a flush and does not call it a flush draw',()=>{const f=features(cards('Ah Jh'),cards('2h 8h Th'));expect(f.made?.name).toBe('Flush');expect(f.flushDraws).toHaveLength(0);});
 it('finds nine flush completion cards',()=>{const f=features(cards('Ah Jh'),cards('2h 8h Tc'));expect(f.flushDraws[0].outs).toHaveLength(9);});
 it('handles a shared four-flush turn',()=>expect(features(cards('As Kd'),cards('2h 8h Th 4h')).flushDraws[0].shared).toBe(true));
 it.each([['As Ad','Kh 8h 2c','Overpair'],['3s 3d','Kh 8h 5c','Underpair'],['As Kd','Kh 8h 5c','Top pair'],['As 8d','Kh 8h 5c','Middle pair'],['As 5d','Kh 8h 5c','Bottom pair']])('labels pair relation', (h,b,label)=>expect(features(cards(h),cards(b)).pairRelation).toBe(label));
 it('counts overcards and board pairing',()=>{const f=features(cards('As Kd'),cards('Qh Qc 2s'));expect(f.overcards).toBe(2);expect(f.boardPaired).toBe(true);});
});
describe('pots, stacks, positions and hidden future information',()=>{
 it('uses call / final pot',()=>expect(potOdds(12,6)).toEqual({call:6,finalPot:24,equity:.25}));
 it('handles an overbet and caps an all-in call',()=>{expect(potOdds(10,20).equity).toBe(.4);expect(potOdds(12,6,3).equity).toBe(3/21);});
 it('rejects negative amounts',()=>expect(()=>potOdds(12,-6)).toThrow());
 it('maps six seats and short-handed gaps',()=>{expect([...positions([1,2,3,4,5,6],4).values()]).toEqual(['BTN','SB','BB','UTG','HJ','CO']);expect(positions([1,4],1).get(1)).toBe('SB');expect([...positions([1,3,6],3).values()]).toEqual(['BTN','SB','BB']);});
 it('freezes before a river call with no shown opponent cards or payout',()=>{const h=parseHand(river),idx=h.actions.findIndex(a=>a.player==='Hero'&&a.street==='river'&&a.kind==='call'),d=decisionFacts(h,idx);expect(d.call).toBe(36);expect(d.state.pot).toBe(87);expect(d.finalPot).toBe(123);expect(d.requiredEquity).toBe(36/123);expect(d.state.seats.find(s=>s.name==='Player6')?.revealed).toEqual([]);expect(d.state.seats.every(s=>s.collected===0)).toBe(true);});
 it('does not expose a river at a turn decision',()=>{const h=parseHand(river),idx=h.actions.findIndex(a=>a.player==='Hero'&&a.street==='turn'&&a.kind==='bet');expect(snapshot(h,idx).board).toEqual(cards('Qs 8h 4s 2c'));});
 it('accounts for raise-to, returns and side-pot payouts',()=>{const a=parseHand(headsUp);expect(snapshot(a,a.actions.length).seats.find(s=>s.name==='Hero')?.invested).toBe(200);const b=parseHand(preflop);expect(b.heroNet).toBe(3);const c=parseHand(sidePot);expect(c.heroNet).toBe(-5);expect(snapshot(c,c.actions.length).pot).toBe(250);});
 it('every transition conserves ledger chips',()=>{for(const raw of [river,preflop,headsUp,sidePot]){const h=parseHand(raw),initial=h.seats.reduce((s,p)=>s+p.stack,0);for(let i=0;i<=h.actions.length;i++){const s=snapshot(h,i);expect(s.seats.reduce((t,p)=>t+p.remaining-p.collected,0)+s.pot).toBe(initial);expect(s.seats.every(p=>p.remaining>=0)).toBe(true);}}});
 it('excludes inaccessible side-pot chips from a short all-in caller’s odds',()=>{const h=parseHand(sidePot);h.hero='Short';const idx=h.actions.findIndex(a=>a.player==='Short'&&a.kind==='call'),f=decisionFacts(h,idx);expect(f.call).toBe(49);expect(f.finalPot).toBe(152);expect(f.eligiblePot).toBe(102);expect(f.sidePotExcluded).toBe(50);expect(f.requiredEquity).toBe(49/102);});
});
