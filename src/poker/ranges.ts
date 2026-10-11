import { POSITIONS, type Position } from './types';
export const GRID_RANKS='AKQJT98765432';
export const gridClass=(row:number,col:number)=>row===col?GRID_RANKS[row]+GRID_RANKS[col]:row<col?GRID_RANKS[row]+GRID_RANKS[col]+'s':GRID_RANKS[col]+GRID_RANKS[row]+'o';
export type RangeAction='open'|'fold'|'call'|'3-bet'|'mixed'|'unknown';
export type RangeContext='unopened'|'facing-open'|'facing-limpers'|'facing-3bet';
export const CONTEXTS:RangeContext[]=['unopened','facing-open','facing-limpers','facing-3bet'];
export const RANGE_ACTIONS:RangeAction[]=['open','fold','call','3-bet','mixed','unknown'];
export type RangeBook=Record<string,Record<string,RangeAction>>;
export const rangeKey=(position:Position,context:RangeContext)=>`${position}:${context}`;
const opens:Record<Position,string>={UTG:'77 88 99 TT JJ QQ KK AA ATs AJs AQs AKs KJs KQs QJs JTs T9s AQo AKo',HJ:'66 77 88 99 TT JJ QQ KK AA A9s ATs AJs AQs AKs KTs KJs KQs QTs QJs JTs T9s 98s AJo AQo AKo KQo',CO:'44 55 66 77 88 99 TT JJ QQ KK AA A2s A3s A4s A5s A6s A7s A8s A9s ATs AJs AQs AKs K9s KTs KJs KQs Q9s QTs QJs J9s JTs T9s 98s 87s 76s ATo AJo AQo AKo KJo KQo QJo',BTN:'22 33 44 55 66 77 88 99 TT JJ QQ KK AA A2s A3s A4s A5s A6s A7s A8s A9s ATs AJs AQs AKs K5s K6s K7s K8s K9s KTs KJs KQs Q8s Q9s QTs QJs J8s J9s JTs T8s T9s 97s 98s 86s 87s 75s 76s 65s 54s A8o A9o ATo AJo AQo AKo KTo KJo KQo QTo QJo JTo',SB:'22 33 44 55 66 77 88 99 TT JJ QQ KK AA A2s A3s A4s A5s A6s A7s A8s A9s ATs AJs AQs AKs K7s K8s K9s KTs KJs KQs Q9s QTs QJs J9s JTs T9s 98s 87s 76s 65s A9o ATo AJo AQo AKo KTo KJo KQo QJo',BB:''};
export function defaultRanges():RangeBook {
  const result:RangeBook={};for(const p of POSITIONS)for(const context of CONTEXTS){const cells:Record<string,RangeAction>={};for(let r=0;r<13;r++)for(let c=0;c<13;c++)cells[gridClass(r,c)]='fold';
    if(context==='unopened') {opens[p].split(' ').filter(Boolean).forEach(h=>cells[h]='open');if(p==='BB')Object.keys(cells).forEach(h=>cells[h]='unknown');}
    if(context==='facing-limpers'){opens[p==='BB'?'HJ':p].split(' ').filter(Boolean).forEach(h=>cells[h]='open');}
    if(context==='facing-open') {('QQ KK AA AKs AKo'+(p==='BB'||p==='BTN'?' JJ AQs':'')).split(' ').forEach(h=>cells[h]='3-bet');if(p==='BB')'22 33 44 55 66 77 88 99 TT A2s A3s A4s A5s A6s A7s A8s A9s ATs AJs KTs KJs KQs QTs QJs JTs T9s 98s 87s 76s AQo'.split(' ').forEach(h=>cells[h]='call');}
    if(context==='facing-3bet'){Object.keys(cells).forEach(h=>cells[h]='unknown');'AA KK'.split(' ').forEach(h=>cells[h]='mixed');}
    result[rangeKey(p,context)]=cells;
  }return result;
}
export const rangeDescription:Record<RangeContext,string>={unopened:'100 BB · folded to you · no ante. An editable tight-aggressive starting point.', 'facing-open':'100 BB · versus one 2.5 BB open, no callers. Simplified conservative baseline; opener position matters.', 'facing-limpers':'100 BB · one limper, no raise. Open means isolation raise; adjust for additional limpers.', 'facing-3bet':'100 BB · you opened and face a 3-bet. Unconfigured by default: sizes and positions matter too much for a blanket answer.'};
