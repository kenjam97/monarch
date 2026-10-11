import * as THREE from './three.module.js';
import {cardCanvas} from './art.js';
import { CUE, composeStudyCamera, composeFlopCloseup, composeFlopWide } from './camera.js';

export async function mountStudyFilm(root=document, options={}) {
const abort=new AbortController(),listen=(target,event,callback)=>target.addEventListener(event,callback,{signal:abort.signal});
let disposed=false,externalHold=false,frameId=0,resizeObserver;
const body=root===document?document.body:root.querySelector('.film-root');
const $ = (id) => root.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const END = CUE.end;
const preferences=new URLSearchParams(location.search),embedded=root!==document||preferences.has('embed');
if(embedded)body.classList.add('embedded');
let data, renderer, scene, camera, closeCamera;
let motion=!reduced.matches&&preferences.get('motion')!=='0'&&options.motion!==false;
let elapsed=motion?0:END,paused=!motion||preferences.get('automatic')==='0'||options.automatic===false;
let result = false, choice = '', choiceTime = 0, count = -1, shot = '', dirty = 100, last = 0;
let width = 1, height = 1, mobile = false, resumeAfterMenu = false;
let drawWidth=1,drawHeight=1,captionAnimation,previousMotionStamp='',panelFraction=.34;
let paintedPause = null;
let soundBoard=0,suppressSound=false;
const cue=(name,count=1)=>{if(!suppressSound&&!document.hidden&&!externalHold)options.onSound?.(name,count);};
// Explicit development-only readout for checking frame pacing in the browser.
const timing=new URLSearchParams(location.search).has('timing')?new Map():null;
let timingOutput;
const cards = [], projected = new THREE.Vector3();
const board = [], opponents = [], chips = [];
const tableDetails = [];
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const stages = [
  { at: 0, count: 0, street: '', title: '', detail: '' },
  { at: CUE.opening, count: 8, street: 'Before the flop', title: 'You raise.\nThe big blind calls.', detail: '2.5 BB each.' },
  { at: CUE.flop, count: 10, street: 'The flop', title: 'Top pair.', detail: 'The big blind checks.' },
  { at: CUE.flopBet, count: 11, street: 'The flop', title: 'You bet 3 BB.', detail: 'Queen, eight, four.' },
  { at: CUE.flopCall, count: 12, street: 'The flop', title: 'They call.', detail: '11.5 BB in the pot.' },
  { at: CUE.turn, count: 14, street: 'The turn', title: 'A second bet.', detail: 'The big blind checks again.' },
  { at: CUE.turnBet, count: 15, street: 'The turn', title: 'You bet 7 BB.', detail: 'Two of clubs.' },
  { at: CUE.turnCall, count: 16, street: 'The turn', title: 'Another call.', detail: '25.5 BB in the pot.' },
  { at: CUE.river, count: 17, street: 'The river', title: 'Nine of hearts.', detail: 'The flush draw misses.' },
  { at: CUE.riverBet, count: 18, street: 'The river', title: 'They lead\nfor 18 BB.', detail: '43.5 BB in the pot.' },
];

function canvasTexture(draw, w = 512, h = 716) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); draw(ctx, w, h);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
function faceTexture(code) {
  const texture=new THREE.CanvasTexture(cardCanvas(code));texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
}
function roundedShape(w,h,r) {
  const s=new THREE.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function card(code,x,z,angle=0,y=.035) {
  const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=angle;
  const geo=new THREE.ExtrudeGeometry(roundedShape(1.01,1.415,.043),{depth:.009,bevelEnabled:false,steps:1,curveSegments:5});
  const stock=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#c5c2be',roughness:.6}));stock.rotation.x=-Math.PI/2;stock.castShadow=true;stock.receiveShadow=true;group.add(stock);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(.998,1.40),new THREE.MeshStandardMaterial({map:faceTexture(code),roughness:.68,metalness:0}));face.rotation.x=-Math.PI/2;face.position.y=.0105;face.receiveShadow=true;group.add(face);
  group.userData={code,face,base:v(x,y,z)};scene.add(group);cards.push(group);return group;
}
function chipTexture(color) {
  return canvasTexture((ctx,w,h)=>{
    ctx.fillStyle=color;ctx.fillRect(0,0,w,h);ctx.translate(w/2,h/2);
    ctx.strokeStyle='#e5e0db';ctx.lineWidth=29;
    for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(0,0,109,i*Math.PI/3+.05,i*Math.PI/3+.31);ctx.stroke();}
    ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,83,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#bbb0b1';ctx.beginPath();ctx.arc(0,0,71,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#ded6d4';ctx.font='italic 54px Georgia';ctx.textAlign='center';ctx.fillText('m',0,16);
  },256,256);
}
function stack(x,z,n,color) {
  const group=new THREE.Group(), map=chipTexture(color);
  const materials=[new THREE.MeshStandardMaterial({color,roughness:.7}),new THREE.MeshStandardMaterial({map,roughness:.63}),new THREE.MeshStandardMaterial({color,roughness:.7})];
  const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.24,.24,.068,48),materials,n);
  const edges=new THREE.InstancedMesh(new THREE.BoxGeometry(.092,.067,.013),new THREE.MeshStandardMaterial({color:'#d8ccc9',roughness:.6}),n*6);
  const transform=new THREE.Object3D();
  mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh,edges);
  for(let i=0;i<n;i++){
    transform.position.set(Math.sin(i*9)*.012,.039+i*.069,Math.cos(i*7)*.01);transform.rotation.y=i*.17;
    transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
    for(let j=0;j<6;j++){
      const a=j*Math.PI/3+i*.17;
      transform.position.set(Math.sin(a)*.239,.039+i*.069,Math.cos(a)*.239);transform.rotation.y=a;transform.updateMatrix();edges.setMatrixAt(i*6+j,transform.matrix);
    }
  }
  group.position.set(x,0,z);group.userData.base=group.position.clone();scene.add(group);chips.push(group);return group;
}

