import * as THREE from './three.module.js';

export const CUE = Object.freeze({opening:2500,flop:6100,closeStart:6700,closeEnd:10200,flopBet:10300,flopCall:12100,turn:14000,turnBet:15800,turnCall:17300,river:19200,riverBet:21100,end:22700});
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const ease=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
const lerp=THREE.MathUtils.lerp;

// Card corners and stack/label extents, including the complete five-card board.
// The same bounds apply on every street, so dealing a card cannot move the camera.
export const STUDY_POINTS=[];
for(const x of [-2.78,2.80])for(const z of [-.96,.72])STUDY_POINTS.push(v(x,.08,z));
for(const x of [-1.78,2.0])for(const z of [-3.35,-2.0])STUDY_POINTS.push(v(x,.6,z));
for(const x of [-1.25,2.55])for(const z of [1.6,3.22])STUDY_POINTS.push(v(x,.7,z));
STUDY_POINTS.push(v(1.3,.1,-4.18),v(.15,.1,3.85));
const local=new THREE.Vector3(),normal=new THREE.Vector3();

function fit(camera,target,rect,points=STUDY_POINTS){
  camera.updateMatrixWorld(true);
  const fx=camera.projectionMatrix.elements[0],fy=camera.projectionMatrix.elements[5];
  const halfX=rect.right-rect.left,halfY=rect.bottom-rect.top;
  let distance=-Infinity;
  for(const point of points){
    local.copy(point).applyMatrix4(camera.matrixWorldInverse);
    distance=Math.max(distance,Math.abs(local.x*fx)/halfX+local.z,Math.abs(local.y*fy)/halfY+local.z);
  }
  normal.copy(camera.position).sub(target).normalize();
  camera.position.addScaledVector(normal,distance);
  camera.updateMatrixWorld(true);
  // An off-axis lens places the subject within the editorial space without
  // turning the camera away from the right-hand end of the board.
  camera.projectionMatrix.elements[8]=-(rect.left+rect.right-1);
  camera.projectionMatrix.elements[9]=-(1-rect.top-rect.bottom);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

export function composeStudyCamera(camera,{time,width,height,mobile,motion=true,reveal=1,frameWidth=width,frameHeight=height,panelFraction=0}){
  const decision=time>=CUE.end,target=v(0,0,.25);
  camera.aspect=width/height;
  camera.fov=mobile?38:34;
  if(time<CUE.opening){
    const t=motion?ease(time/CUE.opening):1;
    if(mobile){camera.position.set(1.8,6.5,7.9);target.set(-.9,0,1.5);camera.fov=39;}
    else {camera.position.set(lerp(2.8,3.6,t),lerp(4,5.1,t),lerp(6.2,6.7,t));target.set(-1.95,0,1.9);}
    camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return;
  }
  const turn=motion?ease((time-CUE.turn)/1400):Number(time>=CUE.turn);
  const river=motion?ease((time-(CUE.river-650))/1300):Number(time>=CUE.river);
  camera.position.set(lerp(lerp(3.6,4.2,turn),2.35,river),lerp(lerp(9,9.4,turn),9.2,river),lerp(lerp(8.7,7.35,turn),8.1,river));
  if(mobile)camera.position.set(.2,10.6,7.5);
  if(decision)camera.position.lerp(v(.65,8.5,8.3),reveal);
  // Time alone determines the pose. Pausing cannot snap the camera to a
  // different position, and resuming continues from exactly the same frame.
  if(motion)camera.position.x+=Math.sin(time*.00018)*.065;
  camera.lookAt(target);camera.updateProjectionMatrix();
  let rect=mobile?(decision?{left:.055,right:.945,top:.19,bottom:.91}:{left:.065,right:.935,top:.34,bottom:.79}):
    decision?{left:.075,right:.925,top:.16,bottom:.88}:{left:.415,right:.955,top:.15,bottom:.83};
  if(decision&&frameWidth!==width&&!mobile){
    const crop=(frameWidth-width)/frameWidth,available=1-crop;
    rect={left:(lerp(.415,panelFraction+(1-panelFraction)*.075,reveal)-crop)/available,
      right:(lerp(.955,panelFraction+(1-panelFraction)*.925,reveal)-crop)/available,
      top:lerp(.15,.16,reveal),bottom:lerp(.83,.88,reveal)};
  }else if(decision&&!mobile&&reveal<1){rect={left:.415,right:.955,top:.15,bottom:.83};}
  if(decision&&mobile&&frameHeight!==height){
    const available=height/frameHeight;
    rect={left:lerp(.065,.055,reveal),right:lerp(.935,.945,reveal),top:lerp(.34,.56*.19,reveal)/available,bottom:lerp(.79,.56*.91,reveal)/available};
  }else if(decision&&mobile&&reveal<1){rect={left:.065,right:.935,top:.34,bottom:.79};}
  fit(camera,target,rect);
}

export function composeFlopCloseup(camera,{time,width,height,motion=true}){
  const travel=motion?ease((time-CUE.closeStart-200)/(CUE.closeEnd-CUE.closeStart-500)):.5;
  const x=lerp(-2.18,0,travel);
  camera.aspect=width/height;
  camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(31/2))*Math.max(1,.62/camera.aspect)));
  camera.position.set(x+.65,3.6,1.82);camera.lookAt(x,0,-.13);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}

export function composeFlopWide(camera,{width,height}){
  const target=v(.1,0,.25);camera.aspect=width/height;camera.fov=40;
  camera.position.set(3.8,8.7,6.4);camera.lookAt(target);camera.updateProjectionMatrix();
  fit(camera,target,{left:.06,right:.94,top:.14,bottom:.84});
}
