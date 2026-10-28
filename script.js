const eyes=[...document.querySelectorAll('.eye')];
const controls=document.getElementById('controls');
const video=document.getElementById('cameraVideo');
const cameraButton=document.getElementById('cameraButton');
const cameraStatus=document.getElementById('cameraStatus');
let state='neutral',lookTimeout=null,cameraStream=null,faceDetector=null,cameraRunning=false,lastVideoTime=-1,lastDetection=0,smoothX=0,smoothY=0,noFaceFrames=0;

function setState(next){state=next||'neutral';document.body.dataset.state=state}
controls.addEventListener('click',e=>{const b=e.target.closest('button[data-state]');if(b)setState(b.dataset.state)});

function blink(){if(state==='sleep')return;eyes.forEach(eye=>eye.animate([{transform:'translate(var(--look-x),var(--look-y)) scaleY(1)'},{transform:'translate(var(--look-x),var(--look-y)) scaleY(.06)'},{transform:'translate(var(--look-x),var(--look-y)) scaleY(1)'}],{duration:190,easing:'ease-in-out'}))}
function scheduleBlink(){setTimeout(()=>{blink();scheduleBlink()},3000+Math.random()*5000)}

function setLook(nx,ny){const s=eyes[0].getBoundingClientRect().width;document.documentElement.style.setProperty('--look-x',`${nx*s*.15}px`);document.documentElement.style.setProperty('--look-y',`${ny*s*.15}px`)}
function centerLook(){smoothX=0;smoothY=0;setLook(0,0)}
function followPoint(x,y){if(cameraRunning)return;const nx=Math.max(-1,Math.min(1,(x-innerWidth/2)/(innerWidth/2)));const ny=Math.max(-1,Math.min(1,(y-innerHeight/2)/(innerHeight/2)));setLook(nx,ny);clearTimeout(lookTimeout);lookTimeout=setTimeout(centerLook,1200)}
addEventListener('mousemove',e=>followPoint(e.clientX,e.clientY));addEventListener('touchmove',e=>{if(e.touches[0])followPoint(e.touches[0].clientX,e.touches[0].clientY)},{passive:true});addEventListener('touchend',()=>{if(!cameraRunning){clearTimeout(lookTimeout);lookTimeout=setTimeout(centerLook,400)}});

async function loadFaceDetector(){
  if(faceDetector)return faceDetector;
  cameraStatus.textContent='Laddar ansiktsdetektor…';
  const vision=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm');
  const fileset=await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
  faceDetector=await vision.FaceDetector.createFromOptions(fileset,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'},runningMode:'VIDEO',minDetectionConfidence:.55});
  return faceDetector;
}

async function startCamera(){
  try{
    cameraButton.disabled=true;cameraStatus.textContent='Begär kameratillstånd…';
    const detectorPromise=loadFaceDetector();
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
    video.srcObject=cameraStream;await video.play();await detectorPromise;
    cameraRunning=true;cameraButton.textContent='Stoppa kamera';cameraStatus.textContent='Kamera: söker ansikte';cameraButton.disabled=false;requestAnimationFrame(cameraLoop);
  }catch(error){console.error(error);cameraStatus.textContent='Kamera kunde inte startas';cameraButton.textContent='Starta kamera';cameraButton.disabled=false;cameraRunning=false;}
}
function stopCamera(){cameraRunning=false;if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null}video.srcObject=null;cameraButton.textContent='Starta kamera';cameraStatus.textContent='Kamera av';centerLook()}
cameraButton.addEventListener('click',()=>cameraRunning?stopCamera():startCamera());

function cameraLoop(now){
  if(!cameraRunning)return;
  if(video.readyState>=2&&video.currentTime!==lastVideoTime&&now-lastDetection>90){
    lastVideoTime=video.currentTime;lastDetection=now;
    try{
      const result=faceDetector.detectForVideo(video,performance.now());
      if(result.detections&&result.detections.length){
        const box=result.detections[0].boundingBox;
        const cx=(box.originX+box.width/2)/video.videoWidth;
        const cy=(box.originY+box.height/2)/video.videoHeight;
        // Frontkameran spegelvänds för naturlig blick från användarens perspektiv.
        const targetX=Math.max(-1,Math.min(1,(.5-cx)*2));
        const targetY=Math.max(-1,Math.min(1,(cy-.5)*2));
        smoothX=smoothX*.72+targetX*.28;smoothY=smoothY*.72+targetY*.28;setLook(smoothX,smoothY);noFaceFrames=0;cameraStatus.textContent='Kamera: följer ansikte';
      }else{
        noFaceFrames++;if(noFaceFrames>8){smoothX*=.82;smoothY*=.82;setLook(smoothX,smoothY);cameraStatus.textContent='Kamera: söker ansikte';}
      }
    }catch(error){console.error(error);cameraStatus.textContent='Kamera: detekteringsfel';}
  }
  requestAnimationFrame(cameraLoop);
}

function updateClock(){const n=new Date();document.getElementById('clock').textContent=n.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});document.getElementById('date').textContent=n.toLocaleDateString('sv-SE',{weekday:'short',day:'numeric',month:'short'}).replace('.','')}
setState('neutral');centerLook();updateClock();setInterval(updateClock,1000);scheduleBlink();
