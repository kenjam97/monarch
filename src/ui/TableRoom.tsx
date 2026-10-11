import {useEffect,useRef,useState} from 'react';
import type {ReplaySeat} from '../poker/types';
import {useCinema} from './Cinema';
import {Cards} from './common';
import {sound} from '../audio/model';
const ROOM='/study-film/room.js';
type Room={set:(value:unknown)=>void;setActive:(value:boolean)=>void;dispose:()=>void};
type Props={hole:string[];board:string[];seats?:ReplaySeat[];hero?:string;pot?:number;potLabel?:string;bigBlind?:number;labels?:boolean;compact?:boolean;catalog?:boolean;dealerSeat?:number;playing?:boolean;count?:number;opening?:boolean;introKey?:string;onArrival?:()=>void;onInspect?:()=>void};
export function TableRoom({hole,board,seats=[],hero='',pot,potLabel='In the pot',bigBlind=1,labels=true,compact=false,catalog=false,dealerSeat,playing=false,count=0,opening=false,introKey='',onArrival,onInspect}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null),room=useRef<Room|null>(null),nodes=useRef(new Map<string,HTMLElement>()),[error,setError]=useState(''),[ready,setReady]=useState(false),[shot,setShot]=useState('table'),[focus,setFocus]=useState('table'),{enabled}=useCinema();
 const callbacks=useRef({onArrival,onInspect});callbacks.current={onArrival,onInspect};
 const heroSeat=seats.find(s=>s.name===hero),people=seats.filter(s=>s.name===hero||!s.folded);
 const config={hole,board,motion:enabled,people:seats.map(s=>({id:String(s.seat),hero:s.name===hero,cards:s.revealed,folded:s.folded})),dealer:dealerSeat??false,chips:!compact,labels,practice:compact,catalog,playing,count,opening,introKey,focus,bet:Math.max(0,...people.map(s=>s.bet))};
 const latest=useRef(config);latest.current=config;
 useEffect(()=>{setFocus('table');},[introKey]);
 useEffect(()=>{
  let live=true,inView=true,menu=false;
  const activity=()=>room.current?.setActive(inView&&!menu&&!document.hidden);
  const pause=()=>{menu=true;activity();},resume=()=>{menu=false;activity();};
  window.addEventListener('monarch:pause',pause);window.addEventListener('monarch:resume',resume);document.addEventListener('visibilitychange',activity);
  const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;activity();},{threshold:.1});if(container.current)observer.observe(container.current);
  import(/* @vite-ignore */ ROOM).then(module=>{
   if(!live||!canvas.current)return;
   const instance:Room=module.createRoom(canvas.current,{motion:enabled,onShot:(value:string)=>{if(live)setShot(value);},onArrival:()=>callbacks.current.onArrival?.(),onProject:(points:Record<string,[number,number]>)=>{for(const [id,point] of Object.entries(points)){const node=nodes.current.get(id);if(node)node.style.transform=`translate3d(${point[0]}px,${point[1]}px,0) translate(-50%,-50%)`;}}});
   room.current=instance;instance.set(latest.current);activity();setReady(true);
  }).catch(()=>{if(live){setError('The 3D table is unavailable.');callbacks.current.onArrival?.();}});
  return()=>{live=false;observer.disconnect();window.removeEventListener('monarch:pause',pause);window.removeEventListener('monarch:resume',resume);document.removeEventListener('visibilitychange',activity);room.current?.dispose();room.current=null;};
 },[]);
 useEffect(()=>{room.current?.set(config);},[JSON.stringify(config)]);
 const sounded=useRef<{key:string;board:string[];hole:string[];count:number}|null>(null);
 useEffect(()=>{if(!ready)return;const old=sounded.current,current={key:introKey,board:[...board],hole:[...hole],count};sounded.current=current;
  if(!old||old.key!==introKey){sound('card',board.length||hole.length);return;}
  if(count<old.count)return;
  const added=board.filter((card,i)=>old.board[i]!==card).length;
  if(added)sound('card',added);else if(hole.join('')!==old.hole.join(''))sound('card',hole.length);
 },[ready,introKey,board.join(''),hole.join(''),count]);
 const ref=(id:string)=>(node:HTMLDivElement|null)=>{if(node)nodes.current.set(id,node);else nodes.current.delete(id);};
 return <div ref={container} className={`table-room ${ready?'room-ready':''}`} data-shot={shot} data-focus={focus} role="group" aria-label={catalog?`Card illustration: ${hole.join(' ')}.`:`Your cards: ${hole.join(' ')}. Board: ${board.join(' ')||'not dealt'}. ${pot===undefined?'':`Pot: ${(pot/bigBlind).toFixed(1)} BB.`}`}>
  <canvas ref={canvas} aria-hidden="true"/>
  {!ready&&!error&&<p className="room-loading">Preparing the table.</p>}{error&&<div className="table-fallback"><p>{error}</p><h3>Your hand</h3><Cards cards={hole}/>{board.length>0&&<><h3>Board</h3><Cards cards={board}/></>}</div>}
  {ready&&labels&&<div className="table-annotations" aria-hidden="true">
   {pot!==undefined&&<div ref={ref('pot')} className="table-annotation"><span>{potLabel}</span><b>{(pot/bigBlind).toFixed(1)} <small>BB</small></b></div>}
   <div ref={ref('hero')} className="table-annotation player-annotation"><span>You{heroSeat?', '+heroSeat.position:''}</span>{heroSeat&&<b>{(heroSeat.remaining/bigBlind).toFixed(1)} <small>BB</small></b>}</div>
   {people.filter(s=>s.name!==hero).map(s=><div key={s.seat} ref={ref(String(s.seat))} className="table-annotation player-annotation"><span>{s.name} · {s.position}</span><b>{(s.remaining/bigBlind).toFixed(1)} <small>BB</small></b></div>)}
  </div>}
  {(shot==='split'||opening)&&<span className="closeup-title">{board.length===5?'The river.':board.length===4?'The turn.':board.length===3?'The flop.':'Your hand.'}</span>}
  {ready&&opening&&<button className="skip-card-opening" onClick={()=>callbacks.current.onArrival?.()}>Show {compact?'question':'decision'} ↗</button>}
  {ready&&!opening&&!catalog&&<nav className="camera-shots" aria-label="Card view">{[{id:'table',label:'Table'},{id:'hand',label:'Your hand'},...(board.length?[{id:'board',label:'Board'}]:[])].map(item=><button key={item.id} aria-pressed={focus===item.id} onClick={()=>{callbacks.current.onInspect?.();setFocus(item.id);}}>{item.label}</button>)}</nav>}
 </div>;
}
