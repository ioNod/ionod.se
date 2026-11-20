/* Inga tjänster eller enheter ansluts. All interaktion sker i webbläsaren. */
"use strict";

const timeline = document.querySelector(".well-timeline");
if (timeline && "IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("is-current", entry.isIntersecting);
      if (entry.isIntersecting) entry.target.classList.add("is-seen");
    });
  }, { rootMargin: "-20% 0px -20% 0px", threshold: 0.05 });
  timeline.classList.add("timeline-ready");
  timeline.querySelectorAll(".well-step").forEach((step) => observer.observe(step));
}

// Lägg till separata bilddelar så att tassar, öron och ben kan röra sig var för sig.
if (CSS.supports("clip-path", "polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%)")) {
  document.querySelectorAll(".rabbit-note-mascot.pose-pointing, .rabbit-note-mascot.pose-sitting").forEach((rabbit) => {
    const picture = rabbit.querySelector(".rabbit-pose");
    const art = document.createElement("span");
    art.className = "rabbit-pose-art";
    picture.before(art);
    art.append(picture);
    const parts = rabbit.classList.contains("pose-pointing") ? ["paw"] : ["ears", "left-leg", "right-leg"];
    parts.forEach((name) => {
      const part = picture.cloneNode();
      part.className = "rabbit-pose-part rabbit-part-" + name;
      part.setAttribute("aria-hidden", "true");
      art.append(part);
    });
    if (rabbit.classList.contains("pose-sitting")) {
      const smile = document.createElement("span");
      smile.className = "rabbit-pose-smile";
      smile.setAttribute("aria-hidden", "true");
      art.append(smile);
    }
    rabbit.classList.add("has-moving-parts");
  });
}

document.querySelectorAll(".demo-guide-invitation > img, [data-tour-mascot]").forEach((image) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rabbit-guide-button";
  button.setAttribute("aria-label", "Hälsa på kaninen");
  image.before(button);
  button.append(image);
});

document.querySelectorAll(".rabbit-note-mascot.pose-lying").forEach((rabbit) => {
  const stretch = document.createElement("img");
  stretch.className = "rabbit-stretch";
  stretch.src = "assets/rabbit-stretch.png";
  stretch.alt = "";
  stretch.setAttribute("aria-hidden", "true");
  rabbit.append(stretch);
});

document.querySelectorAll(".rabbit-note-mascot, .rabbit-guide-button").forEach((rabbit) => {
  let resetTimer;
  rabbit.addEventListener("click", () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    clearTimeout(resetTimer);
    rabbit.classList.remove("is-waving");
    void rabbit.offsetWidth;
    rabbit.classList.add("is-waving");
    resetTimer = setTimeout(() => rabbit.classList.remove("is-waving"), rabbit.classList.contains("pose-lying") ? 2500 : 1900);
  });
  rabbit.addEventListener("animationend", (event) => {
    if (event.target === rabbit && event.animationName === "rabbit-greet") rabbit.classList.remove("is-waving");
  });
});

