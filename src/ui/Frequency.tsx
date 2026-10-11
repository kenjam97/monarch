import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { FolderInput } from 'lucide-react';
import { type CardSource, type Frequencies } from '../analysis/frequency';
import { GRID_RANKS } from '../poker/ranges';
import { POSITIONS } from '../poker/types';
import { Empty, Loading, dateLabel, useLoad, type PageProps } from './common';
import { TableRoom } from './TableRoom';

const sources: Record<CardSource, string> = { hole: 'Your cards', flop: 'Flop', turn: 'Turn', river: 'River' };
const suits = { s: '♠', h: '♥', c: '♣', d: '♦' };
const displayCard = (card: string) => card[0] + suits[card[1] as keyof typeof suits];
const number = (n: number) => n.toLocaleString('en-GB');
const percentage = (n: number, d: number) => d ? (100 * n / d).toFixed(2) + '%' : '—';
function arrowKey(event: KeyboardEvent<HTMLDivElement>, columns: number) {
 const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')], index = buttons.indexOf(event.target as HTMLButtonElement);
 if (index < 0) return;
 const offset = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key];
 if (offset === undefined) return;
 event.preventDefault(); buttons[Math.max(0, Math.min(buttons.length - 1, index + offset))]?.focus();
}
export function Frequency({ version, go, query }: PageProps & { query: URLSearchParams }) {
 const [view, setView] = useState(query.get('view') === 'cards' ? 'cards' : 'hands');
 const [source, setSource] = useState<CardSource>(Object.hasOwn(sources, query.get('source') || '') ? query.get('source') as CardSource : 'hole');
 const [selectedHand, setSelectedHand] = useState(query.get('hand') || 'AA'), [selectedCard, setSelectedCard] = useState(query.get('card') || 'As');
 const [position, setPosition] = useState(query.get('position') || ''), [session, setSession] = useState(query.get('session') || '');
 const [from, setFrom] = useState(query.get('from') || ''), [to, setTo] = useState(query.get('to') || '');
 const params = new URLSearchParams({ position, session, from, to });
 const { data, error } = useLoad<Frequencies>('/frequencies?' + params, version), { data: summary } = useLoad('/summary', version);
 const bookmark = new URLSearchParams({ ...Object.fromEntries(params), view, source, hand: selectedHand, card: selectedCard });
 useEffect(() => { history.replaceState(null, '', '#frequencies?' + bookmark); }, [bookmark.toString()]);
 const activeHand = data?.starting.find(cell => cell.hand === selectedHand) ?? data?.starting[0];
 const sample = data?.sources[source], activeCard = sample?.cards.find(cell => cell.card === selectedCard) ?? sample?.cards[0];
 const count = view === 'hands' ? activeHand?.count ?? 0 : activeCard?.count ?? 0;
 const denominator = view === 'hands' ? data?.known ?? 0 : sample?.hands ?? 0;
 const title = view === 'hands' ? activeHand?.hand ?? 'AA' : displayCard(activeCard?.card ?? 'As');
 const illustration = view === 'cards' ? [activeCard?.card ?? 'As'] : activeHand?.example.length ? activeHand.example : [title[0] + 's', title[1] + (title.endsWith('s') ? 's' : 'h')];
 const cards = sample ? [...'shcd'].flatMap(suit => [...GRID_RANKS].map(rank => sample.cards.find(cell => cell.card === rank + suit)!)) : [];
 const maximum = Math.max(1, ...(view === 'hands' ? data?.starting ?? [] : cards).map(cell => cell.count));
 const reference = activeHand ? activeHand.combinations / 1326 : 0;
 function openHands() {
  const drill = new URLSearchParams(params);
  if (view === 'hands') drill.set('class', activeHand!.hand);
  else { drill.set('card', activeCard!.card); drill.set('source', source); }
  drill.set('back', 'frequencies?' + bookmark); go('hands?' + drill);
 }
 const heat = (n: number) => ({ '--frequency-ink': n ? .07 + .4 * n / maximum : 0, '--frequency-text': 'var(--ink)' }) as CSSProperties;
 return <div className="frequency-page">
  <div className="frequency-title"><div><h1>Card frequencies.</h1><p>{data ? `${number(data.total)} imported ${data.total === 1 ? 'hand' : 'hands'} in this selection.` : 'From your imported hands.'}</p></div><p className="frequency-provenance">Your dealt cards.<br/>Recorded boards.</p></div>
  <form className="frequency-filters" onSubmit={event => event.preventDefault()}>
   <label>Position<select aria-label="Position" value={position} onChange={e => setPosition(e.target.value)}><option value="">All positions</option>{POSITIONS.map(p => <option key={p}>{p}</option>)}</select></label>
   <label>Session<select aria-label="Session" value={session} onChange={e => setSession(e.target.value)}><option value="">All sessions</option>{summary?.sessions.map((s: any) => <option value={s.id} key={s.id}>{dateLabel(s.started_at)} · {s.table_name}</option>)}</select></label>
   <label>From<input type="date" value={from} max={to || undefined} onInput={e => setFrom(e.currentTarget.value)}/></label>
   <label>To<input type="date" value={to} min={from || undefined} onInput={e => setTo(e.currentTarget.value)}/></label>
   {(position || session || from || to) && <button className="text-button" onClick={() => { setPosition(''); setSession(''); setFrom(''); setTo(''); }}>Clear filters ×</button>}
  </form>
  {!data ? <Loading error={error}/> : !data.total ? <Empty icon={FolderInput} title="No hands in this selection." action={<button className="text-button" onClick={() => go('imports')}>Import hands ↗</button>}>Change the filters or import hand histories to see frequencies.</Empty> : <>
   <div className="frequency-tabs" role="group" aria-label="Frequency view"><button aria-pressed={view === 'hands'} onClick={() => setView('hands')}>Starting hands</button><button aria-pressed={view === 'cards'} onClick={() => setView('cards')}>Individual cards</button></div>
   {view === 'cards' && <div className="frequency-streets" role="group" aria-label="Card source">{Object.entries(sources).map(([id, label]) => <button key={id} aria-pressed={source === id} onClick={() => setSource(id as CardSource)}>{label}</button>)}</div>}
   <div className="frequency-spread">
    <section className="frequency-index" aria-label={view === 'hands' ? 'Starting hand frequencies' : `${sources[source]} frequencies`}>
     <div className="frequency-index-heading"><h2>{view === 'hands' ? '169 starting hands.' : sources[source] + '.'}</h2><span>{number(denominator)} {view === 'hands' || source === 'hole' ? 'known hands' : `recorded ${source === 'flop' ? 'flops' : source + 's'}`}</span></div>
     <div className="frequency-mobile-selection" aria-live="polite"><span><b>{title}</b> · {number(count)} hands · {percentage(count, denominator)}</span><button disabled={!count} onClick={openHands}>See hands ↗</button></div>
     <div className="frequency-grid-scroll"><div className={view === 'hands' ? 'frequency-matrix' : 'frequency-deck'} onKeyDown={e => arrowKey(e, 13)}>
      {view === 'hands' ? data.starting.map(cell => <button key={cell.hand} style={heat(cell.count)} aria-pressed={activeHand?.hand === cell.hand} aria-label={`${cell.hand}: ${cell.count} hands, ${percentage(cell.count, data.known)}`} onClick={() => setSelectedHand(cell.hand)}><span>{cell.hand}</span><small>{cell.count}</small></button>) : cards.map(cell => <button key={cell.card} style={heat(cell.count)} aria-pressed={activeCard?.card === cell.card} aria-label={`${displayCard(cell.card)}: ${cell.count} hands, ${percentage(cell.count, sample!.hands)}`} onClick={() => setSelectedCard(cell.card)}><span>{displayCard(cell.card)}</span><small>{cell.count}</small></button>)}
     </div></div>
     <div className="frequency-legend"><span>Fewer</span><i/><i/><i/><span>More recorded hands</span></div>
     <p className="frequency-definition">{view === 'hands' ? 'Pairs on the diagonal. Suited above, offsuit below. Each cell counts hands dealt, including hands you folded.' : source === 'hole' ? 'Each card is counted once per known two-card hand. Card percentages add to 200% because every hand contains two cards.' : source === 'flop' ? 'The three original flop cards, counted once per hand. Percentages add to 300%. Only hands with a recorded flop are included.' : `Only the new ${source} card is counted. The denominator is hands with a recorded ${source}.`}</p>
     {data.missing > 0 && <p className="frequency-definition">{number(data.missing)} {data.missing === 1 ? 'hand has' : 'hands have'} no complete pair of your hole cards and {data.missing === 1 ? 'is' : 'are'} excluded from starting-hand counts.</p>}
     {view === 'cards' && source !== 'hole' && <p className="frequency-definition">These are boards present in your histories, including boards dealt after you folded. Later streets are a selected sample of hands.</p>}
    </section>
    <section className="frequency-detail" aria-label="Selected frequency">
     <div className="frequency-card-scene">
      {denominator > 0 && <TableRoom hole={illustration} board={[]} compact labels={false} catalog introKey={'frequency-' + view + '-' + title}/>}
      <div className="frequency-card-heading"><span>{view === 'hands' ? 'Starting hand' : sources[source]}</span><h2>{title}</h2></div>
      <span className="frequency-card-caption">{view === 'hands' ? activeHand?.example.length ? 'Suits from a matching hand.' : 'Example suits.' : 'Each hand counted once.'}</span>
     </div>
     <div className="frequency-tally" aria-live="polite"><div><strong key={view + source + title + count}>{number(count)}</strong><span>{count === 1 ? 'recorded hand' : 'recorded hands'}</span></div><div><b>{percentage(count, denominator)}</b><span>of {number(denominator)} eligible hands</span></div></div>
     {view === 'hands' && denominator > 0 && <p className="frequency-reference">Random-deal reference: <b>{percentage(reference, 1)}</b>, or about <b>{(reference * denominator).toFixed(1)}</b> hands in this sample.</p>}
     <button className="frequency-open" disabled={!count} onClick={openHands}>See {number(count)} matching {count === 1 ? 'hand' : 'hands'} <span>↗</span></button>
    </section>
   </div>
   <footer className="frequency-notes"><h2>How it’s counted.</h2><p>Duplicate imports count once. Opponent hole cards, practice hands and unrevealed cards are excluded. No result filter is applied.</p><p>The starting-hand reference uses the 1,326 possible deals from a uniformly shuffled deck: six combinations per pair, four per suited hand and twelve per offsuit hand. Small samples will vary; these counts do not predict your next hand.</p></footer>
  </>}
 </div>;
}
