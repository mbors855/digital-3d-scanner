// Parallel, horizontal stereo pair. Coordinates and baseline use millimetres.
function reconstruct(left,right,w,h,baseline,focal){
  const gray=image=>Float32Array.from({length:w*h},(_,i)=>
    .299*image[i*4]+.587*image[i*4+1]+.114*image[i*4+2]);
  const a=gray(left), b=gray(right), vertices=[], faces=[], grid=new Map();
  function match(source,target,x,y,dir){
    const costs=[];
    for(let d=1;d<=Math.min(80,w/3);d++){
      const tx=x+dir*d;
      if(tx<4||tx>=w-4)break;
      let s=0,t=0,ss=0,tt=0,st=0;
      for(let j=-4;j<=4;j+=2)for(let i=-4;i<=4;i+=2){
        const p=source[(y+j)*w+x+i],q=target[(y+j)*w+tx+i];
        s+=p;t+=q;ss+=p*p;tt+=q*q;st+=p*q;
      }
      const variance=(ss-s*s/25)*(tt-t*t/25);
      costs[d]=variance>10000?(st-s*t/25)/Math.sqrt(variance):-1;
    }
    let best=0,score=.87;
    costs.forEach((v,d)=>{if(v>score){best=d;score=v}});
    if(!best||costs.some((v,d)=>Math.abs(d-best)>2&&v>score-.045))return 0;
    return best;
  }
  for(let y=5;y<h-5;y+=5)for(let x=5;x<w-5;x+=5){
    const d=match(a,b,x,y,-1);
    if(d<3||Math.abs(match(b,a,x-d,y,1)-d)>1)continue;
    const z=focal*baseline/d,k=y*w+x;
    grid.set(k,vertices.length);
    vertices.push([(x-w/2)*baseline/d,(h/2-y)*baseline/d,-z,...left.slice(4*k,4*k+3)]);
    for(const keys of [[k-5*w-5,k-5,k],[k-5*w-5,k,k-5*w]]){
      const ids=keys.map(key=>grid.get(key));
      if(ids.includes(undefined))continue;
      const depths=ids.map(i=>vertices[i][2]);
      if(Math.max(...depths)-Math.min(...depths)<.09*z)faces.push(ids);
    }
  }
  return {vertices,faces};
}
if(typeof module!=='undefined')module.exports=reconstruct;