// Kaninen har färdiga förklaringar som hör till den aktuella sidan.
const mascotImages = {
  happy: "assets/rabbit-mascot.png",
  curious: "assets/rabbit-mascot.png",
  explaining: "assets/rabbit-mascot.png"
};
const mascotTopics = {
  home: {
    link: "#appdemo", linkText: "Gå till demon",
    questions: [
      { question: "Hur provar jag IoNod?", answer: "Vid telefonen finns Prova i tre steg. Jag visar pumpknappen, vattenreglaget och var du ser dina ändringar.", mood: "explaining" },
      { question: "Styr jag en riktig pump här?", answer: "Nej, telefonen på testsidan är en demo. Du kan prova alla reglage utan att påverka någon riktig utrustning.", mood: "curious" },
      { question: "Kan jag använda datorn också?", answer: "Ja, IoNod kan användas med mobilen eller datorn. Vad du kan styra beror på din installation.", mood: "happy" }
    ]
  },
  products: {
    link: "#product-contact-title", linkText: "Till kontaktuppgifterna",
    questions: [
      { question: "Vilken del behöver jag?", answer: "Börja med vad du vill kunna göra med din pump. En installatör går igenom utrustningen och hjälper dig att hitta ett upplägg som passar.", mood: "curious" },
      { question: "Mobil eller dator?", answer: "De är två sätt att använda IoNod. Pumpen finns kvar på platsen, medan knappar och information kan nås från en skärm.", mood: "explaining" },
      { question: "Kan jag prova först?", answer: "Ja! På startsidan finns en klickbar telefon där du kan prova pumpknappen och vattenreglaget. Det är bara en demo.", mood: "happy" }
    ]
  },
  customer: {
    link: "index.html#appdemo", linkText: "Prova appen",
    questions: [
      { question: "Måste jag stå vid pumpen?", answer: "Med IoNod kan du styra från mobilen eller datorn, även när du är på en annan plats. Vilka reglage du får beror på pumpen och installationen.", mood: "happy" },
      { question: "Vem hjälper mig att börja?", answer: "En installatör hjälper dig att koppla in utrustningen och visar hur du använder styrningen när allt är på plats.", mood: "explaining" },
      { question: "Är telefonen här en demo?", answer: "Ja. Du kan trycka och dra i reglagen på startsidan, men ingen riktig pump påverkas.", mood: "curious" }
    ]
  },
  installer: {
    link: "index.html#appdemo", linkText: "Visa demon för kunden",
    questions: [
      { question: "Vad visar jag för kunden?", answer: "Visa var styrningen finns, låt kunden prova de avsedda reglagen och berätta vem kunden kan kontakta vid frågor.", mood: "explaining" },
      { question: "Tar allt lika lång tid?", answer: "Nej. Installatörens arbetssätt, förberedelserna och anläggningen påverkar hur lång tid installationen tar.", mood: "curious" },
      { question: "Finns det något att visa?", answer: "Telefonen på startsidan är ett enkelt sätt att förklara idén för kunden. Alla värden där är simulerade.", mood: "happy" }
    ]
  },
  team: {
    link: "#team-title", linkText: "Till teamet",
    questions: [
      { question: "Vilka står bakom IoNod?", answer: "Davey och Daniel är teamet bakom IoNod. Praktikanten Emilia har skapat den här hemsidan med hjälp av AI.", mood: "happy" },
      { question: "Är bilderna riktiga porträtt?", answer: "Nej, de är AI-genererade profilfigurer med utvalda kläder och detaljer.", mood: "curious" },
      { question: "Vem har gjort hemsidan?", answer: "Det har praktikanten Emilia gjort, med hjälp av AI. Hennes avatar har en Ice Cream-keps.", mood: "explaining" }
    ]
  },
  how: {
    link: "index.html#appdemo", linkText: "Prova förklaringen i demon",
    questions: [
      { question: "Är det mobilen som pumpar?", answer: "Nej. Pumpen flyttar vattnet. Mobilen är skärmen där du ger en uppgift, och IoNod kopplar ihop skärmen med utrustningens styrning.", mood: "explaining" },
      { question: "Hur ser jag vad som händer?", answer: "Information från den anslutna utrustningen kan visas på skärmen. Vilka uppgifter du får beror på vad som har installerats.", mood: "curious" },
      { question: "Kan jag testa knapparna?", answer: "Ja, på startsidan kan du prova ett exempel på pumpstyrning och se ändringarna i telefonens historik.", mood: "happy" }
    ]
  },
  basics: {
    link: "#rakneexempel", linkText: "Prova räkneexemplet",
    questions: [
      { question: "Vad betyder flöde?", answer: "Flöde är hur mycket vatten som passerar under en viss tid, till exempel 30 liter per minut.", mood: "explaining" },
      { question: "Är tryck och flöde samma sak?", answer: "Nej. Tryck beskriver hur hårt vattnet pressar. Flöde beskriver hur många liter som passerar. Mer tryck betyder inte automatiskt mer flöde.", mood: "curious" },
      { question: "Hur snabbt fylls en tank?", answer: "Prova reglagen i räkneexemplet! Där räknas tiden ut från volymen och ett konstant flöde. Det är en förenkling av verkligheten.", mood: "happy" }
    ]
  },
  compare: {
    link: "#jamforelsetabell", linkText: "Se jämförelsen",
    questions: [
      { question: "Vad ska jag jämföra?", answer: "Titta på vad som ingår, vilken utrustning som behövs, kostnaderna och vem som hjälper dig efter installationen.", mood: "curious" },
      { question: "Kan jag behålla min pump?", answer: "Det behöver gås igenom för just din anläggning. Fråga vad som kan återanvändas och vad som behöver läggas till.", mood: "explaining" },
      { question: "Vad behöver jag fråga om?", answer: "Fråga hur du ser att en ändring har gått igenom, vad som händer vid avbrott och vem som ansvarar för supporten.", mood: "happy" }
    ]
  }
};
document.querySelectorAll("[data-mascot-note]").forEach((note, noteIndex) => {
  const topic = mascotTopics[note.dataset.mascotNote];
  if (!topic) return;
  const titleId = "mascot-note-title-" + (noteIndex + 1);
  if (!note.id) note.id = "pumpkompisen-" + (noteIndex + 1);
  note.setAttribute("aria-labelledby", titleId);
  note.innerHTML = `<img class="mascot-character" alt="" width="512" height="512" loading="lazy" decoding="async"><div class="mascot-bubble"><p class="mascot-name">Kaninen förklarar</p><div class="mascot-answer" aria-atomic="true"><h3 id="${titleId}"></h3><p class="mascot-explanation"></p></div><details class="mascot-more"><summary>Fler frågor</summary><div class="mascot-questions" role="group" aria-label="Välj en fråga till kaninen"></div></details><a class="text-link mascot-link"></a></div>`;
  const image = note.querySelector(".mascot-character");
  const title = note.querySelector("h3");
  const explanation = note.querySelector(".mascot-explanation");
  const questions = note.querySelector(".mascot-questions");
  const buttons = topic.questions.map((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mascot-question";
    button.textContent = question.question;
    button.addEventListener("click", () => showQuestion(index));
    questions.append(button);
    return button;
  });
  const showQuestion = (index) => {
    const question = topic.questions[index];
    note.dataset.mood = question.mood;
    image.src = mascotImages[question.mood];
    title.textContent = question.question;
    explanation.textContent = question.answer;
    buttons.forEach((button, position) => button.setAttribute("aria-pressed", String(position === index)));
  };
  const link = note.querySelector(".mascot-link");
  link.href = topic.link;
  link.textContent = topic.linkText + " ↗";
  showQuestion(0);
  note.querySelector(".mascot-answer").setAttribute("aria-live", "polite");
});

