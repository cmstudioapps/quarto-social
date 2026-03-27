(() => {
  "use strict";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = String(text == null ? "" : text);
  }

  function clearChildren(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function safeNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizePercent(value) {
    return clamp(Math.round(safeNumber(value, 0)), 0, 100);
  }

  function formatInt(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return "0";
    return String(Math.trunc(numberValue));
  }

  function formatPercent(value) {
    return `${normalizePercent(value)}%`;
  }

  const dom = {
    root: null,
    hud: {
      money: null,
      popularity: null,
      health: null,
      education: null,
      food: null,
      housing: null,
      employment: null,
      wellbeing: null,
    },
    question: null,
    options: [
      { button: null, text: null },
      { button: null, text: null },
      { button: null, text: null },
    ],
    actions: {
      phone: {
        button: null,
        text: null,
        badge: null,
      },
    },
    toastRoot: null,
    credits: {
      root: null,
    },
    splash: {
      root: null,
      text: null,
    },
    overlay: {
      root: null,
      scrim: null,
      generic: {
        root: null,
        title: null,
        body: null,
        actions: null,
        close: null,
      },
      phone: {
        root: null,
        close: null,
        name: null,
        status: null,
        btnCall: null,
        btnHang: null,
        continueHint: null,
        captionPerson: null,
        captionPersonWho: null,
        captionPersonText: null,
        captionMayor: null,
        captionMayorWho: null,
        captionMayorText: null,
      },
      scene: {
        root: null,
        title: null,
        close: null,
        image: null,
        caption: null,
        captionText: null,
      },
    },
  };

  const state = {
    money: 50000,
    popularity: 0,
    health: 0,
    education: 0,
    food: 0,
    housing: 0,
    employment: 0,
    wellbeing: 0,
    round: 3,
    question: "O hospital está lotado. O que devemos fazer?",
    playerName: "Prefeito",
    options: [
      { text: "Construir uma nova ala", enabled: true, visible: true, tone: "green" },
      { text: "Aumentar a verba da saúde", enabled: true, visible: true, tone: "blue" },
      { text: "Ignorar o problema", enabled: true, visible: true, tone: "red" },
    ],
    optionHandlers: [null, null, null],

    overlay: {
      open: false,
      modal: "none", // none | generic | phone | scene
    },

    notifications: {
      nextId: 1,
      timers: {},
    },

    phone: {
      visible: false,
      buttonText: "Chamadas",
      badge: 0,
      name: "Desconhecido",
      status: "idle", // idle | ringing | connected
      caption: null, // { speaker: 'person'|'mayor', text: string }
      waitingAdvance: false,
    },

    scene: {
      title: "Cena",
      image: "",
      caption: null, // string
    },

    handlers: {
      phone: {
        onCall: null,
        onHang: null,
        onOpen: null,
        onClose: null,
      },
      scene: {
        onOpen: null,
        onClose: null,
      },
    },
  };


  const FINAL_METRICS = [
    { key: "money", label: "Dinheiro", format: formatInt, type: "number" },
    { key: "popularity", label: "Popularidade", format: formatPercent, type: "percent" },
    { key: "health", label: "Saúde", format: formatPercent, type: "percent" },
    { key: "education", label: "Educação", format: formatPercent, type: "percent" },
    { key: "food", label: "Alimentação", format: formatPercent, type: "percent" },
    { key: "housing", label: "Moradia", format: formatPercent, type: "percent" },
    { key: "employment", label: "Emprego", format: formatPercent, type: "percent" },
    { key: "wellbeing", label: "Bem-estar", format: formatPercent, type: "percent" },
  ];

  const METRIC_LABELS = FINAL_METRICS.reduce((acc, metric) => {
    acc[metric.key] = metric.label;
    return acc;
  }, {});

  const STORAGE_KEY_LAST_METRICS = "prefeito_last_metrics";

  function hydrateMetricsSnapshot(source) {
    const snapshot = {};
    FINAL_METRICS.forEach((metric) => {
      snapshot[metric.key] = safeNumber(source && source[metric.key], 0);
    });
    return snapshot;
  }

  function loadLastSessionMetrics() {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_LAST_METRICS);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const metricsSource = parsed.metrics && typeof parsed.metrics === "object" ? parsed.metrics : parsed;
      const name = parsed.name && typeof parsed.name === "string" ? parsed.name : null;
      return {
        name,
        metrics: hydrateMetricsSnapshot(metricsSource),
      };
    } catch (err) {
      // ignore corrupted storage
    }

    return null;
  }

  function persistLastSessionMetrics(name, metrics) {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return;
    }

    try {
      const payload = {
        name: name && typeof name === "string" ? name : null,
        metrics,
        timestamp: new Date().toISOString(),
      };
      window.localStorage.setItem(STORAGE_KEY_LAST_METRICS, JSON.stringify(payload));
    } catch (_) {
      // ignore quota errors
    }
  }

  const impactAudit = {
    choices: 0,
    totalMagnitude: 0,
    positiveMagnitude: 0,
    negativeMagnitude: 0,
    distribution: {},
  };

  function resetImpactAudit() {
    impactAudit.choices = 0;
    impactAudit.totalMagnitude = 0;
    impactAudit.positiveMagnitude = 0;
    impactAudit.negativeMagnitude = 0;
    impactAudit.distribution = {};
  }

  function logImpact(efeitos) {
    if (!efeitos || typeof efeitos !== "object") return;

    const entries = Object.entries(efeitos);
    if (!entries.length) return;

    impactAudit.choices += 1;
    entries.forEach(([key, rawValue]) => {
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value === 0) return;

      const magnitude = Math.abs(value);
      impactAudit.totalMagnitude += magnitude;
      if (value > 0) impactAudit.positiveMagnitude += value;
      else impactAudit.negativeMagnitude += magnitude;

      impactAudit.distribution[key] = (impactAudit.distribution[key] || 0) + value;
    });
  }

  resetImpactAudit();

  let roundsRange = null;
  let finalSummaryShown = false;
  let lastSessionMetrics = loadLastSessionMetrics();


  let pendingPergunta = null;
  let pendingPerguntaSeq = 0;

  function cancelPendingPergunta(payload) {
    if (!pendingPergunta) return;

    const resolver = pendingPergunta.resolve;
    pendingPergunta = null;

    try {
      resolver(payload);
    } catch (_) {
      // ignore
    }
  }

  function resolvePergunta(perguntaId, payload) {
    if (!pendingPergunta || pendingPergunta.id !== perguntaId) return;

    const resolver = pendingPergunta.resolve;
    pendingPergunta = null;

    try {
      resolver(payload);
    } catch (_) {
      // ignore
    }
  }

  function ensureDom() {
    if (dom.root) return;

    dom.root = byId("game");

    dom.hud.money = byId("hud-money");
    dom.hud.popularity = byId("hud-popularity");
    dom.hud.health = byId("hud-health");
    dom.hud.education = byId("hud-education");
    dom.hud.food = byId("hud-food");
    dom.hud.housing = byId("hud-housing");
    dom.hud.employment = byId("hud-employment");
    dom.hud.wellbeing = byId("hud-wellbeing");

    dom.question = byId("game-question");

    for (let i = 1; i <= 3; i += 1) {
      dom.options[i - 1] = {
        button: byId(`option-${i}`),
        text: byId(`option-${i}-text`),
      };
    }

    dom.actions.phone.button = byId("action-phone");
    dom.actions.phone.text = byId("action-phone-text");
    dom.actions.phone.badge = byId("action-phone-badge");

    dom.toastRoot = byId("toast-root");

    dom.overlay.root = byId("overlay");
    dom.overlay.scrim = dom.overlay.root ? dom.overlay.root.querySelector("[data-overlay-close='true']") : null;

    dom.overlay.generic.root = byId("modal-generic");
    dom.overlay.generic.title = byId("modal-generic-title");
    dom.overlay.generic.body = byId("modal-generic-body");
    dom.overlay.generic.actions = byId("modal-generic-actions");
    dom.overlay.generic.close = byId("modal-generic-close");

    dom.overlay.phone.root = byId("modal-phone");
    dom.overlay.phone.close = byId("modal-phone-close");
    dom.overlay.phone.name = byId("phone-name");
    dom.overlay.phone.status = byId("phone-status");
    dom.overlay.phone.btnCall = byId("phone-btn-call");
    dom.overlay.phone.btnHang = byId("phone-btn-hang");
    dom.overlay.phone.continueHint = byId("phone-continue");
    dom.overlay.phone.captionPerson = byId("phone-caption-person");
    dom.overlay.phone.captionPersonWho = byId("phone-caption-person-who");
    dom.overlay.phone.captionPersonText = byId("phone-caption-person-text");
    dom.overlay.phone.captionMayor = byId("phone-caption-mayor");
    dom.overlay.phone.captionMayorWho = byId("phone-caption-mayor-who");
    dom.overlay.phone.captionMayorText = byId("phone-caption-mayor-text");

    dom.overlay.scene.root = byId("modal-scene");
    dom.overlay.scene.title = byId("modal-scene-title");
    dom.overlay.scene.close = byId("modal-scene-close");
    dom.overlay.scene.image = byId("scene-image");
    dom.overlay.scene.caption = byId("scene-caption");
    dom.overlay.scene.captionText = byId("scene-caption-text");

    dom.splash.root = byId("splash");
    dom.splash.text = byId("splash-text");
    dom.splash.logo = byId("splash-logo");
    dom.credits.root = byId("credits-screen");
  }

  function creditsIsOpen() {
    ensureDom();
    return !!(dom.credits.root && !dom.credits.root.hasAttribute("hidden"));
  }

  function showCreditsScreen() {
    ensureDom();
    if (!dom.credits.root) return;
    setHidden(dom.credits.root, false);
  }

  function hideCreditsScreen() {
    ensureDom();
    if (!dom.credits.root) return;
    const wasVisible = !dom.credits.root.hasAttribute("hidden");
    setHidden(dom.credits.root, true);
    if (wasVisible && typeof window !== "undefined" && window.location && typeof window.location.reload === "function") {
      window.location.reload();
    }
  }

  function renderHud() {
    ensureDom();
    const animateDelta = (el, nextText) => {
      if (!el) return;
      const prevText = String(el.textContent || "");
      const nextValue = String(nextText == null ? "" : nextText);
      if (prevText === nextValue) return;

      const parseNum = (raw) => {
        const n = Number(String(raw).replace(/[^0-9-]/g, ""));
        return Number.isFinite(n) ? n : 0;
      };

      const prevNum = parseNum(prevText);
      const nextNum = parseNum(nextValue);
      const deltaClass = nextNum > prevNum ? "hud-value--up" : nextNum < prevNum ? "hud-value--down" : "hud-value--pulse";

      el.classList.remove("hud-value--up", "hud-value--down", "hud-value--pulse");
      // força restart da animação
      void el.offsetWidth;
      el.classList.add(deltaClass);
      el.textContent = nextValue;
    };

    animateDelta(dom.hud.money, formatInt(state.money));
    animateDelta(dom.hud.popularity, formatPercent(state.popularity));
    animateDelta(dom.hud.health, formatPercent(state.health));
    animateDelta(dom.hud.education, formatPercent(state.education));
    animateDelta(dom.hud.food, formatPercent(state.food));
    animateDelta(dom.hud.housing, formatPercent(state.housing));
    animateDelta(dom.hud.employment, formatPercent(state.employment));
    animateDelta(dom.hud.wellbeing, formatPercent(state.wellbeing));

    if (dom.question) {
      const nextQuestion = String(state.question || "");
      const prevQuestion = String(dom.question.textContent || "");
      if (prevQuestion !== nextQuestion) {
        dom.question.textContent = nextQuestion;
        dom.question.classList.remove("decision-question-text--pulse");
        void dom.question.offsetWidth;
        dom.question.classList.add("decision-question-text--pulse");
      }
    }

    for (let i = 0; i < 3; i += 1) {
      const optDom = dom.options[i];
      const optState = state.options[i] || {};

      if (optDom && optDom.text) optDom.text.textContent = String(optState.text || "");

      if (optDom && optDom.button) {
        optDom.button.disabled = optState.enabled === false;
        optDom.button.style.display = optState.visible === false ? "none" : "";

        if (optState.tone) {
          setOptionTone(i + 1, optState.tone);
        }
      }
    }
  }

  function renderBadge(el, value) {
    if (!el) return;

    const n = Math.max(0, Math.trunc(safeNumber(value, 0)));
    if (n <= 0) {
      el.textContent = "0";
      setHidden(el, true);
      return;
    }

    el.textContent = String(n);
    setHidden(el, false);
  }

  function renderPhoneAction() {
    ensureDom();

    if (dom.actions.phone.button) {
      setHidden(dom.actions.phone.button, state.phone.visible === false);
    }

    if (dom.actions.phone.text) {
      setText(dom.actions.phone.text, state.phone.buttonText);
    }

    renderBadge(dom.actions.phone.badge, state.phone.badge);
  }

  function phoneStatusLabel(status) {
    if (status === "ringing") return "Chamando...";
    if (status === "connected") return "Em ligação";
    return "Sem ligação";
  }

  function renderPhoneModal() {
    ensureDom();

    setText(dom.overlay.phone.name, state.phone.name);
    setText(dom.overlay.phone.status, phoneStatusLabel(state.phone.status));

    const cap = state.phone.caption && typeof state.phone.caption === "object" ? state.phone.caption : null;
    const speaker = cap && cap.speaker ? String(cap.speaker) : "";
    const who = cap && cap.who ? String(cap.who) : "";
    const captionText = cap && cap.text != null ? String(cap.text) : "";
    const showCaption = captionText.trim().length > 0;

    const showPerson = showCaption && speaker === "person";
    const showMayor = showCaption && speaker === "mayor";

    if (dom.overlay.phone.captionPersonWho) setText(dom.overlay.phone.captionPersonWho, state.phone.name || "Pessoa");
    if (dom.overlay.phone.captionPersonText) setText(dom.overlay.phone.captionPersonText, showPerson ? captionText : "");
    setHidden(dom.overlay.phone.captionPerson, !showPerson);
    if (dom.overlay.phone.captionPerson) dom.overlay.phone.captionPerson.dataset.active = showPerson ? "1" : "0";

    if (dom.overlay.phone.captionMayorWho) {
      setText(dom.overlay.phone.captionMayorWho, who || "Prefeito");
    }
    if (dom.overlay.phone.captionMayorText) setText(dom.overlay.phone.captionMayorText, showMayor ? captionText : "");
    setHidden(dom.overlay.phone.captionMayor, !showMayor);
    if (dom.overlay.phone.captionMayor) dom.overlay.phone.captionMayor.dataset.active = showMayor ? "1" : "0";

    if (dom.overlay.phone.continueHint) {
      setHidden(dom.overlay.phone.continueHint, state.phone.waitingAdvance !== true);
    }

    if (dom.overlay.phone.btnCall) {
      dom.overlay.phone.btnCall.disabled = state.phone.status === "connected";
    }

    if (dom.overlay.phone.btnHang) {
      dom.overlay.phone.btnHang.disabled = state.phone.status === "idle";
    }
  }

  function renderSceneModal() {
    ensureDom();

    if (dom.overlay.scene.title) {
      setText(dom.overlay.scene.title, state.scene.title);
    }

    const imgEl = dom.overlay.scene.image;
    if (imgEl) {
      const nextSrc = state.scene.image ? String(state.scene.image) : "";
      const currSrc = imgEl.getAttribute("src") || "";

      imgEl.alt = String(state.scene.title || "Cena");

      if (nextSrc !== currSrc) {
        imgEl.dataset.loaded = "0";
        if (nextSrc) imgEl.setAttribute("src", nextSrc);
        else imgEl.removeAttribute("src");
      }
    }

    const captionText = state.scene.caption != null ? String(state.scene.caption) : "";
    const showCaption = captionText.trim().length > 0;

    if (dom.overlay.scene.captionText) setText(dom.overlay.scene.captionText, showCaption ? captionText : "");
    setHidden(dom.overlay.scene.caption, !showCaption);
  }

  function overlayShow(modal) {
    ensureDom();

    state.overlay.open = true;
    state.overlay.modal = modal;

    setHidden(dom.overlay.root, false);

    setHidden(dom.overlay.generic.root, modal !== "generic");
    setHidden(dom.overlay.phone.root, modal !== "phone");
    setHidden(dom.overlay.scene.root, modal !== "scene");

    if (modal === "phone") renderPhoneModal();
    if (modal === "scene") renderSceneModal();
  }

  function overlayClose() {
    ensureDom();

    state.overlay.open = false;
    state.overlay.modal = "none";

    setHidden(dom.overlay.generic.root, true);
    setHidden(dom.overlay.phone.root, true);
    setHidden(dom.overlay.scene.root, true);
    setHidden(dom.overlay.root, true);
  }

  const boundGlobal = Object.create(null);

  function bindOnce(el, key, eventName, handler) {
    if (!el) return;

    if (!el.dataset) {
      if (boundGlobal[key] === true) return;
      boundGlobal[key] = true;
      el.addEventListener(eventName, handler);
      return;
    }

    const k = `bound_${key}`;
    if (el.dataset[k] === "1") return;
    el.dataset[k] = "1";
    el.addEventListener(eventName, handler);
  }

  function closeAnyModal() {
    if (!state.overlay.open) return;

    if (state.overlay.modal === "phone") {
      if (typeof state.handlers.phone.onClose === "function") {
        state.handlers.phone.onClose({ name: state.phone.name, status: state.phone.status, state: getState() });
      }
    }

    if (state.overlay.modal === "scene") {
      sceneClearLegendas();
      if (typeof state.handlers.scene.onClose === "function") {
        state.handlers.scene.onClose({ title: state.scene.title, image: state.scene.image, state: getState() });
      }
    }

    if (state.overlay.modal === "generic") {
      dialogCancelPending();
    }

    overlayClose();
  }

  function setupEventsOnce() {
    ensureDom();

    for (let i = 0; i < 3; i += 1) {
      const btn = dom.options[i] ? dom.options[i].button : null;
      if (!btn) continue;

      bindOnce(btn, "option_click", "click", (event) => {
        const handler = state.optionHandlers[i];
        if (typeof handler !== "function") return;

        btn.classList.remove("game-btn--selected");
        void btn.offsetWidth;
        btn.classList.add("game-btn--selected");

        handler({ index: i + 1, event, state: getState() });
      });
    }

    bindOnce(dom.actions.phone.button, "phone_open", "click", () => {
      phoneOpen();
    });

    bindOnce(dom.overlay.scrim, "overlay_scrim", "click", () => {
      closeAnyModal();
    });

    bindOnce(dom.overlay.generic.close, "generic_close", "click", () => {
      closeAnyModal();
    });

    bindOnce(dom.overlay.phone.close, "phone_close", "click", () => {
      closeAnyModal();
    });

    bindOnce(dom.overlay.scene.close, "scene_close", "click", () => {
      closeAnyModal();
    });

    bindOnce(dom.overlay.scene.image, "scene_image_load", "load", () => {
      if (dom.overlay.scene.image) dom.overlay.scene.image.dataset.loaded = "1";
    });

    bindOnce(dom.overlay.scene.image, "scene_image_error", "error", () => {
      if (dom.overlay.scene.image) dom.overlay.scene.image.dataset.loaded = "1";
    });

    bindOnce(dom.splash.root, "splash_skip", "click", (event) => {
      if (!splashIsOpen()) return;
      event.preventDefault();
      hideSplash({ reason: "click" });
    });

    bindOnce(dom.credits.root, "credits_close", "click", () => {
      hideCreditsScreen();
    });

    bindOnce(dom.overlay.phone.btnCall, "phone_call", "click", () => {
      phoneCall();
    });

    bindOnce(dom.overlay.phone.btnHang, "phone_hang", "click", () => {
      phoneHang();
    });

    bindOnce(dom.overlay.phone.root, "phone_advance_click", "click", (event) => {
      if (!state.overlay.open || state.overlay.modal !== "phone") return;
      const target = event && event.target ? event.target : null;
      if (target && target.closest && target.closest("button")) return;
      phoneAdvanceCaption();
    });

    bindOnce(document, "esc_close", "keydown", (event) => {
      if (splashIsOpen()) {
        if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          hideSplash({ reason: "key" });
        }
        return;
      }

      if (creditsIsOpen()) {
        if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          hideCreditsScreen();
        }
        return;
      }

      if (!state.overlay.open) return;
      if (event.key === "Escape") {
        closeAnyModal();
      }

      if (state.overlay.modal === "phone") {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          phoneAdvanceCaption();
        }
      }
    });
  }

  function getState() {
    return {
      money: state.money,
      popularity: state.popularity,
      health: state.health,
      education: state.education,
      food: state.food,
      housing: state.housing,
      employment: state.employment,
      wellbeing: state.wellbeing,
      round: state.round,
      question: state.question,
      options: state.options.map((o) => ({
        text: o.text,
        enabled: o.enabled,
        visible: o.visible,
        tone: o.tone,
      })),
      overlay: {
        open: state.overlay.open,
        modal: state.overlay.modal,
      },
      phone: {
        visible: state.phone.visible,
        buttonText: state.phone.buttonText,
        badge: state.phone.badge,
        name: state.phone.name,
        status: state.phone.status,
      },
      scene: {
        title: state.scene.title,
        image: state.scene.image,
      },
    };
  }

  function setMoney(value) {
    state.money = Math.trunc(safeNumber(value, 0));
    renderHud();
    return state.money;
  }

  function addMoney(delta) {
    return setMoney(state.money + safeNumber(delta, 0));
  }

  function setPopularity(value) {
    state.popularity = normalizePercent(value);
    renderHud();
    return state.popularity;
  }

  function addPopularity(delta) {
    return setPopularity(state.popularity + safeNumber(delta, 0));
  }

  function setHealth(value) {
    state.health = normalizePercent(value);
    renderHud();
    return state.health;
  }

  function addHealth(delta) {
    return setHealth(state.health + safeNumber(delta, 0));
  }

  function setEducation(value) {
    state.education = normalizePercent(value);
    renderHud();
    return state.education;
  }

  function addEducation(delta) {
    return setEducation(state.education + safeNumber(delta, 0));
  }

  function setFood(value) {
    state.food = normalizePercent(value);
    renderHud();
    return state.food;
  }

  function addFood(delta) {
    return setFood(state.food + safeNumber(delta, 0));
  }

  function setHousing(value) {
    state.housing = normalizePercent(value);
    renderHud();
    return state.housing;
  }

  function addHousing(delta) {
    return setHousing(state.housing + safeNumber(delta, 0));
  }

  function setEmployment(value) {
    state.employment = normalizePercent(value);
    renderHud();
    return state.employment;
  }

  function addEmployment(delta) {
    return setEmployment(state.employment + safeNumber(delta, 0));
  }

  function setWellbeing(value) {
    state.wellbeing = normalizePercent(value);
    renderHud();
    return state.wellbeing;
  }

  function addWellbeing(delta) {
    return setWellbeing(state.wellbeing + safeNumber(delta, 0));
  }

  function captureTrackedMetrics() {
    const snapshot = {};
    FINAL_METRICS.forEach((metric) => {
      snapshot[metric.key] = safeNumber(state[metric.key], 0);
    });
    return snapshot;
  }

  function formatDeltaForMetric(metric, current, baseline) {
    const diff = Math.round(current - baseline);
    const classes = ['final-row__delta'];
    if (diff > 0) classes.push('final-row__delta--positive');
    else if (diff < 0) classes.push('final-row__delta--negative');
    const sign = diff > 0 ? '+' : '';
    const suffix = metric.type === 'percent' ? ' p.p.' : '';
    return {
      diff,
      text: diff === 0 ? '0' : `${sign}${diff}${suffix}`,
      className: classes.join(' '),
    };
  }

  function computeSessionScore(metrics) {
    if (!metrics || typeof metrics !== "object") return 0;
    const percentSum = FINAL_METRICS.reduce((total, metric) => {
      if (metric.key === "money") return total;
      return total + Math.round(safeNumber(metrics[metric.key], 0));
    }, 0);
    const moneyScore = Math.round(safeNumber(metrics.money, 0) / 2000);
    return percentSum + moneyScore;
  }

  function buildImpactAuditHtml() {
    if (!impactAudit.choices) {
      return `<div class="final-summary__audit">
        <p class="final-summary__audit-title">Avaliação da pontuação</p>
        <p class="final-summary__audit-text">Não há decisões registradas para avaliar a proporcionalidade dos impactos.</p>
      </div>`;
    }

    const averageImpact = Math.round(impactAudit.totalMagnitude / impactAudit.choices);
    const positivityPct = impactAudit.totalMagnitude
      ? Math.round((impactAudit.positiveMagnitude / impactAudit.totalMagnitude) * 100)
      : 0;
    const negativePct = impactAudit.totalMagnitude
      ? Math.round((impactAudit.negativeMagnitude / impactAudit.totalMagnitude) * 100)
      : 0;
    const contributions = Object.entries(impactAudit.distribution)
      .map(([key, value]) => ({ key, value, label: METRIC_LABELS[key] || key }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 2)
      .map((item) => `${item.label} ${item.value > 0 ? '+' : ''}${Math.round(item.value)}`);
    const contributionText = contributions.length
      ? `Impactos mais frequentes: ${contributions.join(' · ')}.`
      : 'Impactos diversificados entre os indicadores.';
    const balanceDescription =
      positivityPct >= 60
        ? 'O volume de impactos positivos mostra que as escolhas têm peso real nos indicadores.'
        : positivityPct <= 40
        ? 'Os efeitos negativos dominam, indicando decisões mais duras para a população.'
        : 'Impactos positivos e negativos estão equilibrados, sugerindo escolhas ponderadas.';

    return `<div class="final-summary__audit">
      <p class="final-summary__audit-title">Avaliação da pontuação</p>
      <p class="final-summary__audit-text">
        Média de ${averageImpact} pontos por decisão com ${impactAudit.choices} escolhas consideradas.
        ${balanceDescription}
      </p>
      <div class="final-summary__audit-stats">
        <span>Positivos ${positivityPct}%</span>
        <span>Negativos ${negativePct}%</span>
      </div>
      <p class="final-summary__audit-note">${contributionText}</p>
    </div>`;
  }

  function buildFinalComparisonHtml(currentMetrics, previousSession) {
    const hasHistory = Boolean(previousSession && previousSession.metrics);
    const previousMetrics = hasHistory ? previousSession.metrics : null;
    let improvedCount = 0;
    let worsenedCount = 0;
    let stableCount = 0;

    const rows = FINAL_METRICS.map((metric) => {
      const current = safeNumber(currentMetrics[metric.key], 0);
      const valueText = metric.format(current);

      if (!hasHistory) {
        return `<div class="final-row final-row--first-time">
          <span class="final-row__label">${metric.label}</span>
          <span class="final-row__value">${valueText}</span>
          <div class="final-row__delta-cell">
            <span class="final-row__status final-row__status--neutral">Primeira vez</span>
          </div>
        </div>`;
      }

      const baseline = safeNumber(previousMetrics[metric.key], 0);
      const delta = formatDeltaForMetric(metric, current, baseline);
      const statusLabel = delta.diff > 0 ? 'Bom' : delta.diff < 0 ? 'Ruim' : 'Estável';
      const statusTone =
        delta.diff > 0 ? 'positive' : delta.diff < 0 ? 'negative' : 'neutral';

      if (delta.diff > 0) improvedCount += 1;
      else if (delta.diff < 0) worsenedCount += 1;
      else stableCount += 1;

      const toneClass = delta.diff > 0 ? "final-row--positive" : delta.diff < 0 ? "final-row--negative" : "final-row--neutral";
      return `<div class="final-row ${toneClass}">
        <span class="final-row__label">${metric.label}</span>
        <span class="final-row__value">${valueText}</span>
        <div class="final-row__delta-cell">
          <span class="${delta.className}">${delta.text}</span>
          <span class="final-row__status final-row__status--${statusTone}">${statusLabel}</span>
        </div>
      </div>`;
    }).join('');
    const header = roundsRange ? `Rounds ${roundsRange.start} → ${roundsRange.end}` : 'Resultado final';
    const hintText = hasHistory
      ? `Resumo: ${improvedCount} melhorou(s), ${worsenedCount} piorou(aram) e ${stableCount} ficou(aram) estável(is).`
      : 'Primeira vez jogando: os indicadores mostram apenas esta rodada.';
    const totalCompared = hasHistory ? Math.max(1, improvedCount + worsenedCount + stableCount) : 1;
    const performancePct = hasHistory ? Math.round((improvedCount / totalCompared) * 100) : 50;
    const performanceLabel = hasHistory
      ? performancePct >= 70
        ? "Mandato de destaque"
        : performancePct >= 45
        ? "Mandato equilibrado"
        : "Mandato em alerta"
      : "Primeiro resultado registrado";

    const currentName = state.playerName || 'Você';
    const previousName = previousSession?.name || 'sessão anterior';
    const currentScore = computeSessionScore(currentMetrics);
    const previousScore = hasHistory ? computeSessionScore(previousMetrics) : null;
    const scoreDifference = hasHistory ? Math.abs(currentScore - previousScore) : null;
    const comparisonSummary = hasHistory
      ? `<p class="final-summary__name-comparison">
          Comparação: ${currentName} (${currentScore} pts) vs ${previousName} (${previousScore} pts).
          ${scoreDifference === 0 ? 'Desempenho equivalente entre os mandatos.' : `${currentScore >= previousScore ? currentName : previousName} liderou por ${scoreDifference} pontos.`}
        </p>`
      : `<p class="final-summary__name-comparison">
          ${currentName} registrou seu primeiro mandato. Volte para comparar com outros nomes.
        </p>`;

    return `<div class="final-summary">
      <div class="final-summary__header">
        <p class="final-summary__title">Mandato encerrado</p>
        <p class="final-summary__subtitle">${header}</p>
      </div>
      ${comparisonSummary}
      <div class="final-summary__score">
        <div class="final-summary__score-label">${performanceLabel}</div>
        <div class="final-summary__score-track">
          <span class="final-summary__score-fill" style="width:${performancePct}%"></span>
        </div>
      </div>
      <div class="final-summary__body">
        ${rows}
      </div>
      ${buildImpactAuditHtml()}
      <p class="final-summary__hint">${hintText}</p>
    </div>`;
  }

  function showFinalSummaryModal() {
    const currentSnapshot = captureTrackedMetrics();
    const previousSession = lastSessionMetrics;

    modalOpen({
      title: 'Resultado final',
      html: buildFinalComparisonHtml(currentSnapshot, previousSession),
      buttons: [{
        text: 'Fechar',
        tone: 'green',
        onClick: () => {
          setTimeout(() => {
            showCreditsScreen();
          }, 160);
        },
      }],
    });

    persistLastSessionMetrics(state.playerName, currentSnapshot);
    lastSessionMetrics = {
      name: state.playerName,
      metrics: currentSnapshot,
    };
  }

  function maybeTriggerFinalSummary() {
    if (!roundsRange || finalSummaryShown) return;
    if (state.round > roundsRange.end) {
      finalSummaryShown = true;
      showFinalSummaryModal();
    }
  }

  function definirRounds(start, end) {
    const minRound = Math.max(1, Math.trunc(safeNumber(start, 1)));
    const maxRound = Math.max(minRound, Math.trunc(safeNumber(end, minRound)));
    roundsRange = { start: minRound, end: maxRound };
    resetImpactAudit();
    finalSummaryShown = false;
    state.round = minRound;
    renderHud();
    return roundsRange;
  }

  function setRound(value) {
    state.round = Math.max(0, Math.trunc(safeNumber(value, 0)));
    renderHud();
    maybeTriggerFinalSummary();
    return state.round;
  }

  function nextRound() {
    return setRound(state.round + 1);
  }

  function setPlayerName(value) {
    state.playerName = String(value == null ? "" : value).trim() || "Prefeito";
    renderHud();
    return state.playerName;
  }

  function getPlayerName() {
    return state.playerName;
  }

  function setQuestion(text) {
    state.question = String(text == null ? "" : text);
    renderHud();
    return state.question;
  }

  function setBackgroundImage(url) {
    ensureDom();
    if (!dom.root) return;

    if (!url) {
      dom.root.style.backgroundImage = "";
      return;
    }

    dom.root.style.backgroundImage = `url('${String(url)}')`;
  }

  function setBackgroundAuto() {
    setBackgroundImage(null);
  }

  function normalizeOptionIndex(index) {
    const idx = Math.trunc(safeNumber(index, 0));
    if (idx < 1 || idx > 3) throw new Error("Opção inválida: use 1, 2 ou 3");
    return idx - 1;
  }

  function setOptionText(index, text) {
    const i = normalizeOptionIndex(index);
    state.options[i].text = String(text == null ? "" : text);
    renderHud();
    return state.options[i].text;
  }

  function setOptionEnabled(index, enabled) {
    const i = normalizeOptionIndex(index);
    state.options[i].enabled = Boolean(enabled);
    renderHud();
    return state.options[i].enabled;
  }

  function setOptionVisible(index, visible) {
    const i = normalizeOptionIndex(index);
    state.options[i].visible = Boolean(visible);
    renderHud();
    return state.options[i].visible;
  }

  function setOptionTone(index, tone) {
    ensureDom();
    const i = normalizeOptionIndex(index);

    const normalized = String(tone || "").toLowerCase();
    const finalTone = normalized === "green" || normalized === "blue" || normalized === "red" ? normalized : "blue";

    const optDom = dom.options[i];
    if (optDom && optDom.button) {
      optDom.button.classList.remove("game-btn--green", "game-btn--blue", "game-btn--red");
      optDom.button.classList.add(`game-btn--${finalTone}`);
    }

    state.options[i].tone = finalTone;
  }

  function setOptionAction(index, handler) {
    const i = normalizeOptionIndex(index);
    state.optionHandlers[i] = typeof handler === "function" ? handler : null;
  }

  function setOptions(options) {
    if (!Array.isArray(options)) throw new Error("setOptions espera um array com 3 opções");

    for (let i = 0; i < 3; i += 1) {
      const item = options[i];
      if (!item) continue;

      if (Object.prototype.hasOwnProperty.call(item, "text")) setOptionText(i + 1, item.text);
      if (Object.prototype.hasOwnProperty.call(item, "enabled")) setOptionEnabled(i + 1, item.enabled);
      if (Object.prototype.hasOwnProperty.call(item, "visible")) setOptionVisible(i + 1, item.visible);
      if (Object.prototype.hasOwnProperty.call(item, "tone")) setOptionTone(i + 1, item.tone);
      if (Object.prototype.hasOwnProperty.call(item, "onClick")) setOptionAction(i + 1, item.onClick);
    }
  }

  function setOptionTexts(option1, option2, option3) {
    setOptionText(1, option1);
    setOptionText(2, option2);
    setOptionText(3, option3);
  }

  function setQuestionAndOptions(question, option1, option2, option3) {
    setQuestion(question);
    setOptionTexts(option1, option2, option3);
  }




  function setPergunta(pergunta, respostas) {
    // Compatível com o antigo `setPergunta(texto)`
    setQuestion(pergunta);

    // Evita travar um await antigo se você chamar setpergunta novamente
    cancelPendingPergunta({ cancelled: true, reason: 'replaced', state: getState() });

    if (!Array.isArray(respostas)) {
      return Promise.resolve(state.question);
    }

    pendingPerguntaSeq += 1;
    const perguntaId = pendingPerguntaSeq;

    let resolveFn = null;
    const promise = new Promise((resolve) => {
      resolveFn = resolve;
    });

    pendingPergunta = { id: perguntaId, resolve: resolveFn, done: false };

    let anyVisible = false;

    for (let i = 1; i <= 3; i += 1) {
      const raw = respostas[i - 1];

      if (!raw) {
        setOptionVisible(i, false);
        setOptionEnabled(i, false);
        setOptionAction(i, null);
        continue;
      }

      const answer = typeof raw === 'object' ? raw : { text: String(raw) };

      let buttonText = '';
      if (Object.prototype.hasOwnProperty.call(answer, 'text') && answer.text != null) buttonText = answer.text;
      else if (Object.prototype.hasOwnProperty.call(answer, 'texto') && answer.texto != null) buttonText = answer.texto;
      else if (Object.prototype.hasOwnProperty.call(answer, 'label') && answer.label != null) buttonText = answer.label;
      else if (Object.prototype.hasOwnProperty.call(answer, 'titulo') && answer.titulo != null) buttonText = answer.titulo;

      setOptionText(i, buttonText);

      const enabledNow = Object.prototype.hasOwnProperty.call(answer, 'enabled') ? Boolean(answer.enabled) : true;
      setOptionEnabled(i, enabledNow);

      const visibleNow = Object.prototype.hasOwnProperty.call(answer, 'visible') ? Boolean(answer.visible) : true;
      setOptionVisible(i, visibleNow);
      if (visibleNow) anyVisible = true;

      let tone = null;
      if (Object.prototype.hasOwnProperty.call(answer, 'tone') && answer.tone != null) tone = answer.tone;
      else if (Object.prototype.hasOwnProperty.call(answer, 'cor') && answer.cor != null) tone = answer.cor;
      else if (Object.prototype.hasOwnProperty.call(answer, 'color') && answer.color != null) tone = answer.color;

      if (tone != null) setOptionTone(i, tone);

      let action = null;
      if (Object.prototype.hasOwnProperty.call(answer, 'onSelect')) action = answer.onSelect;
      else if (Object.prototype.hasOwnProperty.call(answer, 'onClick')) action = answer.onClick;
      else if (Object.prototype.hasOwnProperty.call(answer, 'acao')) action = answer.acao;
      else if (Object.prototype.hasOwnProperty.call(answer, 'action')) action = answer.action;

      setOptionAction(i, (ctx) => {
        if (!pendingPergunta || pendingPergunta.id !== perguntaId || pendingPergunta.done) return;

        // Trava múltiplos cliques
        pendingPergunta.done = true;

        // Desabilita todos para feedback imediato
        setOptionEnabled(1, false);
        setOptionEnabled(2, false);
        setOptionEnabled(3, false);

        const ctxWithAnswer = Object.assign({}, ctx, { answer });

        function finish(extra) {
          resolvePergunta(perguntaId, Object.assign({}, ctxWithAnswer, extra || {}));
        }

        if (typeof action !== 'function') {
          finish();
          return;
        }

        let result;
        try {
          result = action(ctxWithAnswer);
        } catch (err) {
          console.error(err);
          finish({ error: err });
          return;
        }

        Promise.resolve(result).then(
          () => finish(),
          (err) => {
            console.error(err);
            finish({ error: err });
          },
        );
      });
    }

    if (!anyVisible) {
      resolvePergunta(perguntaId, { cancelled: true, reason: 'no_answers', state: getState() });
    } else {
      // Reabilita caso o usuário só esteja configurando a tela sem clicar ainda
      // (o disable só acontece no clique)
      setOptionEnabled(1, state.options[0].enabled);
      setOptionEnabled(2, state.options[1].enabled);
      setOptionEnabled(3, state.options[2].enabled);
    }

    return promise;
  }



  function setAll(payload) {
    if (!payload || typeof payload !== "object") return getState();

    if (Object.prototype.hasOwnProperty.call(payload, "money")) setMoney(payload.money);
    if (Object.prototype.hasOwnProperty.call(payload, "popularity")) setPopularity(payload.popularity);
    if (Object.prototype.hasOwnProperty.call(payload, "health")) setHealth(payload.health);
    if (Object.prototype.hasOwnProperty.call(payload, "education")) setEducation(payload.education);
    if (Object.prototype.hasOwnProperty.call(payload, "food")) setFood(payload.food);
    if (Object.prototype.hasOwnProperty.call(payload, "housing")) setHousing(payload.housing);
    if (Object.prototype.hasOwnProperty.call(payload, "employment")) setEmployment(payload.employment);
    if (Object.prototype.hasOwnProperty.call(payload, "wellbeing")) setWellbeing(payload.wellbeing);
    if (Object.prototype.hasOwnProperty.call(payload, "round")) setRound(payload.round);
    if (Object.prototype.hasOwnProperty.call(payload, "question")) setQuestion(payload.question);
    if (Object.prototype.hasOwnProperty.call(payload, "options")) setOptions(payload.options);
    if (Object.prototype.hasOwnProperty.call(payload, "background")) setBackgroundImage(payload.background);

    return getState();
  }

  function notify(text, options) {
    ensureDom();

    const opts = options && typeof options === "object" ? options : {};
    const type = String(opts.type || "info").toLowerCase();
    // Notificações somem rápido demais e confundem; usa padrão mais longo.
    const duration = Math.max(0, Math.trunc(safeNumber(opts.duration, 4500)));

    const id = state.notifications.nextId;
    state.notifications.nextId += 1;

    if (!dom.toastRoot) return id;

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.dataset.toastId = String(id);

    const textEl = document.createElement("span");
    textEl.className = "toast__text";
    textEl.textContent = String(text == null ? "" : text);

    toast.appendChild(textEl);
    dom.toastRoot.appendChild(toast);

    if (duration > 0) {
      const timer = window.setTimeout(() => {
        removeNotification(id);
      }, duration);
      state.notifications.timers[String(id)] = timer;
    }

    return id;
  }

  function removeNotification(id) {
    ensureDom();

    const key = String(id);
    const timer = state.notifications.timers[key];
    if (timer) {
      window.clearTimeout(timer);
      delete state.notifications.timers[key];
    }

    if (!dom.toastRoot) return;

    const el = dom.toastRoot.querySelector(`[data-toast-id='${key}']`);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function clearNotifications() {
    ensureDom();

    const keys = Object.keys(state.notifications.timers);
    for (let i = 0; i < keys.length; i += 1) {
      window.clearTimeout(state.notifications.timers[keys[i]]);
    }
    state.notifications.timers = {};

    clearChildren(dom.toastRoot);
  }

  function modalOpen(options) {
    ensureDom();
    setupEventsOnce();

    const opts = options && typeof options === "object" ? options : {};
    const title = Object.prototype.hasOwnProperty.call(opts, "title") ? opts.title : "Modal";

    if (dom.overlay.generic.title) {
      setText(dom.overlay.generic.title, title);
    }

    if (dom.overlay.generic.body) {
      if (Object.prototype.hasOwnProperty.call(opts, "html")) {
        dom.overlay.generic.body.innerHTML = String(opts.html == null ? "" : opts.html);
      } else {
        dom.overlay.generic.body.textContent = String(opts.text == null ? "" : opts.text);
      }
    }

    clearChildren(dom.overlay.generic.actions);

    const buttons = Array.isArray(opts.buttons) ? opts.buttons : [];
    for (let i = 0; i < buttons.length; i += 1) {
      const b = buttons[i] || {};
      const btn = document.createElement("button");
      const tone = String(b.tone || "blue").toLowerCase();

      btn.type = "button";
      btn.className = "modal-btn";
      if (tone === "green") btn.classList.add("modal-btn--green");
      if (tone === "red") btn.classList.add("modal-btn--red");

      btn.textContent = String(b.text == null ? "OK" : b.text);

      btn.addEventListener("click", () => {
        if (typeof b.onClick === "function") {
          b.onClick({ state: getState() });
        }
        if (b.close !== false) {
          modalClose();
        }
      });

      if (dom.overlay.generic.actions) dom.overlay.generic.actions.appendChild(btn);
    }

    overlayShow("generic");
  }

  function modalClose() {
    closeAnyModal();
  }

  const SPLASH_HOLD_DEFAULT_MS = 1100;
  const SPLASH_HOLD_MIN_MS = 0;
  const SPLASH_HOLD_MAX_MS = 30000;

  const SPLASH_TEXT_IN_MS = 320;
  const SPLASH_TEXT_OUT_MS = 260;
  const SPLASH_BG_OUT_MS = 380;

  let splashToken = 0;
  let splashWaitTimer = 0;
  let splashWaitResolve = null;
  let splashHideTimer = 0;
  let splashActive = null;

  function splashIsOpen() {
    ensureDom();
    if (!dom.splash || !dom.splash.root) return false;
    return dom.splash.root.dataset.open === "1";
  }

  function splashClearWait() {
    if (splashWaitTimer) {
      clearTimeout(splashWaitTimer);
      splashWaitTimer = 0;
    }

    if (splashWaitResolve) {
      const resolve = splashWaitResolve;
      splashWaitResolve = null;
      try {
        resolve();
      } catch (_) {
        // ignore
      }
    }
  }

  function splashWait(ms) {
    splashClearWait();

    const duration = Math.max(0, Math.trunc(safeNumber(ms, 0)));

    return new Promise((resolve) => {
      splashWaitResolve = resolve;
      splashWaitTimer = setTimeout(() => {
        splashWaitTimer = 0;
        splashWaitResolve = null;
        resolve();
      }, duration);
    });
  }

  function splashFinish(payload) {
    if (!splashActive) return;

    const resolver = splashActive.resolve;
    splashActive = null;

    try {
      resolver(payload);
    } catch (_) {
      // ignore
    }
  }

  function splashShowRoot() {
    ensureDom();
    if (!dom.splash || !dom.splash.root) return;

    if (splashHideTimer) {
      clearTimeout(splashHideTimer);
      splashHideTimer = 0;
    }

    setHidden(dom.splash.root, false);

    dom.splash.root.dataset.open = "1";
    dom.splash.root.dataset.phase = "hide";
    dom.splash.root.setAttribute("aria-hidden", "false");
  }

  function hideSplash(payload) {
    ensureDom();

    splashToken += 1;
    const token = splashToken;

    splashClearWait();

    if (splashHideTimer) {
      clearTimeout(splashHideTimer);
      splashHideTimer = 0;
    }

    if (dom.splash && dom.splash.root) {
      dom.splash.root.dataset.phase = "hide";
      dom.splash.root.dataset.open = "0";
      dom.splash.root.setAttribute("aria-hidden", "true");

      splashHideTimer = setTimeout(() => {
        if (token != splashToken) return;
        setHidden(dom.splash.root, true);
      }, SPLASH_BG_OUT_MS);
    }

    splashFinish(payload);
  }

  function normalizeSplashSequence(sequence) {
    const raw = Array.isArray(sequence) ? sequence : [sequence];
    const out = [];

    raw.forEach((item) => {
      if (item == null) return;

      if (typeof item === "string" || typeof item === "number") {
        const textValue = String(item);
        if (textValue.trim()) out.push({ text: textValue, duration: null });
        return;
      }

      if (typeof item === "object") {
        const textRaw = Object.prototype.hasOwnProperty.call(item, "text")
          ? item.text
          : Object.prototype.hasOwnProperty.call(item, "nome")
          ? item.nome
          : Object.prototype.hasOwnProperty.call(item, "title")
          ? item.title
          : Object.prototype.hasOwnProperty.call(item, "name")
          ? item.name
          : "";

        const textValue = String(textRaw == null ? "" : textRaw);
        const hasText = textValue.trim().length > 0;

        const imageRaw = Object.prototype.hasOwnProperty.call(item, "image")
          ? item.image
          : Object.prototype.hasOwnProperty.call(item, "logo")
          ? item.logo
          : Object.prototype.hasOwnProperty.call(item, "src")
          ? item.src
          : null;
        const imageValue = imageRaw == null ? "" : String(imageRaw);
        const imageUrl = imageValue.trim();
        const hasImage = imageUrl.length > 0;

        if (!hasText && !hasImage) return;

        const durationRaw = Object.prototype.hasOwnProperty.call(item, "duration")
          ? item.duration
          : Object.prototype.hasOwnProperty.call(item, "ms")
          ? item.ms
          : Object.prototype.hasOwnProperty.call(item, "tempo")
          ? item.tempo
          : null;

        const step = { text: hasText ? textValue : "", duration: durationRaw };
        if (hasImage) step.image = imageUrl;
        out.push(step);
      }
    });

    return out;
  }

  function showSplash(sequence, options) {
    ensureDom();
    setupEventsOnce();

    const steps = normalizeSplashSequence(sequence);

    if (!steps.length) {
      hideSplash({ reason: "empty" });
      return Promise.resolve();
    }

    const opts = options && typeof options === "object" ? options : {};

    const holdDefault = Math.min(
      SPLASH_HOLD_MAX_MS,
      Math.max(SPLASH_HOLD_MIN_MS, Math.trunc(safeNumber(opts.duration, SPLASH_HOLD_DEFAULT_MS)))
    );
    const fadeIn = Math.max(0, Math.trunc(safeNumber(opts.fadeIn, SPLASH_TEXT_IN_MS)));
    const fadeOut = Math.max(0, Math.trunc(safeNumber(opts.fadeOut, SPLASH_TEXT_OUT_MS)));

    if (splashActive) {
      hideSplash({ reason: "replaced" });
    }

    splashToken += 1;
    const token = splashToken;

    splashShowRoot();

    if (dom.splash && dom.splash.text) dom.splash.text.textContent = "";
    if (dom.splash && dom.splash.root) dom.splash.root.dataset.phase = "hide";

    const promise = new Promise((resolve) => {
      splashActive = { token, resolve };
    });

    (async () => {
      try {
        await splashWait(30);
        if (token != splashToken) return;

        for (let i = 0; i < steps.length; i += 1) {
          if (token != splashToken) return;

          const step = steps[i];

          if (dom.splash) {
            if (dom.splash.text) {
              const textValue = String(step.text == null ? "" : step.text);
              setText(dom.splash.text, textValue);
              setHidden(dom.splash.text, textValue.trim().length === 0);
            }

            if (dom.splash.logo) {
              const logoEl = dom.splash.logo;
              if (logoEl) {
                if (step.image) {
                  logoEl.dataset.loaded = "0";
                  logoEl.setAttribute("src", step.image);
                  setHidden(logoEl, false);
                } else {
                  logoEl.removeAttribute("src");
                  setHidden(logoEl, true);
                }
              }
            }
          }

          if (dom.splash && dom.splash.root) dom.splash.root.dataset.phase = "show";

          await splashWait(fadeIn);
          if (token != splashToken) return;

          let hold = holdDefault;
          if (step && step.duration != null) {
            hold = safeNumber(step.duration, holdDefault);
          }
          hold = Math.min(SPLASH_HOLD_MAX_MS, Math.max(SPLASH_HOLD_MIN_MS, Math.trunc(hold)));

          await splashWait(hold);
          if (token != splashToken) return;

          if (dom.splash && dom.splash.root) dom.splash.root.dataset.phase = "hide";
          await splashWait(fadeOut);
        }

        if (token != splashToken) return;
        hideSplash({ reason: "done" });
      } catch (_) {
        hideSplash({ reason: "error" });
      }
    })();

    return promise;
  }

  let nativeAlert = typeof window.alert === "function" ? window.alert.bind(window) : null;
  let nativePrompt = typeof window.prompt === "function" ? window.prompt.bind(window) : null;
  let dialogsInterceptInstalled = false;

  let dialogQueue = Promise.resolve();
  let pendingDialog = null; // { type: 'alert'|'prompt', resolve: fn }

  function queueDialog(task) {
    const run = dialogQueue.then(() => task());
    dialogQueue = run.catch(() => {});
    return run;
  }

  function dialogResolve(value) {
    if (!pendingDialog || typeof pendingDialog.resolve !== "function") return;

    const resolver = pendingDialog.resolve;
    pendingDialog = null;

    try {
      resolver(value);
    } catch (_) {
      // ignore
    }
  }

  function dialogCancelPending() {
    if (!pendingDialog) return;

    const type = pendingDialog.type;
    dialogResolve(type === "prompt" ? null : undefined);
  }

  function dialogPrepareGeneric(title) {
    ensureDom();
    setupEventsOnce();

    if (state.overlay.open) {
      closeAnyModal();
    }

    if (dom.overlay.generic.title) {
      setText(dom.overlay.generic.title, title);
    }

    clearChildren(dom.overlay.generic.body);
    clearChildren(dom.overlay.generic.actions);
  }

  function dialogAlert(text, options) {
    const msg = String(text == null ? "" : text);
    const opts = options && typeof options === "object" ? options : {};

    const title = Object.prototype.hasOwnProperty.call(opts, "title") ? opts.title : "Aviso";
    const okText = Object.prototype.hasOwnProperty.call(opts, "okText") ? opts.okText : "OK";
    const tone = String(Object.prototype.hasOwnProperty.call(opts, "tone") ? opts.tone : "blue").toLowerCase();

    return queueDialog(() => {
      dialogPrepareGeneric(title);

      if (dom.overlay.generic.body) {
        dom.overlay.generic.body.textContent = msg;
      }

      const okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "modal-btn";
      if (tone === "green") okBtn.classList.add("modal-btn--green");
      if (tone === "red") okBtn.classList.add("modal-btn--red");
      okBtn.textContent = String(okText == null ? "OK" : okText);

      return new Promise((resolve) => {
        pendingDialog = { type: "alert", resolve };

        okBtn.addEventListener("click", () => {
          dialogResolve(undefined);
          closeAnyModal();
        });

        if (dom.overlay.generic.actions) dom.overlay.generic.actions.appendChild(okBtn);

        overlayShow("generic");

        setTimeout(() => {
          try {
            okBtn.focus();
          } catch (_) {
            // ignore
          }
        }, 0);
      });
    });
  }

  function dialogPrompt(text, defaultValue, options) {
    const msg = String(text == null ? "" : text);
    const def = String(defaultValue == null ? "" : defaultValue);
    const opts = options && typeof options === "object" ? options : {};

    const title = Object.prototype.hasOwnProperty.call(opts, "title") ? opts.title : "Digite";
    const okText = Object.prototype.hasOwnProperty.call(opts, "okText") ? opts.okText : "OK";
    const cancelText = Object.prototype.hasOwnProperty.call(opts, "cancelText") ? opts.cancelText : "Cancelar";

    return queueDialog(() => {
      dialogPrepareGeneric(title);

      const wrap = document.createElement("div");
      wrap.className = "prompt";

      const msgEl = document.createElement("div");
      msgEl.className = "prompt__message";
      msgEl.textContent = msg;

      const input = document.createElement("input");
      input.className = "prompt__input";
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.value = def;

      wrap.appendChild(msgEl);
      wrap.appendChild(input);

      if (dom.overlay.generic.body) dom.overlay.generic.body.appendChild(wrap);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "modal-btn modal-btn--red";
      cancelBtn.textContent = String(cancelText == null ? "Cancelar" : cancelText);

      const okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "modal-btn modal-btn--green";
      okBtn.textContent = String(okText == null ? "OK" : okText);

      return new Promise((resolve) => {
        pendingDialog = { type: "prompt", resolve };

        function onCancel() {
          dialogResolve(null);
          closeAnyModal();
        }

        function onOk() {
          dialogResolve(String(input.value == null ? "" : input.value));
          closeAnyModal();
        }

        cancelBtn.addEventListener("click", onCancel);
        okBtn.addEventListener("click", onOk);

        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onOk();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        });

        if (dom.overlay.generic.actions) {
          dom.overlay.generic.actions.appendChild(cancelBtn);
          dom.overlay.generic.actions.appendChild(okBtn);
        }

        overlayShow("generic");

        setTimeout(() => {
          try {
            input.focus();
            input.select();
          } catch (_) {
            // ignore
          }
        }, 0);
      });
    });
  }

  function installDialogInterceptors() {
    if (dialogsInterceptInstalled) return;
    dialogsInterceptInstalled = true;

    window.alert = (message) => {
      return dialogAlert(message);
    };

    window.prompt = (message, defaultVal) => {
      return dialogPrompt(message, defaultVal);
    };
  }

  function restoreDialogInterceptors() {
    if (!dialogsInterceptInstalled) return;
    dialogsInterceptInstalled = false;

    if (typeof nativeAlert === "function") window.alert = nativeAlert;
    if (typeof nativePrompt === "function") window.prompt = nativePrompt;
  }

  function normalizeSceneOptions(options) {
    if (typeof options === "string") return { caption: options };
    if (options && typeof options === "object") return options;
    return {};
  }

  function sceneSetTitle(title) {
    state.scene.title = String(title == null ? "" : title) || "Cena";
    renderSceneModal();
    return state.scene.title;
  }

  function sceneSetImage(url) {
    state.scene.image = String(url == null ? "" : url);
    renderSceneModal();
    return state.scene.image;
  }

  const SCENE_CAPTION_MIN_DURATION = 200;
  const SCENE_CAPTION_MAX_DURATION = 30000;

  let sceneCaptionActive = null;
  let sceneCaptionTimer = 0;

  function sceneNormalizeCaptionDuration(options) {
    if (typeof options === "number") return options;

    const opts = options && typeof options === "object" ? options : null;
    if (opts && typeof opts.duration === "number") return opts.duration;
    if (opts && typeof opts.ms === "number") return opts.ms;

    return null;
  }

  function sceneClampCaptionDuration(value) {
    const n = safeNumber(value, 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(SCENE_CAPTION_MAX_DURATION, Math.max(SCENE_CAPTION_MIN_DURATION, Math.trunc(n)));
  }

  function sceneClearCaptionTimer() {
    if (!sceneCaptionTimer) return;
    clearTimeout(sceneCaptionTimer);
    sceneCaptionTimer = 0;
  }

  function sceneResolveCaptionItem(item) {
    if (!item || typeof item.resolve !== "function") return;

    try {
      item.resolve();
    } catch (_) {
      // ignore
    }
  }

  function sceneSetActiveCaption(text) {
    state.scene.caption = text == null ? null : String(text);
    renderSceneModal();
  }

  function sceneSetLegenda(text, options) {
    const msg = String(text == null ? "" : text);

    sceneClearCaptionTimer();

    const prev = sceneCaptionActive;
    sceneCaptionActive = null;
    sceneResolveCaptionItem(prev);

    if (!msg.trim()) {
      sceneSetActiveCaption(null);
      return Promise.resolve();
    }

    sceneSetActiveCaption(msg);

    const durationRaw = sceneNormalizeCaptionDuration(options);
    const duration = durationRaw == null ? 0 : sceneClampCaptionDuration(durationRaw);

    return new Promise((resolve) => {
      sceneCaptionActive = { resolve };

      if (duration > 0) {
        sceneCaptionTimer = setTimeout(() => {
          sceneCaptionTimer = 0;
          const done = sceneCaptionActive;
          sceneCaptionActive = null;

          sceneSetActiveCaption(null);
          sceneResolveCaptionItem(done);
        }, duration);
      }
    });
  }

  function sceneAppendLegenda(text, options) {
    return sceneSetLegenda(text, options);
  }

  function sceneSetLegendas(payload, options) {
    const data = payload;

    sceneClearLegendas();

    if (Array.isArray(data)) {
      let chain = Promise.resolve();

      data.forEach((item) => {
        if (typeof item === "string" || typeof item === "number") {
          chain = chain.then(() => sceneSetLegenda(item, options));
          return;
        }

        const it = item && typeof item === "object" ? item : {};
        const text = Object.prototype.hasOwnProperty.call(it, "text") ? it.text : it.legenda;
        const dur = Object.prototype.hasOwnProperty.call(it, "duration") ? it.duration : options;

        chain = chain.then(() => sceneSetLegenda(text, dur));
      });

      return chain;
    }

    return sceneSetLegenda(data, options);
  }

  function sceneClearLegendas() {
    sceneClearCaptionTimer();

    const active = sceneCaptionActive;
    sceneCaptionActive = null;

    sceneSetActiveCaption(null);
    sceneResolveCaptionItem(active);
  }

  function sceneOpen(imageUrl, options) {
    ensureDom();
    setupEventsOnce();

    const url = String(imageUrl == null ? "" : imageUrl);
    if (!url.trim()) {
      sceneClose();
      return null;
    }

    const opts = normalizeSceneOptions(options);

    if (Object.prototype.hasOwnProperty.call(opts, "title")) {
      sceneSetTitle(opts.title);
    } else if (!state.scene.title) {
      sceneSetTitle("Cena");
    }

    const keepCaptions = opts && (opts.clearCaptions === false || opts.manterLegendas === true);
    if (!keepCaptions) sceneClearLegendas();

    sceneSetImage(url);

    overlayShow("scene");

    const caption = Object.prototype.hasOwnProperty.call(opts, "caption")
      ? opts.caption
      : Object.prototype.hasOwnProperty.call(opts, "legenda")
      ? opts.legenda
      : null;

    if (caption != null && String(caption).trim()) {
      sceneSetLegenda(caption, opts);
    }

    if (typeof state.handlers.scene.onOpen === "function") {
      state.handlers.scene.onOpen({ title: state.scene.title, image: state.scene.image, state: getState() });
    }

    return state.scene.image;
  }

  function sceneClose() {
    if (state.overlay.modal === "scene") {
      closeAnyModal();
      return;
    }

    sceneClearLegendas();
  }

  function sceneOnOpen(handler) {
    state.handlers.scene.onOpen = typeof handler === "function" ? handler : null;
  }

  function sceneOnClose(handler) {
    state.handlers.scene.onClose = typeof handler === "function" ? handler : null;
  }

  function setCena(caminhoDaImagem, options) {
    return sceneOpen(caminhoDaImagem, options);
  }

  function phoneSetVisible(visible) {
    state.phone.visible = Boolean(visible);
    renderPhoneAction();
    return state.phone.visible;
  }

  function phoneSetButtonText(text) {
    state.phone.buttonText = String(text == null ? "" : text);
    renderPhoneAction();
    return state.phone.buttonText;
  }

  function phoneSetBadge(value) {
    state.phone.badge = Math.max(0, Math.trunc(safeNumber(value, 0)));
    renderPhoneAction();
    return state.phone.badge;
  }

  function phoneSetName(name) {
    state.phone.name = String(name == null ? "" : name) || "Desconhecido";
    renderPhoneModal();
    return state.phone.name;
  }

  function phoneSetStatus(status) {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "ringing" || normalized === "tocando") state.phone.status = "ringing";
    else if (normalized === "connected" || normalized === "conectado") state.phone.status = "connected";
    else state.phone.status = "idle";

    if (state.phone.status === "idle") {
      phoneClearLegendas();
      return state.phone.status;
    }

    renderPhoneModal();
    return state.phone.status;
  }

  const PHONE_CAPTION_DEFAULT_DURATION = 2200;
  const PHONE_CAPTION_MIN_DURATION = 200;
  const PHONE_CAPTION_MAX_DURATION = 30000;

  let phoneCaptionQueue = [];
  let phoneCaptionActive = null;
  let phoneCaptionTimer = 0;

  function normalizeCaptionDuration(options) {
    if (typeof options === "number") return options;

    const opts = options && typeof options === "object" ? options : null;
    if (opts && typeof opts.duration === "number") return opts.duration;
    if (opts && typeof opts.ms === "number") return opts.ms;

    return PHONE_CAPTION_DEFAULT_DURATION;
  }

  function clampCaptionDuration(value) {
    const n = safeNumber(value, PHONE_CAPTION_DEFAULT_DURATION);
    if (Math.trunc(n) === 0) return 0;
    return Math.min(PHONE_CAPTION_MAX_DURATION, Math.max(PHONE_CAPTION_MIN_DURATION, Math.trunc(n)));
  }

  function phoneClearCaptionTimer() {
    if (!phoneCaptionTimer) return;
    clearTimeout(phoneCaptionTimer);
    phoneCaptionTimer = 0;
  }

  function phoneResolveCaptionItem(item) {
    if (!item || typeof item.resolve !== "function") return;

    try {
      item.resolve();
    } catch (_) {
      // ignore
    }
  }

  function phoneSetActiveCaption(speaker, text, who) {
    if (!speaker) {
      state.phone.caption = null;
      renderPhoneModal();
      return;
    }

    state.phone.caption = {
      speaker: String(speaker),
      text: String(text == null ? "" : text),
      who: String(who == null ? "" : who),
    };
    renderPhoneModal();
  }

  function phoneStartNextCaption() {
    if (phoneCaptionActive) return;

    if (!phoneCaptionQueue.length) {
      phoneSetActiveCaption(null, "");
      state.phone.waitingAdvance = false;
      renderPhoneModal();
      return;
    }

    const next = phoneCaptionQueue.shift();
    phoneCaptionActive = next;

    phoneSetActiveCaption(next.speaker, next.text, next.who);

    const duration = clampCaptionDuration(next.duration);

    phoneClearCaptionTimer();
    state.phone.waitingAdvance = duration === 0;
    renderPhoneModal();

    if (duration === 0) {
      return;
    }
    phoneCaptionTimer = setTimeout(() => {
      const done = phoneCaptionActive;
      phoneCaptionActive = null;

      phoneSetActiveCaption(null, "");
      phoneResolveCaptionItem(done);

      phoneStartNextCaption();
    }, duration);
  }

  function phoneAdvanceCaption() {
    if (!phoneCaptionActive) return;
    if (state.phone.waitingAdvance !== true) return;

    const done = phoneCaptionActive;
    phoneCaptionActive = null;

    state.phone.waitingAdvance = false;
    phoneSetActiveCaption(null, "");
    phoneResolveCaptionItem(done);

    phoneStartNextCaption();
  }

  function phoneEnqueueCaption(speaker, text, options) {
    const msg = String(text == null ? "" : text);
    if (!msg.trim()) return Promise.resolve();

    const opts = options && typeof options === "object" ? options : null;
    const manual = Boolean(opts && (opts.manual === true || opts.avancarNoClique === true));
    const who = opts && Object.prototype.hasOwnProperty.call(opts, "who") ? String(opts.who) : "";
    const durationRaw = normalizeCaptionDuration(options);
    const duration = manual ? 0 : clampCaptionDuration(durationRaw);

    return new Promise((resolve) => {
      phoneCaptionQueue.push({ speaker, text: msg, who, duration, resolve });
      phoneStartNextCaption();
    });
  }

  function phoneSetLegendaPessoa(text, options) {
    return phoneEnqueueCaption("person", text, options);
  }

  function phoneAppendLegendaPessoa(text, options) {
    return phoneEnqueueCaption("person", text, options);
  }

  function phoneSetLegendaPrefeito(text, options) {
    return phoneEnqueueCaption("mayor", text, options);
  }

  function phoneAppendLegendaPrefeito(text, options) {
    return phoneEnqueueCaption("mayor", text, options);
  }

  function phoneSetLegendas(payload, options) {
    const data = payload;

    phoneClearLegendas();

    if (Array.isArray(data)) {
      let chain = Promise.resolve();

      data.forEach((item) => {
        const it = item && typeof item === "object" ? item : {};
        const fromRaw = String(it.from || it.who || it.speaker || "").toLowerCase();
        const speaker = fromRaw === "prefeito" || fromRaw === "mayor" ? "mayor" : "person";
        const text = Object.prototype.hasOwnProperty.call(it, "text") ? it.text : it.legenda;
        const dur = Object.prototype.hasOwnProperty.call(it, "duration") ? it.duration : options;

        chain = chain.then(() => phoneEnqueueCaption(speaker, text, dur));
      });

      return chain;
    }

    const obj = data && typeof data === "object" ? data : {};
    let chain = Promise.resolve();

    if (Object.prototype.hasOwnProperty.call(obj, "person")) {
      chain = chain.then(() => phoneEnqueueCaption("person", obj.person, options));
    } else if (Object.prototype.hasOwnProperty.call(obj, "pessoa")) {
      chain = chain.then(() => phoneEnqueueCaption("person", obj.pessoa, options));
    }

    if (Object.prototype.hasOwnProperty.call(obj, "mayor")) {
      chain = chain.then(() => phoneEnqueueCaption("mayor", obj.mayor, options));
    } else if (Object.prototype.hasOwnProperty.call(obj, "prefeito")) {
      chain = chain.then(() => phoneEnqueueCaption("mayor", obj.prefeito, options));
    }

    return chain;
  }

  function phoneClearLegendas() {
    phoneClearCaptionTimer();

    const active = phoneCaptionActive;
    phoneCaptionActive = null;
    state.phone.waitingAdvance = false;

    phoneSetActiveCaption(null, "");

    phoneResolveCaptionItem(active);

    while (phoneCaptionQueue.length) {
      phoneResolveCaptionItem(phoneCaptionQueue.shift());
    }
  }


  function phoneIncoming(name, options) {
    const opts = options && typeof options === "object" ? options : {};

    phoneClearLegendas();

    phoneSetName(name);
    phoneSetStatus("ringing");

    if (Object.prototype.hasOwnProperty.call(opts, "badge")) {
      phoneSetBadge(opts.badge);
    } else {
      phoneSetBadge(1);
    }

    if (opts.autoOpen) {
      phoneOpen();
    }
  }

  function phoneOpen() {
    ensureDom();
    setupEventsOnce();

    overlayShow("phone");
    renderPhoneAction();

    if (typeof state.handlers.phone.onOpen === "function") {
      state.handlers.phone.onOpen({ name: state.phone.name, status: state.phone.status, state: getState() });
    }
  }

  function phoneClose() {
    closeAnyModal();
  }

  function phoneOnCall(handler) {
    state.handlers.phone.onCall = typeof handler === "function" ? handler : null;
  }

  function phoneOnHang(handler) {
    state.handlers.phone.onHang = typeof handler === "function" ? handler : null;
  }

  function phoneOnOpen(handler) {
    state.handlers.phone.onOpen = typeof handler === "function" ? handler : null;
  }

  function phoneOnClose(handler) {
    state.handlers.phone.onClose = typeof handler === "function" ? handler : null;
  }

  function phoneCall() {
    if (state.phone.status === "connected") return;

    phoneSetStatus("connected");
    phoneSetBadge(0);

    if (typeof state.handlers.phone.onCall === "function") {
      state.handlers.phone.onCall({ name: state.phone.name, status: state.phone.status, state: getState() });
    }
  }

  function phoneHang() {
    if (state.phone.status === "idle") {
      phoneClearLegendas();
      phoneClose();
      return;
    }

    phoneSetStatus("idle");
    phoneSetBadge(0);

    if (typeof state.handlers.phone.onHang === "function") {
      state.handlers.phone.onHang({ name: state.phone.name, status: state.phone.status, state: getState() });
    }

    phoneClose();
  }

  function bootstrap(initialState) {
    ensureDom();
    setupEventsOnce();

    if (initialState) setAll(initialState);

    renderHud();
    renderPhoneAction();
    renderPhoneModal();
  }

  const api = {
    bootstrap,
    getState,
    setAll,

    setMoney,
    addMoney,
    setPopularity,
    addPopularity,
    setHealth,
    addHealth,
    setEducation,
    addEducation,
    setFood,
    addFood,
    setHousing,
    addHousing,
    setEmployment,
    addEmployment,
    setWellbeing,
    addWellbeing,
    setRound,
    nextRound,
    definirRounds,
    setPlayerName,
    getPlayerName,
    trackImpact: logImpact,

    setQuestion,
    setBackgroundImage,
    setBackgroundAuto,

    setOptionText,
    setOptionEnabled,
    setOptionVisible,
    setOptionTone,
    setOptionAction,
    setOptions,

    setOptionTexts,
    setQuestionAndOptions,

    notify,
    removeNotification,
    clearNotifications,

    modalOpen,
    modalClose,

    showSplash,
    hideSplash,

    dialogs: {
      alert: dialogAlert,
      prompt: dialogPrompt,
      install: installDialogInterceptors,
      restore: restoreDialogInterceptors,
      native: {
        alert: nativeAlert,
        prompt: nativePrompt,
      },
    },

    setCena,
    fecharCena: sceneClose,

    scene: {
      open: sceneOpen,
      close: sceneClose,
      setCaption: sceneSetLegenda,
      appendCaption: sceneAppendLegenda,
      setCaptions: sceneSetLegendas,
      clearCaptions: sceneClearLegendas,
      onOpen: sceneOnOpen,
      onClose: sceneOnClose,
    },

    phone: {
      setVisible: phoneSetVisible,
      setButtonText: phoneSetButtonText,
      setBadge: phoneSetBadge,
      setName: phoneSetName,
      setStatus: phoneSetStatus,
      setPersonCaption: phoneSetLegendaPessoa,
      appendPersonCaption: phoneAppendLegendaPessoa,
      setMayorCaption: phoneSetLegendaPrefeito,
      appendMayorCaption: phoneAppendLegendaPrefeito,
      setCaptions: phoneSetLegendas,
      clearCaptions: phoneClearLegendas,
      incoming: phoneIncoming,
      open: phoneOpen,
      close: phoneClose,
      onCall: phoneOnCall,
      onHang: phoneOnHang,
      onOpen: phoneOnOpen,
      onClose: phoneOnClose,
      call: phoneCall,
      hang: phoneHang,
    },

    // Aliases PT-BR (HUD)
    setDinheiro: setMoney,
    addDinheiro: addMoney,
    setPopularidade: setPopularity,
    addPopularidade: addPopularity,
    setSaude: setHealth,
    addSaude: addHealth,
    setEducacao: setEducation,
    addEducacao: addEducation,
    setAlimentacao: setFood,
    addAlimentacao: addFood,
    setMoradia: setHousing,
    addMoradia: addHousing,
    setEmprego: setEmployment,
    addEmprego: addEmployment,
    setBemEstar: setWellbeing,
    addBemEstar: addWellbeing,
    setRoundAtual: setRound,
    proximoRound: nextRound,
    setPergunta,
    setpergunta: setPergunta,
    // Aliases PT-BR (Fundo)
    setFundo: setBackgroundImage,
    setFundoAuto: setBackgroundAuto,

    // Aliases PT-BR (Textos)
    setTextosOpcoes: setOptionTexts,
    setPerguntaEOpcoes: setQuestionAndOptions,

    // Aliases PT-BR (Notificações)
    notificar: notify,
    limparNotificacoes: clearNotifications,

    // Aliases PT-BR (Modal)
    abrirModal: modalOpen,
    fecharModal: modalClose,

    // Aliases PT-BR (Tela inicial)
    telaInicial: showSplash,
    fecharTelaInicial: hideSplash,

    // Aliases PT-BR (Diálogos)
    dialogos: {
      alerta: dialogAlert,
      prompt: dialogPrompt,
      instalar: installDialogInterceptors,
      restaurar: restoreDialogInterceptors,
    },

    // Aliases PT-BR (Cena)
    cena: {
      abrir: sceneOpen,
      fechar: sceneClose,
      setLegenda: sceneSetLegenda,
      appendLegenda: sceneAppendLegenda,
      setLegendas: sceneSetLegendas,
      limparLegendas: sceneClearLegendas,
      aoAbrir: sceneOnOpen,
      aoFechar: sceneOnClose,
    },

    mostrarBotaoChamada: phoneSetVisible,

    // Aliases PT-BR (Ligações)
    ligacao: {
      mostrarBotao: phoneSetVisible,
      mostrarBotaoChamada: phoneSetVisible,
      setTextoBotao: phoneSetButtonText,
      setBadge: phoneSetBadge,
      setNome: phoneSetName,
      setStatus: phoneSetStatus,
      setLegendaPessoa: phoneSetLegendaPessoa,
      appendLegendaPessoa: phoneAppendLegendaPessoa,
      setLegendaPrefeito: phoneSetLegendaPrefeito,
      appendLegendaPrefeito: phoneAppendLegendaPrefeito,
      setLegendas: phoneSetLegendas,
      limparLegendas: phoneClearLegendas,
      tocar: phoneIncoming,
      abrir: phoneOpen,
      fechar: phoneClose,
      aoLigar: phoneOnCall,
      aoDesligar: phoneOnHang,
      aoAbrir: phoneOnOpen,
      aoFechar: phoneOnClose,
      ligar: phoneCall,
      desligar: phoneHang,
    },
  };

  window.controllers = api;

  try {
    installDialogInterceptors();
  } catch (_) {
    // ignore
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      bootstrap();
    } catch (_) {
      // ignore
    }
  });
})();

