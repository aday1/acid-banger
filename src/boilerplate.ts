/*
  Copyright 2021 David Whiting
  This work is licensed under a Creative Commons Attribution 4.0 International License
  https://creativecommons.org/licenses/by/4.0/
*/

export function pressToStart(
    fn: () => void | Promise<void>,
    title: string,
    description: string,
    callToAction: string = "Click, tap or press any key to start"
) {
    const button = document.createElement("button");
    button.id = "_start_button";
    const introText = document.createElement("div");
    introText.id = "_intro_text";
    button.append(introText);
    introText.innerHTML = title + "<br><br>" + description + "<br><br>" + callToAction;

    document.head.insertAdjacentHTML(
        "beforeend",
        `
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
    `
    );
    document.body.append(button);

    let booting = false;

    async function handleStartAction() {
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
            await Promise.resolve(fn());
            button.style.display = "none";
            document.getElementById("acidPageIntro")?.remove();
        } catch (err) {
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
    }
    button.addEventListener("click", () => {
        void handleStartAction();
    });
    window.addEventListener("keydown", () => {
        void handleStartAction();
    });
}

export function repeat(seconds: number, fn: (time: number, step: number) => void) {
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

export function Clock(bpm: number, subdivision: number =4, shuffle: number = 0) {
    let currentBpm = bpm;
    let fn = (time: number, step: number) => {};
    let time = new Date().getTime();
    let n = 0;
    let timeoutId: number | null = null;
    function bind(newFn: (time: number, step: number) => void) {
        fn = newFn;
    }
    function step() {
        const t = new Date().getTime() - time;
        fn(t, n);
        const shuffleFactor = n % 2 == 0 ? 1 + shuffle : 1 - shuffle;
        n++;

        timeoutId = window.setTimeout(step, shuffleFactor * (60000 / currentBpm) / subdivision) as unknown as number;
    }

    timeoutId = window.setTimeout(step, (60000 / bpm) / subdivision) as unknown as number;
    function dispose() {
        if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
        }
    }
    return {
        bind,
        setBpm: (bpm: number) => currentBpm = bpm,
        dispose
    }
}