// Mobilmenyn: fungerar även med tangentbord och stängs med Escape.
document.querySelectorAll("[data-product-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".portfolio-product");
    const opening = button.getAttribute("aria-expanded") !== "true";
    card.querySelectorAll("[data-product-panel]").forEach((item) => {
      const panel = document.getElementById(item.getAttribute("aria-controls"));
      const selected = item === button && opening;
      item.setAttribute("aria-expanded", String(selected));
      panel.classList.toggle("is-open", selected);
      panel.inert = !selected;
    });
  });
});

const menuButton = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
if (menuButton && siteNav) {
  const menuLabel = menuButton.querySelector("[data-menu-label]");
  const menuIcon = menuButton.querySelector("[data-menu-icon]");
  const showMenuState = (open) => {
    menuButton.setAttribute("aria-expanded", String(open));
    if (menuLabel) menuLabel.textContent = open ? "Stäng menyn" : "Meny";
    if (menuIcon) menuIcon.textContent = open ? "×" : "☰";
  };
  const closeMenu = () => {
    showMenuState(false);
    siteNav.classList.remove("is-open");
    siteNav.querySelectorAll("details[open]").forEach((details) => { details.open = false; });
  };
  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";
    showMenuState(open);
    siteNav.classList.toggle("is-open", open);
  });
  siteNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });
  document.addEventListener("click", (event) => {
    if (!siteNav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menuButton.focus();
    } else if (event.key === "Escape") {
      const openDetails = siteNav.querySelector("details[open]");
      if (openDetails) {
        openDetails.open = false;
        openDetails.querySelector("summary").focus({ preventScroll: true });
      }
    }
  });
  window.matchMedia("(min-width: 1241px)").addEventListener("change", closeMenu);
}

