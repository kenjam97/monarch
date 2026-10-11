import type { Hand, Position, Snapshot } from './types';
export function positions(seats: number[],button: number): Map<number,Position> {
  const sorted=[...seats].sort((a,b)=>a-b),idx=sorted.indexOf(button); if(idx<0) throw new Error('Dealer seat not found.');
  const rotated=[...sorted.slice(idx),...sorted.slice(0,idx)];
  const labels: Position[]=seats.length===2?['SB','BB']:['BTN','SB','BB',...(['UTG','HJ','CO'] as Position[]).slice(6-seats.length)];
  return new Map(rotated.map((s,i)=>[s,labels[i]]));
}
export function snapshot(hand: Hand,count: number): Snapshot {
  const state:Snapshot={street:'preflop',board:[],pot:0,seats:hand.seats.map(s=>({...s,cards:[],remaining:s.stack,bet:0,invested:0,collected:0,folded:false,revealed:s.name===hand.hero?s.cards:[],lastAction:''})),currentBet:0,count:Math.max(0,Math.min(count,hand.actions.length))};
  for(const a of hand.actions.slice(0,state.count)) {
    state.last=a;state.street=a.street;
    if(a.kind==='deal') {state.board=a.cards??[];state.seats.forEach(s=>{s.bet=0;s.lastAction='';});state.currentBet=0;continue;}
    const seat=state.seats.find(s=>s.name===a.player);if(!seat) continue;
    seat.lastAction=a.kind;
    if(a.kind==='fold') seat.folded=true;
    if(['small-blind','big-blind','ante','call','bet','raise'].includes(a.kind)) {
      seat.remaining-=a.amount;seat.invested+=a.amount;state.pot+=a.amount;if(a.kind!=='ante') seat.bet+=a.amount;state.currentBet=Math.max(state.currentBet,seat.bet);
    }
    if(a.kind==='return') {seat.remaining+=a.amount;seat.invested-=a.amount;seat.bet-=a.amount;state.pot-=a.amount;state.currentBet=Math.max(...state.seats.map(s=>s.bet));}
    if(a.kind==='collect'||a.kind==='show') {state.seats.forEach(s=>s.bet=0);state.currentBet=0;}
    if(a.kind==='collect') {seat.remaining+=a.amount;seat.collected+=a.amount;}
    if(a.kind==='show') seat.revealed=a.cards??[];
  } return state;
}
export function decisionFacts(hand:Hand,index:number) {
  const state=snapshot(hand,index), hero=state.seats.find(s=>s.name===hand.hero)!;
  const call=Math.max(0,Math.min(hero.remaining,state.currentBet-hero.bet));
  const opponents=state.seats.filter(s=>!s.folded&&s.name!==hand.hero);
  const effective=Math.min(hero.remaining,Math.max(0,...opponents.map(s=>s.remaining)));
  const finalPot=state.pot+call,cap=hero.invested+call;
  // An all-in caller cannot win side-pot contributions above their total commitment.
  const eligiblePot=call?state.seats.reduce((sum,s)=>sum+Math.min(s.invested,cap),0)+call:state.pot;
  return {state,call,finalPot,eligiblePot,sidePotExcluded:finalPot-eligiblePot,requiredEquity:call/(eligiblePot||1),effective,spr:state.pot?effective/state.pot:null};
}
export const potOdds=(potBeforeBet:number,bet:number,call=bet)=>{if([potBeforeBet,bet,call].some(x=>!Number.isFinite(x)||x<0))throw new Error('Amounts must be non-negative.');return {call,finalPot:potBeforeBet+bet+call,equity:call/(potBeforeBet+bet+call||1)};};
