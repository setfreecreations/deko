const eyes = [...document.querySelectorAll('.eye')];
const controls = document.getElementById('controls');
let state = 'neutral';
let lookTimeout = null;

function setState(next) {
  state = next || 'neutral';
  document.body.dataset.state = state;
}

controls.addEventListener('click', e => {
  const button = e.target.closest('button[data-state]');
  if (button) setState(button.dataset.state);
});

function blink() {
  if (state === 'sleep') return;
  eyes.forEach(eye => eye.animate([
    { transform: getComputedStyle(eye).transform },
    { transform: `translate(var(--look-x),var(--look-y)) scaleY(.06)` },
    { transform: `translate(var(--look-x),var(--look-y)) scaleY(1)` }
  ], { duration: 190, easing: 'ease-in-out' }));
}

function scheduleBlink() {
  setTimeout(() => { blink(); scheduleBlink(); }, 3000 + Math.random()*5000);
}

function setLook(nx, ny) {
  // Maxrörelse = 15 % av ögats diameter, i enlighet med designprincipen.
  const eyeSize = eyes[0].getBoundingClientRect().width;
  document.documentElement.style.setProperty('--look-x', `${nx * eyeSize * .15}px`);
  document.documentElement.style.setProperty('--look-y', `${ny * eyeSize * .15}px`);
}

function centerLook() { setLook(0,0); }

function followPoint(x,y) {
  const nx = Math.max(-1,Math.min(1,(x-innerWidth/2)/(innerWidth/2)));
  const ny = Math.max(-1,Math.min(1,(y-innerHeight/2)/(innerHeight/2)));
  setLook(nx,ny);
  clearTimeout(lookTimeout);
  lookTimeout = setTimeout(centerLook,1200);
}

addEventListener('mousemove', e => followPoint(e.clientX,e.clientY));
addEventListener('touchmove', e => { if(e.touches[0]) followPoint(e.touches[0].clientX,e.touches[0].clientY); }, {passive:true});
addEventListener('touchend', () => { clearTimeout(lookTimeout); lookTimeout=setTimeout(centerLook,400); });

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
  document.getElementById('date').textContent = now.toLocaleDateString('sv-SE',{weekday:'short',day:'numeric',month:'short'}).replace('.', '');
}

setState('neutral');
centerLook();
updateClock();
setInterval(updateClock,1000);
scheduleBlink();
