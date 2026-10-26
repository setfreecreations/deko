const eyes = document.querySelectorAll(".eye");
const pupils = document.querySelectorAll(".pupil");
const stateButtons = document.querySelectorAll("button[data-state]");

const micButton = document.getElementById("micButton");
const speechButton = document.getElementById("speechButton");
const speechText = document.getElementById("speechText");

let userIsInteracting = false;
let interactionTimer = null;

let microphoneStream = null;
let audioContext = null;

let dekoAwake = false;
let recognitionShouldRun = false;
let confirmationActive = false;
let pendingCommand = "";


/* ÖGONENS TILLSTÅND */

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


/* SEPARAT TEST AV MIKROFONENS LJUDNIVÅ */

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


/* TALIGENKÄNNING OCH HEJ DEKO */

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

    function findWakePhrase(text) {
        return text.match(/hej\s+(deko|deco|dekko)/i);
    }

    function textAfterWakePhrase(text) {
        const match = findWakePhrase(text);

        if (!match) {
            return "";
        }

        return text
            .slice(match.index + match[0].length)
            .replace(/^[,.\s!?]+/, "")
            .trim();
    }

    function getFullTranscript(event) {
        let text = "";

        for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript + " ";
        }

        return text.replace(/\s+/g, " ").trim();
    }

    function wakeDeko(remainder) {
        dekoAwake = true;
        confirmationActive = true;
        pendingCommand = remainder;

        setState("listening");
        speechText.textContent = "Ja Erik, jag lyssnar...";

        setTimeout(() => {
            confirmationActive = false;

            if (pendingCommand) {
                speechText.textContent = pendingCommand;
            } else {
                speechText.textContent = "Jag lyssnar...";
            }
        }, 2000);
    }

    speechButton.addEventListener("click", () => {
        if (microphoneStream) {
            microphoneStream
                .getTracks()
                .forEach(track => track.stop());

            microphoneStream = null;
        }

        dekoAwake = false;
        confirmationActive = false;
        pendingCommand = "";
        recognitionShouldRun = true;

        speechText.textContent =
            "Väntar på: Hej Deko";

        setState("neutral");

        try {
            recognition.start();
        } catch (error) {
            console.log(error);
        }
    });

    recognition.onresult = event => {
        const fullTranscript =
            getFullTranscript(event);

        if (!dekoAwake) {
            const normalizedTranscript =
                normalizeText(fullTranscript);

            const wakePhrase =
                findWakePhrase(normalizedTranscript);

            if (!wakePhrase) {
                speechText.textContent =
                    "Väntar på: Hej Deko";

                return;
            }

            const remainder =
                textAfterWakePhrase(fullTranscript);

            wakeDeko(remainder);
            return;
        }

        const command =
            textAfterWakePhrase(fullTranscript);

        if (command) {
            pendingCommand = command;
        }

        if (confirmationActive) {
            return;
        }

        if (pendingCommand) {
            speechText.textContent = pendingCommand;
        } else {
            speechText.textContent = "Jag lyssnar...";
        }
    };

    recognition.onend = () => {
        if (!recognitionShouldRun) {
            return;
        }

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

        if (
            event.error === "no-speech" ||
            event.error === "aborted"
        ) {
            return;
        }

        speechText.textContent =
            "Fel: " + event.error;

        setState("error");
    };
}


/* STARTA DEKO */

setState("neutral");
scheduleBlink();
scheduleLook();