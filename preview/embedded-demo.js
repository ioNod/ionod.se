"use strict";

// Ninis leder användaren genom appens riktiga reglage och simulerade mätvärden.
(() => {
  const frame = document.getElementById("superpump-demo");
  if (!frame) return;

  const phone = frame.closest(".phone");
  const clock = phone.querySelector(".phone-clock");
  const clockFormat = new Intl.DateTimeFormat("sv-SE", {hour: "2-digit", minute: "2-digit"});
  const updateClock = () => {
    const now = new Date();
    clock.textContent = clockFormat.format(now);
    setTimeout(updateClock, 60000 - now.getTime() % 60000);
  };
  updateClock();

  const section = frame.closest(".app-demo-section");
  const art = frame.closest(".embedded-demo-art");
  const phoneViewport = phone.parentElement;
  const header = document.querySelector(".page-header, .home-header");
  const tour = document.getElementById("demo-tour");
  const starter = document.querySelector("[data-tour-start]");
  const reset = document.querySelector("[data-demo-reset]");
  const mascotStarter = document.querySelector(".demo-guide-invitation .rabbit-guide-button");
  if (mascotStarter) {
    mascotStarter.disabled = true;
    mascotStarter.setAttribute("aria-label", "Starta Ninis guide till appen");
  }
  const loadStatus = document.getElementById("demo-load-status");
  const title = document.getElementById("tour-title");
  const description = document.getElementById("tour-description");
  const counter = document.getElementById("tour-counter");
  const result = document.getElementById("tour-result");
  const next = tour.querySelector("[data-tour-next]");
  const skip = tour.querySelector("[data-tour-exit]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pressureGauge = ".gauge:has(.pressure)";
  const pumpToggle = "#pumps-toggle";
  const firstPump = "#pump-controls .pump-row:first-child";
  const settingsToggle = "#settings-toggle";
  const steps = [
    { key: "start", title: "Starta pumpen", description: "Lås upp och tryck Start inom fyra sekunder. Sedan väntar vi på trycket.", selector: ".control-panel", allowed: "#unlock, #start", manual: true },
    { key: "raise", title: "Höj trycket", description: "Ändra trycket till 6,4 bar och spara. Sedan följer vi trycket i historiken.", selector: ".pressure-setting", allowed: "#set-pressure, #configuration-value-0, #save-configuration, #cancel-configuration", pressure: 6.4 },
    { key: "rising", title: "Följ trycket i historiken", description: "Historiken visar hur systemet beter sig över tid. Följ trycket i grafen tills det når 6,4 bar.", selector: ".history", allowed: "#graph", manual: true },
    { key: "block", title: "Blockera en pump", description: "Blockera Pump 1. Den mindre pumpen får försöka hålla trycket själv.", selector: pumpToggle, allowed: pumpToggle },
    { key: "alarm", title: "Invänta larmet", description: "Trycket sjunker när en pump inte räcker till. Vi väntar på larmet.", selector: pressureGauge, manual: true },
    { key: "acknowledge", title: "Kvittera larmet", description: "Larmet har stoppat driften. Lås upp och tryck Kvittera larm.", selector: ".control-panel", allowed: "#unlock, #reset" },
    { key: "done", title: "Nu är det din tur!", description: "Testa till exempel larminställningarna under Inställningar. Jag har avblockerat Pump 1 åt dig.", selector: settingsToggle }
  ];
  let appDocument;
  let app;
  let guideAfterLoad = false;
  let activeStep = -1;
  let currentTarget;
  let originalDescription;
  let originalTabIndex;
  let guideDescription;
  let revealTimer;
  let bindings;
  let dialogObserver;
  let fitRequest;
  let stableSince;
  let stepStartedAt;
  let stepReady = false;
  let advanceTimer;
  let revealRequest;
  let revealVersion = 0;
  const scrollAnimations = new Map();
  const savedInert = new Map();
  const isGuided = () => activeStep >= 0 && activeStep < steps.length - 1;
  const isExpanded = selector => appDocument.querySelector(selector).getAttribute("aria-expanded") === "true";

  // Behåll telefonens proportioner och appens layout när hela ramen skalas.
  const fitPhone = () => {
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const headerHeight = header?.getBoundingClientRect().height || 0;
    const sectionBounds = section.getBoundingClientRect();
    const artBounds = art.getBoundingClientRect();
    const styles = getComputedStyle(section);
    const stacked = window.matchMedia("(max-width:900px)").matches;
    const above = stacked ? artBounds.top - sectionBounds.top : parseFloat(styles.paddingTop);
    const guideBounds = tour.hidden ? null : tour.getBoundingClientRect();
    const guideBelow = guideBounds && guideBounds.left < artBounds.right && guideBounds.right > artBounds.left;
    const availableHeight = guideBelow
      ? viewportHeight - headerHeight - guideBounds.height - 24
      : viewportHeight - headerHeight - above - art.querySelector(".demo-expand-link").offsetHeight - 24;
    const width = Math.max(1, Math.min(320, art.clientWidth, availableHeight * 320 / 666));
    const roundedWidth = Math.floor(width * 100) / 100;
    if (phoneViewport.style.getPropertyValue("--demo-phone-width") !== `${roundedWidth}px`) {
      phoneViewport.style.setProperty("--demo-phone-width", `${roundedWidth}px`);
      phone.style.setProperty("--demo-phone-scale", String(roundedWidth / 320));
    }
  };
  const scheduleFit = () => {
    cancelAnimationFrame(fitRequest);
    fitRequest = requestAnimationFrame(() => {
      fitPhone();
      if (activeStep >= 0) revealTarget();
    });
  };

  const stopScroll = (view) => {
    const animation = scrollAnimations.get(view);
    if (!animation) return;
    cancelAnimationFrame(animation.request);
    scrollAnimations.delete(view);
    animation.resolve(false);
  };

  const stopScrolling = () => {
    clearTimeout(revealTimer);
    for (const view of scrollAnimations.keys()) stopScroll(view);
  };

  // Samma lugna rörelse inne i telefonen och på sidan, utan upprepade omstarter.
  const scrollGently = (view, requestedTop) => {
    const max = Math.max(0, view.document.scrollingElement.scrollHeight - view.innerHeight);
    const top = Math.min(max, Math.max(0, requestedTop));
    const existing = scrollAnimations.get(view);
    if (existing && Math.abs(existing.top - top) < 3) return existing.promise;
    stopScroll(view);
    const from = view.scrollY;
    const distance = top - from;
    if (Math.abs(distance) < 2 || reducedMotion.matches) {
      view.scrollTo({ top, behavior: "instant" });
      return Promise.resolve(true);
    }
    const duration = Math.min(1900, 1100 + Math.abs(distance) * .5);
    const animation = { top };
    animation.promise = new Promise(resolve => { animation.resolve = resolve; });
    scrollAnimations.set(view, animation);
    const startedAt = performance.now();
    const tick = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      view.scrollTo({ top: from + distance * eased, behavior: "instant" });
      if (progress < 1) animation.request = requestAnimationFrame(tick);
      else {
        scrollAnimations.delete(view);
        animation.resolve(true);
      }
    };
    animation.request = requestAnimationFrame(tick);
    return animation.promise;
  };

  const clearTarget = () => {
    revealVersion += 1;
    cancelAnimationFrame(revealRequest);
    stopScrolling();
    clearTimeout(revealTimer);
    if (!currentTarget) return;
    currentTarget.classList.remove("ionod-guide-highlight");
    if (originalDescription === null) currentTarget.removeAttribute("aria-describedby");
    else currentTarget.setAttribute("aria-describedby", originalDescription);
    if (originalTabIndex === null) currentTarget.removeAttribute("tabindex");
    else currentTarget.setAttribute("tabindex", originalTabIndex);
    currentTarget = null;
  };

  const guideViewport = (phoneBounds) => {
    const guideBounds = tour.getBoundingClientRect();
    const top = (header ? header.getBoundingClientRect().bottom : 0) + 8;
    const beside = guideBounds.left >= phoneBounds.right || guideBounds.right <= phoneBounds.left;
    const bottom = beside ? window.innerHeight - 8 : guideBounds.top - 8;
    return { top, bottom: Math.max(top + 1, bottom) };
  };

  // Låt besökaren rulla fritt tills nästa reglage skulle försvinna ur sikte.
  const keepInView = (view, bounds, top, bottom) => {
    const topDelta = bounds.top - top;
    const bottomDelta = bounds.bottom - bottom;
    const min = Math.min(topDelta, bottomDelta);
    const max = Math.max(topDelta, bottomDelta);
    const nearest = Math.max(min, Math.min(0, max));
    if (Math.abs(nearest) >= 1) view.scrollTo({ top: view.scrollY + nearest, behavior: "instant" });
  };

  const keepTargetVisible = () => {
    if (!isGuided() || !currentTarget || scrollAnimations.size) return;
    const dialog = appDocument.querySelector("dialog[open]");
    const target = dialog || currentTarget;
    if (!dialog) keepInView(frame.contentWindow, target.getBoundingClientRect(), 8, frame.clientHeight - 8);
    const bounds = target.getBoundingClientRect();
    const frameBounds = frame.getBoundingClientRect();
    const scale = frameBounds.width / frame.offsetWidth;
    const top = frameBounds.top + Math.max(0, bounds.top) * scale;
    const bottom = frameBounds.top + Math.min(frame.clientHeight, bounds.bottom) * scale;
    const viewport = guideViewport(phone.getBoundingClientRect());
    keepInView(window, { top, bottom }, viewport.top, viewport.bottom);
  };

  const revealTarget = () => {
    cancelAnimationFrame(revealRequest);
    const version = revealVersion;
    revealRequest = requestAnimationFrame(async () => {
      if (activeStep < 0 || !currentTarget || tour.hidden) return;
      const phoneBounds = phone.getBoundingClientRect();
      const viewport = guideViewport(phoneBounds);
      const available = viewport.bottom - viewport.top;
      const dialog = appDocument.querySelector("dialog[open]");
      if (dialog) stopScroll(frame.contentWindow);
      const scale = frame.getBoundingClientRect().width / frame.offsetWidth;
      if (dialog) appDocument.documentElement.style.setProperty("--ionod-dialog-max-height", `${Math.max(160, Math.floor(available / scale - 12))}px`);
      let target = dialog || currentTarget;
      if (dialog && dialog.getBoundingClientRect().height > frame.clientHeight - 24) {
        target = dialog.contains(appDocument.activeElement) ? appDocument.activeElement : dialog;
      }
      let bounds = target.getBoundingClientRect();
      if (!dialog && (bounds.top < 12 || bounds.bottom > frame.clientHeight - 12)) {
        const top = frame.contentWindow.scrollY + bounds.top - Math.max(12, (frame.clientHeight - bounds.height) / 2);
        if (!await scrollGently(frame.contentWindow, top)) return;
        if (version !== revealVersion || activeStep < 0 || tour.hidden) return;
        bounds = target.getBoundingClientRect();
      }
      const frameBounds = frame.getBoundingClientRect();
      const targetBounds = { top: frameBounds.top + bounds.top * scale, height: bounds.height * scale };
      const visibleBounds = phoneBounds.height <= available ? phoneBounds : targetBounds;
      const top = window.scrollY + visibleBounds.top - viewport.top - Math.max(0, (available - visibleBounds.height) / 2);
      if (version !== revealVersion || activeStep < 0 || tour.hidden) return;
      await scrollGently(window, top);
    });
  };

  const unlockApp = () => {
    savedInert.forEach((wasInert, control) => {
      control.toggleAttribute("inert", wasInert);
      control.removeAttribute("data-ionod-guide-locked");
    });
    savedInert.clear();
    appDocument.body.classList.remove("ionod-guided");
  };

  const allowedSelector = () => {
    if (!isGuided()) return "";
    if (advanceTimer) return "";
    const step = steps[activeStep];
    if (step.key === "start" && app["getState"]()["enabled"]) return "";
    if (step.key === "block" && isExpanded(pumpToggle)) return firstPump + " button";
    return step.allowed || "";
  };

  const correctPressure = () => {
    const input = appDocument.getElementById("configuration-value-0");
    return input && Math.abs(input.valueAsNumber - steps[activeStep].pressure) < .01;
  };

  const applyGate = () => {
    if (!isGuided()) return;
    appDocument.body.classList.add("ionod-guided");
    const allowed = allowedSelector();
    appDocument.querySelectorAll("button,input,select,textarea,a[href],canvas[tabindex]").forEach(control => {
      if (!savedInert.has(control)) savedInert.set(control, control.hasAttribute("inert"));
      const blocked = !allowed || !control.matches(allowed) || (control.id === "save-configuration" && !correctPressure());
      control.toggleAttribute("inert", blocked || savedInert.get(control));
      control.toggleAttribute("data-ionod-guide-locked", blocked);
    });
  };

  const focusAllowedControl = () => {
    const allowed = allowedSelector();
    const control = allowed && [...appDocument.querySelectorAll(allowed)].find(node => !node.closest("[inert]") && !node.disabled && node.getClientRects().length);
    (control || currentTarget)?.focus({ preventScroll: true });
  };

  // Capture spärrar även Enter, formulär och programstyrda klick på fel reglage.
  const guardAction = (event) => {
    if (!isGuided()) return;
    if (event.type === "keydown" && ["Tab", "Escape"].includes(event.key)) return;
    const control = event.target.closest?.("button,input,select,textarea,a[href],canvas");
    if (!control && (event.type === "pointerdown" || event.type === "keydown")) return;
    const allowed = allowedSelector();
    const submitting = event.type === "submit";
    const valid = submitting
      ? Boolean(steps[activeStep].pressure && event.target.id === "configuration-form" && correctPressure())
      : Boolean(control && allowed && control.matches(allowed) && !control.closest("[inert]") && !control.disabled);
    if (!valid) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (submitting) {
        description.textContent = steps[activeStep].description;
        focusAllowedControl();
      }
      return;
    }
    if (event.type !== "pointerdown" && event.type !== "keydown") queueMicrotask(() => {
      applyGate();
      updateGuide(app["getState"]());
    });
  };

  const syncApp = () => {
    if (steps[activeStep]?.key === "done" && isExpanded(settingsToggle)) clearTarget();
    if (!isGuided()) return;
    if (steps[activeStep].key === "block" && currentTarget.matches(pumpToggle) && isExpanded(pumpToggle)) {
      markTarget(firstPump, description.textContent);
      revealTimer = setTimeout(revealTarget, 320);
    }
    applyGate();
    scheduleFit();
  };

  const markTarget = (selector, message) => {
    clearTarget();
    currentTarget = appDocument.querySelector(selector);
    originalDescription = currentTarget.getAttribute("aria-describedby");
    originalTabIndex = currentTarget.getAttribute("tabindex");
    guideDescription.textContent = message;
    currentTarget.setAttribute("aria-describedby", [originalDescription, guideDescription.id].filter(Boolean).join(" "));
    if (!currentTarget.matches("button,input,a,[tabindex]")) currentTarget.setAttribute("tabindex", "-1");
    currentTarget.classList.add("ionod-guide-highlight");
    currentTarget.focus({ preventScroll: true });
  };

  const showStep = (index) => {
    if (!appDocument || appDocument.querySelector("dialog[open]")) return;
    clearTimeout(advanceTimer);
    advanceTimer = undefined;
    clearTarget();
    activeStep = index;
    stableSince = undefined;
    stepStartedAt = performance.now();
    stepReady = false;
    section.classList.add("is-tour-active");
    section.classList.toggle("is-guide-locked", isGuided());
    tour.hidden = false;
    result.hidden = true;
    const step = steps[index];
    const done = !isGuided();
    tour.dataset.step = step.key;
    tour.dataset.ready = "false";
    delete tour.dataset.starting;
    delete tour.dataset.alarm;
    title.textContent = step.title;
    description.textContent = step.description;
    counter.textContent = done ? "Guiden är klar" : `Steg ${index + 1} av ${steps.length - 1}`;
    tour.scrollTop = 0;
    tour.querySelectorAll(".tour-progress i").forEach((dot, position) => {
      dot.classList.toggle("is-current", position === index);
      dot.classList.toggle("is-complete", done || position < index);
    });
    next.hidden = !done && !step.manual;
    next.disabled = !done;
    next.textContent = done ? "Prova själv" : "Fortsätt";
    skip.hidden = done;
    if (done) {
      unlockApp();
      app["endGuide"](true);
    } else if (step.key === "alarm") {
      app["armGuideAlarm"]();
    }
    markTarget(step.selector, step.description);
    applyGate();
    fitPhone();
    revealTarget();
    revealTimer = setTimeout(revealTarget, 320);
  };

  const conditionHeld = (condition) => {
    if (!condition) { stableSince = undefined; return false; }
    stableSince ??= performance.now();
    return performance.now() - stableSince >= 3000;
  };

  const setStepReady = (ready, message) => {
    if (!ready || stepReady) return;
    stepReady = true;
    tour.dataset.ready = "true";
    next.disabled = false;
    description.textContent = message;
    guideDescription.textContent = description.textContent;
    if (ready && steps[activeStep].key === "alarm" && !currentTarget.matches(".process")) {
      markTarget(".process", description.textContent);
      revealTarget();
    }
    scheduleFit();
  };

  function updateGuide(payload) {
    if (!isGuided()) return;
    const {
      "enabled": enabled,
      "reachedSetpoint": reachedSetpoint,
      "nearSetpoint": nearSetpoint,
      "setpoint": setpoint,
      "firstPumpBlocked": firstPumpBlocked,
      "alarm": alarm
    } = payload;
    const step = steps[activeStep];
    let ready = false;
    let message = "";
    switch (step.key) {
      case "start":
        if (enabled && !tour.dataset.starting) {
          tour.dataset.starting = "true";
          description.textContent = "Pumpen är startad. Vi följer mätaren tills den visar 5,6 bar.";
          markTarget(pressureGauge, description.textContent);
          applyGate();
          revealTarget();
        }
        ready = reachedSetpoint || conditionHeld(nearSetpoint);
        message = reachedSetpoint ? "Trycket har nått 5,6 bar." : "Trycket ligger nära 5,6 bar.";
        break;
      case "raise": ready = setpoint === step.pressure; message = "6,4 bar är sparat. Nu följer vi trycket i historiken."; break;
      case "rising":
        ready = reachedSetpoint || conditionHeld(nearSetpoint);
        message = reachedSetpoint
          ? "Trycket har nått 6,4 bar. I historiken ser du hur trycket steg."
          : "Trycket ligger nära 6,4 bar. Grafen visar hur det varierar över tid.";
        break;
      case "block": ready = firstPumpBlocked; break;
      case "alarm":
        if (alarm && !tour.dataset.alarm) {
          tour.dataset.alarm = "true";
          description.textContent = "Larmet har stoppat driften. Läs meddelandet i telefonen.";
          markTarget(".process", description.textContent);
          revealTarget();
        }
        ready = conditionHeld(Boolean(alarm)) && performance.now() - stepStartedAt >= 4000;
        message = "Larmet har stoppat driften. Läs larmet och fortsätt när du är redo.";
        break;
      case "acknowledge": ready = !alarm; message = "Larmet är kvitterat. Du får strax fri kontroll över appen."; break;
    }
    if (step.manual) {
      setStepReady(ready, message);
    } else if (ready && !advanceTimer) {
      const index = activeStep;
      if (message) {
        description.textContent = message;
        guideDescription.textContent = message;
      }
      advanceTimer = setTimeout(() => {
        if (activeStep === index) showStep(index + 1);
      }, 1800);
      applyGate();
    }
  }

  const stopTour = () => {
    if (activeStep < 0) return;
    const finished = activeStep === steps.length - 1;
    clearTimeout(advanceTimer);
    advanceTimer = undefined;
    clearTarget();
    unlockApp();
    activeStep = -1;
    if (!finished) {
      appDocument.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
      app["endGuide"](false);
    }
    section.classList.remove("is-tour-active");
    section.classList.remove("is-guide-locked");
    appDocument.documentElement.style.removeProperty("--ionod-dialog-max-height");
    tour.hidden = true;
    fitPhone();
    result.textContent = finished ? "Guiden är klar. Nu kan du styra appen själv." : "Guiden är avslutad. Nu kan du styra appen själv.";
    result.hidden = false;
    starter.textContent = "Starta om guiden";
    mascotStarter?.setAttribute("aria-label", "Starta om Ninis guide till appen");
    starter.focus({ preventScroll: true });
  };

  const setLoadStatus = message => {
    for (const button of [starter, reset, mascotStarter]) {
      if (button) button.disabled = Boolean(message);
    }
    loadStatus.textContent = message;
    loadStatus.hidden = !message;
  };

  const showLoadError = () => {
    guideAfterLoad = false;
    setLoadStatus("Appen kunde inte laddas. Prova länken under telefonen.");
  };

  const reloadApp = startGuide => {
    guideAfterLoad = startGuide;
    result.hidden = true;
    setLoadStatus("Appen laddas…");
    frame.srcdoc = frame.srcdoc;
  };

  const initialize = () => {
    try {
      const doc = frame.contentDocument;
      if (!doc || !frame.contentWindow["ionodDemo"] || !doc.getElementById("unlock") || doc.querySelectorAll(".gauge").length !== 4) throw new Error("App not ready");
      if (appDocument === doc) return;
      const reloaded = Boolean(appDocument);
      if (activeStep >= 0) stopTour();
      bindings?.abort();
      dialogObserver?.disconnect();
      bindings = new AbortController();
      const options = { signal: bindings.signal };
      appDocument = doc;
      app = frame.contentWindow["ionodDemo"];
      guideDescription = doc.createElement("p");
      guideDescription.id = "ionod-guide-description";
      guideDescription.className = "ionod-guide-description";
      doc.body.append(guideDescription);
      for (const type of ["click", "pointerdown", "keydown", "input", "change", "submit"]) {
        doc.addEventListener(type, guardAction, { ...options, capture: true });
      }
      doc.addEventListener("ionod:state", event => updateGuide(event.detail), options);
      doc.addEventListener("wheel", stopScrolling, { ...options, passive: true });
      doc.addEventListener("touchmove", stopScrolling, { ...options, passive: true });
      frame.contentWindow.addEventListener("scroll", keepTargetVisible, { ...options, passive: true });
      doc.addEventListener("focusin", event => {
        if (!isGuided()) return;
        const control = event.target.closest?.("button,input,select,textarea,a[href]");
        const allowed = allowedSelector();
        if (control && (!allowed || !control.matches(allowed) || control.closest("[inert]"))) focusAllowedControl();
        if (doc.querySelector("dialog[open]")) revealTarget();
      }, options);
      dialogObserver = new MutationObserver(syncApp);
      doc.querySelectorAll("dialog").forEach(dialog => dialogObserver.observe(dialog, { attributes: true, attributeFilter: ["open"] }));
      dialogObserver.observe(doc.getElementById("configuration-fields"), {childList: true});
      for (const selector of [pumpToggle, settingsToggle]) {
        dialogObserver.observe(doc.querySelector(selector), { attributes: true, attributeFilter: ["aria-expanded"] });
      }
      setLoadStatus("");
      scheduleFit();
      if (guideAfterLoad) {
        guideAfterLoad = false;
        app["beginGuide"]();
        showStep(0);
      } else if (reloaded) {
        result.textContent = "Appen är nollställd.";
        result.hidden = false;
      }
    } catch {
      clearTimeout(advanceTimer);
      advanceTimer = undefined;
      if (appDocument) {
        clearTarget();
        unlockApp();
        app?.["endGuide"](false);
        activeStep = -1;
        tour.hidden = true;
        section.classList.remove("is-tour-active");
        section.classList.remove("is-guide-locked");
      }
      showLoadError();
    }
  };

  starter.addEventListener("click", () => reloadApp(true));
  mascotStarter?.addEventListener("click", () => reloadApp(true));
  reset.addEventListener("click", () => reloadApp(false));
  next.addEventListener("click", () => {
    if (activeStep === steps.length - 1) stopTour();
    else if (isGuided() && steps[activeStep].manual) {
      updateGuide(app["getState"]());
      if (stepReady) showStep(activeStep + 1);
    }
  });
  skip.addEventListener("click", stopTour);
  window.addEventListener("resize", scheduleFit);
  window.visualViewport?.addEventListener("resize", scheduleFit);
  window.addEventListener("wheel", stopScrolling, { passive: true });
  window.addEventListener("touchmove", stopScrolling, { passive: true });
  window.addEventListener("scroll", keepTargetVisible, { passive: true });
  const sizeObserver = new ResizeObserver(scheduleFit);
  [section, art, header, tour].filter(Boolean).forEach(element => sizeObserver.observe(element));
  document.fonts.ready.then(scheduleFit);
  scheduleFit();
  frame.addEventListener("load", initialize);
  frame.addEventListener("error", showLoadError);
  if (frame.contentDocument?.readyState === "complete" && frame.contentDocument.getElementById("unlock")) initialize();
})();
