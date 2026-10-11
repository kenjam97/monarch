import * as THREE from './three.module.js';
import {cardCanvas} from './art.js';
import {composeCardCamera,cardCorners,easeShot} from './room-camera.js';
export function createRoom(canvas,{onProject=()=>{},onShot=()=>{},onArrival=()=>{},motion=true}={}){
let width=1,height=1,frame=0,last=0,dirty=90,disposed=false,view={},allowMotion=motion,active=true;
let stage=-1,stagePeople=[],stagePoints=[],introAge=0,introKey='',splitAge=4000,shot='',arrived=false;
const closeCamera=new THREE.PerspectiveCamera(31,1,.08,100),wideCamera=new THREE.PerspectiveCamera(34,1,.08,100);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.setClearColor('#26131e');
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.08,100),goal=new THREE.PerspectiveCamera(38,1,.08,100),target=new THREE.Vector3(0,0,.3);
const checking=new URLSearchParams(location.search).has('camera-check');
const cards=[],chips=[],tableDetails=[],slots=new Map(),textures=new Map(),labels=new Map(),vector=new THREE.Vector3();
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
function canvasTexture(draw,w=512,h=716){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return texture(c);}
function texture(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
function faceTexture(code){if(!textures.has(code))textures.set(code,texture(cardCanvas(code)));return textures.get(code);}
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

stack(1.65,2.38,9,'#3c3d46');stack(2.17,2.6,6,'#763850');stack(2.26,1.99,4,'#763850');
stack(-1.1,-2.8,7,'#3c3d46');stack(-1.66,-2.62,5,'#763850');
stack(1.96,-1.38,3,'#763850');stack(2.48,-1.39,3,'#3c3d46');
const dealer=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.06,48),[new THREE.MeshStandardMaterial({color:'#c8c3c3'}),new THREE.MeshStandardMaterial({map:canvasTexture((ctx,w,h)=>{ctx.fillStyle='#efeeec';ctx.fillRect(0,0,w,h);ctx.fillStyle='#29202c';ctx.font='italic 135px Georgia';ctx.textAlign='center';ctx.fillText('d',w/2,h*.65);},256,256)}),new THREE.MeshStandardMaterial({color:'#c8c3c3'})]);dealer.position.set(-1.55,.06,2.7);dealer.castShadow=true;scene.add(dealer);

