/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export function pressToStart(fn, title, description, callToAction = "Click, tap or press any key to start") {
    const button = document.createElement("button");
    button.id = "_start_button";
    const introText = document.createElement("div");
    introText.id = "_intro_text";
    button.append(introText);
    introText.innerHTML = title + "<br><br>" + description + "<br><br>" + callToAction;
    document.head.insertAdjacentHTML("beforeend", `
    <style>
        body {
            height: 95vh;  margin: 0; padding: 0;
        }
        #${button.id} {
            width: 100%;
            height: 100%;
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            z-index: 50;
            color:grey;
            background-color: black;
            border: none;
            cursor: pointer;
        }

        #${introText.id} {
            max-width: 640px;
            font-size: 1.5em;
            margin-left: auto;
            margin-right: auto;
            text-align:left;
            font-family: monospace;
        }
    </style>
    `);
    document.body.append(button);
    let booting = false;
    function handleStartAction() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (booting || button.style.display === "none") {
                return;
            }
            booting = true;
            introText.innerHTML =
                title +
                    "<br><br>" +
                    description +
                    "<br><br>Loading samples and UI…";
            try {
                yield Promise.resolve(fn());
                button.style.display = "none";
                (_a = document.getElementById("acidPageIntro")) === null || _a === void 0 ? void 0 : _a.remove();
            }
            catch (err) {
                booting = false;
                const msg = err instanceof Error ? err.message : String(err);
                introText.innerHTML =
                    title +
                        "<br><br>Could not start: " +
                        msg +
                        "<br><br>" +
                        callToAction;
                console.error(err);
            }
        });
    }
    button.addEventListener("click", () => {
        void handleStartAction();
    });
    window.addEventListener("keydown", () => {
        void handleStartAction();
    });
}
export function repeat(seconds, fn) {
    let time = new Date().getTime();
    let n = 0;
    function step() {
        const t = new Date().getTime() - time;
        fn(t, n);
        n++;
    }
    step();
    window.setInterval(step, seconds * 1000);
}
export function Clock(bpm, subdivision = 4, shuffle = 0) {
    let currentBpm = bpm;
    let fn = (time, step) => { };
    let time = new Date().getTime();
    let n = 0;
    let timeoutId = null;
    function bind(newFn) {
        fn = newFn;
    }
    function step() {
        const t = new Date().getTime() - time;
        fn(t, n);
        const shuffleFactor = n % 2 == 0 ? 1 + shuffle : 1 - shuffle;
        n++;
        timeoutId = window.setTimeout(step, shuffleFactor * (60000 / currentBpm) / subdivision);
    }
    timeoutId = window.setTimeout(step, (60000 / bpm) / subdivision);
    function dispose() {
        if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
        }
    }
    return {
        bind,
        setBpm: (bpm) => currentBpm = bpm,
        dispose
    };
}
//# sourceMappingURL=boilerplate.js.map