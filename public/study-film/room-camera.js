import * as THREE from './three.module.js';
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
export const easeShot=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
export const panelWidth=width=>Math.min(480,Math.max(340,width*.34));
export function cardCorners(x,z,angle=0){return [-.55,.55].flatMap(dx=>[-.77,.77].map(dz=>v(x+dx*Math.cos(angle)+dz*Math.sin(angle),.1,z+dz*Math.cos(angle)-dx*Math.sin(angle))));}
export function fitCardFrame(camera,target,points,rect){
 camera.updateMatrixWorld(true);
 const local=v(0,0,0),fx=camera.projectionMatrix.elements[0],fy=camera.projectionMatrix.elements[5];
 let distance=-Infinity;
 for(const point of points){local.copy(point).applyMatrix4(camera.matrixWorldInverse);distance=Math.max(distance,Math.abs(local.x*fx)/(rect.right-rect.left)+local.z,Math.abs(local.y*fy)/(rect.bottom-rect.top)+local.z);}
 camera.position.addScaledVector(camera.position.clone().sub(target).normalize(),distance);
 camera.updateMatrixWorld(true);
 camera.projectionMatrix.elements[8]=-(rect.left+rect.right-1);
 camera.projectionMatrix.elements[9]=-(1-rect.top-rect.bottom);
 camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
// Each pose reserves the same editorial space. Bets never restart a camera move.
export function composeCardCamera(camera,{width,height,points,boardCount=0,practice=false,focus='table',panel=true,mobile=width<=760,wide=false,catalog=false}){
 const target=new THREE.Box3().setFromPoints(points).getCenter(v(0,0,0));target.y=0;
 camera.aspect=width/height;camera.fov=mobile?38:34;
 let offset=boardCount>=5?v(.65,8.5,8.3):boardCount>=4?v(4.2,9.4,7.35):v(3.6,9,8.7);
 if(practice||focus!=='table')offset=focus==='hand'?v(.7,6.7,5.6):v(1.8,8,6.6);
 if(mobile)offset=v(.2,10.6,7.5);
 camera.position.copy(target).add(offset);camera.lookAt(target);camera.updateProjectionMatrix();
 const rect=catalog?{left:.08,right:.94,top:.28,bottom:.87}:mobile?{left:.065,right:.935,top:.23,bottom:.90}:wide?{left:.06,right:.94,top:.16,bottom:.86}:{left:panel?panelWidth(width)/width+.035:.08,right:.955,top:.16,bottom:.89};
 fitCardFrame(camera,target,points,rect);return rect;
}
