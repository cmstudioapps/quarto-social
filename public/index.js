window.addEventListener("DOMContentLoaded", async () => {
  if (!window.controllers) return;

  const PLAYER_PROFILE_KEY = "prefeito_player_profile";

  function loadPlayerProfile() {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(PLAYER_PROFILE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        name: typeof parsed.name === "string" ? parsed.name : null,
        lastPlayed: typeof parsed.lastPlayed === "string" ? parsed.lastPlayed : null,
      };
    } catch (_) {
      return null;
    }
  }

  function persistPlayerProfile(profile) {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return;
    }

    try {
      const payload = {
        name: profile && typeof profile.name === "string" ? profile.name : null,
        lastPlayed: profile && typeof profile.lastPlayed === "string" ? profile.lastPlayed : new Date().toISOString(),
      };
      window.localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(payload));
    } catch (_) {
      // ignore quota errors
    }
  }

  const INITIAL_STATS = {
    money: 50000,
    popularity: 0,
    health: 0,
    education: 0,
    food: 0,
    housing: 0,
    employment: 0,
    wellbeing: 0,
  };

  async function askForPlayerName() {
    const storedProfile = loadPlayerProfile();
    let nome = '';

    if (storedProfile && storedProfile.name) {
      const choice = await askNameConfirmation(storedProfile.name);
      if (choice === 'change') {
        const typedName = await prompt('Qual seu nome?', storedProfile.name);
        nome = typedName ? typedName.trim() : storedProfile.name;
      } else {
        nome = storedProfile.name;
      }
    } else {
      const typedName = await prompt('Qual seu nome?', '');
      nome = typedName ? typedName.trim() : '';
    }

    if (!nome) nome = 'Prefeito';
    controllers.setPlayerName(nome);
    persistPlayerProfile({ name: nome, lastPlayed: new Date().toISOString() });
    return nome;
  }

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

  function formatCurrency(value) {
    const amount = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    return currencyFormatter.format(amount);
  }

  const tentacoes = [
    {
      id: 'empresa-influente',
      round: 2,
      person: 'Empresário influente',
      badge: 2,
      intro: 'Prefeito, temos uma oportunidade de acelerar a indústria, mas a verba oficial está lenta.',
      prefeitoIntro: 'Essa ligação sempre vem com um pedido duvidoso.',
      offer: 'Se você desviar parte da verba da moradia para o clube que estamos construindo, eu te entrego R$ 120 mil de investimento extra.',
      accept: {
        effects: { money: 120, popularity: -8, wellbeing: -1 },
        prefeitoMessage: 'Aceitei desviar recursos e agora sinto o peso disso.',
        notification: 'Você aceitou o desvio e ganhou apoio privado.',
      },
      reject: {
        effects: { popularity: 3, wellbeing: 1 },
        prefeitoMessage: 'Recusei o desvio e deixei claro que o povo vem primeiro.',
        notification: 'Você recusou o desvio e reforçou sua postura ética.',
      },
    },
    {
      id: 'aliado-politico',
      round: 4,
      person: 'Aliado político',
      badge: 1,
      intro: 'Precisamos mostrar serviço para manter o apoio antes das eleições.',
      prefeitoIntro: 'Mais uma ligação pedindo favores em troca de votos.',
      offer: 'Desvie R$ 90 mil da verba de capacitação e eu garanto que o jornal elogia sua gestão.',
      accept: {
        effects: { money: 90, popularity: -10, wellbeing: -1 },
        prefeitoMessage: 'Fiz um acordo incômodo para agradar aliados, mas temo as consequências.',
        notification: 'Você aceitou o desvio e tentou manter os aliados felizes.',
      },
      reject: {
        effects: { popularity: 4, wellbeing: 2 },
        prefeitoMessage: 'Recusei o desvio e reafirmei que o dinheiro do povo não se compra.',
        notification: 'Você recusou a tentação e conquistou confiança popular.',
      },
    },
  ];

  function resetTentacoesState() {
    tentacoes.forEach((tentacao) => {
      tentacao.triggered = false;
    });
  }

  let tentacaoAtiva = null;
  let tentacaoTutorialShown = false;

  function lockTentacaoButtons(locked) {
    const callBtn = document.getElementById("phone-btn-call");
    const hangBtn = document.getElementById("phone-btn-hang");
    if (callBtn) callBtn.classList.toggle("phone-btn--locked", Boolean(locked));
    if (hangBtn) hangBtn.classList.toggle("phone-btn--locked", Boolean(locked));
  }

  function setTentacaoPhoneButtonsUI() {
    const callBtn = document.getElementById("phone-btn-call");
    const hangBtn = document.getElementById("phone-btn-hang");

    // Para tentações, "Ligar/Desligar" confunde: mostramos como "Aceitar/Recusar".
    if (callBtn) callBtn.textContent = "Aceitar";
    if (hangBtn) hangBtn.textContent = "Recusar";
  }

  function aplicarImpactosTemptacao(efeitos) {
    if (!efeitos || typeof efeitos !== "object") return null;
    const scaled = amplifyEffects(efeitos);
    if (typeof controllers.trackImpact === 'function' && Object.keys(scaled).length) {
      controllers.trackImpact(scaled);
    }
    if (typeof scaled.money === 'number') controllers.addDinheiro(scaled.money);
    if (typeof scaled.popularity === 'number') controllers.addPopularidade(scaled.popularity);
    if (typeof scaled.food === 'number') controllers.addAlimentacao(scaled.food);
    if (typeof scaled.housing === 'number') controllers.addMoradia(scaled.housing);
    if (typeof scaled.employment === 'number') controllers.addEmprego(scaled.employment);
    if (typeof scaled.wellbeing === 'number') controllers.addBemEstar(scaled.wellbeing);
    return scaled;
  }

  controllers.ligacao.aoLigar(async ({ name }) => {
    if (!tentacaoAtiva || tentacaoAtiva.person !== name) return;
    const { accept, resolve } = tentacaoAtiva;
    tentacaoAtiva = null;

    lockTentacaoButtons(true);

    const scaledAccept = aplicarImpactosTemptacao(accept.effects);

    // Mantém o overlay aberto até o jogador conseguir ler a mensagem do prefeito.
    if (accept.prefeitoMessage) {
      // Pós-decisão não pode depender de clique manual (evita deadlock se modal fechar).
      await controllers.ligacao.setLegendaPrefeito(accept.prefeitoMessage, 2400);
    }

    const effectsSummary = formatEfeitos(scaledAccept || accept.effects);
    const notificationText = accept.notification || 'Você aceitou a tentação.';
    controllers.notificar(
      effectsSummary ? `${notificationText} Efeitos: ${effectsSummary}` : notificationText,
      { type: 'warning' },
    );

    resolve && resolve('accepted');
    controllers.ligacao.desligar();
  });

  controllers.ligacao.aoDesligar(async ({ name }) => {
    if (!tentacaoAtiva || tentacaoAtiva.person !== name) return;
    const { reject, resolve } = tentacaoAtiva;
    tentacaoAtiva = null;

    lockTentacaoButtons(true);

    const scaledReject = aplicarImpactosTemptacao(reject.effects);

    // Mantém o overlay aberto até o jogador conseguir ler a mensagem do prefeito.
    if (reject.prefeitoMessage) {
      // Pós-decisão não pode depender de clique manual (evita deadlock se modal fechar).
      await controllers.ligacao.setLegendaPrefeito(reject.prefeitoMessage, 2400);
    }

    const effectsSummary = formatEfeitos(scaledReject || reject.effects);
    const notificationText = reject.notification || 'Você recusou a tentação.';
    controllers.notificar(
      effectsSummary ? `${notificationText} Efeitos: ${effectsSummary}` : notificationText,
      { type: 'success' },
    );

    resolve && resolve('rejected');
  });

  // Se o jogador fechar o modal da chamada no "X", a tentação deve continuar o jogo (recusa).
  controllers.ligacao.aoFechar(({ name }) => {
    if (!tentacaoAtiva || tentacaoAtiva.person !== name) return;
    controllers.notificar('Ligação encerrada. Decisão registrada como recusa.', { type: 'info' });
    controllers.ligacao.desligar();
  });

  async function mostrarTentacao(tentacao) {
    if (!tentacao) return;
    const decisionPromise = new Promise((resolve) => {
      tentacaoAtiva = { ...tentacao, resolve };
    });

    setTentacaoPhoneButtonsUI();
    lockTentacaoButtons(true);

    const hintEl = document.getElementById("phone-tentacao-hint");
    if (hintEl) {
      const acceptEffects = formatEfeitos(tentacao.accept?.effects);
      const rejectEffects = formatEfeitos(tentacao.reject?.effects);
      hintEl.textContent =
        `Aceitar (verde): ${acceptEffects || '—'}\n` +
        `Recusar (vermelho): ${rejectEffects || '—'}`;
      hintEl.hidden = false;
    }

    // Evita confusão com um botão flutuante; durante tentação o jogador decide no modal.
    controllers.ligacao.mostrarBotaoChamada(false);

    controllers.ligacao.setNome(tentacao.person);
    controllers.ligacao.tocar(tentacao.person, { badge: tentacao.badge ?? 1, autoOpen: true });

    // Tutorial embutido na chamada (evita modal genérico que pode travar a experiência).
    if (!tentacaoTutorialShown) {
      tentacaoTutorialShown = true;

      const acceptEffects = formatEfeitos(tentacao.accept?.effects);
      const rejectEffects = formatEfeitos(tentacao.reject?.effects);
      const tutorialText =
        "Tentações chegam pelo telefone.\n" +
        "Botão verde: Aceitar (os efeitos do 'Aceitar' entram em vigor).\n" +
        "Botão vermelho: Recusar (os efeitos do 'Recusar' entram em vigor).\n\n" +
        `Nesta ligação:\n` +
        `Aceitar -> ${acceptEffects || '—'}\n` +
        `Recusar -> ${rejectEffects || '—'}\n\n`;

      await controllers.ligacao.setLegendaPrefeito(tutorialText, { manual: true, who: 'Sistema' });
    }

    // Aumenta o tempo das legendas para leitura confortável.
    await controllers.ligacao.setLegendaPessoa(tentacao.intro, { manual: true });
    await controllers.ligacao.setLegendaPrefeito(tentacao.prefeitoIntro, { manual: true, who: 'Sistema' });
    await controllers.ligacao.setLegendaPessoa(tentacao.offer, { manual: true });

    // Liberamos a decisão só depois da orientação final.
    await controllers.ligacao.setLegendaPrefeito(
      "Agora decida: Aceitar (verde) para atender o pedido ou Recusar (vermelho) para negar.",
      { manual: true, who: 'Sistema' },
    );
    lockTentacaoButtons(false);
    controllers.notificar(
      `Ligação de ${tentacao.person}: ${tentacao.offer}`,
      { type: 'warning' },
    );

    const fallbackTimeoutMs = 45000;
    const fallbackPromise = new Promise((resolve) => {
      setTimeout(() => {
        if (tentacaoAtiva && tentacaoAtiva.id === tentacao.id) {
          controllers.notificar('Tempo esgotado na ligação. O jogo registrou recusa para continuar.', { type: 'warning' });
          controllers.ligacao.desligar();
        }
        resolve();
      }, fallbackTimeoutMs);
    });

    try {
      await Promise.race([decisionPromise, fallbackPromise]);
    } finally {
      if (hintEl) hintEl.hidden = true;
      controllers.ligacao.mostrarBotaoChamada(false);
    }
  }

  async function possiveisTentacoesParaRound(roundId) {
    const entradas = tentacoes.filter((tentacao) => tentacao.round === roundId && !tentacao.triggered);
    for (const tentacao of entradas) {
      await mostrarTentacao(tentacao);
      tentacao.triggered = true;
    }
  }

  function resumoProblema(legend) {
    const prefix = String(legend || "").split("·")[0] || "";
    return prefix.replace(/^ROUND\s*\d+\s*[–-]\s*/i, "").trim();
  }

  let confirmModalPending = false;
  let nameModalPending = false;
  function askDecisionConfirmation(cost, overrideText) {
    return new Promise((resolve) => {
      if (confirmModalPending) {
        resolve(false);
        return;
      }
      confirmModalPending = true;
      let settled = false;
      const finalize = (answer) => {
        if (settled) return;
        settled = true;
        confirmModalPending = false;
        resolve(answer);
      };

      const state = controllers.getState();
      const currentMoney = Number.isFinite(state.money) ? state.money : 0;
      controllers.notificar(`Saldo atual: ${formatCurrency(currentMoney)}.`, { type: 'warning', duration: 3500 });

      controllers.abrirModal({
        title: 'Confirmação de gasto',
        text: overrideText || `deseja gastar ${cost} reais para esse problema?`,
        buttons: [
          {
            text: 'Sim, gastar',
            tone: 'green',
            onClick: () => finalize(true),
          },
          {
            text: 'Não',
            tone: 'red',
            onClick: () => finalize(false),
          },
        ],
      });
    });
  }

  function askNameConfirmation(existingName) {
    return new Promise((resolve) => {
      if (nameModalPending) {
        resolve('keep');
        return;
      }
      nameModalPending = true;
      let settled = false;

      const finalize = (choice) => {
        if (settled) return;
        settled = true;
        nameModalPending = false;
        cleanup();
        resolve(choice);
      };

      const closeBtn = document.getElementById("modal-generic-close");
      const scrim = document.querySelector("[data-overlay-close='true']");
      const handleClose = () => finalize('keep');
      const cleanup = () => {
        if (closeBtn) closeBtn.removeEventListener("click", handleClose);
        if (scrim) scrim.removeEventListener("click", handleClose);
      };

      controllers.abrirModal({
        title: 'Quer manter esse nome?',
        text: `Você jogou como ${existingName}. Deseja manter esse apelido ou começar com outro nome?`,
        buttons: [
          {
            text: 'Manter nome',
            tone: 'green',
            onClick: () => finalize('keep'),
          },
          {
            text: 'Trocar nome',
            tone: 'red',
            onClick: () => finalize('change'),
          },
        ],
      });

      if (closeBtn) closeBtn.addEventListener("click", handleClose);
      if (scrim) scrim.addEventListener("click", handleClose);
    });
  }


  let currentRoundOptions = [];

  async function handleDecision(option, legend) {
    const hasCost = typeof option?.cost === "number" && Number.isFinite(option.cost);
    const cost = hasCost ? Math.max(0, option.cost) : 0;
    const selectionText = option?.text ? String(option.text) : 'Sua decisão';

    if (hasCost) {
      const state = controllers.getState();
      const currentMoney = Number.isFinite(state.money) ? state.money : 0;
      const affordableOptionExists = currentRoundOptions.some((nextOption) => {
        const nextCost = typeof nextOption?.cost === "number" && Number.isFinite(nextOption.cost)
          ? Math.max(0, nextOption.cost)
          : 0;
        return nextCost <= currentMoney;
      });
      if (cost > currentMoney && affordableOptionExists) {
        controllers.notificar('Você não tem dinheiro suficiente para essa decisão.', { type: 'error' });
        return;
      }

      const forcedNegative = cost > currentMoney && !affordableOptionExists;
      const confirmationMessage = forcedNegative
        ? `Saldo insuficiente (${formatCurrency(currentMoney)}). Você será coberto no vermelho para fechar o mandato.`
        : cost > currentMoney
          ? `Saldo insuficiente (${formatCurrency(currentMoney)}). Aceita gastar ${cost} mesmo assim?`
          : undefined;

      let confirmed = true;
      if (!forcedNegative) {
        confirmed = await askDecisionConfirmation(cost, confirmationMessage);
        if (!confirmed) {
          controllers.notificar(`Decisão cancelada: "${selectionText}".`, { type: 'info' });
          return;
        }
      } else {
        controllers.notificar('Saldo insuficiente, mas o mandato será finalizado com a decisão no vermelho.', { type: 'warning' });
      }

      controllers.addDinheiro(-cost);
      controllers.notificar(
        `Gasto ${forcedNegative ? 'no negativo para garantir o fim do mandato' : `confirmado: -R$ ${cost}`}.`,
        { type: forcedNegative ? 'warning' : 'success' },
      );
    }

    await aplicarComFeedback(option.effects, legend, selectionText, cost);
    currentRoundOptions = [];
  }

  const METRIC_SCALE_FACTOR = 1.75;

  function amplifyEffects(efeitos) {
    if (!efeitos || typeof efeitos !== "object") return {};

    const scaled = {};
    Object.entries(efeitos).forEach(([key, rawValue]) => {
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value === 0) return;

      if (key === "money") {
        scaled[key] = Math.round(value);
        return;
      }

      const multiplied = Math.round(value * METRIC_SCALE_FACTOR);
      scaled[key] = multiplied === 0 ? (value > 0 ? 1 : -1) : multiplied;
    });

    return scaled;
  }

  function aplicarEfeitos(efeitos) {
    if (!efeitos) return;
    if (typeof efeitos.food === 'number') controllers.addAlimentacao(efeitos.food);
    if (typeof efeitos.housing === 'number') controllers.addMoradia(efeitos.housing);
    if (typeof efeitos.employment === 'number') controllers.addEmprego(efeitos.employment);
    if (typeof efeitos.wellbeing === 'number') controllers.addBemEstar(efeitos.wellbeing);
    if (typeof efeitos.popularity === 'number') controllers.addPopularidade(efeitos.popularity);
    if (typeof efeitos.money === 'number') controllers.addDinheiro(efeitos.money);
  }

  const ROUND_META = {
    1: {
      scene: './images/cenas/round1.png',
      legend: 'ROUND 1 – A FOME · 13/05/1958 · Uma mulher segura a criança e relata a fome constante da comunidade.',
    },
    2: {
      scene: './images/cenas/round2.png',
      legend: 'ROUND 2 – MORADIA PRECÁRIA · 22/05/1958 · A chuva invade barracos e deixa famílias desabrigadas.',
    },
    3: {
      scene: './images/cenas/round3.png',
      legend: 'ROUND 3 – LIXO E FALTA DE SANEAMENTO · 19/05/1958 · O lixo se acumula e causa doenças pela favela.',
    },
    4: {
      scene: './images/cenas/round4.png',
      legend: 'ROUND 4 – FALTA DE TRABALHO · 22/05/1958 · Chuva fecha as ruas e o desemprego cresce.',
    },
    5: {
      scene: './images/cenas/round5.png',
      legend: 'ROUND 5 – A VOZ DA COMUNIDADE · 20/05/1958 · Moradores querem participar das decisões.',
    },
  };

  function formatEfeitos(efeitos) {
    const label = {
      food: 'Alimentação',
      housing: 'Moradia',
      employment: 'Emprego',
      wellbeing: 'Bem-estar',
      money: 'Dinheiro',
      popularity: 'Popularidade',
    };
    return Object.entries(efeitos)
      .filter(([, value]) => typeof value === 'number' && value !== 0)
      .map(([key, value]) => {
        const sign = value > 0 ? '+' : '';
        if (key === 'money') {
          const abs = Math.abs(Math.round(value));
          const moneySign = value > 0 ? '+' : value < 0 ? '-' : '';
          return `${label[key]} ${moneySign}R$ ${abs}`;
        }
        return `${label[key] ?? key} ${sign}${value}`;
      })
      .join(' · ');
  }

  async function aplicarComFeedback(efeitos, legend, selectionText, cost) {
    const scaledEffects = amplifyEffects(efeitos);
    if (typeof controllers.trackImpact === 'function' && Object.keys(scaledEffects).length) {
      controllers.trackImpact(scaledEffects);
    }
    aplicarEfeitos(scaledEffects);
    const summary = formatEfeitos(scaledEffects);
    const costLine = Number.isFinite(cost) && cost > 0 ? `Custo: -R$ ${cost}` : null;
    const decisionLine = selectionText ? `Decisão: ${selectionText}` : null;
    const displayParts = [summary || null, legend, decisionLine, costLine].filter(Boolean);
    const display = displayParts.join('\n');
    await controllers.cena.setLegenda(display, 1200);
  }

  async function mostrarFinal() {
    controllers.setRoundAtual(6);
    await alert('Você encerrou os desafios. Agora confira a tela final e a comparação dos indicadores.');
    await alert(finalNarrative);
    controllers.setRoundAtual(7);
  }

  const rounds = [
    {
      id: 1,
      meta: ROUND_META[1],
      options: [
        { text: 'Distribuir alimentos emergenciais', cost: 12000, tone: 'green', effects: { food: 2, employment: -1, wellbeing: 2 } },
        { text: 'Trabalho temporário', cost: 9000, tone: 'blue', effects: { food: 1, employment: 2, wellbeing: 1 } },
        { text: 'Esperar pela melhora', cost: 4000, tone: 'red', effects: { food: -1, wellbeing: -1 } },
      ],
    },
    {
      id: 2,
      meta: ROUND_META[2],
      options: [
        { text: 'Reforçar casas atuais', cost: 14000, tone: 'green', effects: { housing: 2, employment: 1, wellbeing: 1 } },
        { text: 'Construir casas populares', cost: 18000, tone: 'blue', effects: { housing: 3, employment: 0, wellbeing: 1 } },
        { text: 'Adiar essa prioridade', cost: 7000, tone: 'red', effects: { housing: -1, wellbeing: -1 } },
      ],
    },
    {
      id: 3,
      meta: ROUND_META[3],
      options: [
        { text: 'Programa de limpeza', cost: 11000, tone: 'green', effects: { food: 1, housing: 1, wellbeing: 2 } },
        { text: 'Campanhas de conscientização', cost: 7000, tone: 'blue', effects: { housing: 1, wellbeing: 1 } },
        { text: 'Ignorar o problema', cost: 3000, tone: 'red', effects: { food: -1, housing: -1, wellbeing: -1 } },
      ],
    },
    {
      id: 4,
      meta: ROUND_META[4],
      options: [
        { text: 'Cursos de capacitação', cost: 10000, tone: 'green', effects: { employment: 2, wellbeing: 1 } },
        { text: 'Apoiar pequenos negócios', cost: 13000, tone: 'blue', effects: { employment: 3, wellbeing: 1 } },
        { text: 'Não investir agora', cost: 4500, tone: 'red', effects: { employment: -1, wellbeing: -1 } },
      ],
    },
    {
      id: 5,
      meta: ROUND_META[5],
      options: [
        { text: 'Reuniões comunitárias', cost: 8000, tone: 'green', effects: { wellbeing: 2 } },
        { text: 'Programas sociais', cost: 12000, tone: 'blue', effects: { food: 1, housing: 1, wellbeing: 1 } },
        { text: 'Decidir sozinho', cost: 2500, tone: 'red', effects: { wellbeing: -2 } },
      ],
    },
  ];

  let sessionRunning = false;

  async function runSession() {
    if (sessionRunning) return;
    sessionRunning = true;
    resetTentacoesState();
    tentacaoAtiva = null;
    tentacaoTutorialShown = false;
    controllers.limparNotificacoes();
    controllers.setAll(INITIAL_STATS);

    try {
      await controllers.telaInicial([
        'Quarto social',
        { image: './images/marcas/cm.png', duration: 1400 },
        { text: 'Inspirado na obra Quarto de Despejo, de Carolina Maria de Jesus.', duration: 4000 },
        { text: 'Um mundo de escolhas', duration: 1200 },
        { text: 'Vamos começar?', duration: 900 },
      ]);

      controllers.setRoundAtual(1);
      const nome = await askForPlayerName();
      const percentualVotos = 52 + Math.floor(Math.random() * 17);
      await alert(
        `${nome}, você foi eleito com ${percentualVotos}% dos votos. ` +
        'O povo confiou a você o futuro da cidade. Suas decisões a partir de agora vão mudar a vida de muita gente.'
      );

      controllers.setCena('./images/desktop/fundo.png');
      await controllers.cena.setLegenda('Você finalmente está no poder e começa a pensar no que deve fazer primeiro.');
      await new Promise((resolve) => setTimeout(resolve, 300));
      await alert('Neste jogo você enfrentará fome, moradias frágeis, lixo acumulado e falta de trabalho. Decida com cuidado, porque cada round afeta a comunidade. Boa sorte!');

      const finalNarrative = `${nome}, sua gestão chegou ao fim. Confira a tela final e reflita sobre suas decisões.`;

      controllers.definirRounds(1, 6);

      for (const round of rounds) {
        controllers.setRoundAtual(round.id);
        controllers.setCena(round.meta.scene);
        await controllers.cena.setLegenda(round.meta.legend);
        await possiveisTentacoesParaRound(round.id);
        const problema = resumoProblema(round.meta.legend);
        const pergunta = problema
          ? `PROBLEMA: ${problema}\nO que você vai fazer?`
          : 'O que você vai fazer?';
        currentRoundOptions = round.options;
        await controllers.setpergunta(
          pergunta,
          round.options.map((option) => ({
            text: option.text,
            tone: option.tone,
            onSelect: () => handleDecision(option, round.meta.legend),
          }))
        );
      }

      await mostrarFinal();
    } finally {
      sessionRunning = false;
    }
  }

  await runSession();
  window.__restartGame = () => {
    if (!sessionRunning) {
      runSession();
    }
  };
});
