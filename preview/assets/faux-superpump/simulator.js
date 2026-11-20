(() => {
    "use strict";

    const sv = {
        locale: "sv-SE",
        labels: [
            ["credit", "Ett system från"], ["events-title", "Händelsehistorik"],
            ["unlock-label", "Lås upp"], ["start-label", "Start"], ["stop-label", "Stopp"], ["reset", "Kvittera larm"],
            ["history-title", "Historik"],
            ["settings-title", "Inställningar"], ["setpoint-label", "Tryck:"],
            ["cancel-configuration", "Avbryt"], ["save-configuration", "Spara"],
            ["diagnostics-title", "Diagnostik"], ["energy-label", "Förbrukad energi"],
            ["volume-label", "Vattenvolym pumpad"], ["updated-label", "Senast uppdaterad"],
            ["gps-label", "Enheten på karta"], ["gps", "55,852° N, 13,662° Ö"], ["more", "Fler funktioner"],
            ["toast-label", "1 meddelande"], ["unavailable-title", "Inte tillgängligt i demon"], ["close", "Stäng"]
        ],
        graph: seconds => `Tryck, flöde, pumphastigheter och total effekt de senaste ${seconds} sekunderna`,
        past: seconds => `−${seconds} s`, now: "Nu",
        pressure: "Tryck", flow: "Flöde", speed: "Pumphastighet", power: "Effekt",
        pump: number => `Pump ${number}`,
        speedSeries: number => `Hast. ${number}`,
        powerUnit: "in / ut kW",
        active: "Aktiv", starting: "Startar", stopped: "Stoppad", ready: "Redo",
        blocked: "Blockerad i Auto", regulating: "Tryckreglerar",
        block: name => `Blockera ${name}`, allow: name => `Tillåt ${name}`,
        lowPressure: "Lågt processtryck", highPressure: "Högt processtryck", lowFlow: "Lågt processflöde", noPumps: "Inga pumpar tillgängliga i Auto",
        setPressure: "Önskat tryck", pressureAlarm: "Trycklarm", flowAlarm: "Flödeslarm", configure: "Ändra",
        minPressure: "Mintryck", maxPressure: "Maxtryck", minFlow: "Minflöde",
        activation: "Aktiveringstid", pressureActivation: "Aktiveringstid (endast mintryck)", delay: "Felfördröjning", off: "Av",
        unavailable: ["Användarhantering", "Avancerade inställningar", "Tjänster"],
        gpsLinks: "Länkar till GPS-koordinater",
        report: "Skapa rapporter",
        startEvent: "Drift startad", stopEvent: "Drift stoppad", resetEvent: "Larm kvitterat",
        blockEvent: name => `${name} blockerad i Auto`, allowEvent: name => `${name} tillåten i Auto`,
        setpointEvent: value => `Önskat tryck ändrat till ${value} bar`, systemStarted: "Systemet startat",
        alarmSettingsEvent: name => `${name} · inställningar sparade`
    };
    const copy = sv;
    const demoAuthor = "Demo";
    const element = id => document.getElementById(id);
    const setText = (node, value) => {
        if (node.textContent !== value) node.textContent = value;
    };
    const decimal = new Intl.NumberFormat(copy.locale, {minimumFractionDigits: 1, maximumFractionDigits: 1});
    const historyTime = new Intl.DateTimeFormat(copy.locale, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});
    const updateTime = new Intl.DateTimeFormat(copy.locale, {hour: "2-digit", minute: "2-digit", second: "2-digit"});
    const loadedAt = Date.now();
    document.documentElement.lang = copy.locale;
    copy.labels.forEach(([id, label]) => setText(element(id), label));

    let setpoint = 6;
    const pressureLimits = {min: 5.5, max: 7.2, activation: 26, delay: 4};
    const flowLimits = {min: 160, activation: 26, delay: 2.5};
    const pumpHead = 9;
    const outletCapacity = 92;
    const stepSeconds = .05;
    const updateMs = 200;
    const historySeconds = 90;
    const historySamples = historySeconds * 1000 / updateMs + 1;
    const hydraulicResponse = 320;
    const stageInterval = 10;
    const recoveryHorizon = 5;
    const pressureBand = .2;
    const pumps = [
        {name: copy.pump(1), rating: 50, capacity: 325, blocked: false, speed: 0, power: 0},
        {name: copy.pump(2), rating: 20, capacity: 145, blocked: false, speed: 0, power: 0}
    ];
    let activePumps = [];
    let enabled = false;
    let runningFor = 0;
    let secondsSinceStage = 0;
    let pressureRise = 0;
    let alarm = "";
    let regulator = null;
    let pressure = 0;
    let flow = 0;
    let outletFactor = 1;
    let targetOutletFactor = 1;
    let outletChangeIn = 18;
    let shaftPower = 0;
    let supplyPower = 0;
    let energy = 1284.6;
    let volume = 4839.2;
    let guideMode = false;
    let guideAlarmArmed = false;

    const status = element("process-state");
    const statusPressure = element("process-pressure");
    const process = document.querySelector(".process");
    const start = /** @type {!HTMLButtonElement} */ (element("start"));
    const stop = /** @type {!HTMLButtonElement} */ (element("stop"));
    const reset = /** @type {!HTMLButtonElement} */ (element("reset"));
    const unlock = element("unlock");
    const updated = element("updated");
    const energyValue = element("energy");
    const volumeValue = element("volume");
    const alarmRules = [
        {message: copy.highPressure, delay: () => pressureLimits.delay, active: () => pressure > pressureLimits.max, elapsed: 0},
        {message: copy.lowPressure, delay: () => pressureLimits.delay,
            active: () => enabled && runningFor >= pressureLimits.activation && pressure < pressureLimits.min, elapsed: 0},
        {message: copy.lowFlow, delay: () => flowLimits.delay,
            active: () => enabled && runningFor >= flowLimits.activation && flowLimits.min > 0 && flow < flowLimits.min, elapsed: 0}
    ];

    function renderSculpt(button, color, light, dark) {
        // Fixed-size geometry and lighting from Superpump's angled sculpt renderer.
        const id = button.id;
        const rim = `${id}-rim`;
        const bevel = `${id}-bevel`;
        const face = `${id}-face`;
        button.querySelector(".sculpt").innerHTML = `<svg viewBox="-121 -128 242 226" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id="${rim}" x1="0" y1="1" x2=".9" y2=".05">
                    <stop stop-color="#262622"/><stop offset=".52" stop-color="#d9d9d5"/><stop offset="1" stop-color="#777869"/>
                </linearGradient>
                <linearGradient id="${bevel}" x1="0" y1="1" x2=".85" y2="0">
                    <stop stop-color="${dark}"/><stop offset=".28" stop-color="${color}"/><stop offset=".53" stop-color="#fff"/><stop offset="1" stop-color="${dark}"/>
                </linearGradient>
                <radialGradient id="${face}" cx=".3" cy=".23" r=".95">
                    <stop stop-color="${light}"/><stop offset=".24" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/>
                </radialGradient>
            </defs>
            <ellipse rx="112.5" ry="91" fill="#050608"/>
            <ellipse cy="-20" rx="112.5" ry="91" fill="#11150f"/>
            <ellipse cy="-20" rx="109.5" ry="88" fill="url(#${rim})"/>
            <ellipse cy="-20" rx="106.5" ry="85" fill="#5f6054"/>
            <ellipse cy="-30" rx="94.5" ry="76.5" fill="#151710"/>
            <ellipse cy="-30" rx="88.5" ry="70.5" fill="#0b0d0a"/>
            <g class="sculpt-head">
                <ellipse cy="-36" rx="88.5" ry="70.5" fill="#080a08"/>
                <ellipse cy="-50" rx="88.5" ry="70.5" fill="#0b100a"/>
                <ellipse cy="-50" rx="85.5" ry="67.5" fill="url(#${bevel})"/>
                <ellipse cy="-50" rx="79.5" ry="61.5" fill="url(#${face})"/>
            </g>
        </svg>`;
    }

    renderSculpt(unlock, "#e0e0e0", "#f8f8f8", "#555555");
    renderSculpt(start, "#afff00", "#edffc7", "#436100");
    renderSculpt(stop, "#ff5748", "#ffdad7", "#61211b");

    const commands = element("commands");
    const lockedControls = element("locked-controls");
    let unlockTimer;
    let unlockedUntil = 0;

    function lockCommands() {
        const restoreFocus = commands.contains(document.activeElement);
        clearTimeout(unlockTimer);
        unlockedUntil = 0;
        commands.setAttribute("inert", "");
        lockedControls.removeAttribute("inert");
        unlock.setAttribute("aria-expanded", "false");
        if (restoreFocus) unlock.focus({preventScroll: true});
    }

    function renewUnlock() {
        clearTimeout(unlockTimer);
        unlockedUntil = performance.now() + 4000;
        unlockTimer = setTimeout(lockCommands, 4000);
    }

    unlock.addEventListener("click", () => {
        renewUnlock();
        lockedControls.setAttribute("inert", "");
        commands.removeAttribute("inert");
        unlock.setAttribute("aria-expanded", "true");
        (alarm ? reset : enabled ? stop : start).focus({preventScroll: true});
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) lockCommands();
    });

    function bindCommand(button, action, nextFocus) {
        button.addEventListener("click", () => {
            if (document.hidden || performance.now() >= unlockedUntil || button.disabled) return;
            renewUnlock();
            action();
            renderCommands();
            nextFocus.focus({preventScroll: true});
        });
    }

    const pumpViews = pumps.map(pump => {
        const chip = document.createElement("span");
        chip.className = "pump";
        chip.innerHTML = `<span class="pump-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">
            <rect class="pump-stop" x="7.5" y="7.5" width="9" height="9" rx="1.4"/>
            <path class="pump-play" d="M9 6.5 18 12 9 17.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <circle class="pump-regulator" cx="12" cy="12" r="9.3" fill="none" stroke="currentColor" stroke-width="1.6"/>
            <path class="pump-slash" d="M4.5 19.5 19.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg></span>${pump.name}`;
        element("pumps").append(chip);
        const row = document.createElement("div");
        row.className = "pump-row";
        row.innerHTML = `<div><strong>${pump.name} · ${pump.rating} kW</strong><span></span></div><button class="pill" type="button"></button>`;
        element("pump-controls").append(row);
        const stateText = row.querySelector("span");
        const button = row.querySelector("button");
        button.addEventListener("click", () => {
            setPumpBlocked(pump, !pump.blocked, demoAuthor);
        });
        return {chip, stateText, button};
    });

    function setPumpBlocked(pump, blocked, author) {
        if (pump.blocked === blocked) return;
        pump.blocked = blocked;
        recordEvent(blocked ? copy.blockEvent(pump.name) : copy.allowEvent(pump.name), author);
        renderStatus();
    }

    const speedReference = () => regulator || (pumps[0].speed >= pumps[1].speed ? pumps[0] : pumps[1]);
    const dialSweep = fraction => Math.min(1, fraction) * 240;
    const arcStroke = '<path class="arc-fill" pathLength="240" d="M22.733 67.32 A32.64 32.64 0 1 1 79.267 67.32"/>';
    const liveArc = `<svg class="live-arc" viewBox="0 0 102 102">${arcStroke}</svg>`;
    // Each pump's power segment spans less than 180°, so one straight cut can color the second segment.
    const powerArc = `<svg class="live-arc" viewBox="0 0 102 102">
        <defs><clipPath id="power-color-split"><path class="arc-split" d="M51 -51H153V153H51Z"/></clipPath></defs>
        ${arcStroke}<g class="arc-second" clip-path="url(#power-color-split)">${arcStroke}</g>
        </svg>`;
    const gauges = [
        {kind: "pressure", title: copy.pressure, max: 10, unit: "bar", read: () => pressure},
        {kind: "flow", title: copy.flow, max: 300, unit: "m³/h", read: () => flow},
        {kind: "speed", title: copy.speed, max: 100, unit: "%", read: () => 100 * speedReference().speed},
        {kind: "power", title: copy.power, max: 80, unit: copy.powerUnit, read: () => shaftPower,
            format: value => `${decimal.format(supplyPower)} / ${decimal.format(value)}`}
    ].map(({kind, title, max, unit, read, format = value => decimal.format(value)}) => {
        const card = document.createElement("article");
        card.className = "gauge";
        card.innerHTML = `<h2>${title}</h2><div class="dial ${kind}" aria-hidden="true">
            ${kind === "speed" ? `<span class="speed-ring">${liveArc}</span><span class="speed-ring">${liveArc}</span>` : kind === "power" ? powerArc : liveArc}
            <span class="dial-min">0</span><span class="dial-max">${max}</span>
            ${kind === "pressure" ? '<span class="target"></span>' : ""}<span class="needle"></span>
            </div><strong class="gauge-value"></strong><span class="gauge-unit">${unit}</span>`;
        element("gauges").append(card);
        const dial = /** @type {!HTMLElement} */ (card.querySelector(".dial"));
        const value = card.querySelector(".gauge-value");
        const unitText = card.querySelector(".gauge-unit");
        const rings = card.querySelectorAll(".speed-ring");
        const needle = card.querySelector(".needle");
        return () => {
            const reading = read();
            if (kind !== "speed") dial.style.setProperty("--arc", String(dialSweep(reading / max)));
            setText(value, format(reading));
            if (kind === "pressure") dial.style.setProperty("--target-arc", `${dialSweep(setpoint / max)}deg`);
            if (kind === "power") {
                const hasSecond = pumps[1].power > 0;
                dial.style.setProperty("--split", `${dialSweep(pumps[0].power / max)}deg`);
                dial.classList.toggle("second-pump", hasSecond);
                dial.classList.toggle("only-second-pump", hasSecond && pumps[0].power === 0);
            }
            if (kind === "speed") {
                const outer = speedReference();
                rings.forEach((ring, index) => {
                    const pump = pumps[index];
                    const style = /** @type {!HTMLElement} */ (ring).style;
                    style.setProperty("--arc", String(dialSweep(pump.speed)));
                    const isOuter = pump === outer;
                    ring.classList.toggle("inner", !isOuter);
                    if (isOuter && needle.parentElement !== ring) ring.append(needle);
                });
                setText(unitText, reading > .1 ? `${outer.name} %` : unit);
            }
        };
    });

    const events = [
        {time: loadedAt - 3 * 60000, message: copy.stopEvent, author: "Bengt"},
        {time: loadedAt - 12 * 60000, message: copy.startEvent, author: "Johanna"},
        {time: loadedAt - 16 * 60000, message: copy.setpointEvent(decimal.format(setpoint)), author: "Bengt"},
        {time: loadedAt - 21 * 60000, message: copy.resetEvent, author: "Johanna"},
        {time: loadedAt - 26 * 60000, message: copy.lowFlow, author: ""},
        {time: loadedAt - 27 * 3600000, message: copy.systemStarted, author: ""}
    ];

    function eventRow({time, message, author}) {
        const row = document.createElement("li");
        row.className = "event";
        const date = new Date(time);
        const stamp = document.createElement("time");
        stamp.setAttribute("datetime", date.toISOString());
        stamp.textContent = historyTime.format(date);
        const text = document.createElement("span");
        text.textContent = author ? `[${author}] ${message}` : message;
        row.append(stamp, text);
        return row;
    }

    function renderEvents() {
        element("event-preview").replaceChildren(...events.slice(0, 2).map(eventRow));
        element("event-list").replaceChildren(...events.slice(2).map(eventRow));
    }

    function recordEvent(message, author = "") {
        events.unshift({time: Date.now(), message, author});
        if (events.length > 12) events.pop();
        renderEvents();
    }

    function bindFold(toggle, fold) {
        toggle.addEventListener("click", () => {
            const opening = fold.hasAttribute("inert");
            fold.toggleAttribute("inert", !opening);
            toggle.setAttribute("aria-expanded", String(opening));
        });
    }

    bindFold(element("pumps-toggle"), element("pumps-fold"));
    bindFold(element("events-toggle"), element("events-fold"));
    bindFold(element("settings-toggle"), element("settings-fold"));

    const dialog = /** @type {!HTMLDialogElement} */ (element("unavailable"));

    function showUnavailable(messages) {
        element("unavailable-list").replaceChildren(...messages.map(message => {
            const item = document.createElement("li");
            item.textContent = message;
            return item;
        }));
        dialog.showModal();
    }

    element("gps").addEventListener("click", () => showUnavailable([copy.gpsLinks]));
    element("more").addEventListener("click", () => showUnavailable(copy.unavailable));
    element("report").addEventListener("click", () => showUnavailable([copy.report]));
    setText(element("report"), copy.report);

    const configuration = /** @type {!HTMLDialogElement} */ (element("configuration"));
    const configurationFields = element("configuration-fields");
    const tenth = value => Math.round(value * 10) / 10;
    const shortNumber = new Intl.NumberFormat(copy.locale, {maximumFractionDigits: 1});
    const settingValue = (value, unit) => `${(unit === "bar" ? decimal : shortNumber).format(value)} ${unit}`;
    let saveConfiguration;

    const pressureAlarmFields = () => [
        [copy.minPressure, pressureLimits.min, 0, tenth(setpoint - .1), .1, "bar"],
        [copy.maxPressure, pressureLimits.max, tenth(setpoint + .1), 10, .1, "bar"],
        [copy.pressureActivation, pressureLimits.activation, 0, 60, 1, "s"],
        [copy.delay, pressureLimits.delay, 0, 30, .5, "s"]
    ];
    const flowAlarmFields = () => [
        [copy.minFlow, flowLimits.min, 0, 300, 1, "m³/h"],
        [copy.activation, flowLimits.activation, 0, 60, 1, "s"],
        [copy.delay, flowLimits.delay, 0, 30, .5, "s"]
    ];

    function renderAlarmReadings(id, fields) {
        element(id).replaceChildren(...fields.map(([label, value, , , , unit]) => {
            const row = document.createElement("div");
            const name = document.createElement("dt");
            const reading = document.createElement("dd");
            name.textContent = label;
            reading.textContent = unit === "m³/h" && value === 0 ? copy.off : settingValue(value, unit);
            row.append(name, reading);
            return row;
        }));
    }

    function renderSettings() {
        setText(element("setpoint"), settingValue(setpoint, "bar"));
        renderAlarmReadings("pressure-alarm-readings", pressureAlarmFields());
        renderAlarmReadings("flow-alarm-readings", flowAlarmFields());
    }

    function openConfiguration(title, fields, save) {
        setText(element("configuration-title"), title);
        const inputs = fields.map(([name, value, min, max, step, unit], index) => {
            const field = document.createElement("div");
            field.className = "setting-field";
            const id = `configuration-value-${index}`;
            field.innerHTML = `<label for="${id}">${name}</label><output for="${id}"></output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;
            const input = /** @type {!HTMLInputElement} */ (field.querySelector("input"));
            const output = field.querySelector("output");
            const preview = () => {
                const text = settingValue(input.valueAsNumber, unit);
                setText(output, text);
                input.setAttribute("aria-valuetext", text);
            };
            input.addEventListener("input", preview);
            preview();
            return {field, input};
        });
        configurationFields.replaceChildren(...inputs.map(control => control.field));
        saveConfiguration = () => {
            const values = inputs.map(control => control.input.valueAsNumber);
            if (values.every((value, index) => value === fields[index][1])) return;
            save(values);
            resetAlarmTimers();
            renderSettings();
            renderTelemetry();
        };
        configuration.showModal();
    }

    element("set-pressure").addEventListener("click", () => {
        const min = Math.max(3.5, tenth(pressureLimits.min + .1));
        const max = Math.min(6.4, tenth(pressureLimits.max - .1));
        openConfiguration(copy.setPressure, [[copy.setPressure, setpoint, min, max, .1, "bar"]], ([value]) => {
            setpoint = value;
            recordEvent(copy.setpointEvent(decimal.format(setpoint)), demoAuthor);
        });
    });
    element("set-pressure-alarm").addEventListener("click", () => {
        openConfiguration(copy.pressureAlarm, pressureAlarmFields(), ([min, max, activation, delay]) => {
            Object.assign(pressureLimits, {min, max, activation, delay});
            recordEvent(copy.alarmSettingsEvent(copy.pressureAlarm), demoAuthor);
        });
    });
    element("set-flow-alarm").addEventListener("click", () => {
        openConfiguration(copy.flowAlarm, flowAlarmFields(), ([min, activation, delay]) => {
            Object.assign(flowLimits, {min, activation, delay});
            recordEvent(copy.alarmSettingsEvent(copy.flowAlarm), demoAuthor);
        });
    });
    setText(element("pressure-alarm-label"), copy.pressureAlarm);
    setText(element("flow-alarm-label"), copy.flowAlarm);
    ["configure-pressure", "configure-pressure-alarm", "configure-flow-alarm"].forEach(id => setText(element(id), copy.configure));
    element("configuration-form").addEventListener("submit", event => {
        event.preventDefault();
        saveConfiguration();
        configuration.close();
    });
    element("cancel-configuration").addEventListener("click", () => configuration.close());

    const toast = element("toast");
    toast.addEventListener("animationend", event => {
        if (event.target === toast) toast.classList.remove("shown");
    });

    function resetAlarmTimers() {
        alarmRules.forEach(rule => { rule.elapsed = 0; });
    }

    function stopRun() {
        enabled = false;
        runningFor = 0;
        secondsSinceStage = 0;
        resetAlarmTimers();
        activePumps = [];
        regulator = null;
    }

    function trip(message) {
        stopRun();
        alarm = message;
        recordEvent(message);
        setText(element("toast-message"), message);
        toast.classList.add("shown");
        renderCommands();
    }

    bindCommand(start, () => {
        enabled = true;
        recordEvent(copy.startEvent, demoAuthor);
    }, stop);
    bindCommand(stop, () => {
        stopRun();
        recordEvent(copy.stopEvent, demoAuthor);
    }, start);
    bindCommand(reset, () => {
        alarm = "";
        toast.classList.remove("shown");
        recordEvent(copy.resetEvent, demoAuthor);
    }, start);

    function updateCascade() {
        if (activePumps.some(pump => pump.blocked)) {
            activePumps = activePumps.filter(pump => !pump.blocked);
            secondsSinceStage = 0;
        }

        const regulatorAtLimit = regulator?.speed >= .999;
        const belowBand = pressure < setpoint - pressureBand;
        const projectedPressure = pressure + pressureRise * recoveryHorizon;
        const canStage = secondsSinceStage >= stageInterval;
        const needsCapacity = canStage && regulatorAtLimit && belowBand && projectedPressure < setpoint;
        if (!activePumps.length || needsCapacity) {
            const next = pumps.find(pump => !pump.blocked && !activePumps.includes(pump));
            if (next) {
                activePumps.push(next);
                secondsSinceStage = 0;
            } else if (!activePumps.length) {
                trip(copy.noPumps);
            }
        }
        if (activePumps.length === 2 && canStage && !needsCapacity && regulator &&
            pressure > setpoint + pressureBand && projectedPressure > setpoint + pressureBand &&
            pumpDelivery(regulator, regulator.speed, pressure) < 1) {
            const demand = outletCapacity * Math.sqrt(setpoint);
            const single = activePumps.find(pump => pumpDelivery(pump, 1, setpoint) >= demand);
            if (single) {
                activePumps = [single];
                secondsSinceStage = 0;
            }
        }
        regulator = activePumps.length ? activePumps[activePumps.length - 1] : null;
    }

    function updateOutlet() {
        outletChangeIn -= stepSeconds;
        if (outletChangeIn <= 0) {
            const span = .085;
            const change = span * Math.random();
            const target = .965 + change;
            targetOutletFactor = Math.abs(target - targetOutletFactor) < .012 ? .965 + (change + span / 2) % span : target;
            outletChangeIn = 9 + 11 * Math.random();
        }
        outletFactor += (targetOutletFactor - outletFactor) * stepSeconds / 7;
    }

    function pumpDelivery(pump, speed, head) {
        // Parallel pumps share one pressure. Each check valve prevents reverse flow.
        return pump.capacity * Math.sqrt(Math.max(0, speed ** 2 - head / pumpHead));
    }

    function step() {
        if (enabled) updateCascade();
        const capacity = activePumps.length === 2 ? activePumps[0] : null;
        let regulatedSpeed = 0;
        if (regulator) {
            // Capacity pumps run at maximum. The newest pump trims the remaining demand.
            const capacityFlow = capacity ? pumpDelivery(capacity, 1, setpoint) : 0;
            const remainingFlow = Math.max(0, outletCapacity * Math.sqrt(setpoint) - capacityFlow);
            const reference = Math.sqrt(setpoint / pumpHead + (remainingFlow / regulator.capacity) ** 2);
            regulatedSpeed = Math.min(1, Math.max(.6, reference + .14 * (setpoint - pressure)));
        }

        let delivery = 0;
        shaftPower = 0;
        for (const pump of pumps) {
            const target = pump === capacity ? 1 : pump === regulator ? regulatedSpeed : 0;
            // The drive ramps independently of the hydraulic response.
            pump.speed += Math.max(-stepSeconds / 4, Math.min(stepSeconds / 5, target - pump.speed));
            const pumped = pumpDelivery(pump, pump.speed, pressure);
            const load = pump.speed > 0 ? Math.min(1, pumped / (.65 * pump.capacity * pump.speed)) : 0;
            delivery += pumped;
            pump.power = pump.rating * pump.speed ** 3 * (.45 + .55 * load);
            shaftPower += pump.power;
        }
        pressureRise = (delivery - flow) / hydraulicResponse;
        pressure = Math.max(0, pressure + pressureRise * stepSeconds);
        updateOutlet();
        flow = outletCapacity * outletFactor * Math.sqrt(pressure);
        supplyPower = shaftPower / .91;
        energy += supplyPower * stepSeconds / 3600;
        volume += flow * stepSeconds / 3600;

        if (enabled) {
            runningFor += stepSeconds;
            secondsSinceStage += stepSeconds;
        }
        if (alarm || (guideMode && !guideAlarmArmed)) return;
        for (const rule of alarmRules) {
            rule.elapsed = rule.active() ? rule.elapsed + stepSeconds : 0;
            if (rule.elapsed > 0 && rule.elapsed >= rule.delay()) {
                trip(rule.message);
                break;
            }
        }
    }

    function renderCommands() {
        start.disabled = enabled || Boolean(alarm);
        stop.disabled = !enabled;
        reset.hidden = !alarm;
    }

    function renderStatus() {
        const running = pumps.some(pump => pump.speed > .02);
        const mode = enabled ? (running ? copy.active : copy.starting) : copy.stopped;
        setText(status, alarm || mode);
        setText(statusPressure, enabled && running && !alarm ? `: ${settingValue(pressure, "bar")}` : "");
        process.classList.toggle("alarmed", Boolean(alarm));
        pumps.forEach((pump, index) => {
            const {chip, stateText, button} = pumpViews[index];
            const running = !pump.blocked && pump.speed > .02;
            const regulating = running && pump === regulator;
            const mode = pump.blocked ? copy.blocked : regulating ? copy.regulating : running ? copy.active : copy.ready;
            chip.classList.toggle("running", running);
            chip.classList.toggle("regulating", regulating);
            chip.classList.toggle("blocked", pump.blocked);
            chip.title = `${pump.name} · ${mode}`;
            setText(stateText, `${mode} · ${Math.round(pump.speed * 100)} %`);
            setText(button, pump.blocked ? copy.allow(pump.name) : copy.block(pump.name));
        });
    }

    function renderTelemetry() {
        gauges.forEach(renderGauge => renderGauge());
        setText(energyValue, `${decimal.format(energy)} kWh`);
        setText(volumeValue, `${decimal.format(volume)} m³`);
        const now = new Date();
        updated.setAttribute("datetime", now.toISOString());
        setText(updated, updateTime.format(now));
        if (guideMode) document.dispatchEvent(new CustomEvent("ionod:state", {detail: getDemoState()}));
    }

    const graph = /** @type {!HTMLCanvasElement} */ (element("graph"));
    const context = /** @type {!CanvasRenderingContext2D} */ (graph.getContext("2d"));
    const graphBox = element("graph-box");
    const readoutTime = element("graph-readout");
    const series = [
        {label: copy.pressure, color: "#d7f06b", unit: "bar", max: 10, read: () => pressure},
        {label: copy.flow, color: "#85c6f3", unit: "m³/h", max: 300, read: () => flow},
        {label: copy.speedSeries(1), color: "#f6c989", unit: "%", max: 100, read: () => pumps[0].speed * 100},
        {label: copy.speedSeries(2), color: "#a38aff", unit: "%", max: 100, read: () => pumps[1].speed * 100},
        {label: copy.power, color: "#f19bae", unit: "kW", max: 80, read: () => shaftPower}
    ];
    graph.setAttribute("aria-label", copy.graph(historySeconds));
    setText(element("graph-start"), copy.past(historySeconds));
    setText(element("graph-end"), copy.now);
    const readoutValues = series.map(line => {
        const label = document.createElement("li");
        label.style.setProperty("--series", line.color);
        const name = document.createElement("span");
        name.className = "graph-series";
        name.textContent = line.label;
        const value = document.createElement("strong");
        value.className = "graph-reading";
        label.append(name, value);
        element("graph-legend").append(label);
        return value;
    });

    const samples = Array(historySamples).fill(series.map(line => line.read()));
    const graphPadding = 8;
    const graphX = index => graphPadding + index * (graph.width - 2 * graphPadding) / (historySamples - 1);
    let cursorSample = null;
    let heldPointer = null;

    function sample() {
        samples.push(series.map(line => line.read()));
        samples.shift();
    }

    function drawGraph() {
        const {width, height} = graph;
        context.clearRect(0, 0, width, height);
        context.lineWidth = 1;
        context.strokeStyle = "#33404a";
        context.beginPath();
        for (let n = 0; n <= 4; n += 1) {
            const y = graphPadding + n * (height - 2 * graphPadding) / 4;
            context.moveTo(graphPadding, y);
            context.lineTo(width - graphPadding, y);
        }
        context.stroke();
        context.lineWidth = 3;
        series.forEach((line, index) => {
            context.strokeStyle = line.color;
            context.beginPath();
            samples.forEach((point, indexInWindow) => {
                const x = graphX(indexInWindow);
                const y = height - graphPadding - Math.min(1, point[index] / line.max) * (height - 2 * graphPadding);
                if (indexInWindow === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
            });
            context.stroke();
        });
        const selected = cursorSample;
        if (selected === null) return;
        const x = graphX(selected);
        context.lineWidth = 2;
        context.strokeStyle = "#eff8ffb3";
        context.setLineDash([5, 4]);
        context.beginPath();
        context.moveTo(x, graphPadding);
        context.lineTo(x, height - graphPadding);
        context.stroke();
        context.setLineDash([]);
        const secondsAgo = (historySamples - 1 - selected) * updateMs / 1000;
        setText(readoutTime, secondsAgo ? copy.past(shortNumber.format(secondsAgo)) : copy.now);
        const point = samples[selected];
        readoutValues.forEach((value, index) => setText(value, `${shortNumber.format(point[index])} ${series[index].unit}`));
    }

    function inspectGraph(clientX) {
        const rect = graph.getBoundingClientRect();
        const x = (clientX - rect.left) * graph.width / rect.width;
        const ratio = (x - graphPadding) / (graph.width - 2 * graphPadding);
        const index = Math.min(historySamples - 1, Math.max(0, Math.round(ratio * (historySamples - 1))));
        if (index === cursorSample) return;
        cursorSample = index;
        readoutTime.hidden = false;
        graphBox.classList.add("inspecting");
        drawGraph();
    }

    function clearGraphCursor() {
        if (cursorSample === null) return;
        cursorSample = null;
        readoutTime.hidden = true;
        graphBox.classList.remove("inspecting");
        drawGraph();
    }

    graph.addEventListener("pointermove", event => {
        if (event.pointerType === "mouse" || event.pointerId === heldPointer) inspectGraph(event.clientX);
    });
    graph.addEventListener("pointerdown", event => {
        if (event.button !== 0 || heldPointer !== null) return;
        heldPointer = event.pointerId;
        graph.setPointerCapture(heldPointer);
        inspectGraph(event.clientX);
    });
    graph.addEventListener("pointerleave", () => {
        if (heldPointer === null) clearGraphCursor();
    });
    graph.addEventListener("pointerup", event => {
        if (event.pointerId !== heldPointer) return;
        heldPointer = null;
        const rect = graph.getBoundingClientRect();
        if (event.pointerType !== "mouse" || event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) clearGraphCursor();
    });
    graph.addEventListener("lostpointercapture", event => {
        if (event.pointerId !== heldPointer) return;
        heldPointer = null;
        clearGraphCursor();
    });

    function getDemoState() {
        const reading = decimal.format(pressure);
        return {
            "enabled": enabled,
            "reachedSetpoint": enabled && (pressure >= setpoint || reading === decimal.format(setpoint)),
            "nearSetpoint": enabled && reading === decimal.format(setpoint - .1),
            "setpoint": setpoint,
            "alarm": alarm,
            "firstPumpBlocked": pumps[0].blocked
        };
    }

    // Guiden börjar i en ny simulator och väntar med larmen till larmsteget.
    function beginGuide() {
        guideMode = true;
        setpoint = 5.6;
        renderSettings();
        renderTelemetry();
    }

    function armGuideAlarm() {
        if (!guideMode) return;
        guideAlarmArmed = true;
        resetAlarmTimers();
    }

    function endGuide(completed) {
        guideMode = guideAlarmArmed = false;
        if (completed) setPumpBlocked(pumps[0], false, "Ninis");
        lockCommands();
    }

    if (window.frameElement?.id === "superpump-demo") {
        window["ionodDemo"] = Object.freeze({
            "getState": getDemoState,
            "beginGuide": beginGuide,
            "armGuideAlarm": armGuideAlarm,
            "endGuide": endGuide
        });
    }

    renderEvents();
    renderSettings();
    renderCommands();
    renderStatus();
    drawGraph();
    renderTelemetry();
    setInterval(renderStatus, 500);

    let previous = performance.now();
    let pending = 0;
    const stepsPerSample = updateMs / (stepSeconds * 1000);
    let stepsSinceSample = 0;
    setInterval(() => {
        const now = performance.now();
        pending += Math.min(1, (now - previous) / 1000);
        previous = now;
        while (pending >= stepSeconds) {
            step();
            pending -= stepSeconds;
            stepsSinceSample += 1;
            if (stepsSinceSample === stepsPerSample) {
                sample();
                stepsSinceSample = 0;
            }
        }
        drawGraph();
        renderTelemetry();
    }, updateMs);
})();