// Principanimation och gemensam paus för sidans rörelser.
const motionPlayer = document.querySelector("[data-motion-player]");
if (motionPlayer) {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionButtons = [...document.querySelectorAll("[data-motion-toggle]")];
  const phaseButtons = [...motionPlayer.querySelectorAll("[data-motion-phase]")];
  const scene = motionPlayer.querySelector(".motion-scene");
  const descriptions = [
    "Du trycker på en knapp i mobilen, till exempel Starta pumpen.",
    "IoNod skickar vidare det du vill göra till utrustningen vid pumpen.",
    "Pumpen startar när den är redo och installationens inställningar tillåter det.",
    "Information från pumpen visar vad som har hänt. Så kan du se hur den går."
  ];
  let phase = 0;
  let paused = motionPreference.matches;
  let inView = !('IntersectionObserver' in window);
  const setPaused = (value) => {
    paused = value;
    document.body.classList.toggle("motion-paused", paused);
    motionButtons.forEach((button) => {
      button.querySelector("[data-motion-label]").textContent = paused ? "Spela rörelse" : "Pausa rörelse";
      button.querySelector("[data-motion-icon]").textContent = paused ? "▶" : "Ⅱ";
      button.setAttribute("aria-label", paused ? "Spela sidans animationer" : "Pausa sidans animationer");
    });
  };
  const showPhase = (value, announce = false) => {
    phase = value;
    scene.dataset.phase = String(phase);
    phaseButtons.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.motionPhase) === phase)));
    document.getElementById("motion-counter").textContent = "0" + (phase + 1) + " / 04";
    document.getElementById("motion-description").textContent = descriptions[phase];
    if (announce) document.getElementById("motion-announcement").textContent = descriptions[phase];
  };
  motionButtons.forEach((button) => button.addEventListener("click", () => setPaused(!paused)));
  phaseButtons.forEach((button) => button.addEventListener("click", () => {
    setPaused(true);
    showPhase(Number(button.dataset.motionPhase), true);
  }));
  motionPreference.addEventListener("change", (event) => setPaused(event.matches));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }, { threshold: 0.2 });
    observer.observe(motionPlayer);
  }
  setInterval(() => {
    if (!paused && inView && !document.hidden) showPhase((phase + 1) % descriptions.length);
  }, 2800);
  setPaused(paused);
}

// Pedagogiskt räkneexempel: fylltid = volym / konstant flöde.
const flowCalculator = document.querySelector("[data-flow-calculator]");
if (flowCalculator) {
  const volumeInput = document.getElementById("example-volume");
  const flowInput = document.getElementById("example-flow");
  const updateFillTime = () => {
    const volume = Number(volumeInput.value);
    const flow = Number(flowInput.value);
    const totalSeconds = Math.round(volume / flow * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours) parts.push(hours + " h");
    if (minutes) parts.push(minutes + " min");
    if (seconds || !parts.length) parts.push(seconds + " s");
    document.getElementById("volume-output").textContent = volume + " liter";
    document.getElementById("flow-output").textContent = flow + " l/min";
    document.getElementById("fill-time").textContent = parts.join(" ");
    document.getElementById("fill-formula").textContent = volume + " liter ÷ " + flow + " l/min";
    volumeInput.setAttribute("aria-valuetext", volume + " liter");
    flowInput.setAttribute("aria-valuetext", flow + " liter per minut");
  };
  volumeInput.addEventListener("input", updateFillTime);
  flowInput.addEventListener("input", updateFillTime);
  updateFillTime();
}