function put(key,code,x,z,angle=0,y=.04,delay=0){
 let object=slots.get(key);const fresh=!object||!object.visible;
 if(!object){object=card(code,x,z,angle,y);slots.set(key,object);}
 if(object.userData.code!==code){object.userData.code=code;object.userData.face.material.map=faceTexture(code);object.userData.face.material.needsUpdate=true;}
 if(fresh){object.userData.dealAge=allowMotion?-delay:700;}
 object.visible=true;object.userData.destination=v(x,y,z);object.userData.angle=angle;object.userData.used=true;return object;
}
function subjectPoints(focus=view.focus||'table'){
 if(focus==='table')return stagePoints;
 const prefix=focus==='hand'?'hero-':'board-';
 const objects=[...slots.entries()].filter(([key,o])=>key.startsWith(prefix)&&o.visible);
 return objects.length?objects.flatMap(([,o])=>cardCorners(o.userData.destination.x,o.userData.destination.z,o.userData.angle)):stagePoints;
}
function fit(){
 if(!stagePoints.length)return;
 composeCardCamera(goal,{width,height,points:subjectPoints(),boardCount:view.board?.length||0,practice:view.practice,focus:view.focus,panel:!view.catalog,mobile:!view.catalog&&width<=760,catalog:view.catalog});
 camera.aspect=goal.aspect;camera.fov=goal.fov;camera.projectionMatrix.copy(goal.projectionMatrix);camera.projectionMatrixInverse.copy(goal.projectionMatrixInverse);
 if(!allowMotion||last===0){camera.position.copy(goal.position);camera.quaternion.copy(goal.quaternion);if(allowMotion&&view.opening&&width<=760)composeCardCamera(camera,{width,height,points:subjectPoints('hand'),focus:'hand',practice:true,mobile:true});}
 dirty=90;
}
function set(next){
 const previous=view,boardCount=next.board?.length||0,newStage=stage!==boardCount||next.count<previous.count;
 view=next;allowMotion=next.motion!==false;slots.forEach(c=>{c.userData.used=false;if(next.introKey!==introKey)c.visible=false;});labels.clear();
 const people=next.people||[],others=people.filter(p=>!p.hero&&!p.folded);
 if(newStage||!stagePeople.length){stagePeople=others.map(p=>p.id);stage=boardCount;}
 const positions=({1:[[1.25,-2.6]],2:[[-2.8,-1.7],[2.8,-1.7]],3:[[-3.3,0],[0,-3.2],[3.3,0]],4:[[-3.7,1],[-2.7,-2.3],[2.7,-2.3],[3.7,1]]})[stagePeople.length]||[[-3.8,1.2],[-3.7,-1.7],[0,-3.3],[3.7,-1.7],[3.8,1.2]];
 (next.hole||[]).forEach((c,i)=>put('hero-'+i,c,-.43+i*.81,2.30+i*.09,i?.12:-.12,.04+i*.025));labels.set('hero',v(.15,.1,3.58));
 (next.board||[]).forEach((c,i)=>put('board-'+i,c,-2.18+i*1.09,-.13,(i-2)*.009,.04,i<3?i*110:0));
 others.forEach(p=>{const index=stagePeople.indexOf(p.id),[x,z]=positions[Math.max(0,index)]||[0,-3.3];(p.cards?.length?p.cards:['back','back']).forEach((c,j)=>put('seat-'+p.id+'-'+j,c,x+(j-.5)*.68,z-j*.08,j?-.08:.16,.04+j*.025));labels.set(p.id,v(x,.1,z-(z<0?1.28:-1.15)));});
 slots.forEach(c=>{if(!c.userData.used)c.visible=false;});labels.set('pot',v(0,.1,-1.60));
 const dealerPerson=people.find(p=>p.id===String(next.dealer));dealer.visible=!!dealerPerson&&!dealerPerson.folded;
 if(dealer.visible){const index=stagePeople.indexOf(dealerPerson.id),place=dealerPerson.hero?[-1.75,2.42]:positions[Math.max(0,index)]||[0,-3.3];dealer.position.set(place[0]-(dealerPerson.hero?0:1),.05,place[1]);}
 chips.forEach((c,i)=>c.visible=next.chips!==false&&(i<5||next.bet>0));
 // Reserve the complete board from preflop onwards. Within a street neither a
 // bet nor a fold changes these bounds, so the lens never jerks between actions.
 if(newStage||!stagePoints.length||next.practice){
  stagePoints=[];
  const count=next.practice?boardCount:5;
  for(let i=0;i<count;i++)stagePoints.push(...cardCorners(-2.18+i*1.09,-.13));
  (next.hole||[]).forEach((c,i)=>stagePoints.push(...cardCorners(-.43+i*.81,2.30+i*.09,i?.12:-.12)));
  stagePeople.forEach((id,i)=>{const [x,z]=positions[i]||[0,-3.3];stagePoints.push(...cardCorners(x-.34,z),...cardCorners(x+.34,z-.08));if(next.labels!==false)stagePoints.push(v(x-.5,.1,z-(z<0?1.48:-1.35)),v(x+.5,.1,z-(z<0?1.48:-1.35)));});
  if(next.labels!==false)stagePoints.push(v(-.65,.1,3.8),v(.85,.1,3.8));
  if(next.chips!==false)stagePoints.push(v(2.6,.7,3.02),v(-1.92,.7,-3.02));
  if(!stagePoints.length)stagePoints.push(v(-1,0,1),v(1,0,3));
 }
 if(boardCount===3&&(previous.board?.length||0)<3&&next.playing&&allowMotion)splitAge=0;
 if(boardCount!==3||next.focus!=='table')splitAge=4000;
 if(next.introKey!==introKey){introKey=next.introKey;introAge=0;arrived=false;}
 renderer.shadowMap.needsUpdate=true;fit();
}
function resize(){const box=canvas.parentElement.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);renderer.setSize(width,height,false);fit();}
function render(now){
 if(disposed)return;const dt=Math.min(.05,(now-last)/1000||.016);last=now;
 const opening=allowMotion&&view.opening&&!arrived;
 if(active&&!document.hidden){if(opening)introAge+=dt*1000;if(view.playing&&splitAge<4000)splitAge+=dt*1000;}
 const introEnd=(view.board?.length?3700:2800);
 if(opening&&introAge>=introEnd){arrived=true;onArrival();dirty=90;}
 const split=width>760&&allowMotion&&((opening&&introAge>850&&introAge<introEnd)||(splitAge>900&&splitAge<3800));
 const currentShot=split?'split':view.focus||'table';if(currentShot!==shot){shot=currentShot;onShot(shot);dirty=90;}
 if(active&&!document.hidden&&(dirty>0||split||opening)){
  let moved=false;const k=allowMotion?1-Math.exp(-6.5*dt):1;
  for(const object of slots.values()){
   if(!object.visible)continue;object.userData.dealAge+=dt*1000;
   const t=allowMotion?easeShot(object.userData.dealAge/650):1,dest=object.userData.destination;
   object.position.copy(dest);object.position.x+=(1-t)*3.5;object.position.y+=(1-t)*.32;object.rotation.y=(object.userData.angle||0)+(1-t)*.3;if(t<1)moved=true;
  }
  let destination=goal;
  if(opening&&width<=760&&introAge<1600){composeCardCamera(closeCamera,{width,height,points:subjectPoints('hand'),focus:'hand',practice:true,mobile:true});destination=closeCamera;}
  camera.position.lerp(destination.position,k);camera.quaternion.slerp(destination.quaternion,k);camera.updateMatrixWorld(true);if(moved)renderer.shadowMap.needsUpdate=true;
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);
  if(split){
   const cut=Math.floor(width*.38),hasBoard=(view.board?.length||0)>0;
   const travel=easeShot((opening?(introAge-850)/(introEnd-850):(splitAge-900)/2900));
   const x=hasBoard?THREE.MathUtils.lerp(-2.18,-2.18+((view.board?.length||1)-1)*1.09,travel):THREE.MathUtils.lerp(-.43,.38,travel),z=hasBoard?-.13:2.34;
   closeCamera.aspect=cut/height;closeCamera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(31/2))*Math.max(1,.62/closeCamera.aspect)));
   closeCamera.position.set(x+.65,3.6,z+1.95);closeCamera.lookAt(x,0,z);closeCamera.updateProjectionMatrix();
   renderer.setScissorTest(true);renderer.setViewport(0,0,cut-2,height);renderer.setScissor(0,0,cut-2,height);renderer.render(scene,closeCamera);
   composeCardCamera(wideCamera,{width:width-cut,height,points:stagePoints,boardCount:view.board?.length||0,practice:view.practice,wide:true,mobile:false});
   renderer.setViewport(cut,0,width-cut,height);renderer.setScissor(cut,0,width-cut,height);renderer.render(scene,wideCamera);renderer.setScissorTest(false);
  }else renderer.render(scene,camera);
  if(checking){canvas.dataset.camera=JSON.stringify({width,height,position:camera.position.toArray(),goal:goal.position.toArray(),quaternion:camera.quaternion.toArray(),goalQuaternion:goal.quaternion.toArray(),rect:camera.projectionMatrix.elements.slice(8,10),points:subjectPoints().map(p=>p.clone().project(camera).toArray()),objects:[...slots.values()].filter(o=>o.visible).map(o=>({code:o.userData.code,age:o.userData.dealAge,position:o.position.toArray(),destination:o.userData.destination.toArray()}))});}
  const projected={};for(const [id,point] of labels){vector.copy(point).project(camera);projected[id]=[(vector.x*.5+.5)*width,(-vector.y*.5+.5)*height];}onProject(projected);
  const settling=moved||camera.position.distanceToSquared(destination.position)>1e-8||1-Math.abs(camera.quaternion.dot(destination.quaternion))>1e-9;
  dirty=settling?Math.max(2,dirty-1):dirty-1;
 }
 frame=requestAnimationFrame(render);
}
const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);resize();frame=requestAnimationFrame(render);
return {set,setActive(value){active=value;last=performance.now();dirty=90;},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){material.map?.dispose();material.dispose();}});textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();}};
}
