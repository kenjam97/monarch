import { handClass } from '../poker/cards';
import { features } from '../poker/draws';
import { decisionFacts, snapshot } from '../poker/replay';
import { rangeKey, type RangeBook, type RangeContext } from '../poker/ranges';
import { type Hand, type Position, POSITIONS } from '../poker/types';
export interface Metrics { hands:number;netBB:number;vpip:number;pfr:number;threeBet:number;threeBetOpp:number;steal:number;stealOpp:number;sawFlop:number;showdown:number;wonShowdown:number;cbetFlop:number;cbetFlopOpp:number;cbetTurn:number;cbetTurnOpp:number;foldCbet:number;foldCbetOpp:number;riverCalls:number;riverInvested:number;riverCallShowdowns:number;riverCallWins:number;riverCallNet:number;riverFolds:number;riverLowMadeCalls:number;riverCallLosingHands:number;riverLargeLosingCalls:number;coldCalls:number;limps:number }
export function blankMetrics():Metrics{return {hands:0,netBB:0,vpip:0,pfr:0,threeBet:0,threeBetOpp:0,steal:0,stealOpp:0,sawFlop:0,showdown:0,wonShowdown:0,cbetFlop:0,cbetFlopOpp:0,cbetTurn:0,cbetTurnOpp:0,foldCbet:0,foldCbetOpp:0,riverCalls:0,riverInvested:0,riverCallShowdowns:0,riverCallWins:0,riverCallNet:0,riverFolds:0,riverLowMadeCalls:0,riverCallLosingHands:0,riverLargeLosingCalls:0,coldCalls:0,limps:0};}
export function metrics(hand:Hand,player=hand.hero):Metrics {
  const m=blankMetrics();m.hands=1;
  const seat=hand.seats.find(s=>s.name===player)!;const end=snapshot(hand,hand.actions.length),final=end.seats.find(s=>s.name===player)!;m.netBB=(final.collected-final.invested)/hand.bigBlind;
  const pre=hand.actions.filter(a=>a.street==='preflop'),own=pre.filter(a=>a.player===player);
  m.vpip=+own.some(a=>['call','bet','raise'].includes(a.kind));m.pfr=+own.some(a=>a.kind==='raise');
  let raises=0,limps=0,hasVoluntary=false;
  for(const a of pre){if(a.player===player&&['call','raise','fold','check'].includes(a.kind)){
    if(raises===1){m.threeBetOpp=1;if(a.kind==='raise')m.threeBet=1;}
    if(!raises&&!limps&&['CO','BTN','SB'].includes(seat.position)){m.stealOpp=1;if(a.kind==='raise')m.steal=1;}
    if(a.kind==='call'&&raises>0&&!hasVoluntary&&seat.position!=='BB'&&seat.position!=='SB')m.coldCalls=1;
    if(a.kind==='call'&&!raises)m.limps=1;
    if(['call','raise'].includes(a.kind))hasVoluntary=true;
  }if(a.kind==='raise')raises++;if(a.kind==='call'&&!raises)limps++;}
  const flopIndex=hand.actions.findIndex(a=>a.kind==='deal'&&a.street==='flop');m.sawFlop=+(flopIndex>=0&&!pre.some(a=>a.player===player&&a.kind==='fold'));
  m.showdown=+(!!m.sawFlop&&!final.folded&&hand.actions.some(a=>a.kind==='show'));m.wonShowdown=+(!!m.showdown&&final.collected>0);
  const aggressor=pre.filter(a=>a.kind==='raise').at(-1)?.player;
  let flopCbetter:string|undefined;
  for(const st of ['flop','turn'] as const) {
    const acts=hand.actions.filter(a=>a.street===st&&['bet','raise','call','check','fold'].includes(a.kind)),firstBet=acts.find(a=>a.kind==='bet'||a.kind==='raise');
    const candidate=st==='flop'?aggressor:flopCbetter;
    const first=acts.find(a=>a.player===candidate);
    const opportunity=first&&(!firstBet||first.index<=firstBet.index);
    if(candidate===player&&opportunity){if(st==='flop'){m.cbetFlopOpp=1;m.cbetFlop=+(first.kind==='bet');}else{m.cbetTurnOpp=1;m.cbetTurn=+(first.kind==='bet');}}
    if(st==='flop'&&firstBet&&firstBet.player===aggressor){flopCbetter=aggressor;const response=acts.find(a=>a.player===player&&a.index>firstBet.index);if(player!==aggressor&&response&&!acts.some(a=>a.index>firstBet.index&&a.index<response.index&&a.kind==='raise')){m.foldCbetOpp=1;m.foldCbet=+(response.kind==='fold');}}
  }
  const calls=hand.actions.filter(a=>a.street==='river'&&a.player===player&&a.kind==='call');
  m.riverCalls=calls.length;m.riverInvested=calls.reduce((s,a)=>s+a.amount/hand.bigBlind,0);m.riverFolds=hand.actions.filter(a=>a.street==='river'&&a.player===player&&a.kind==='fold').length;
  if(calls.length){m.riverLowMadeCalls=seat.cards.length===2?calls.filter(a=>(features(seat.cards,snapshot(hand,a.index).board).made?.category??9)<=1).length:0;m.riverCallLosingHands=+(m.netBB<0);m.riverLargeLosingCalls=m.netBB<0?calls.filter(a=>a.amount>=10*hand.bigBlind).length:0;m.riverCallShowdowns=m.showdown;m.riverCallWins=m.wonShowdown;m.riverCallNet=m.netBB;}
  return m;
}
export function addMetrics(ms:Metrics[]) {const result=blankMetrics();for(const m of ms)for(const k of Object.keys(result) as (keyof Metrics)[])result[k]+=m[k];return result;}
export const percent=(n:number,d:number)=>d?100*n/d:null;
export function aggregate(hands:Hand[]) {return {total:addMetrics(hands.map(h=>metrics(h))),positions:POSITIONS.map(p=>({position:p,...addMetrics(hands.filter(h=>h.seats.find(s=>s.name===h.hero)?.position===p).map(h=>metrics(h)))}))};}
export interface Candidate { id:string;handId:string;actionIndex:number;title:string;reason:string;priority:number;street:string;amountBB:number;category:string }
export function reviewCandidates(h:Hand,ranges:RangeBook):Candidate[] {
  const out:Candidate[]=[],hero=h.seats.find(s=>s.name===h.hero)!;
  const add=(i:number,title:string,reason:string,priority:number,category:string)=>{const a=h.actions[i];out.push({id:`${h.id}:${i}:${category}`,handId:h.id,actionIndex:i,title,reason,priority,street:a.street,amountBB:a.amount/h.bigBlind,category});};
  for(const a of h.actions.filter(a=>a.player===h.hero&&['call','raise','bet','fold','check'].includes(a.kind))) {
    const f=decisionFacts(h,a.index);
    if(a.street==='river'&&a.kind==='call')add(a.index,'River call',`River call of ${(a.amount/h.bigBlind).toFixed(1)} BB. Rebuild villain's value and bluff range before seeing the result.`,100+a.amount/h.bigBlind,'river');
    if(a.street==='river'&&a.kind==='fold'&&f.call>=5*h.bigBlind)add(a.index,'River fold',`You declined ${(f.call/h.bigBlind).toFixed(1)} BB more. Open reviews; money not invested is not proven EV saved.`,65,'river-fold');
    if(a.street==='preflop') {
      const before=h.actions.slice(0,a.index).filter(x=>x.street==='preflop'),raises=before.filter(x=>x.kind==='raise'),limpers=before.filter(x=>x.kind==='call');
      const context:RangeContext=raises.length>=2?'facing-3bet':raises.length?'facing-open':limpers.length?'facing-limpers':'unopened';
      const base=ranges[rangeKey(hero.position,context)]?.[handClass(hero.cards)];const actual=a.kind==='raise'?(raises.length?'3-bet':'open'):a.kind==='call'?'call':a.kind==='fold'?'fold':'unknown';
      const firstDecision=!before.some(x=>x.player===h.hero&&['call','raise','fold','check'].includes(x.kind));
      if(firstDecision&&base&&base!=='unknown'&&base!=='mixed'&&base!==actual)add(a.index,'Range deviation',`${hero.position} ${handClass(hero.cards)} · baseline ${base}, actual ${actual}. ${context.replaceAll('-',' ')}; stack depth, sizing and reads can justify deviations.`,70,'range');
    }
    if(['flop','turn'].includes(a.street)&&a.kind==='call') {
      const fact=features(hero.cards,f.state.board),drawOuts=new Set([...fact.straight.outs,...fact.flushDraws.flatMap(d=>d.outs)]).size,nextCard=drawOuts/(52-hero.cards.length-f.state.board.length);
      if(fact.made?.category===0&&!drawOuts)add(a.index,'High-card call',`A call with high card and no one-card straight or flush draw. Overcards and backdoors may matter; review your plan.`,60,'draw');
      else if(drawOuts&&f.requiredEquity>nextCard&&f.state.board.length===4)add(a.index,'Draw call',`${drawOuts} straight/flush completion cards give ${(nextCard*100).toFixed(1)}% next-card probability; the call needs ${(f.requiredEquity*100).toFixed(1)}% equity. Outs may be dirty; implied odds are uncertain.`,80,'draw');
    }
    if(a.amount>=30*h.bigBlind&&!out.some(c=>c.actionIndex===a.index))add(a.index,'Large investment',`${(a.amount/h.bigBlind).toFixed(1)} BB invested at this decision. Compare the line with the information then available.`,50,'big-pot');
  }return out;
}
export function potentialLeaks(m:Metrics) {const out:{title:string;detail:string;category:string}[]=[];if(m.hands>=100&&((m.vpip-m.pfr)/m.hands)>0.1)out.push({title:'VPIP and PFR gap',detail:`${m.vpip} voluntary entries, ${m.pfr} raises in ${m.hands} hands. Review passive entries and dominated calls.`,category:'range'});if(m.hands>=100&&m.limps/m.hands>0.06)out.push({title:'Limp frequency',detail:`${m.limps} hands entered by limping. Review position and isolation opportunities.`,category:'range'});if(m.riverCalls>=5)out.push({title:'River-call review',detail:`${m.riverCalls} calls · ${m.riverInvested.toFixed(1)} BB invested. Frequency alone does not prove a leak.`,category:'river'});if(m.hands>=100&&m.coldCalls/m.hands>0.06)out.push({title:'Cold-call frequency',detail:`${m.coldCalls} non-blind cold calls. Check your baseline and the opener range.`,category:'range'});return out;}
export function archetype(m:Metrics) {if(m.hands<30)return {name:'Unknown',hint:'Collect evidence through review. Fewer than 30 hands is too little for a label.',confidence:'Insufficient sample'};const vp=m.vpip/m.hands,pf=m.pfr/m.hands;if(vp>0.45&&pf<0.12)return {name:'Loose passive',hint:'Tentative read: favour value and reduce speculative bluffs. Calling-station behaviour needs postflop evidence.',confidence:m.hands<100?'Tentative':'Observed tendency'};if(vp<0.17&&pf<0.15)return {name:'Nit',hint:'Tentative read: respect strong action; look for late-position steal opportunities.',confidence:'Tentative'};if(vp>0.4&&pf>0.28)return {name:'Loose aggressive',hint:'Use position and a strong continuing range. Aggression is not evidence of a bluff.',confidence:'Tentative'};if(m.limps/m.hands>0.2)return {name:'Limp heavy',hint:'Review isolation opportunities and the hands that reach showdown.',confidence:'Tentative'};return {name:'Unclassified',hint:'Mixed evidence. Use specific actions and your notes over a broad label.',confidence:'Observed sample'};}