// Klickbar appdemo på startsidan.
const phone = document.querySelector(".phone");
if (phone && !phone.querySelector("iframe")) {
  const pumpSwitch = phone.querySelector(".pump-switch");
  const pumpStatus = document.getElementById("pump-status");
  const waterTarget = document.getElementById("water-target");
  const targetOutput = document.getElementById("target-output");
  const targetNote = document.getElementById("target-note");
  const activityList = document.getElementById("activity-list");
  const announcement = document.getElementById("demo-announcement");
  const tabs = [...phone.querySelectorAll('[role="tab"]')];
  const gauge = phone.querySelector(".water-gauge");
  const gaugeProgress = phone.querySelector(".gauge-progress");
  const levelDisplay = document.getElementById("demo-water-level");
  const demoArt = phone.closest(".hero-art");
  const connectionLabel = document.getElementById("app-connection");
  const connectionText = connectionLabel.textContent;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let confirmationTimer;
  let waterBurstTimer;
  const showConfirmation = (message) => {
    clearTimeout(confirmationTimer);
    connectionLabel.textContent = "✓ " + message + " · demo";
    connectionLabel.closest(".app-footer").classList.add("is-confirmed");
    confirmationTimer = setTimeout(() => {
      connectionLabel.textContent = connectionText;
      connectionLabel.closest(".app-footer").classList.remove("is-confirmed");
    }, 2800);
  };
  const showWaterBurst = () => {
    clearTimeout(waterBurstTimer);
    gauge.classList.remove("is-celebrating");
    if (reducedMotion.matches || document.body.classList.contains("motion-paused")) return;
    void gauge.offsetWidth;
    gauge.classList.add("is-celebrating");
    waterBurstTimer = setTimeout(() => gauge.classList.remove("is-celebrating"), 950);
  };

  const addActivity = (message) => {
    const item = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "activity-dot";
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = message;
    const time = document.createElement("span");
    time.textContent = "Demo · " + new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    content.append(title, time);
    item.append(dot, content);
    activityList.prepend(item);
    while (activityList.children.length > 8) activityList.lastElementChild.remove();
    announcement.textContent = message + ". Simulerad ändring.";
  };

  pumpSwitch.addEventListener("click", () => {
    const running = pumpSwitch.getAttribute("aria-pressed") !== "true";
    pumpSwitch.setAttribute("aria-pressed", String(running));
    pumpStatus.textContent = running ? "Pumpen är igång" : "Pumpen är pausad";
    phone.classList.toggle("pump-off", !running);
    demoArt?.classList.toggle("pump-paused", !running);
    addActivity(running ? "Pumpen startades" : "Pumpen pausades");
    showConfirmation(running ? "Pumpen startad" : "Pumpen pausad");
    if (running) showWaterBurst();
    else {
      clearTimeout(waterBurstTimer);
      gauge.classList.remove("is-celebrating");
    }
  });

  const updateWaterLevel = () => {
    const level = Number(waterTarget.value);
    targetOutput.textContent = level + " %";
    waterTarget.setAttribute("aria-valuetext", level + " procent");
    gauge.setAttribute("aria-valuenow", String(level));
    gauge.setAttribute("aria-valuetext", level + " procent");
    levelDisplay.textContent = String(level);
    gaugeProgress.style.strokeDashoffset = String(2 * Math.PI * 66 * (1 - level / 100));
    gaugeProgress.style.opacity = level === 0 ? "0" : "1";
  };
  updateWaterLevel();
  waterTarget.addEventListener("input", () => {
    updateWaterLevel();
    targetNote.textContent = "Vattennivå: " + waterTarget.value + " %.";
  });
  waterTarget.addEventListener("change", () => {
    addActivity("Vattennivån ändrades till " + waterTarget.value + " %");
    showConfirmation("Nivån ändrad till " + waterTarget.value + " %");
  });

  const selectTab = (selectedTab) => {
    tabs.forEach((tab) => {
      const selected = tab === selectedTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle("active", selected);
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      panel.hidden = !selected;
      if (selected) panel.scrollTop = 0;
    });
    phone.dispatchEvent(new CustomEvent("demo-tabchange", { detail: selectedTab.id }));
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") nextIndex = (index + tabs.length - 1) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex !== undefined) {
        event.preventDefault();
        selectTab(tabs[nextIndex]);
        tabs[nextIndex].focus({ preventScroll: true });
      }
    });
  });

  // På mobil hålls telefonen och Ninis guide synliga tillsammans när de får plats.
  const tour = document.getElementById("demo-tour");
  const tourStarter = document.querySelector("[data-tour-start]");
  if (tour && tourStarter) {
    const tourTitle = document.getElementById("tour-title");
    const tourDescription = document.getElementById("tour-description");
    const tourCounter = document.getElementById("tour-counter");
    const tourMascot = tour.querySelector("[data-tour-mascot]");
    const tourResult = document.getElementById("tour-result");
    const backButton = tour.querySelector("[data-tour-back]");
    const nextButton = tour.querySelector("[data-tour-next]");
    const historyTab = document.getElementById("history-tab");
    const steps = [
      { target: pumpSwitch, title: "Pumpen", description: "Slå av eller på pumpen med den markerade knappen." },
      { target: waterTarget, title: "Vattennivå", description: "Ändra vattennivån med reglaget." },
      { target: historyTab, title: "Historik", description: "Öppna Historik för att se dina ändringar." }
    ];
    let stepIndex = -1;
    let currentTarget;
    let originalDescription;
    let levelAtStepStart;
    let completed = false;
    const demoSection = phone.closest(".app-demo-section");
    const clearTarget = () => {
      if (!currentTarget) return;
      currentTarget.classList.remove("is-guided");
      if (originalDescription === null) currentTarget.removeAttribute("aria-describedby");
      else currentTarget.setAttribute("aria-describedby", originalDescription);
      currentTarget = null;
    };
    const revealTarget = () => {
      const target = currentTarget;
      requestAnimationFrame(() => {
        if (!target || target !== currentTarget || tour.hidden) return;
        target.scrollIntoView({ behavior: "instant", block: "nearest" });
        const header = document.querySelector(".page-header, .home-header");
        const mobile = window.matchMedia("(max-width: 900px)").matches;
        const topInset = (header ? header.getBoundingClientRect().bottom : 0) + (mobile ? 8 : 20);
        const guideBounds = tour.getBoundingClientRect();
        const phoneBounds = phone.getBoundingClientRect();
        const guideBesidePhone = guideBounds.left >= phoneBounds.right || guideBounds.right <= phoneBounds.left;
        const availableHeight = Math.max(0, window.innerHeight - (guideBesidePhone ? 0 : guideBounds.height + 8) - topInset - 8);
        const bounds = mobile && phoneBounds.height <= availableHeight ? phoneBounds : target.getBoundingClientRect();
        const top = window.scrollY + bounds.top - topInset - Math.max(0, (availableHeight - bounds.height) / 2);
        window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion.matches || document.body.classList.contains("motion-paused") ? "instant" : "smooth" });
      });
    };
    const showStep = (index) => {
      clearTarget();
      stepIndex = index;
      completed = false;
      levelAtStepStart = waterTarget.value;
      selectTab(tabs[0]);
      tour.hidden = false;
      if (demoSection) demoSection.classList.add("is-tour-active");
      tourResult.hidden = true;
      tourTitle.textContent = steps[index].title;
      tourDescription.textContent = steps[index].description;
      tour.scrollTop = 0;
      tourCounter.textContent = "Steg " + (index + 1) + " av 3";
      if (tourMascot) tourMascot.src = mascotImages[index === 1 ? "curious" : "explaining"];
      tour.querySelectorAll(".tour-progress i").forEach((dot, position) => dot.classList.toggle("is-current", position === index));
      backButton.disabled = index === 0;
      nextButton.innerHTML = index === steps.length - 1 ? 'Klar <span aria-hidden="true">✓</span>' : 'Nästa steg <span aria-hidden="true">→</span>';
      currentTarget = steps[index].target;
      originalDescription = currentTarget.getAttribute("aria-describedby");
      currentTarget.setAttribute("aria-describedby", [originalDescription, "tour-description"].filter(Boolean).join(" "));
      currentTarget.classList.add("is-guided");
      currentTarget.focus({ preventScroll: true });
      revealTarget();
    };
    const completeStep = (message) => {
      if (stepIndex < 0 || completed) return;
      completed = true;
      tourDescription.textContent = message;
      if (tourMascot) tourMascot.src = mascotImages.happy;
    };
    const stopTour = (finished = false) => {
      if (stepIndex < 0) return;
      const returnTarget = currentTarget || tourStarter;
      clearTarget();
      stepIndex = -1;
      tour.hidden = true;
      if (demoSection) demoSection.classList.remove("is-tour-active");
      tourResult.textContent = finished ? "Guiden är klar." : "Guiden är avslutad.";
      tourResult.hidden = false;
      showConfirmation(finished ? "Guiden är klar" : "Guiden avslutad");
      returnTarget.focus({ preventScroll: true });
    };
    tourStarter.addEventListener("click", () => showStep(0));
    backButton.addEventListener("click", () => { if (stepIndex > 0) showStep(stepIndex - 1); });
    nextButton.addEventListener("click", () => {
      if (stepIndex === steps.length - 1) stopTour(true);
      else if (stepIndex >= 0) showStep(stepIndex + 1);
    });
    tour.querySelector("[data-tour-exit]").addEventListener("click", () => stopTour());
    window.addEventListener("resize", () => { if (stepIndex >= 0) revealTarget(); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && stepIndex >= 0 && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        stopTour();
      }
    });
    pumpSwitch.addEventListener("click", () => {
      if (stepIndex === 0) completeStep("Pumpens läge är ändrat.");
    });
    waterTarget.addEventListener("input", () => {
      if (stepIndex === 1 && waterTarget.value !== levelAtStepStart) completeStep("Mätaren visar den nya vattennivån.");
    });
    phone.addEventListener("demo-tabchange", (event) => {
      if (stepIndex === 2 && event.detail === "history-tab") completeStep("Dina ändringar visas här.");
    });
  }
}

