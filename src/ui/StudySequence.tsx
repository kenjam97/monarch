import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react';
import {sound} from '../audio/model';
export type SequenceHandle={pause:()=>void;restart:()=>void};
type Film=SequenceHandle&{dispose:()=>void;release:()=>void};
const MODULE='/study-film/film.js';
export function StudySequence({ref,motion,automatic}:{ref:Ref<SequenceHandle>;motion:boolean;automatic:boolean}){
 const host=useRef<HTMLDivElement>(null),film=useRef<Film|null>(null),[error,setError]=useState('');
 useImperativeHandle(ref,()=>({pause:()=>film.current?.pause(),restart:()=>film.current?.restart()}),[]);
 useEffect(()=>{
  const controller=new AbortController(),element=host.current!;
  const pause=()=>film.current?.pause(),release=()=>film.current?.release();
  window.addEventListener('monarch:pause',pause);window.addEventListener('monarch:resume',release);
  const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pause();else release();},{threshold:.3});observer.observe(element);
  async function mount(){
   try{
    const [html,css,module]=await Promise.all([fetch('/study-film.html',{signal:controller.signal}).then(r=>r.text()),fetch('/study-film/film.css',{signal:controller.signal}).then(r=>r.text()),import(/* @vite-ignore */ MODULE)]);
    if(controller.signal.aborted)return;
    const source=new DOMParser().parseFromString(html,'text/html');source.querySelectorAll('script').forEach(s=>s.remove());
    const shadow=element.shadowRoot??element.attachShadow({mode:'open'}),style=document.createElement('style'),body=document.createElement('div');
    style.textContent=css.replaceAll(':root',':host').replace(/\bhtml,body\b/g,':host,.film-root').replace(/\bbody\b/g,'.film-root').replace("url('./caslon-display.ttf')","url('/study-film/caslon-display.ttf')")+'\n:host{display:block;width:100%;height:100%}.film-root{height:100%}';
    body.className='film-root embedded';body.dataset.shot='loading';body.append(...Array.from(source.body.childNodes));shadow.replaceChildren(style,body);
    const instance:Film=await module.mountStudyFilm(shadow,{motion,automatic,signal:controller.signal,onSound:sound});
    if(controller.signal.aborted){instance.dispose();return;}film.current=instance;
   }catch(e){if(!controller.signal.aborted){element.shadowRoot?.replaceChildren(document.createElement('slot'));setError('The practice hand could not open. Use the menu to continue.');}}
  }
  void mount();return()=>{controller.abort();observer.disconnect();window.removeEventListener('monarch:pause',pause);window.removeEventListener('monarch:resume',release);film.current?.dispose();film.current=null;};
 },[motion,automatic]);
 return <div className="study-sequence" ref={host}>{error&&<p className="room-error" role="status">{error}</p>}</div>;
}
