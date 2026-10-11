import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
const STORAGE='monarch.motion.v1';
const scenes:Record<string,[string,string]>={home:['01','Study'],reviews:['02','Reviews'],hands:['03','Hands'],analytics:['04','Sessions'],training:['05','Practice'],ranges:['06','Ranges'],river:['07','River calls'],opponents:['08','Opponents'],imports:['09','Imports'],settings:['10','Settings'],replay:['11','Replay'],frequencies:['12','Card frequencies']};
export function sceneFor(route:string){return scenes[route.split(/[/?]/)[0]]??scenes.home;}
function stored(){try{return JSON.parse(localStorage.getItem(STORAGE)||'{}');}catch{return {};}}
const CinemaContext=createContext({enabled:true,automatic:true,reduced:false,opening:false,setMotion:(_v:boolean)=>{},setAutomatic:(_v:boolean)=>{},showOpening:()=>{}});
export const useCinema=()=>useContext(CinemaContext);
export function CinemaProvider({children}:{children:ReactNode}){
 const [motion,setMotion]=useState(()=>stored().motion!==false),[automatic,setAutomatic]=useState(()=>stored().automatic!==false),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),[opening,setOpening]=useState(false);
 const enabled=motion&&!reduced;
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(q.matches);q.addEventListener('change',update);return()=>q.removeEventListener('change',update);},[]);
 useEffect(()=>{try{localStorage.setItem(STORAGE,JSON.stringify({motion,automatic}));}catch{}},[motion,automatic]);
 useEffect(()=>{document.documentElement.dataset.motion=enabled?'cinema':'still';},[enabled]);
 useEffect(()=>{if(!opening)return;if(!enabled){setOpening(false);return;}const timer=setTimeout(()=>setOpening(false),1600),skip=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpening(false);};window.addEventListener('keydown',skip);return()=>{clearTimeout(timer);window.removeEventListener('keydown',skip);};},[opening,enabled]);
 return <CinemaContext.Provider value={{enabled,automatic,reduced,opening:opening&&enabled,setMotion,setAutomatic,showOpening:()=>setOpening(true)}}><div inert={opening&&enabled?true:undefined}>{children}</div>{opening&&enabled&&<div className="opening-sequence" role="dialog" aria-modal="true" aria-label="Monarch opening"><p>Poker study</p><span>Monarch.</span><button autoFocus onClick={()=>setOpening(false)}>Continue ↗</button></div>}</CinemaContext.Provider>;
}
// Both timers belong to the latest navigation, including rapid changes.
export function useSceneRoute(){
 const {enabled}=useCinema(),[route,setRoute]=useState(()=>location.hash.slice(1)||'home'),current=useRef(route),[cut,setCut]=useState<{route:string;id:number}|null>(null);
 useEffect(()=>{let commit:ReturnType<typeof setTimeout>,finish:ReturnType<typeof setTimeout>;
 const change=()=>{const next=location.hash.slice(1)||'home';clearTimeout(commit);clearTimeout(finish);const apply=()=>{current.current=next;setRoute(next);window.scrollTo(0,0);};if(!enabled||current.current.split('?')[0]===next.split('?')[0]){apply();setCut(null);return;}setCut({route:next,id:performance.now()});commit=setTimeout(apply,180);finish=setTimeout(()=>setCut(null),540);};
 if(!enabled)setCut(null);if(current.current!==(location.hash.slice(1)||'home'))change();window.addEventListener('hashchange',change);return()=>{clearTimeout(commit);clearTimeout(finish);window.removeEventListener('hashchange',change);};},[enabled]);
 return {route,cut};
}
export function SceneCut({cut}:{cut:{route:string;id:number}|null}){return cut?<div className="scene-cut" key={cut.id} aria-hidden="true"><span>{sceneFor(cut.route)[1]}.</span></div>:null;}
export function MotionSettings(){const {enabled,automatic,reduced,setMotion,setAutomatic,showOpening}=useCinema();return <section className="panel motion-settings"><h2>Motion</h2><label className="checkbox"><input type="checkbox" checked={enabled} disabled={reduced} onChange={e=>setMotion(e.target.checked)}/>Camera movement and page transitions</label><p>{reduced?'Your system requests reduced motion. Automatic playback is off.':'Cards deal onto the table. Pages reveal with a short cut.'}</p><label className="checkbox"><input type="checkbox" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/>Automatic card sequences</label><p>Card introductions play on entry. Hands stop at your decision and pause when you leave the tab.</p><button className="text-button" disabled={!enabled} onClick={showOpening}>Replay opening ↺</button></section>;}
