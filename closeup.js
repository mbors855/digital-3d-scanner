// Keep the preview and capture centred on the same source pixels.
function cropGeometry(width, height, zoom, limit) {
  const w = Math.max(1, Math.round(width / zoom));
  const h = Math.max(1, Math.round(height / zoom));
  const scale = Math.min(1, limit / Math.max(w, h));
  return {
    x: Math.floor((width-w)/2), y: Math.floor((height-h)/2), w, h,
    outW: Math.max(1,Math.round(w*scale)), outH: Math.max(1,Math.round(h*scale))
  };
}
function captureRegion(source, width, height) {
  const g = cropGeometry(width,height,Number(el('field').value),Number(el('resolution').value));
  const canvas = document.createElement('canvas');
  canvas.width=g.outW; canvas.height=g.outH;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(source,g.x,g.y,g.w,g.h,0,0,g.outW,g.outH);
  const image=ctx.getImageData(0,0,g.outW,g.outH);
  image.estimatedFocal=width*g.outW/g.w/(2*Math.tan(65*Math.PI/360));
  return image;
}
async function focusCentre(track) {
  const caps=track.getCapabilities?.() || {};
  const constraints={};
  if(caps.focusMode?.includes('continuous')) constraints.focusMode='continuous';
  if(navigator.mediaDevices.getSupportedConstraints?.().pointsOfInterest)
    constraints.pointsOfInterest=[{x:0.5,y:0.5}];
  if(Object.keys(constraints).length){
    try {await track.applyConstraints({advanced:[constraints]});}catch{}
  }
}
if(typeof module!=='undefined')module.exports=cropGeometry;
