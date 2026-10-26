const eyes = document.querySelectorAll(".eye");
const pupils = document.querySelectorAll(".pupil");
const stateButtons = document.querySelectorAll("button[data-state]");

const micButton = document.getElementById("micButton");
const speechButton = document.getElementById("speechButton");
const speechText = document.getElementById("speechText");

let userIsInteracting = false;
let interactionTimer;

let microphoneStream = null;
let audioContext = null;

let dekoAwake = false;
let recognitionShouldRun = false;
let wakeBuffer = "";
let commandText = "";
let confirmationVisible = false;


/* ÖGONTILLSTÅND */

function resetEyes() {
    eyes.forEach(eye => {
        eye.style.width = "120px";
        eye.style.height = "120px";
        eye.style.borderRadius = "50%";
        eye.style.background = "white";
        eye.style.transform = "scaleY(1)";
    });

    pupils.forEach(pupil => {
        pupil.style.width = "42px";
        pupil.style.height = "42px";
        pupil.style.left = "39px";
        pupil.style.top = "39px";
        pupil.style.transform = "scale(1)";
    });
}

function setState(state) {
    resetEyes();

    if (state === "listening") {
        pupils.forEach(pupil => {
            pupil.style.width = "52px";
            pupil.style.height = "52px";
            pupil.style.left = "34px";
            pupil.style.top = "34px";
        });
    }

    if (state === "thinking") {
        pupils.forEach(pupil => {
            pupil.style.left = "58px";
            pupil.style.top = "18px";
        });
    }

    if (state === "searching") {
        pupils.forEach(pupil => {
            pupil.style.left = "18px";
        });
    }

    if (state === "happy") {
        eyes.forEach(eye => {
            eye.style.height = "65px";
            eye.style.borderRadius = "0 0 100px 100px";
        });
    }

    if (state === "surprised") {
        eyes.forEach(eye => {
            eye.style.width = "140px";
            eye.style.height = "140px";
        });
    }

    if (state === "uncertain") {
        eyes[0].style.height = "75px";
    }

    if (state === "sleep") {
        eyes.forEach(eye => {
            eye.style.height = "8px";
            eye.style.borderRadius = "10px";
        });
    }

    if (state === "error") {
        eyes.forEach(eye => {
            eye.style.background = "#ff3b30";
        });
    }
}

stateButtons.forEach(button => {
    button.addEventListener("click", () => {
        setState(button.dataset.state);
    });
});


/* AUTOMATISK BLINKNING */

function blink() {
    eyes.forEach(eye => {
        eye.style.transform = "scaleY(0.08)";
    });

    setTimeout(() => {
        eyes.forEach(eye => {
            eye.style.transform = "scaleY(1)";
        });
    }, 140);
}

function scheduleBlink() {
    const delay = 3000 + Math.random() * 5000;

    setTimeout(() => {
        blink();
        scheduleBlink();
    }, delay);
}


/* NATURLIGA BLICKRÖRELSER */

function naturalLook() {
    if (userIsInteracting || dekoAwake) {
        return;
    }

    const x = 25 + Math.random() * 28;
    const y = 25 + Math.random() * 28;

    pupils.forEach(pupil => {
        pupil.style.left = x + "px";
        pupil.style.top = y + "px";
    });

    setTimeout(() => {
        if (!userIsInteracting && !dekoAwake) {
            pupils.forEach(pupil => {
                pupil.style.left = "39px";
                pupil.style.top = "39px";
            });
        }
    }, 800 + Math.random() * 1200);
}

function scheduleLook() {
    const delay = 2000 + Math.random() * 4000;

    setTimeout(() => {
        naturalLook();
        scheduleLook();
    }, delay);
}


/* MUS OCH FINGER */

function followPoint(x, y) {
    userIsInteracting = true;

    pupils.forEach((pupil, index) => {
        const eye = eyes[index];
        const rect = eye.getBoundingClientRect();

        const eyeCenterX = rect.left + rect.width / 2;
        const eyeCenterY = rect.top + rect.height / 2;

        const dx = x - eyeCenterX;
        const dy = y - eyeCenterY;

        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxMove = 25;

        const moveX = distance > 0
            ? (dx / distance) * Math.min(distance / 8, maxMove)
            : 0;

        const moveY = distance > 0
            ? (dy / distance) * Math.min(distance / 8, maxMove)
            : 0;

        pupil.style.left = (39 + moveX) + "px";
        pupil.style.top = (39 + moveY) + "px";
    });

    clearTimeout(interactionTimer);

    interactionTimer = setTimeout(() => {
        userIsInteracting = false;
    }, 1500);
}

document.addEventListener("mousemove", event => {
    followPoint(event.clientX, event.clientY);
});

document.addEventListener("touchmove", event => {
    const touch = event.touches[0];

    if (touch) {
        followPoint(touch.clientX, touch.clientY);
    }
}, { passive: true });


/* MIKROFON OCH LJUDREAKTION */

async function startMicrophoneLevel() {
    if (microphoneStream) {
        return;
    }

    microphoneStream =
        await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new (
        window.AudioContext || window.webkitAudioContext
    )();

    const source =
        audioContext.createMediaStreamSource(microphoneStream);

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    source.connect(analyser);

    const data =
        new Uint8Array(analyser.frequencyBinCount);

    function detectVoice() {
        analyser.getByteFrequencyData(data);

        const level =
            data.reduce((sum, value) => sum + value, 0) /
            data.length;

        if (level > 15) {
            pupils.forEach(pupil => {
                pupil.style.transform = "scale(1.18)";
            });
        } else {
            pupils.forEach(pupil => {
                pupil.style.transform = "scale(1)";
            });
        }

        requestAnimationFrame(detectVoice);
    }

    detectVoice();
}

micButton.addEventListener("click", async () => {
    try {
        await startMicrophoneLevel();

        setState("listening");
        micButton.textContent = "🎤 Lyssnar";
    } catch (error) {
        console.error(error);

        micButton.textContent = "Mikrofon nekad";
        setState("error");
    }
});


/* TALIGENKÄNNING */

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    speechButton.disabled = true;
    speechText.textContent =
        "Taligenkänning stöds inte i webbläsaren.";
} else {
    const recognition = new SpeechRecognition();

    recognition.lang = "sv-SE";
    recognition.continuous = true;
    recognition.interimResults = true;

    function normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[.,!?]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function removeWakePhrase(text) {
        return text
            .replace(/hej\s+deko/i, "")
            .replace(/hej\s+deco/i, "")
            .replace(/hej\s+dekko/i, "")
            .replace(/^[,.\s]+/, "")
            .trim();
    }

    function showWakeConfirmation(remainder) {
        dekoAwake = true;
        confirmationVisible = true;
        wakeBuffer = "";
        commandText = "";

        setState("listening");
        speechText.textContent = "Ja Erik, jag lyssnar...";

        setTimeout(() => {
            confirmationVisible = false;

            if (remainder) {
                commandText = remainder;
                speechText.textContent =