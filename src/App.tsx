import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {SoundButton,SpotifyNowPlaying} from './ui/Sound';
import {sound} from './audio/model';
import {Home} from './ui/Home';
import {Replay} from './ui/Replay';
import {Analytics,Library,Reviews,RiverTax} from './ui/Library';
import {RangeLab,Training} from './ui/Study';
import {Imports,Opponents,Settings} from './ui/Data';
import {useLoad} from './ui/common';
import {Frequency} from './ui/Frequency';
import {SceneCut,sceneFor,useSceneRoute} from './ui/Cinema';
const navigation=[['home','Study'],['reviews','Reviews'],['hands','Hands'],['analytics','Sessions'],['frequencies','Card frequencies'],['training','Practice'],['ranges','Ranges'],['river','River calls'],['opponents','Opponents'],['imports','Imports'],['settings','Settings']];
export default function App(){
 const {route,cut}=useSceneRoute(),[version,setVersion]=useState(0),[message,setMessage]=useState(''),[menu,setMenu]=useState(false),dialog=useRef<HTMLDialogElement>(null),{data:summary}=useLoad('/summary',version);
 const [path,qs='']=route.split('?'),[page,detail]=path.split('/'),query=new URLSearchParams(qs);
 useEffect(()=>{setMenu(false);document.title=`${sceneFor(route)[1]} | Monarch`;},[route]);
 useEffect(()=>{if(menu){dialog.current?.showModal();window.dispatchEvent(new Event('monarch:pause'));}else{dialog.current?.close();window.dispatchEvent(new Event('monarch:resume'));}},[menu]);
 useEffect(()=>{if(!message)return;sound('confirm');const timer=setTimeout(()=>setMessage(''),6000);return()=>clearTimeout(timer);},[message]);
 useEffect(()=>{const timer=setInterval(()=>setVersion(v=>v+1),30000);return()=>clearInterval(timer);},[]);
 const go=(r:string)=>{setMenu(false);location.hash=r;},refresh=()=>setVersion(v=>v+1),props={go,version,refresh,toast:setMessage};
 return <div className={`app-shell page-${page}`}>
  <a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>Skip to content</a>
  <header className="app-chrome"><a className="signature" href="#home">Monarch</a><SpotifyNowPlaying/><div className="chrome-controls"><SoundButton/><button className="menu-trigger" aria-haspopup="dialog" aria-expanded={menu} onClick={()=>setMenu(true)}>Menu <span aria-hidden="true">≡</span></button></div></header>
  <main id="main-content" tabIndex={-1} data-scene={page} key={page==='replay'?route:page} className="page-content">
   {page==='home'?<Home {...props}/>:page==='hands'?<Library {...props} query={query}/>:page==='frequencies'?<Frequency {...props} query={query}/>:page==='replay'?<Replay {...props} id={decodeURIComponent(detail??'demo')} query={query}/>:page==='reviews'?<Reviews {...props}/>:page==='ranges'?<RangeLab {...props}/>:page==='training'?<Training {...props} kind={detail}/>:page==='analytics'?<Analytics {...props} query={query}/>:page==='river'?<RiverTax {...props}/>:page==='opponents'?<Opponents {...props}/>:page==='imports'?<Imports {...props}/>:page==='settings'?<Settings {...props}/>:<Home {...props}/>}
  </main>
  <dialog className="navigation-film" ref={dialog} aria-label="Main navigation" onCancel={e=>{e.preventDefault();setMenu(false);}} onClose={()=>setMenu(false)}>
   <span className="signature">Monarch</span><button className="menu-close" onClick={()=>setMenu(false)}>Close <X size={22}/></button>
   <nav aria-label="Main navigation">{navigation.map(([id,label])=><a key={id} href={'#'+id} aria-current={page===id?'page':undefined} onClick={()=>setMenu(false)}>{label}{id==='reviews'&&summary?.queue>0&&<small>{summary.queue}</small>}<span aria-hidden="true">↗</span></a>)}</nav>
   <div className="navigation-record"><span>{summary?.xp??0} study XP</span><span>{summary?.reviewed??0} decisions reviewed</span><span>{summary?.total?.hands??0} imported hands</span></div><span className="navigation-art" aria-hidden="true">m.</span>
  </dialog>
  <SceneCut cut={cut}/>{message&&<div className="toast" role="status"><span>{message}</span><button aria-label="Dismiss notification" onClick={()=>setMessage('')}><X size={17}/></button></div>}
 </div>;
}
