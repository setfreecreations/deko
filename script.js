import{FilesetResolver,FaceDetector}from"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm";const $=x=>document.getElementById(x),eyes=[...document.querySelectorAll('.eye')],D={x:45,y:32,s:36,ret:82,dead:8,size:50,t:7,pos:30,glow:72,color:'#eafaff',blink:true,idle:true},C={...D};let state='neutral',stream=null,det=null,running=false,sx=0,sy=0,last=0,gearTimer=null,tapTimer=null,lastTap=0,longTimer=null,long=false,bx=.5,by=.5,voiceRecognition=null,voiceRunning=false,voiceAwake=false,voiceBuffer='',speechText='',silenceTimer=null;
function setState(s){state=s;document.body.dataset.state=s}function apply(){let r=document.documentElement.style;r.setProperty('--size',C.size+'vh');r.setProperty('--thick',C.t+'px');r.setProperty('--l',C.pos+'%');r.setProperty('--r',(100-C.pos)+'%');r.setProperty('--glow',C.glow/100);r.setProperty('--color',C.color)}function look(x,y){if(Math.abs(x)<C.dead/100)x=0;if(Math.abs(y)<C.dead/100)y=0;let s=eyes[0].getBoundingClientRect().width;document.documentElement.style.setProperty('--x',x*s*C.x/100+'px');document.documentElement.style.setProperty('--y',y*s*C.y/100+'px')}function center(){sx=sy=0;look(0,0)}function blink(){if(!C.blink||state==='sleep')return;eyes.forEach(e=>e.animate([{transform:'translate3d(var(--x),var(--y),0) scaleY(1)'},{transform:'translate3d(var(--x),var(--y),0) scaleY(.05)'},{transform:'translate3d(var(--x),var(--y),0) scaleY(1)'}],{duration:190}))}function blinkLoop(){setTimeout(()=>{blink();blinkLoop()},3000+Math.random()*5000)}
const SpeechRecognitionClass=window.SpeechRecognition||window.webkitSpeechRecognition;
function normaliseSpeech(t){return t.toLowerCase().replace(/[.,!?]/g,'').replace(/\s+/g,' ').trim()}
function stripWake(t){return t.replace(/.*?hej\s+(deko|deco|dekko)[,\.\s!?]*/i,'').trim()}
function setVoiceStatus(t){$('voiceStatus').textContent=t}
function showSpeech(prompt,text=''){$('speechDisplay').hidden=false;$('speechPrompt').textContent=prompt;$('speechTranscript').textContent=text}
function hideSpeech(){$('speechDisplay').hidden=true;$('speechTranscript').textContent=''}
function finishListening(){clearTimeout(silenceTimer);voiceAwake=false;voiceBuffer='';setState('neutral');if(speechText){showSpeech('',speechText);setVoiceStatus('Röst: väntar på Hej Deko');setTimeout(hideSpeech,1800)}else{hideSpeech();setVoiceStatus('Röst: väntar på Hej Deko')}speechText=''}
function armSilenceTimer(){clearTimeout(silenceTimer);silenceTimer=setTimeout(finishListening,2000)}
function setupVoice(){
 if(!SpeechRecognitionClass){$('voiceButton').disabled=true;$('voiceButton').textContent='Röst stöds inte';setVoiceStatus('SpeechRecognition saknas i webbläsaren');return null}
 if(voiceRecognition)return voiceRecognition;
 const r=new SpeechRecognitionClass();r.lang='sv-SE';r.continuous=false;r.interimResults=true;r.maxAlternatives=3;
 r.onstart=()=>setVoiceStatus(voiceAwake?'Röst: lyssnar på frågan':'Röst: väntar på Hej Deko');
 r.onspeechstart=()=>setVoiceStatus(voiceAwake?'Röst: hör frågan':'Röst: hör tal…');
 r.onresult=e=>{
   let chunk='',finalChunk='';
   for(let i=e.resultIndex;i<e.results.length;i++){
     // Testa upp till tre alternativ eftersom Safari ibland misstolkar Deko.
     let chosen=e.results[i][0].transcript;
     for(let a=0;a<Math.min(3,e.results[i].length);a++){
       const alt=e.results[i][a].transcript;
       if(/hej\s+(deko|deco|dekko)/i.test(normaliseSpeech(alt))){chosen=alt;break}
     }
     chunk+=chosen+' '; if(e.results[i].isFinal)finalChunk+=chosen+' ';
   }
   const n=normaliseSpeech(chunk);setVoiceStatus('Hörde: '+chunk.trim());
   if(!voiceAwake){
     voiceBuffer=normaliseSpeech(voiceBuffer+' '+n).slice(-160);
     if(/hej\s+(deko|deco|dekko)/i.test(voiceBuffer)){
       voiceAwake=true;voiceBuffer='';speechText=stripWake(chunk);setState('listening');showSpeech('Jag lyssnar…',speechText);setVoiceStatus('Röst: aktiverad');armSilenceTimer();
     }
     return;
   }
   const clean=stripWake((finalChunk||chunk).trim());
   if(clean){if(finalChunk.trim())speechText=(speechText+' '+clean).replace(/\s+/g,' ').trim();showSpeech('Jag lyssnar…',speechText||clean);armSilenceTimer()}
 };
 r.onerror=e=>{if(e.error==='no-speech'){setVoiceStatus('Röst: inget tal – väntar');return}if(e.error==='aborted')return;setVoiceStatus('Röstfel: '+e.error);console.error(e)};
 r.onend=()=>{if(voiceRunning)setTimeout(()=>{try{r.start()}catch(err){console.log(err)}},350)};
 voiceRecognition=r;return r;
}
function toggleVoice(){const r=setupVoice();if(!r)return;if(voiceRunning){voiceRunning=false;voiceAwake=false;clearTimeout(silenceTimer);try{r.stop()}catch{};$('voiceButton').textContent='Starta röst';setVoiceStatus('Röst av');hideSpeech();setState('neutral');return}voiceRunning=true;voiceAwake=false;voiceBuffer='';speechText='';$('voiceButton').textContent='Stoppa röst';setVoiceStatus('Startar röst…');try{r.start()}catch(e){setVoiceStatus('Startfel: '+e.message)}}
async function init(){if(det)return;let v=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');det=await FaceDetector.createFromModelPath(v,'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite');await det.setOptions({runningMode:'VIDEO',minDetectionConfidence:.5})}async function start(){try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});$('cameraVideo').srcObject=stream;await $('cameraVideo').play();await init();running=true;$('camera').textContent='Stoppa kamera';requestAnimationFrame(loop)}catch(e){$('cameraStatus').textContent='Fel: '+e.message}}function stop(){running=false;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$('camera').textContent='Starta kamera';center()}
function loop(n){if(!running)return;if(n-last>90){last=n;let r=det.detectForVideo($('cameraVideo'),performance.now());if(r.detections?.length){let b=r.detections[0].boundingBox,cx=(b.originX+b.width/2)/$('cameraVideo').videoWidth,cy=(b.originY+b.height/2)/$('cameraVideo').videoHeight,tx=Math.max(-1,Math.min(1,(.5-cx)*2)),ty=Math.max(-1,Math.min(1,(cy-.5)*2)),a=C.s/100;sx=sx*(1-a)+tx*a;sy=sy*(1-a)+ty*a;look(sx,sy);bx=cx;by=cy;$('cameraStatus').textContent='Följer ansikte';marker()}else{$('cameraStatus').textContent='Söker ansikte'}}requestAnimationFrame(loop)}function marker(){if(!$('showMarker').checked||!document.body.classList.contains('cal')){$('marker').hidden=true;return}let r=$('cameraVideo').getBoundingClientRect();$('marker').hidden=false;$('marker').style.left=r.left+(1-bx)*r.width+'px';$('marker').style.top=r.top+by*r.height+'px'}
function showGear(){clearTimeout(gearTimer);$('gear').classList.add('show');if($('panel').hidden)gearTimer=setTimeout(()=>$('gear').classList.remove('show'),5000)}$('gear').onclick=e=>{e.stopPropagation();$('panel').hidden=!$('panel').hidden;showGear()};$('close').onclick=()=>{$('panel').hidden=true;showGear()};$('face').onpointerdown=e=>{long=false;longTimer=setTimeout(()=>{long=true;$('panel').hidden=false;showGear()},650)};$('face').onpointerup=e=>{clearTimeout(longTimer);if(long)return;let n=Date.now();if(n-lastTap<320){clearTimeout(tapTimer);lastTap=0;setState(state==='sleep'?'neutral':'sleep');showGear()}else{lastTap=n;tapTimer=setTimeout(showGear,330)}};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab],.page').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector('[data-page='+b.dataset.tab+']').classList.add('active')});$('camera').onclick=()=>running?stop():start();$('voiceButton').onclick=toggleVoice;$('calibrate').onclick=()=>{document.body.classList.toggle('cal');marker()};$('showMarker').onchange=marker;document.querySelector('.grid').onclick=e=>{let b=e.target.closest('[data-state]');if(b)setState(b.dataset.state)};
const M={rx:['x','ox'],ry:['y','oy'],rs:['s','os'],rr:['ret','or'],rd:['dead','od'],rz:['size','oz'],rt:['t','ot'],rp:['pos','op'],rg:['glow','og']};function render(){for(let[id,[k,o]]of Object.entries(M)){let v=C[k];$(id).value=v;$(o).textContent=id==='rp'?v+'/'+(100-v):v+(id==='rt'?' px':'%')}$('color').value=C.color;$('blink').checked=C.blink;$('idle').checked=C.idle;apply()}function read(){for(let[id,[k]]of Object.entries(M))C[k]=+$ (id).value;C.color=$('color').value;C.blink=$('blink').checked;C.idle=$('idle').checked;render()}document.querySelectorAll('#panel input').forEach(i=>i.oninput=read);$('save').onclick=()=>localStorage.setItem('deko91',JSON.stringify(C));$('reset').onclick=()=>{Object.assign(C,D);localStorage.removeItem('deko91');render();center()};$('copy').onclick=async()=>{let t=JSON.stringify(C);try{await navigator.clipboard.writeText(t)}catch{prompt('Kopiera:',t)}};function clock(){let n=new Date();$('clock').textContent=n.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});$('date').textContent=n.toLocaleDateString('sv-SE',{weekday:'short',day:'numeric',month:'short'}).replace('.','')}try{Object.assign(C,JSON.parse(localStorage.getItem('deko91'))||{})}catch{}render();center();clock();setInterval(clock,1000);blinkLoop();
