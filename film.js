let filmPair = null;
let camera, firstFrame, pulseTimer, audioContext;
const live = el('live');
const message = text => { el('filmStatus').textContent = text; };

function frame(video) {
  const scale = Math.min(1, Number(el('resolution').value) / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function tick() {
  if (!el('sound').checked || audioContext?.state !== 'running') return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  oscillator.frequency.setValueAtTime(950, now);
  oscillator.frequency.exponentialRampToValueAtTime(680, now + 0.055);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.07);
}

function closeCamera() {
  clearInterval(pulseTimer);
  firstFrame = null;
  camera?.getTracks().forEach(track => track.stop());
  camera = null;
  live.srcObject = null;
  live.hidden = true;
  el('openCamera').disabled = false;
  el('closeCamera').disabled = el('film').disabled = el('finish').disabled = true;
  el('facing').disabled = el('clip').disabled = false;
}
el('closeCamera').onclick = () => { closeCamera(); message('Camera gesloten.'); };
window.addEventListener('pagehide', closeCamera);
el('openCamera').onclick = async () => {
  el('openCamera').disabled = true;
  try {
    camera = await navigator.mediaDevices.getUserMedia({audio:false, video:{
      facingMode:{ideal:el('facing').value}, width:{ideal:3840}, height:{ideal:2160}
    }});
    live.srcObject = camera;
    live.hidden = false;
    await live.play();
    el('film').disabled = el('closeCamera').disabled = false;
    const actual = camera.getVideoTracks()[0].getSettings().facingMode;
    if (actual && actual !== el('facing').value) {
      closeCamera();
      message('Deze camera is niet beschikbaar. Kies de andere camera.');
      return;
    }
    message('Zet de camera in de beginpositie en tik op Start filmscan.');
  } catch {
    closeCamera();
    message('Cameratoegang mislukt. Sta de camera toe in Safari of kies een opgenomen film.');
  }
};
el('film').onclick = () => {
  if (!live.videoWidth) { message('Wacht op het eerste camerabeeld.'); return; }
  firstFrame = frame(live);
  el('facing').disabled = el('film').disabled = el('clip').disabled = true;
  el('finish').disabled = false;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().then(tick).catch(()=>{});
    pulseTimer = setInterval(tick, 300);
  } catch { /* Capture continues when audio is unavailable. */ }
  message('Filmscan loopt. Schuif naar rechts en stop op de eindpositie.');
};
el('finish').onclick = () => {
  try {
    filmPair = [firstFrame, frame(live)];
    closeCamera();
    message('Begin- en eindbeeld uit de livevideo vastgelegd.');
    el('build').click();
  } catch { closeCamera(); message('Videobeeld verloren. Start de filmscan opnieuw.'); }
};
function waitVideo(video, event, action) {
  return new Promise((resolve,reject) => {
    const done = success => {
      clearTimeout(timeout);
      video.removeEventListener(event, ready);
      video.removeEventListener('error', failed);
      success ? resolve() : reject(Error('Deze film kan niet worden gelezen.'));
    };
    const ready = () => done(true), failed = () => done(false);
    const timeout = setTimeout(failed, 15000);
    video.addEventListener(event, ready);
    video.addEventListener('error', failed);
    action();
  });
}
el('clip').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  closeCamera();
  const video = document.createElement('video'), url = URL.createObjectURL(file);
  video.muted = video.playsInline = true;
  video.preload = 'auto';
  el('openCamera').disabled = el('clip').disabled = true;
  try {
    await waitVideo(video,'loadedmetadata',()=>{video.src=url;});
    if (!Number.isFinite(video.duration) || video.duration < 0.4) throw Error('Kies een film van minimaal 0,4 seconde.');
    const frames = [];
    for (const time of [0.05,video.duration-0.15]) {
      await waitVideo(video,'seeked',()=>{video.currentTime=time;});
      frames.push(frame(video));
    }
    filmPair = frames;
    message('Begin- en eindbeeld uit de film gelezen.');
    el('build').click();
  } catch (e) { filmPair = null; message(e.message); }
  finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
    el('openCamera').disabled = el('clip').disabled = false;
  }
};
for (const id of ['left','right']) el(id).addEventListener('change',()=>{
  filmPair=null;
  message('De berekening gebruikt de losse foto’s.');
});

el('facing').onchange = () => { if (camera) { closeCamera(); el('openCamera').click(); } };