// Ett lugnt varv vid hovring, eller med knappen på mobil och tangentbord.
document.querySelectorAll("[data-propeller-card]").forEach((card) => {
  const portrait = card.querySelector(".daniel-portrait");
  const rotor = card.querySelector(".propeller-blades");
  const button = card.querySelector("[data-spin-propeller]");
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let timer;
  const spin = () => {
    clearTimeout(timer);
    rotor.classList.remove("is-spinning");
    if (preference.matches || document.body.classList.contains("motion-paused")) return;
    void rotor.getBoundingClientRect();
    rotor.classList.add("is-spinning");
    timer = setTimeout(() => rotor.classList.remove("is-spinning"), 1500);
  };
  portrait.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") spin(); });
  button.addEventListener("click", spin);
  preference.addEventListener("change", () => {
    clearTimeout(timer);
    rotor.classList.remove("is-spinning");
  });
});

// Filtrering av produktområden, utan att sidan laddas om.
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const productCards = [...document.querySelectorAll("[data-category]")];
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.filter;
    filterButtons.forEach((filter) => filter.setAttribute("aria-pressed", String(filter === button)));
    let visible = 0;
    productCards.forEach((card) => {
      card.hidden = category !== "all" && card.dataset.category !== category;
      if (!card.hidden) visible++;
    });
    const count = document.querySelector(".catalog-count");
    count.textContent = visible + (visible === 1 ? " område" : " områden");
  });
});

