// XR depth is axial in metres. Reject points outside a radial 10 mm envelope.
function samplePatch(info, projection) {
 const nx=Math.min(80,Math.floor(info.width/4)),ny=Math.min(80,Math.floor(info.height/4));
 const points=[],faces=[],cells=new Int32Array(nx*ny).fill(-1);
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   const u=.375+.25*(x+.5)/nx,v=.375+.25*(y+.5)/ny,z=info.getDepthInMeters(u,v)*1000;
   const px=z*(2*u-1+projection[8])/projection[0],py=z*(1-2*v+projection[9])/projection[5];
   const radius=Math.hypot(px,py,z);
   if(!(z>0&&radius<=10))continue;
   const k=y*nx+x,id=points.length;
   cells[k]=id;points.push([px,py,-z,u,v]);
   if(!x||!y)continue;
   for(const tri of [[cells[k-nx-1],cells[k-1],id],[cells[k-nx-1],id,cells[k-nx]]]){
     if(tri.includes(-1))continue;
     const depths=tri.map(i=>points[i][2]);
     if(Math.max(...depths)-Math.min(...depths)<=.5)faces.push(tri);
   }
 }
 return {points,faces};
}
if(typeof module!=='undefined')module.exports=samplePatch;
else {
 const ui=id=>document.getElementById(id),say=t=>ui('status').textContent=t;
 let session=null,last=null,saved=null;
 const ctx=ui('preview').getContext('2d');
 const unavailable='Geen bruikbare dieptecamera in deze browser. De 10-mm-scan blijft uit.';
 ui('start').disabled=true;
 (async()=>{try{
   if(!await navigator.xr?.isSessionSupported('immersive-ar')){say(unavailable);return}
   ui('start').disabled=false;say('Start om de dieptemeting te controleren.');
 }catch{say(unavailable)}})();
 ui('start').onclick=async()=>{
   ui('start').disabled=true;
   try{
     session=await navigator.xr.requestSession('immersive-ar',{
       requiredFeatures:['depth-sensing','dom-overlay'],domOverlay:{root:ui('panel')},
       depthSensing:{usagePreference:['cpu-optimized'],dataFormatPreference:['luminance-alpha','float32']}
     });
     const active=session;
     active.addEventListener('end',()=>{
       session=null;last=null;ui('start').disabled=false;ui('stop').disabled=true;
       ui('save').disabled=!saved;say(saved?'Oppervlak vastgelegd in sensor-millimeters.':'Scan gestopt zonder geldig oppervlak.');
     });
     const gl=document.createElement('canvas').getContext('webgl',{xrCompatible:true,alpha:true});
     if(!gl)throw Error();
     active.updateRenderState({baseLayer:new XRWebGLLayer(active,gl)});
     const space=await active.requestReferenceSpace('viewer');
     saved=last=null;ui('save').disabled=true;ui('stop').disabled=false;
     let previous=-Infinity;
     function scan(t,frame){
       if(active!==session)return;
       active.requestAnimationFrame(scan);
       if(t-previous<100)return;previous=t;
       last=null;ctx.clearRect(0,0,140,100);
       try{
         const view=frame.getViewerPose(space)?.views[0];
         const depth=view&&frame.getDepthInformation(view);
         if(!depth){say('Wachten op dieptemeting.');return}
         const patch=samplePatch(depth,view.projectionMatrix);
         for(const [,,z,u,v] of patch.points){
           ctx.fillStyle='hsl(170 65% '+(80+z*4)+'%)';ctx.fillRect((u-.375)*560,(v-.375)*400,3,3);
         }
         if(patch.faces.length){last=patch;say(patch.faces.length+' driehoeken binnen bereik. Tik op Stop om dit beeld te bewaren.')}
         else say('Geen meetbaar oppervlak binnen 10 mm.');
       }catch{say('Dieptemeting ontbreekt.')}
     }
     active.requestAnimationFrame(scan);
   }catch{if(session)await session.end().catch(()=>{});say(unavailable);ui('start').disabled=false}
 };
 ui('stop').onclick=()=>{saved=last;session?.end()};
 ui('save').onclick=async()=>{
   if(!saved)return;
   const {points,faces}=saved,buffer=new ArrayBuffer(84+50*faces.length),v=new DataView(buffer);
   v.setUint32(80,faces.length,true);
   faces.forEach((tri,i)=>tri.forEach((id,j)=>{for(let k=0;k<3;k++)v.setFloat32(96+i*50+12*j+4*k,points[id][k],true)}));
   const file=new File([buffer],'dichtbij-sensormaat.stl',{type:'application/octet-stream'});
   try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file]});return}}catch(e){if(e.name==='AbortError')return}
   const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
 };
}
