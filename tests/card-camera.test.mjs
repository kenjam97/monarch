import {describe,it,expect} from 'vitest';
import * as THREE from '../public/study-film/three.module.js';
import {composeCardCamera,cardCorners} from '../public/study-film/room-camera.js';
const sizes=[[1280,720],[2094,1165],[860,1024],[390,464],[768,700]];
describe('card scene framing',()=>{
 it('keeps frequency cards clear of the title and caption on desktop and phones',()=>{
  for(const [width,height] of [[295,310],[390,310],[450,400]])for(const count of [1,2]){
   const points=Array.from({length:count},(_,i)=>cardCorners(-.43+i*.81,2.30+i*.09,i?.12:-.12)).flat();
   const camera=new THREE.PerspectiveCamera(),rect=composeCardCamera(camera,{width,height,points,practice:true,catalog:true,mobile:false,panel:false});
   for(const point of points){const p=point.clone().project(camera),x=(p.x+1)/2,y=(1-p.y)/2;
    expect(x).toBeGreaterThanOrEqual(rect.left-1e-6);expect(x).toBeLessThanOrEqual(rect.right+1e-6);
    expect(y).toBeGreaterThanOrEqual(.28-1e-6);expect(y).toBeLessThanOrEqual(.87+1e-6);
   }
  }
 });
 for(const [width,height] of sizes)for(const count of [0,3,4,5]){
  it(`keeps ${count} board cards and visible hands inside the scene at ${width}x${height}`,()=>{
   for(const practice of [true,false])for(const multiway of [false,true]){
    if(practice&&multiway)continue;
    const hole=[...cardCorners(-.43,2.3,-.12),...cardCorners(.38,2.39,.12)];
    const board=Array.from({length:practice?count:5},(_,i)=>cardCorners(-2.18+i*1.09,-.13)).flat();
    const opponents=practice?[]:(multiway?[[-3.8,1.2],[-3.7,-1.7],[0,-3.3],[3.7,-1.7],[3.8,1.2]]:[[1.25,-2.6]]).flatMap(([x,z])=>[...cardCorners(x-.34,z),...cardCorners(x+.34,z-.08),new THREE.Vector3(x,.1,z-(z<0?1.48:-1.35))]);
    const all=[...hole,...board,...opponents];
    if(!practice)all.push(new THREE.Vector3(2.6,.7,3.02),new THREE.Vector3(.15,.1,3.8));
    for(const focus of ['table','hand',...(count?['board']:[])]){
     const points=focus==='hand'?hole:focus==='board'?board:all,camera=new THREE.PerspectiveCamera();
     const rect=composeCardCamera(camera,{width,height,points,boardCount:count,practice,focus});
     for(const point of points){const p=point.clone().project(camera),x=(p.x+1)/2,y=(1-p.y)/2;
      expect(x).toBeGreaterThanOrEqual(rect.left-1e-6);expect(x).toBeLessThanOrEqual(rect.right+1e-6);
      expect(y).toBeGreaterThanOrEqual(rect.top-1e-6);expect(y).toBeLessThanOrEqual(rect.bottom+1e-6);
     }
    }
   }
  });
 }
});