// Produktinformation i en tillgänglig dialogruta. Innehållet är koncepttext.
const productDetails = {
  pump: {
    eyebrow: "IoNod / Pumpstyrning",
    title: "Styr din pump.",
    description: "Med IoNod kan du styra pumpen med mobilen eller datorn. Du behöver inte gå till pumpen för varje ändring.",
    points: ["En installatör hjälper dig att koppla in IoNod.", "Du använder knapparna på skärmen för att styra pumpen.", "Vilka pumpar som passar och fler detaljer kommer senare."]
  },
  mobile: {
    eyebrow: "IoNod / Mobil",
    title: "Använd mobilen.",
    description: "I telefonen på startsidan kan du prova hur IoNod kan fungera. Du styr bara ett exempel, ingen riktig pump.",
    points: ["Tryck på knappen bredvid Vattenpump för att slå av eller på.", "Dra reglaget för att ändra vattennivån i exemplet.", "Under Vad har hänt? ser du dina ändringar."]
  },
  web: {
    eyebrow: "IoNod / Webb",
    title: "Använd datorn.",
    description: "Du kan också använda IoNod på en dator. Det passar när du vill ha en större skärm.",
    points: ["Du når IoNod genom en webbsida.", "Du behöver inte vara vid pumpen för att använda styrningen.", "Vad du kan göra beror på din installation."]
  }
};
const productDialog = document.getElementById("product-dialog");
if (productDialog) {
  const closeButton = productDialog.querySelector(".dialog-close");
  document.querySelectorAll("[data-product]").forEach((button) => {
    button.addEventListener("click", () => {
      const product = productDetails[button.dataset.product];
      if (!product) return;
      document.getElementById("dialog-eyebrow").textContent = product.eyebrow;
      document.getElementById("dialog-title").textContent = product.title;
      document.getElementById("dialog-description").textContent = product.description;
      const points = document.getElementById("dialog-points");
      points.replaceChildren(...product.points.map((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        return item;
      }));
      productDialog.showModal();
    });
  });
  closeButton.addEventListener("click", () => productDialog.close());
  productDialog.addEventListener("click", (event) => {
    if (event.target !== productDialog) return;
    const bounds = productDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) productDialog.close();
  });
}
