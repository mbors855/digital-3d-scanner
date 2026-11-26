// Four distinctive printed dots. Reject ambiguous or clipped components.
function referenceDots(image) {
  const {width:w,height:h,data}=image, stride=Math.max(1,Math.floor(Math.max(w,h)/1200));
  const cols=Math.ceil(w/stride),rows=Math.ceil(h/stride);
  const labels=new Uint8Array(cols*rows), groups=[[],[],[],[],[]];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const k=4*stride*(y*w+x),r=data[k],g=data[k+1],b=data[k+2];
    labels[y*cols+x]=r>1.6*g&&b>1.6*g&&Math.min(r,b)>.55*Math.max(r,b)&&r>65?4:
      r>75&&r>1.65*g&&r>1.65*b?1:g>55&&g>1.5*r&&g>1.35*b?2:b>70&&b>1.65*r&&b>1.4*g?3:0;
  }
  const queue=new Int32Array(labels.length);
  for(let i=0;i<labels.length;i++){
    const id=labels[i];if(!id)continue;
    queue[0]=i;labels[i]=0;let end=1,sx=0,sy=0,minX=cols,minY=rows,maxX=0,maxY=0;
    for(let j=0;j<end;j++){
      const k=queue[j],x=k%cols,y=Math.floor(k/cols);
      sx+=x;sy+=y;minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);
      for(const next of [x>0?k-1:-1,x+1<cols?k+1:-1,k-cols,k+cols]){
        if(labels[next]===id){labels[next]=0;queue[end++]=next}
      }
    }
    const dx=maxX-minX+1,dy=maxY-minY+1,fill=end/(dx*dy);
    if(end>=18&&minX>0&&minY>0&&maxX<cols-1&&maxY<rows-1&&dx/dy>.62&&dx/dy<1.6&&fill>.55&&fill<.94)
      groups[id].push([sx*stride/end,sy*stride/end,end]);
  }
  if(groups.slice(1).some(g=>g.length!==1))throw Error('Houd alle vier gekleurde stippen van de schaalkaart scherp in beide beelden, zonder andere gekleurde stippen.');
  return groups.slice(1).map(g=>g[0]);
}
function automaticReference(left,right,focal){
  const a=referenceDots(left),b=referenceDots(right);
  const points=a.map(([x,y,area],i)=>{
    const [rx,ry,otherArea]=b[i],d=x-rx;
    if(d<3||Math.abs(y-ry)>Math.max(1.5,left.width*.001)||Math.abs(area/otherArea-1)>.25)
      throw Error('De kaart bewoog of de camera draaide. Film opnieuw met een rechte beweging naar rechts.');
    return [(x-left.width/2)/d,(left.height/2-y)/d,-focal/d];
  });
  const dist=(i,j)=>Math.hypot(...points[i].map((v,k)=>v-points[j][k]));
  const baseline=30/dist(0,1), control=dist(2,3)*baseline;
  const error=Math.abs(control-20);
  if(!Number.isFinite(error)||error>.4||
    [[0,2,Math.hypot(5,20)],[0,3,Math.hypot(25,20)],[1,2,Math.hypot(25,20)],[1,3,Math.hypot(5,20)]].some(([i,j,n])=>Math.abs(dist(i,j)*baseline-n)>.7))
    throw Error('Kaartgeometrie buiten de testgrens. Leg de kaart vlak en film opnieuw.');
  return {baseline,control};
}
if(typeof module!=='undefined')module.exports=automaticReference;
