import type { Hand } from './types';
// Validate the observed ledger without inventing missing actions or outcomes.
export function validateActions(h:Hand) {
  const seats=new Map(h.seats.map(s=>[s.name,{remaining:s.stack,bet:0,invested:0,folded:false}]));let current=0;
  for(const a of h.actions){
    if(a.kind==='deal'){seats.forEach(s=>s.bet=0);current=0;continue;}
    if(!a.player)continue;const s=seats.get(a.player);if(!s)throw new Error('Action by an unknown player.');
    if(['fold','check','call','bet','raise'].includes(a.kind)){
      if(s.folded)throw new Error('Folded player acts again.');
      if(s.remaining===0)throw new Error('All-in player takes another betting action.');
      if(a.kind==='check'&&s.bet<current)throw new Error('Player checks while facing a bet.');
      if(a.kind==='call'&&a.amount!==Math.min(s.remaining,current-s.bet))throw new Error('Call amount does not match the outstanding wager.');
      if(a.kind==='bet'&&current>0)throw new Error('Bet recorded while facing an existing bet.');
      if(a.kind==='raise'&&(a.to??0)<=current)throw new Error('Raise does not increase the wager.');
    }
    if(['small-blind','big-blind','ante','bet','call','raise'].includes(a.kind)){if(a.amount<=0||a.amount>s.remaining)throw new Error('Invalid wager or stack underflow.');s.remaining-=a.amount;s.invested+=a.amount;if(a.kind!=='ante')s.bet+=a.amount;current=Math.max(current,s.bet);}
    if(a.kind==='fold')s.folded=true;
    if(a.kind==='return'){if(a.amount>s.bet)throw new Error('Returned bet exceeds street contribution.');s.bet-=a.amount;s.invested-=a.amount;s.remaining+=a.amount;current=Math.max(...[...seats.values()].map(p=>p.bet));}
  }
}
