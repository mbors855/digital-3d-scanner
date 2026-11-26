// Reconstruct a lightweight preview against the first frame of this sweep.
let previewWorker, previewTimer;
function stopPreview() {
  clearTimeout(previewTimer);
  previewWorker?.terminate();
  previewWorker=null;
  el('scanInset').hidden=true;
}
function previewFrame(){
  const g=cropGeometry(live.videoWidth,live.videoHeight,Number(el('field').value),320);
  const canvas=document.createElement('canvas');
  canvas.width=g.outW;canvas.height=g.outH;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(live,g.x,g.y,g.w,g.h,0,0,g.outW,g.outH);
  return ctx.getImageData(0,0,g.outW,g.outH);
}
function paintPreview({p,c,f}){
  const canvas=el('scanShape'),ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(f.length<30){el('scanInfo').textContent='Zoekt overlap…';return;}
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  const pts=[];
  for(let i=0;i<p.length;i+=3){
    const x=.94*p[i]+.342*p[i+2],y=p[i+1];
    pts.push([x,y,-.342*p[i]+.94*p[i+2],i]);
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  const s=Math.min((canvas.width-10)/(maxX-minX||1),(canvas.height-8)/(maxY-minY||1));
  for(const [x,y,,i] of pts.sort((a,b)=>a[2]-b[2])){
    ctx.fillStyle='rgb('+c.subarray(i,i+3).join(',')+')';
    ctx.fillRect(canvas.width/2+(x-(minX+maxX)/2)*s,canvas.height/2-(y-(minY+maxY)/2)*s,2,2);
  }
  el('scanInfo').textContent='Live 3D · '+(f.length/3)+' driehoeken';
}
function startPreview(){
  stopPreview();
  el('scanInset').hidden=false;
  el('scanShape').getContext('2d').clearRect(0,0,180,110);
  el('scanInfo').textContent='Schuif iets naar rechts…';
  try{
    const start=previewFrame(),worker=new Worker('dense.js');
    previewWorker=worker;
    function fail(){
      if(previewWorker!==worker)return;
      worker.terminate();previewWorker=null;
      el('scanInfo').textContent='3D-preview niet beschikbaar';
    }
    function update(){
      if(previewWorker!==worker)return;
      try{
        const current=previewFrame();
        if(current.width!==start.width||current.height!==start.height){fail();return;}
        const focal=start.width*Number(el('field').value)/(2*Math.tan(65*Math.PI/360));
        worker.postMessage([start.data,current.data,start.width,start.height,1,focal,3]);
      }catch{fail()}
    }
    worker.onmessage=({data})=>{
      if(previewWorker!==worker)return;
      if(data.error){fail();return}
      paintPreview(data);
      previewTimer=setTimeout(update,300);
    };
    worker.onerror=fail;
    previewTimer=setTimeout(update,200);
  }catch{el('scanInfo').textContent='3D-preview niet beschikbaar'}
}