function buildScene() {
  renderer=new THREE.WebGLRenderer({canvas:$('table-canvas'),antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor('#26131e');
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.08,80);closeCamera=camera.clone();
  scene.add(new THREE.HemisphereLight('#f1f3ff','#231b25',.95));
  const key=new THREE.DirectionalLight('#f3f4ff',2.1);key.position.set(-3,9,6);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:30});key.shadow.bias=-.0002;key.shadow.normalBias=.014;key.shadow.radius=4;scene.add(key);
  const rim=new THREE.DirectionalLight('#ffffff',.3);rim.position.set(4,3,-4);scene.add(rim);
  const felt=canvasTexture((ctx,w,h)=>{
    const pixels=ctx.createImageData(w,h);let seed=19;for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;const noise=((seed>>>16)&15)-7;
      pixels.data[i]=63+noise;pixels.data[i+1]=12+noise*.6;pixels.data[i+2]=25+noise*.8;pixels.data[i+3]=255;}
    ctx.putImageData(pixels,0,0);
  },512,512);felt.wrapS=felt.wrapT=THREE.RepeatWrapping;felt.repeat.set(20,20);
  const table=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({map:felt,roughness:.98,metalness:0}));table.rotation.x=-Math.PI/2;table.receiveShadow=true;scene.add(table);
  const rail=new THREE.Mesh(new THREE.TorusGeometry(14,.34,24,160),new THREE.MeshStandardMaterial({color:'#171920',roughness:.78}));rail.rotation.x=Math.PI/2;rail.scale.x=1.2;rail.position.set(0,-.04,-9.55);rail.castShadow=true;scene.add(rail);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(13.68,.016,8,160),new THREE.MeshStandardMaterial({color:'#c6b9aa',roughness:.38,metalness:.6}));trim.rotation.x=Math.PI/2;trim.scale.x=1.2;trim.position.set(0,.09,-9.55);scene.add(trim);
  tableDetails.push(rail,trim);
  card('As',-.43,2.30,-.12);card('Qd',.38,2.39,.12,.06);
  data.hand.board.forEach((code,i)=>board.push(card(code,-2.18+i*1.09,-.13,(i-2)*.009)));
  opponents.push(card('back',.90,-2.55,.16),card('back',1.61,-2.63,-.08,.065));
  const dealer=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.055,64),[
    new THREE.MeshStandardMaterial({color:'#c8c3c3',roughness:.7}),
    new THREE.MeshStandardMaterial({map:canvasTexture((ctx,w,h)=>{ctx.fillStyle='#efeeec';ctx.fillRect(0,0,w,h);ctx.fillStyle='#29202c';ctx.font='italic 135px Georgia';ctx.textAlign='center';ctx.fillText('d',w/2,h*.65);},256,256),roughness:.6}),
    new THREE.MeshStandardMaterial({color:'#d6cfcf'})]);dealer.position.set(-1.75,.05,2.42);dealer.castShadow=true;scene.add(dealer);
  tableDetails.push(dealer);
  stack(1.65,2.38,9,'#3c3d46');stack(2.17,2.6,6,'#763850');stack(2.26,1.99,4,'#763850');
  stack(-1.1,-2.8,7,'#3c3d46');stack(-1.66,-2.62,5,'#763850');
  stack(1.96,-1.38,3,'#763850');stack(2.48,-1.39,3,'#3c3d46');
  (resizeObserver=new ResizeObserver(resize)).observe($('picture'));resize();
}
function resize() {
  const box=$('picture').getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);mobile=innerWidth<=700;
  const surface=$('film').getBoundingClientRect();
  panelFraction=innerWidth<=1100?.35:Math.min(.34,480/surface.width);
  // Keep the backing surface stable while the decision panel reveals. Resizing
  // GPU buffers on every CSS transition frame caused avoidable stalls.
  if(drawWidth!==surface.width||drawHeight!==surface.height){drawWidth=surface.width;drawHeight=surface.height;renderer.setSize(drawWidth,drawHeight,false);}
  dirty=80;
  if(count>=0)render();
}
function currentStage(){return stages.findLast(s=>elapsed>=s.at)||stages[0];}
function bb(amount){return Number((amount/data.hand.bigBlind).toFixed(1)).toString();}
function state(){return data.frames[result?22:currentStage().count].state;}
function moneyLabel(id,amount){$(id).querySelector('b').innerHTML=`${bb(amount)} <small>BB</small>`;}
function updateState() {
  const stage=currentStage(), nextCount=result?22:stage.count;
  const nextShot=result?'result':elapsed>=END?'decision':elapsed<CUE.opening?'intro':elapsed>=CUE.closeStart&&elapsed<CUE.closeEnd?'split':stage.street==='The turn'?'turn':stage.street==='The river'?'river':'table';
  if(shot!==nextShot){if(shot&&['split','decision','intro'].includes(nextShot))cue('cut');shot=nextShot;body.dataset.shot=shot;if(root.host)root.host.dataset.shot=shot;dirty=90;
    if(shot==='decision')$('accessible-state').textContent='River decision. 43.5 big blinds in the pot. 18 big blinds to call.';
  }
  const atDecision=elapsed>=END;
  $('transport').inert=atDecision;
  $('decision').hidden=!atDecision;
  if(paintedPause!==paused){
    $('play').innerHTML=paused?'Play <span aria-hidden="true">▷</span>':'Pause <span aria-hidden="true">Ⅱ</span>';
    $('play').setAttribute('aria-label',paused?'Play sequence':'Pause sequence');paintedPause=paused;
  }
  $('timeline').value=elapsed;$('elapsed-line').style.transform=`scaleX(${elapsed/END})`;
  root.querySelectorAll('[data-seek]').forEach((button,i)=>button.classList.toggle('current',i===(elapsed<CUE.flop?0:elapsed<CUE.turn?1:elapsed<CUE.river?2:3)));
  if(count===nextCount)return;const previousCount=count;count=nextCount;dirty=90;renderer.shadowMap.needsUpdate=true;
  const s=state(),hero=s.seats.find(x=>x.name===data.hand.hero),opponent=s.seats.find(x=>x.position==='BB');
  if(s.board.length>soundBoard)cue('card',s.board.length-soundBoard);else if(previousCount>=0&&nextCount>previousCount&&stage.at>=CUE.opening&&!result)cue('chips');soundBoard=s.board.length;
  moneyLabel('pot',s.pot);moneyLabel('hero-label',hero.remaining);moneyLabel('opponent-label',opponent.remaining);
  $('pot').querySelector('span').textContent=result?'Final pot':'In the pot';
  $('street-label').textContent=stage.street;
  $('action-copy').replaceChildren(...stage.title.split('\n').flatMap((line,i)=>i?[document.createElement('br'),document.createTextNode(line)]:[document.createTextNode(line)]));
  $('action-detail').textContent=stage.detail;
  captionAnimation?.cancel();
  if(motion)captionAnimation=$('action-copy').animate([{clipPath:'inset(0 100% 0 0)',transform:'translateX(-14px)'},{clipPath:'inset(0)',transform:'translateX(0)'}],{duration:500,easing:'cubic-bezier(.16,1,.3,1)'});
  const facts=data.frames[18].facts;
  if(!result){
    $('decision-title').textContent='Your move.';$('decision-context').textContent=`The big blind bets ${bb(facts.call)} BB.`;
    $('price-number').textContent=bb(facts.call);$('price-unit').textContent='BB to call';$('price-detail').textContent=`${bb(facts.state.pot)} BB in the pot`;
    $('equity').textContent=`The call needs ${(facts.requiredEquity*100).toFixed(1)}% equity.`;
  }
  const cardName=c=>({A:'ace',Q:'queen',8:'eight',4:'four',2:'two',9:'nine'})[c[0]]+' of '+({s:'spades',h:'hearts',d:'diamonds',c:'clubs'})[c[1]];
  $('picture').setAttribute('aria-label',`Poker table. Your cards: ace of spades and queen of diamonds. ${s.board.length?'Board: '+s.board.map(cardName).join(', '):'No community cards yet'}. Pot: ${bb(s.pot)} big blinds.`);
  $('accessible-state').textContent=atDecision?`River decision. ${bb(facts.state.pot)} big blinds in the pot. ${bb(facts.call)} big blinds to call.`:'';
  board.forEach((obj,i)=>obj.visible=i<s.board.length);
  opponents.forEach((obj,i)=>{
    const code=opponent.revealed[i]||'back';if(obj.userData.code!==code){obj.userData.face.material.map.dispose();obj.userData.face.material.map=faceTexture(code);obj.userData.face.material.needsUpdate=true;obj.userData.code=code;}
  });
}
function pose() {
  tableDetails.forEach(object=>object.visible=elapsed>=CUE.opening);
  const reveal=elapsed>=END?clamp(mobile?(1-height/drawHeight)/.44:(1-width/drawWidth)/panelFraction,0,1):0;
  composeStudyCamera(camera,{time:elapsed,width,height,mobile,motion,reveal,frameWidth:drawWidth,frameHeight:drawHeight,panelFraction});
  const stamp=[elapsed>=CUE.opening,...board.map((_,i)=>motion?clamp(elapsed-(i<3?CUE.flop+i*110:i===3?CUE.turn:CUE.river),0,650):1),motion?clamp(elapsed-CUE.riverBet,0,600):1].join(':');
  if(stamp!==previousMotionStamp){renderer.shadowMap.needsUpdate=true;previousMotionStamp=stamp;}
  board.forEach((obj,i)=>{
    const at=i<3?CUE.flop+i*110:i===3?CUE.turn:CUE.river;
    const t=motion?ease((elapsed-at)/650):1;
    obj.position.copy(obj.userData.base);obj.position.x+=(1-t)*3.5;obj.position.y+=(1-t)*.32;obj.rotation.y=(i-2)*.009+(1-t)*.3;
  });
  const betT=motion?ease((elapsed-CUE.riverBet)/600):1;
  chips.slice(5).forEach((group,i)=>{group.visible=elapsed>=CUE.riverBet;group.position.copy(group.userData.base);group.position.x-=(1-betT)*2;group.position.z-=(1-betT)*1.3;});
}
function projectLabel(id,point,box){
  projected.copy(point).project(camera);
  const x=(projected.x*.5+.5)*width+box.left,y=(-projected.y*.5+.5)*height;
  const el=$(id);el.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;el.style.visibility=x<box.left+24||x>innerWidth-25||y<85||y>height-35?'hidden':'visible';
}
function render(){
  const box=$('picture').getBoundingClientRect();
  pose();renderer.setScissorTest(false);renderer.setViewport(0,0,drawWidth,drawHeight);
  if(shot==='split'&&motion&&!mobile){
    const split=Math.floor(drawWidth*.38);renderer.setScissorTest(true);
    composeFlopCloseup(closeCamera,{time:elapsed,width:width*.38,height,motion});
    renderer.setViewport(0,0,split-3,drawHeight);renderer.setScissor(0,0,split-3,drawHeight);renderer.render(scene,closeCamera);
    composeFlopWide(closeCamera,{width:width*.62,height});
    renderer.setViewport(split,0,drawWidth-split,drawHeight);renderer.setScissor(split,0,drawWidth-split,drawHeight);renderer.render(scene,closeCamera);renderer.setScissorTest(false);
  }else{renderer.render(scene,camera);}
  projectLabel('pot',v(0,.1,-1.60),box);projectLabel('opponent-label',v(1.30,.1,-3.9),box);projectLabel('hero-label',v(.15,.1,3.58),box);
}
function frame(now){
  if(disposed)return;
  const gap=now-last,dt=Math.min(gap,250);last=now;
  const measuring=timing&&!paused&&!document.hidden&&elapsed>500;
  if(measuring){const label=shot==='split'?'Flop close-up':currentStage().street||'Opening';if(!timing.has(label))timing.set(label,[]);timing.get(label).push(gap);}
  if(paused&&dirty<=0&&(!choice||result)){frameId=requestAnimationFrame(frame);return;}
  if(!paused&&!document.hidden){elapsed=Math.min(END,elapsed+dt);if(elapsed===END){paused=true;dirty=90;}}
  if(choice&&!result&&!externalHold&&!document.hidden&&!$('menu').open&&!$('history').open){choiceTime+=dt;if(choiceTime>=1400)showResult();}
  updateState();if(!paused||dirty>0){render();dirty--;}
  if(measuring){timingOutput.textContent=[...timing].map(([label,values])=>{const sorted=[...values].sort((a,b)=>a-b);return `${label}: ${values.length} frames · p95 ${sorted[Math.floor(sorted.length*.95)].toFixed(1)} ms · max ${sorted.at(-1).toFixed(1)} ms`;}).join('\n');}
  frameId=requestAnimationFrame(frame);
}
function resetAnswers(){choice='';choiceTime=0;result=false;$('choices').hidden=false;$('answer').hidden=true;$('result').hidden=true;$('evidence').textContent='Read the action so far ↗';count=-1;}
function seek(t,play=false){suppressSound=true;externalHold=false;resetAnswers();elapsed=clamp(t,0,END);paused=!play||elapsed===END;dirty=100;updateState();suppressSound=false;}
function openHistory(){
  paused=true;const current=state();$('history-title').textContent=result?'The recorded hand.':'The hand so far.';
  $('history-limit').textContent=result?'Amounts are shown in big blinds. The recorded pot includes 2.5 BB rake.':"Later actions and the opponent's cards are hidden.";
  $('history-actions').replaceChildren();
  let previous='';
  for(const action of data.hand.actions.slice(0,current.count)){
    if(action.street!==previous){const li=document.createElement('li');li.className='street-row';li.textContent=({preflop:'Before the flop',flop:'Flop',turn:'Turn',river:'River',showdown:'Showdown'})[action.street];$('history-actions').append(li);previous=action.street;}
    const li=document.createElement('li'),label=document.createElement('span'),text=document.createElement('span');
    label.textContent=action.player===data.hand.hero?'You':data.hand.seats.find(s=>s.name===action.player)?.position||'Board';
    if(action.kind==='deal')text.textContent=action.cards.map(c=>c.slice(0,-1)+({s:'♠',h:'♥',d:'♦',c:'♣'})[c.at(-1)]).join('  ');
    else if(action.kind==='show')text.textContent=`Shows ${action.cards.join(' ')}`;
    else if(action.kind==='raise')text.textContent=`Raises to ${bb(action.to)} BB`;
    else if(action.kind==='small-blind'||action.kind==='big-blind')text.textContent=`Posts ${bb(action.amount)} BB`;
    else text.textContent=({fold:'Folds',check:'Checks',call:'Calls',bet:'Bets',collect:'Collects'})[action.kind]+(action.amount?` ${bb(action.amount)} BB`:'');
    li.append(label,text);$('history-actions').append(li);
  }
  $('history').showModal();
}
function showResult(){
  cue('card',2);result=true;count=-1;dirty=90;updateState();
  $('answer').hidden=true;$('result').hidden=false;$('decision-title').textContent='Showdown.';
  $('decision-context').textContent='The recorded action was a call. The big blind showed 8♦ 8♣.';
  $('price-number').textContent=`−${bb(-data.hand.heroNet)}`;$('price-unit').textContent='BB net';$('price-detail').textContent='Across the whole hand';
  $('equity').textContent='One pair lost to three of a kind.';
  $('result-copy').textContent="This result alone does not tell you whether calling was correct. That depends on the big blind's range.";
  $('evidence').textContent='Read the full hand ↗';$('accessible-state').textContent='Recorded result: you called. The big blind held eight of diamonds and eight of clubs. You lost 30.5 big blinds across the hand.';
}
function controls(){
  if(embedded)listen(window,'message',event=>{if(event.origin!==location.origin||event.source!==parent)return;if(event.data?.type==='monarch:pause'){paused=true;dirty=20;}if(event.data?.type==='monarch:restart')seek(motion?0:END,motion);});
  if(timing){timingOutput=document.createElement('output');timingOutput.id='timing-readout';timingOutput.style.cssText='position:fixed;left:16px;bottom:80px;z-index:50;white-space:pre;background:#151419;color:#fff;padding:12px;font:11px/1.5 monospace;pointer-events:none';body.append(timingOutput);}
  $('timeline').max=END;
  root.querySelectorAll('[data-seek]').forEach((el,i)=>el.dataset.seek=[CUE.opening+200,CUE.closeStart+100,CUE.turn+500,CUE.river+700][i]);
  $('play').onclick=()=>{externalHold=false;paused=!paused;dirty=10;};
  $('timeline').oninput=e=>seek(Number(e.target.value));
  root.querySelectorAll('[data-seek]').forEach(el=>el.onclick=()=>seek(Number(el.dataset.seek)));
  $('menu-open').onclick=()=>{resumeAfterMenu=!paused;paused=true;$('menu').showModal();};
  $('menu-close').onclick=()=>$('menu').close();
  $('menu').addEventListener('close',()=>{if(resumeAfterMenu&&elapsed<END)paused=false;resumeAfterMenu=false;});
  root.querySelectorAll('[data-menu]').forEach(el=>el.onclick=()=>{
    const action=el.dataset.menu;resumeAfterMenu=false;$('menu').close();
    if(action==='resume'){paused=elapsed>=END;dirty=10;}
    if(action==='restart')seek(0,true);
    if(action==='decision')seek(END);
    if(action==='history')openHistory();
  });
  $('evidence').onclick=openHistory;$('history-close').onclick=()=>$('history').close();
  root.querySelectorAll('[data-choice]').forEach(el=>el.onclick=()=>{
    cue('confirm');choice=el.dataset.choice;choiceTime=0;$('choices').hidden=true;$('answer').hidden=false;
    $('answer-text').textContent=`You chose to ${choice}.`;
  });
  $('change-answer').onclick=()=>{choice='';$('answer').hidden=true;$('choices').hidden=false;$('choices').querySelector('button').focus();};
  $('again').onclick=()=>seek(0,true);
  $('motion-choice').checked=motion;body.classList.toggle('still',!motion);
  $('motion-choice').onchange=e=>{motion=e.target.checked;body.classList.toggle('still',!motion);dirty=20;};
  listen(root,'keydown',e=>{
    if(e.code==='Space'&&!e.repeat&&!$('menu').open&&!$('history').open&&!['INPUT','BUTTON','A'].includes((root.activeElement||document.activeElement).tagName)){
      e.preventDefault();if(elapsed<END){paused=!paused;dirty=10;}
    }
  });
  listen(document,'visibilitychange',()=>{if(document.hidden){paused=true;dirty=10;}last=performance.now();});
  listen(reduced,'change',e=>{if(e.matches){motion=false;$('motion-choice').checked=false;body.classList.add('still');seek(END);}});
  $('table-canvas').addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;$('renderer-error-text').textContent='The graphics connection was interrupted. Reload to try again.';$('renderer-error').hidden=false;});
}

try{
  const response=await fetch(new URL('./hand.json',import.meta.url));if(!response.ok)throw new Error('The practice hand could not be loaded.');data=await response.json();
  await document.fonts.ready;if(options.signal?.aborted)return {dispose(){},pause(){},release(){},restart(){}};buildScene();controls();updateState();render();$('loading').classList.add('gone');last=performance.now();frameId=requestAnimationFrame(frame);
}catch(error){
  console.error('Study film:',error);$('loading').classList.add('gone');$('renderer-error-text').textContent='This preview needs WebGL and its local hand file. Reload to try again.';$('renderer-error').hidden=false;
}

return {pause(){externalHold=true;paused=true;dirty=20;},release(){externalHold=false;},restart(){seek(motion?0:END,motion);},dispose(){disposed=true;abort.abort();cancelAnimationFrame(frameId);resizeObserver?.disconnect();captionAnimation?.cancel();scene?.traverse(object=>{object.geometry?.dispose();for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){material.map?.dispose();material.dispose();}});renderer?.dispose();renderer?.forceContextLoss();}};
}
if(document.getElementById('film'))void mountStudyFilm();
