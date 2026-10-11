function paintCanvas(draw,w=512,h=716){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d'),w,h);return canvas;}
function suit(ctx, s, x, y, size, color) {
  ctx.save(); ctx.fillStyle = color; ctx.translate(x, y); ctx.scale(size / 100, size / 100);
  ctx.beginPath();
  if (s === 'd') { ctx.moveTo(0, -50); ctx.lineTo(32, 0); ctx.lineTo(0, 50); ctx.lineTo(-32, 0); }
  if (s === 'h' || s === 's') {
    if (s === 's') ctx.rotate(Math.PI);
    ctx.moveTo(0, 43); ctx.bezierCurveTo(-12, 27, -47, 6, -44, -16);
    ctx.bezierCurveTo(-39, -46, -10, -42, 0, -20); ctx.bezierCurveTo(10, -42, 39, -46, 44, -16);
    ctx.bezierCurveTo(47, 6, 12, 27, 0, 43); ctx.fill();
    if (s === 's') {ctx.beginPath(); ctx.moveTo(-16,-48);ctx.quadraticCurveTo(-4,-25,-3,-13);ctx.lineTo(3,-13);ctx.quadraticCurveTo(4,-25,16,-48);}
  }
  if (s === 'c') {
    for (const [cx,cy] of [[0,-24],[-25,8],[25,8]]) {ctx.moveTo(cx+23,cy);ctx.arc(cx,cy,23,0,Math.PI*2);}
    ctx.moveTo(-15,49);ctx.quadraticCurveTo(-4,24,-3,9);ctx.lineTo(3,9);ctx.quadraticCurveTo(4,24,15,49);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
export function cardCanvas(code) {
  return paintCanvas((ctx,w,h) => {
    ctx.fillStyle = '#f5f4f1'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = '#d6d1cf';ctx.lineWidth = 1;ctx.strokeRect(1,1,w-2,h-2);
    if (code === 'back') {
      ctx.fillStyle = '#24212b';ctx.fillRect(22,22,w-44,h-44);
      ctx.strokeStyle = '#987884';ctx.lineWidth = 1.7;
      for (let x=-h;x<w+h;x+=20) {ctx.beginPath();ctx.moveTo(x,38);ctx.lineTo(x+h,h-38);ctx.stroke();ctx.beginPath();ctx.moveTo(x,h-38);ctx.lineTo(x+h,38);ctx.stroke();}
      ctx.strokeStyle='#efede9';ctx.lineWidth=10;ctx.strokeRect(25,25,w-50,h-50);
      ctx.fillStyle='#24212b';ctx.beginPath();ctx.arc(w/2,h/2,75,0,Math.PI*2);ctx.fill();
      ctx.font='italic 82px Georgia';ctx.fillStyle='#e5dad9';ctx.textAlign='center';ctx.fillText('m',w/2,h/2+23);return;
    }
    const rank=code.slice(0,-1)==='T'?'10':code.slice(0,-1), s=code.at(-1), color=/[hd]/.test(s)?'#8e2445':'#19212b';
    for (let i=0;i<2;i++) {
      ctx.save(); if(i){ctx.translate(w,h);ctx.rotate(Math.PI);}
      ctx.fillStyle=color;ctx.font='80px Georgia';ctx.textAlign='center';ctx.fillText(rank,47,78);suit(ctx,s,47,115,41,color);ctx.restore();
    }
    if (rank==='A') {
      suit(ctx,s,w/2,h/2,215,color);ctx.font='italic 20px Georgia';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText('Monarch',w/2,h-102);
    } else if (['Q','K','J'].includes(rank)) {
      // Original two-way geometric court illustration, drawn for this prototype.
      ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(110,100,292,516);
      for (let i=0;i<2;i++) {
        ctx.save();ctx.translate(w/2,h/2);if(i)ctx.rotate(Math.PI);
        ctx.fillStyle='#c1ada7';ctx.beginPath();ctx.moveTo(-122,0);ctx.lineTo(-66,-108);ctx.lineTo(56,-110);ctx.lineTo(123,0);ctx.fill();
        ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-122,0);ctx.lineTo(7,-110);ctx.lineTo(72,0);ctx.fill();
        ctx.strokeStyle='#f5f4f1';ctx.lineWidth=3;
        for(let k=0;k<6;k++){ctx.beginPath();ctx.moveTo(-112+k*23,0);ctx.lineTo(8+k*9,-85);ctx.stroke();}
        ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,-152,57,77,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#f5f4f1';ctx.beginPath();ctx.moveTo(-11,-206);ctx.bezierCurveTo(26,-204,34,-181,30,-166);ctx.lineTo(42,-154);ctx.lineTo(28,-148);ctx.bezierCurveTo(28,-112,4,-108,-15,-127);ctx.fill();
        ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(9,-175);ctx.lineTo(23,-175);ctx.moveTo(17,-139);ctx.lineTo(26,-139);ctx.stroke();
        if(rank==='K'){
          ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-17,-153);ctx.lineTo(1,-137);ctx.lineTo(31,-143);ctx.lineTo(29,-112);ctx.lineTo(2,-88);ctx.lineTo(-24,-122);ctx.fill();
          ctx.strokeStyle='#c1ada7';ctx.lineWidth=2;for(let b=0;b<4;b++){ctx.beginPath();ctx.moveTo(-7+b*10,-128);ctx.lineTo(2,-102);ctx.stroke();}
          ctx.fillStyle='#c1ada7';ctx.beginPath();ctx.moveTo(-47,-205);ctx.lineTo(-51,-244);ctx.lineTo(-28,-229);ctx.lineTo(-28,-257);ctx.lineTo(-5,-239);ctx.lineTo(15,-266);ctx.lineTo(27,-235);ctx.lineTo(47,-248);ctx.lineTo(43,-205);ctx.fill();
          ctx.fillStyle=color;ctx.fillRect(-40,-216,77,5);
        }else if(rank==='J'){
          ctx.fillStyle='#c1ada7';ctx.beginPath();ctx.moveTo(-53,-208);ctx.lineTo(-32,-240);ctx.lineTo(7,-239);ctx.lineTo(51,-209);ctx.closePath();ctx.fill();
          ctx.strokeStyle=color;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-55,-207);ctx.lineTo(53,-207);ctx.stroke();
          ctx.strokeStyle='#c1ada7';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-26,-233);ctx.quadraticCurveTo(-71,-257,-62,-277);ctx.quadraticCurveTo(-23,-271,-26,-233);ctx.stroke();
        }else{ctx.fillStyle='#c1ada7';ctx.beginPath();ctx.moveTo(-50,-205);ctx.lineTo(-57,-235);ctx.lineTo(-24,-225);ctx.lineTo(-7,-253);ctx.lineTo(15,-225);ctx.lineTo(47,-238);ctx.lineTo(45,-205);ctx.fill();}
        suit(ctx,s,93,-165,33,color);ctx.restore();
      }
    } else {
      const n=Number(rank), layouts={3:[[.5,.23],[.5,.5],[.5,.77]],5:[[.3,.23],[.7,.23],[.5,.5],[.3,.77],[.7,.77]],6:[[.3,.23],[.7,.23],[.3,.5],[.7,.5],[.3,.77],[.7,.77]],7:[[.3,.23],[.7,.23],[.5,.36],[.3,.5],[.7,.5],[.3,.77],[.7,.77]],10:[[.3,.2],[.7,.2],[.5,.31],[.3,.4],[.7,.4],[.3,.6],[.7,.6],[.5,.69],[.3,.8],[.7,.8]],2:[[.5,.25],[.5,.75]],4:[[.3,.25],[.7,.25],[.3,.75],[.7,.75]],8:[[.3,.23],[.7,.23],[.3,.41],[.7,.41],[.3,.59],[.7,.59],[.3,.77],[.7,.77]],9:[[.3,.23],[.7,.23],[.3,.41],[.7,.41],[.5,.5],[.3,.59],[.7,.59],[.3,.77],[.7,.77]]};
      for (const [x,y] of layouts[n]||[]) suit(ctx,s,w*x,h*y,n>4?66:91,color);
    }
  });
}

const images=new Map();export function cardImage(code){if(!images.has(code))images.set(code,cardCanvas(code).toDataURL('image/png'));return images.get(code);}