// HUD_AUTOFIT_START
(() => {
  const MIN_VALUE_FONT_PX = 12;
  const MIN_VALUE_FONT_PX_HARD = 10;

  function getHudItems() {
    return Array.from(document.querySelectorAll('.hud .hud-item'));
  }

  function isOverflowing(el) {
    return !!el && el.scrollWidth > el.clientWidth + 1;
  }

  function resetItem(item) {
    const valueEl = item.querySelector('.hud-value');
    if (valueEl) valueEl.style.fontSize = '';
    item.classList.remove('hud-item--compact');
    item.removeAttribute('data-hud-overflow');
  }

  function shrinkValueToFit(textEl, valueEl, minPx) {
    const computed = window.getComputedStyle(valueEl);
    let fontPx = parseFloat(computed.fontSize) || 16;

    while (isOverflowing(textEl) && fontPx > minPx) {
      fontPx -= 1;
      valueEl.style.fontSize = fontPx + 'px';
    }
  }

  function fitItem(item) {
    const textEl = item.querySelector('.hud-text');
    const valueEl = item.querySelector('.hud-value');
    if (!textEl || !valueEl) return;

    resetItem(item);

    // 1) Tenta caber diminuindo apenas o valor
    if (isOverflowing(textEl)) {
      shrinkValueToFit(textEl, valueEl, MIN_VALUE_FONT_PX);
    }

    // 2) Se ainda estourar, esconde o label (o ícone continua identificando)
    if (isOverflowing(textEl)) {
      item.classList.add('hud-item--compact');
    }

    // 3) Se ainda estourar, diminui um pouco mais (hard minimum)
    if (isOverflowing(textEl)) {
      shrinkValueToFit(textEl, valueEl, MIN_VALUE_FONT_PX_HARD);
    }

    if (isOverflowing(textEl)) {
      item.setAttribute('data-hud-overflow', 'true');
    }
  }

  function fitAll() {
    const items = getHudItems();
    for (let i = 0; i < items.length; i += 1) {
      fitItem(items[i]);
    }
  }

  let scheduled = false;
  function scheduleFit() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fitAll();
    });
  }

  function init() {
    const hud = document.querySelector('.hud');
    if (!hud) return;

    scheduleFit();
    window.addEventListener('resize', scheduleFit);

    const mo = new MutationObserver(scheduleFit);
    mo.observe(hud, { subtree: true, childList: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
// HUD_AUTOFIT_END

// HUD_HINTS_START
(() => {
  const METRIC_HINTS = {
    money: 'dinheiro',
    popularity: 'popularidade',
    health: 'saúde',
    education: 'educação',
    round: 'round',
  };

  let hintEl = null;
  let hideTimer = null;

  function ensureHintEl() {
    if (hintEl) return hintEl;

    hintEl = document.createElement('div');
    hintEl.className = 'hud-hint';
    hintEl.dataset.show = '0';
    hintEl.setAttribute('role', 'status');
    hintEl.setAttribute('aria-live', 'polite');

    document.body.appendChild(hintEl);
    return hintEl;
  }

  function cleanLabel(raw) {
    return String(raw || '')
      .replace(/\s+/g, ' ')
      .replace(/:/g, '')
      .trim()
      .toLowerCase();
  }

  function getHintText(item) {
    const metric = item.getAttribute('data-metric');
    if (metric && Object.prototype.hasOwnProperty.call(METRIC_HINTS, metric)) return METRIC_HINTS[metric];

    const labelEl = item.querySelector('.hud-label');
    return cleanLabel(labelEl ? labelEl.textContent : '');
  }

  function showHint(item) {
    const el = ensureHintEl();
    const text = getHintText(item);
    if (!text) return;

    el.textContent = text;

    const rect = item.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.bottom + 10;

    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.dataset.show = '1';
  }

  function hideHint() {
    if (!hintEl) return;
    hintEl.dataset.show = '0';
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function bindItem(item) {
    item.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      clearHideTimer();
      showHint(item);
    });

    item.addEventListener('pointerleave', () => {
      clearHideTimer();
      hideHint();
    });

    item.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      clearHideTimer();
      showHint(item);
      hideTimer = setTimeout(() => {
        hideHint();
      }, 900);
    });
  }

  function init() {
    const hud = document.querySelector('.hud');
    if (!hud) return;

    const items = hud.querySelectorAll('.hud-item');
    if (!items.length) return;

    ensureHintEl();

    for (let i = 0; i < items.length; i += 1) {
      bindItem(items[i]);
    }

    window.addEventListener('resize', hideHint);
    window.addEventListener('scroll', hideHint, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
// HUD_HINTS_END
