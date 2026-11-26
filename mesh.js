function calculate(l,r,baseline,focal){
 return new Promise((resolve,reject)=>{
   const worker=new Worker('dense.js');
   worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data)};
   worker.onerror=()=>{worker.terminate();reject(Error('Berekening afgebroken. Probeer de lagere resolutie.'))};
   worker.postMessage([l.data,r.data,l.width,l.height,baseline,focal,Number(el('step').value)]);
 });
}
let screenPoints=[],picked=[],scaleFactor=1;
function draw(){
 const ctx=el('view').getContext('2d');ctx.clearRect(0,0,600,400);screenPoints=[];if(!mesh)return;
 const {p,c}=mesh,skip=Math.max(1,Math.ceil(p.length/3/65000));
 let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
 for(let i=0;i<p.length;i+=3*skip){
   const z=p[i+2]*Math.cos(yaw)-p[i]*Math.sin(yaw),u=p[i]*Math.cos(yaw)+p[i+2]*Math.sin(yaw),v=p[i+1]*Math.cos(pitch)-z*Math.sin(pitch);
   screenPoints.push({i,u,v,z:z*Math.cos(pitch)+p[i+1]*Math.sin(pitch)});
   xmin=Math.min(xmin,u);xmax=Math.max(xmax,u);ymin=Math.min(ymin,v);ymax=Math.max(ymax,v);
 }
 const s=Math.min(570/(xmax-xmin||1),370/(ymax-ymin||1));
 for(const pt of screenPoints.sort((a,b)=>a.z-b.z)){
   pt.x=300+(pt.u-(xmin+xmax)/2)*s;pt.y=200-(pt.v-(ymin+ymax)/2)*s;
   ctx.fillStyle='rgb('+c.subarray(pt.i,pt.i+3).join(',')+')';ctx.fillRect(pt.x,pt.y,3,3);
 }
 for(const pt of screenPoints.filter(pt=>picked.includes(pt.i))){ctx.strokeStyle='yellow';ctx.beginPath();ctx.arc(pt.x,pt.y,6,0,Math.PI*2);ctx.stroke()}
}
el('view').addEventListener('click',e=>{
 if(!mesh||!el('measure').checked)return;
 const rect=e.target.getBoundingClientRect(),x=(e.clientX-rect.left)*600/rect.width,y=(e.clientY-rect.top)*400/rect.height;
 let nearest,dist=64;for(const pt of screenPoints){const d=(pt.x-x)**2+(pt.y-y)**2;if(d<=dist){dist=d;nearest=pt}}
 if(!nearest)return;if(picked.length===2)picked=[];picked.push(nearest.i);draw();
 el('reading').textContent=picked.length===2?'Afstand in model: '+(distance()*scaleFactor).toFixed(3)+' mm':'Tik op het tweede punt.';
});
function distance(){return Math.hypot(...[0,1,2].map(k=>mesh.p[picked[0]+k]-mesh.p[picked[1]+k]))}
el('calibrate').onclick=()=>{
 const known=Number(el('known').value);
 if(picked.length!==2||!(distance()>0&&known>0)){el('reading').textContent='Selecteer twee verschillende punten en vul de gemeten lengte in.';return}
 scaleFactor=known/distance();el('reading').textContent='Exportschaal ingesteld. Controleer een tweede bekende afstand.';picked=[];draw();
};
function encode(ext){
 const {p,c,f}=mesh,ply=ext==='ply',nv=p.length/3,nf=f.length/3;
 const header=ply?new TextEncoder().encode(['ply','format binary_little_endian 1.0','element vertex '+nv,...['x','y','z'].map(k=>'property float '+k),...['red','green','blue'].map(k=>'property uchar '+k),'element face '+nf,'property list uchar int vertex_indices','end_header',''].join('\n')):new Uint8Array(84);
 const buffer=new ArrayBuffer(header.length+(ply?nv*15+nf*13:nf*50));new Uint8Array(buffer).set(header);
 const view=new DataView(buffer);let off=header.length;
 function float(v){view.setFloat32(off,v,true);off+=4}
 if(ply){
 for(let i=0;i<p.length;i+=3){for(let k=0;k<3;k++)float(p[i+k]*scaleFactor);for(let k=0;k<3;k++)view.setUint8(off++,c[i+k])}
 for(let i=0;i<f.length;i+=3){view.setUint8(off++,3);for(let k=0;k<3;k++){view.setInt32(off,f[i+k],true);off+=4}}
 }else{view.setUint32(80,nf,true);for(let i=0;i<f.length;i+=3){off+=12;for(let j=0;j<3;j++)for(let k=0;k<3;k++)float(p[f[i+j]*3+k]*scaleFactor);off+=2}}
 return buffer;
}
