const eyes = document.querySelectorAll(".eye");
const pupils = document.querySelectorAll(".pupil");
const stateButtons = document.querySelectorAll("button[data-state]");
const micButton = document.getElementById("micButton");
const speechButton = document.getElementById("speechButton");
const speechText = document.getElementById("speechText");

let userIsInteracting = false;
let interactionTimer = null;
let microphoneStream = null;
let dekoAwake = false;
let recognitionRunning = false;
let lastTranscript = "";

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
    } else if (state === "thinking") {
        pupils.forEach(pupil => {
            pupil.style.left = "58px";
            pupil.style.top = "18px";
        });
    } else if (state === "searching") {
        pupils.forEach(pupil => pupil.style.left = "18px");
    } else if (state === "happy") {
        eyes.forEach(eye => {
            eye.style.height = "65px";
            eye.style.borderRadius = "0 0 100px 100px";
        });
    } else if (state === "surprised") {
        eyes.forEach(eye => {
            eye.style.width = "140px";
            eye.style.height = "140px";
        });
    } else if (state === "uncertain") {
        if (eyes[0]) eyes[0].style.height = "75px";
    } else if (state === "sleep") {
        eyes.forEach(eye => {
            eye.style.height = "8px";
            eye.style.borderRadius = "10px";
        });
    } else if (state === "error") {
        eyes.forEach(eye => eye.style.background = "#ff3b30");
    }
}

stateButtons.forEach(button => {
    button.addEventListener("click", () => setState(button.dataset.state));
});

function blink() {
    eyes.forEach(eye => eye.style.transform = "scaleY(0.08)");
    setTimeout(() => {
        eyes.forEach(eye => eye.style.transform = "scaleY(1)");
    }, 140);
}

function scheduleBlink() {
    setTimeout(() => {
        blink();
        scheduleBlink();
    }, 3000 + Math.random() * 5000);
}

function naturalLook() {
    if (userIsInteracting || dekoAwake) return;

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
    setTimeout(() => {
        naturalLook();
        scheduleLook();
    }, 2000 + Math.random() * 4000);
}

function followPoint(x, y) {
    userIsInteracting = true;

    pupils.forEach((pupil, index) => {
        const eye = eyes[index];
        if (!eye) return;

        const rect = eye.getBoundingClientRect();
        const dx = x - (rect.left + rect.width / 2);
        const dy = y - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy) || 1;
        const amount = Math.min(distance / 8, 25);

        pupil.style.left = (39 + dx / distance * amount) + "px";
        pupil.style.top = (39 + dy / distance * amount) + "px";
    });

    clearTimeout(interactionTimer);
    interactionTimer = setTimeout(() => userIsInteracting = false, 1500);
}

document.addEventListener("mousemove", event => followPoint(event.clientX, event.clientY));
document.addEventListener("touchmove", event => {
    const touch = event.touches[0];
    if (touch) followPoint(touch.clientX, touch.clientY);
}, { passive: true });

async function startMicrophoneLevel() {
    if (microphoneStream) return;

    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(microphoneStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    function detectVoice() {
        analyser.getByteFrequencyData(data);
        const level = data.reduce((sum, value) => sum + value, 0) / data.length;
        pupils.forEach(pupil => {
            pupil.style.transform = level > 15 ? "scale(1.18)" : "scale(1)";
        });
        requestAnimationFrame(detectVoice);
    }

    detectVoice();
}

if (micButton) {
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
}

const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognitionClass) {
    if (speechButton) speechButton.disabled = true;
    if (speechText) speechText.textContent = "Taligenkänning stöds inte i webbläsaren.";
} else {
    const recognition = new SpeechRecognitionClass();
    recognition.lang = "sv-SE";
    recognition.continuous = true;
    recognition.interimResults = true;

    function normalize(text) {
        return text.toLowerCase().replace(/[.,!?]/g, "").replace(/\s+/g, " ").trim();
    }

    function hasWakePhrase(text) {
        return /hej\s+(deko|deco|dekko)/i.test(text);
    }

    function removeWakePhrase(text) {
        return text.replace(/.*?hej\s+(deko|deco|dekko)[,\.\s!?]*/i, "").trim();
    }

    if (speechButton) {
        speechButton.addEventListener("click", () => {
            if (microphoneStream) {
                microphoneStream.getTracks().forEach(track => track.stop());
                microphoneStream = null;
            }

            dekoAwake = false;
            lastTranscript = "";
            recognitionRunning = true;
            setState("neutral");
            speechText.textContent = "Väntar på: Hej Deko";

            try {
                recognition.start();
            } catch (error) {
                console.log(error);
            }
        });
    }

    recognition.onresult = event => {
        let fullText = "";
        for (let i = 0; i < event.results.length; i++) {
            fullText += event.results[i][0].transcript + " ";
        }
        fullText = fullText.replace(/\s+/g, " ").trim();
        if (!fullText || fullText === lastTranscript) return;
        lastTranscript = fullText;

        if (!dekoAwake) {
            if (!hasWakePhrase(normalize(fullText))) {
                speechText.textContent = "Väntar på: Hej Deko";
                return;
            }

            dekoAwake = true;
            setState("listening");
            const command = removeWakePhrase(fullText);
            speechText.textContent = command
                ? "Ja Erik, jag lyssnar. " + command
                : "Ja Erik, jag lyssnar...";
            return;
        }

        const command = removeWakePhrase(fullText);
        if (command) {
            speechText.textContent = "Ja Erik, jag lyssnar. " + command;
        }
    };

    recognition.onend = () => {
        if (!recognitionRunning) return;
        setTimeout(() => {
            try {
                recognition.start();
            } catch (error) {
                console.log(error);
            }
        }, 300);
    };

    recognition.onerror = event => {
        console.error(event.error);
        if (event.error === "no-speech" || event.error === "aborted") return;
        speechText.textContent = "Fel: " + event.error;
        setState("error");
    };
}

setState("neutral");
scheduleBlink();
scheduleLook();
