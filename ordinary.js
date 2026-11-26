const ordinary=document.getElementById('ordinary');
const openVideo=document.getElementById('openVideo');
const endVideo=document.getElementById('endVideo');
const videoMessage=document.getElementById('videoMessage');
let requestNumber=0;
function closeOrdinary(){
  requestNumber++;
  ordinary.srcObject?.getTracks().forEach(track=>track.stop());
  ordinary.srcObject=null;
  ordinary.hidden=true;
  endVideo.hidden=true;
  openVideo.disabled=false;
  videoMessage.textContent='Camerabeeld gesloten.';
}
endVideo.onclick=closeOrdinary;
window.addEventListener('pagehide',closeOrdinary);
openVideo.onclick=async()=>{
  const current=++requestNumber;
  openVideo.disabled=true;
  endVideo.hidden=false;
  videoMessage.textContent='Wachten op cameratoestemming…';
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Open deze HTTPS-pagina rechtstreeks in Safari.');
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
    if(current!==requestNumber){stream.getTracks().forEach(track=>track.stop());return;}
    ordinary.srcObject=stream;
    ordinary.hidden=false;
    try{await ordinary.play();}catch{
      if(current===requestNumber)videoMessage.textContent='Camera geopend. Tik op afspelen om het beeld te zien.';
      return;
    }
    if(current===requestNumber)videoMessage.textContent='Camera actief. Dit beeld heeft geen 10-mm-afstandsmeting.';
  }catch(error){
    if(current!==requestNumber)return;
    closeOrdinary();
    const hints={
      NotAllowedError:'Geen toestemming. Open deze link in Safari en sta de camera toe in de website-instellingen.',
      NotReadableError:'De camera is bezet. Sluit de andere camera-app en probeer opnieuw.',
      NotFoundError:'Deze browser vindt geen camera. Open de link op je iPhone in Safari.'
    };
    videoMessage.textContent=hints[error.name]||error.message||'Camera openen mislukt.';
  }
};
