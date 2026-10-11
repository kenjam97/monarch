import { cards, validateCards } from '../poker/cards';
import { positions, snapshot } from '../poker/replay';
import { validateActions } from '../poker/actions';
import type { Action, Hand, Seat, Street } from '../poker/types';
export interface ParseIssue { id: string; message: string; raw: string }
export interface ParseResult { hands: Hand[]; issues: ParseIssue[] }
export interface HistoryParser { id: string; accepts(text:string):boolean; parse(text:string):ParseResult }
export function cents(value: string): number { const v=value.replace(/[$€£¥,\s]/g,''); if(!/^\d+(?:\.\d{1,2})?$/.test(v)) throw new Error(`Unsupported chip amount: ${value}`); return Math.round(Number(v)*100); }
const money='([$€£¥]?[\\d,]+(?:\\.\\d+)?)';
function bracketCards(line:string) { return cards([...line.matchAll(/\[([^\]]*)\]/g)].map(m=>m[1]).join(' ')); }
export function parseHand(raw:string):Hand {
  const lines=raw.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean),header=lines[0];
  const id=header.match(/(?:Poker|GGPoker) Hand\s+#([^:\s]+):/i)?.[1];
  if(!id) throw new Error('Missing GGPoker hand identifier.');
  if(!/Hold['’]?em No Limit/i.test(header)||/Tournament|Short Deck/i.test(header)) throw new Error('Only No-Limit Hold’em cash histories are supported.');
  if(/\*\*\*\s*(FIRST|SECOND|THIRD)|cashout|cash out|straddle|insurance|EV Cashout|bomb pot/i.test(raw)) throw new Error('Multi-board, cash-out, insurance, bomb-pot, or straddle history needs manual review; not imported.');
  const stakes=header.match(new RegExp('\\('+money+'\\s*/\\s*'+money+'\\)'));
  if(!stakes) throw new Error('Missing cash-game stakes.');
  const dt=header.match(/(\d{4})[/-](\d{2})[/-](\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if(!dt) throw new Error('Missing hand timestamp.');
  const date=`${dt[1]}-${dt[2]}-${dt[3]}T${dt[4]}`;
  if(!Number.isFinite(Date.parse(date+'Z'))||new Date(date+'Z').toISOString().slice(0,19)!==date) throw new Error('Invalid hand timestamp.');
  const tableLine=lines.find(l=>/^Table\s/i.test(l))??'', table=tableLine.match(/Table\s+['"](.+?)['"]/i)?.[1], button=Number(tableLine.match(/Seat\s+#(\d+)\s+is the button/i)?.[1]);
  if(!table||!button) throw new Error('Missing table or dealer button.');
  const seats:Seat[]=[];
  for(const l of lines) { const s=l.match(new RegExp('^Seat (\\d+): (.+?) \\('+money+' in chips\\)'));if(s) seats.push({seat:Number(s[1]),name:s[2],stack:cents(s[3]),position:'UTG',cards:[]}); }
  if(seats.length<2||seats.length>6||new Set(seats.map(s=>s.name)).size!==seats.length||new Set(seats.map(s=>s.seat)).size!==seats.length) throw new Error('Expected two to six uniquely identified seats.');
  const pos=positions(seats.map(s=>s.seat),button);seats.forEach(s=>s.position=pos.get(s.seat)!);
  let hero='',street:Street='preflop',board:string[]=[],inSummary=false,totalPot:number|undefined,rake=0;
  const actions:Action[]=[],streetContrib=new Map<string,number>();
  const push=(a:Omit<Action,'index'|'street'>)=>actions.push({...a,index:actions.length,street});
  for(const l of lines.slice(1)) {
    if(/^\*\*\* SUMMARY/.test(l)) {inSummary=true;continue;}
    if(inSummary) {
      const total=l.match(new RegExp('^Total pot '+money)); if(total) {totalPot=cents(total[1]);rake=[...l.matchAll(new RegExp('(?:Rake|Jackpot|Bingo|Fortune|Tax) '+money,'g'))].reduce((s,m)=>s+cents(m[1]),0);}
      continue;
    }
    const dealt=l.match(/^Dealt to (.+?)\s+\[([^\]]+)\]/);
    if(dealt) {if(hero&&hero!==dealt[1]) throw new Error('Multiple dealt hero identities.');hero=dealt[1];const seat=seats.find(s=>s.name===hero);if(!seat)throw new Error('Hero seat missing.');seat.cards=cards(dealt[2]);if(seat.cards.length!==2)throw new Error('Expected two hero cards.');continue;}
    const deal=l.match(/^\*\*\* (FLOP|TURN|RIVER) \*\*\*/);
    if(deal) {const next=deal[1].toLowerCase() as Street,newBoard=bracketCards(l),expected=next==='flop'?3:next==='turn'?4:5;if(newBoard.length!==expected||board.some((c,i)=>newBoard[i]!==c)||(['preflop','flop','turn','river'].indexOf(next)!==['preflop','flop','turn','river'].indexOf(street)+1)) throw new Error('Inconsistent board progression.');board=newBoard;street=next;streetContrib.clear();push({kind:'deal',amount:0,cards:board,text:l});continue;}
    if(/^\*\*\* SHOW\s?DOWN/.test(l)) {street='showdown';continue;}
    const returned=l.match(new RegExp('^Uncalled bet \\('+money+'\\) returned to (.+)$','i'));
    if(returned) {const amount=cents(returned[1]);push({kind:'return',player:returned[2],amount,text:l});streetContrib.set(returned[2],(streetContrib.get(returned[2])??0)-amount);continue;}
    const collected=l.match(new RegExp('^(.+?) collected '+money+' from (?:.*pot)','i'));
    if(collected) {push({kind:'collect',player:collected[1],amount:cents(collected[2]),text:l});continue;}
    const actor=seats.find(s=>l.startsWith(s.name+': '));if(!actor) {if(/^(Table |Seat |Dealt to |\*\*\*|Board )/.test(l)) continue; throw new Error(`Unrecognized history line: ${l.slice(0,140)}`);}
    const text=l.slice(actor.name.length+2), base={player:actor.name,text:l,allIn:/all-in/i.test(text)};
    if(/^folds/.test(text)) {push({...base,kind:'fold',amount:0});continue;}
    if(/^checks/.test(text)) {push({...base,kind:'check',amount:0});continue;}
    if(/^shows /.test(text)) {const shown=bracketCards(text);if(shown.length!==2)throw new Error('Invalid shown cards.');if(actor.cards.length&&[...actor.cards].sort().join()!==[...shown].sort().join())throw new Error('Shown cards conflict with dealt cards.');actor.cards=shown;push({...base,kind:'show',amount:0,cards:shown});continue;}
    if(/^(mucks|doesn't show hand)/.test(text)) continue;
    const raise=text.match(new RegExp('^raises '+money+' to '+money));
    if(raise) {const to=cents(raise[2]),amount=to-(streetContrib.get(actor.name)??0);if(amount<=0)throw new Error('Invalid raise-to amount.');streetContrib.set(actor.name,to);push({...base,kind:'raise',amount,to});continue;}
    const wager=text.match(new RegExp('^(posts small blind|posts big blind|posts (?:the )?ante|calls|bets) '+money));
    if(wager) {const kind=wager[1]==='posts small blind'?'small-blind':wager[1]==='posts big blind'?'big-blind':wager[1].includes('ante')?'ante':wager[1]==='calls'?'call':'bet', amount=cents(wager[2]);if(kind!=='ante')streetContrib.set(actor.name,(streetContrib.get(actor.name)??0)+amount);push({...base,kind,amount});continue;}
    throw new Error(`Unrecognized action: ${l}`);
  }
  if(!hero)throw new Error('No dealt hero cards found.');
  if(totalPot===undefined)throw new Error('Incomplete history: summary total is missing.');
  validateCards([...board,...seats.flatMap(s=>s.cards)]);
  const hand:Hand={id,date,table,button,smallBlind:cents(stakes[1]),bigBlind:cents(stakes[2]),currency:header.includes('€')?'EUR':header.includes('£')?'GBP':header.includes('¥')?'CNY':'USD',hero,seats,actions,board,raw,totalPot,rake,heroNet:0,warnings:[]};
  if(hand.bigBlind<=0||hand.smallBlind<=0||hand.smallBlind>hand.bigBlind)throw new Error('Invalid blinds.');
  validateActions(hand);
  // Validate every transition; a bad ledger must not become a convincing replay.
  const remaining=new Map(seats.map(s=>[s.name,s.stack])),contrib=new Map(seats.map(s=>[s.name,0]));
  for(const a of actions) {if(!a.player)continue;if(!remaining.has(a.player))throw new Error('Action by an unknown player.');if(['small-blind','big-blind','ante','call','bet','raise'].includes(a.kind)){remaining.set(a.player,remaining.get(a.player)!-a.amount);contrib.set(a.player,contrib.get(a.player)!+a.amount);}if(a.kind==='return'){remaining.set(a.player,remaining.get(a.player)!+a.amount);contrib.set(a.player,contrib.get(a.player)!-a.amount);}if(remaining.get(a.player)!<0||contrib.get(a.player)!<0)throw new Error('Contributions exceed a stack or returned bet.');}
  const end=snapshot(hand,actions.length),heroEnd=end.seats.find(s=>s.name===hero)!;
  if(Math.abs(end.pot-totalPot)>1)throw new Error(`Pot mismatch: ledger ${end.pot} cents, summary ${totalPot} cents.`);
  const payout=actions.filter(a=>a.kind==='collect').reduce((s,a)=>s+a.amount,0);
  if(Math.abs(payout+rake-totalPot)>1)throw new Error('Payouts plus fees do not reconcile to the pot.');
  hand.heroNet=heroEnd.collected-heroEnd.invested;
  if(hand.currency!=='USD')hand.warnings.push('Amounts normalized to big blinds; this is not a USD table.');
  return hand;
}
export const ggParser:HistoryParser={id:'gg-cash-v1',accepts:text=>/(?:Poker|GGPoker) Hand\s+#/i.test(text),parse(text){
  const clean=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'),starts=[...clean.matchAll(/^\s*(?:Poker|GGPoker) Hand\s+#/gm)].map(m=>m.index!),hands:Hand[]=[],issues:ParseIssue[]=[];
  if(!starts.length)return {hands,issues:[{id:'unknown',message:'No GGPoker cash hand headers found. Export text histories from PokerCraft.',raw:text}]};
  for(let i=0;i<starts.length;i++){const raw=clean.slice(starts[i],starts[i+1]??clean.length).trim();try{hands.push(parseHand(raw));}catch(e){issues.push({id:raw.match(/Hand\s+#([^:\s]+)/)?.[1]??'unknown',message:(e as Error).message,raw});}}return {hands,issues};
}};
