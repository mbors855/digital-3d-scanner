// Census descriptors tolerate brightness changes between views.
function pyramid(image,w,h){
  let pixels=new Uint8Array(w*h);
  for(let i=0;i<pixels.length;i++) pixels[i]=(image[4*i]*77+image[4*i+1]*150+image[4*i+2]*29)>>8;
  const levels=[];
  while(true){
    const signatures=new Uint32Array(w*h);
    for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
      const k=y*w+x;let bits=0;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)
        bits=(bits<<1)|(pixels[k+dy*w+dx]>pixels[k]);
      signatures[k]=bits;
    }
    levels.push({w,h,signatures});
    if(Math.max(w,h)<=480)break;
    const nw=w>>1,nh=h>>1,next=new Uint8Array(nw*nh);
    for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){
      const i=2*y*w+2*x;next[y*nw+x]=(pixels[i]+pixels[i+1]+pixels[i+w]+pixels[i+w+1])>>2;
    }
    w=nw;h=nh;pixels=next;
  }
  return levels;
}
function bits(v){
  v-=(v>>>1)&0x55555555;
  v=(v&0x33333333)+((v>>>2)&0x33333333);
  return (((v+(v>>>4))&0x0f0f0f0f)*0x01010101)>>>24;
}
function disparities(left,right,direction,step){
  let previous=null;
  for(let level=left.length-1;level>=0;level--){
    const {w,h,signatures:a}=left[level], b=right[level].signatures;
    const stride=Math.ceil(w/step),values=new Float32Array(stride*Math.ceil(h/step));
    const scores=new Int16Array(100);
    for(let y=step* Math.ceil(4/step);y<h-4;y+=step)for(let x=step*Math.ceil(4/step);x<w-4;x+=step){
      const k=y*w+x, index=(y/step)*stride+x/step;
      const seed=previous?.values[Math.floor(y/(2*step))*previous.stride+Math.floor(x/(2*step))]||0;
      const lo=seed?Math.max(1,Math.round(2*seed)-5):1;
      const hi=Math.min(direction<0?x-4:w-5-x,seed?Math.round(2*seed)+5:80);
      let best=1000,win=0;
      for(let d=lo;d<=hi;d++){
        let cost=0;
        for(let dy=-2;dy<=2;dy+=2)for(let dx=-2;dx<=2;dx+=2){
          const i=k+dy*w+dx;cost+=bits(a[i]^b[i+direction*d]);
        }
        scores[d-lo]=cost;
        if(cost<best){best=cost;win=d}
      }
      if(!win||best>47||win===lo||win===hi)continue;
      let unique=true;
      for(let d=lo;d<=hi;d++)if(Math.abs(d-win)>1&&scores[d-lo]<best+9){unique=false;break}
      if(!unique)continue;
      const before=scores[win-lo-1],after=scores[win-lo+1],curve=before+after-2*best;
      values[index]=win+(curve&&best>0?(before-after)/(2*curve):0);
    }
    previous={values,stride};
  }
  return previous;
}
function dense(l,r,w,h,baseline,focal,step){
 const a=pyramid(l,w,h),b=pyramid(r,w,h);
 const left=disparities(a,b,-1,step),right=disparities(b,a,1,step);
 const n=left.values.length,positions=new Float32Array(n*3),colors=new Uint8Array(n*3),indices=new Uint32Array(n*6),lookup=new Int32Array(n).fill(-1);
 let vertices=0,used=0;
 for(let i=0;i<n;i++){
   const d=left.values[i],col=i%left.stride,row=Math.floor(i/left.stride),x=col*step,y=row*step;
   if(d<2||Math.abs(right.values[row*left.stride+Math.round((x-d)/step)]-d)>1)continue;
   const id=vertices++,offset=id*3,k=(y*w+x)*4;lookup[i]=id;
   positions[offset]=(x-w/2)*baseline/d;positions[offset+1]=(h/2-y)*baseline/d;positions[offset+2]=-focal*baseline/d;
   colors[offset]=l[k];colors[offset+1]=l[k+1];colors[offset+2]=l[k+2];
   if(!row||!col)continue;
   const corner=lookup[i-left.stride-1];
   if(corner<0)continue;
   for(const side of [lookup[i-1],lookup[i-left.stride]]){
     if(side<0)continue;
     const depths=[id,corner,side].map(j=>positions[3*j+2]);
     if(Math.max(...depths)-Math.min(...depths)>Math.abs(depths[0])*.035)continue;
     indices[used++]=corner;indices[used++]=side===lookup[i-1]?side:id;indices[used++]=side===lookup[i-1]?id:side;
   }
 }
 return {p:positions.subarray(0,vertices*3),c:colors.subarray(0,vertices*3),f:indices.subarray(0,used)};
}
if(typeof module!=='undefined')module.exports=dense;
else self.onmessage=({data})=>{try{const m=dense(...data);self.postMessage(m,[m.p.buffer,m.c.buffer,m.f.buffer])}catch(e){self.postMessage({error:e.message})}};
