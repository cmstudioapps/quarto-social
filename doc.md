# Simulador de Prefeito — `controllers` (API)

Este projeto expõe uma API global em `window.controllers` para você controlar **tudo por funções**: HUD (dinheiro, popularidade, saúde, educação, round), pergunta/opções, notificações, modais e o sistema de ligações (telefone com badge e modal de ligar/desligar).

## Estrutura (arquivos principais)

- `public/index.html` — tela do jogo (HUD, pergunta, botões, telefone, modais, toasts).
- `public/styles.css` — layout + responsividade + troca automática do fundo.
- `public/controllers.js` — **todas as funções** (API principal).
- `public/index.js` — exemplo simples de uso.
- `images/desktop/fundo.png` — fundo para desktop.
- `images/mobile/fundo.png` — fundo para celular.

## Fundo responsivo (desktop/mobile)

A dinâmica já está pronta no CSS:

- Desktop: usa `images/desktop/fundo.png`.
- Celular: quando a tela tiver largura `<= 760px`, usa `images/mobile/fundo.png`.

Observação:
- Se você chamar `controllers.setFundo(url)`, isso **sobrescreve** o CSS (fica “forçado”).
- Para voltar ao automático do CSS, chame `controllers.setFundoAuto()`.

## Como acessar a API

Abra `public/index.html` no navegador e use no console:

```js
controllers.getState();
```

Ou use no seu código (`public/index.js` ou outro):

```js
window.addEventListener('DOMContentLoaded', () => {
  controllers.setpergunta('Nova pergunta', [
    { text: 'Opção 1', tone: 'green', onSelect: () => {} },
    { text: 'Opção 2', tone: 'blue', onSelect: () => {} },
    { text: 'Opção 3', tone: 'red', onSelect: () => {} },
  ]);
});


## Exemplos rápidos

A sequência típica do jogo combina tela inicial, diálogos e cenas. Use `controllers.telaInicial` para mostrar nomes em sequência, chame `alert`/`prompt` (ou `controllers.dialogs.*`) e finalize com um quadro:

```js
await controllers.telaInicial([
  'Studio do Prefeito',
  { text: 'Um mundo de escolhas', duration: 1200 },
  { text: 'Vamos começar?', duration: 900 },
  { image: './images/desktop/brand.png', duration: 1400 },
]);

await alert('Preparado para liderar a cidade?');
const nome = await prompt('Qual seu nome como prefeito?', 'Meu Nome');

controllers.setCena('./images/desktop/prefeitura.png', {
  title: 'Entrada',
  caption: `${nome} observa a cidade ao amanhecer.`,
});

await controllers.cena.setLegenda('A população espera por decisões rápidas.', 2000);
await controllers.cena.setLegenda('Você tem poucos segundos para agir.', 2200);
controllers.fecharCena();

Use `controllers.dialogs.alert`/`controllers.dialogs.prompt` (ou `controllers.dialogos.alerta`/`controllers.dialogos.prompt`) sempre que precisar customizar títulos e botões.

## Inicialização

### `controllers.bootstrap(initialState?)`

- Faz o bind de eventos (cliques dos botões, telefone, fechar modais) e renderiza a tela.
- Já é chamado automaticamente no `DOMContentLoaded`.
- `initialState` é opcional e funciona igual ao `setAll`.

## Tela inicial (splash)

### `controllers.telaInicial(sequencia, options?)` (alias: `showSplash`)

Exibe uma tela preta de inicialização e mostra **1 ou vários nomes** em sequência.

- `sequencia`: `string | array`
  - `string`: texto único
  - `array`: itens `string` ou `{ text, duration? }`
- `options.duration`: duração padrão de cada item em ms (padrão: `1100`)
- `options.fadeIn`: tempo de entrada do texto em ms (padrão: `320`)
- `options.fadeOut`: tempo de saída do texto em ms (padrão: `260`)

Cada item também aceita um objeto `{ image: 'caminho', duration? }` (ou `logo`/`src`) para mostrar logomarcas; você pode combinar texto e imagem no mesmo passo.

Para pular/fechar:
- clique na tela, ou aperte `ESC` / `Enter` / `Espaço`
- `controllers.fecharTelaInicial()` (alias: `hideSplash`)

Exemplo:

```js
await controllers.telaInicial([
  { text: 'Meu Studio', duration: 900 },
  { text: 'Simulador de Prefeito', duration: 1200 },
]);
```

## Estado atual

### `controllers.getState()`

Retorna um objeto com:

- `money`, `popularity`, `health`, `education`, `round`
- `question`
- `options` (array com 3 opções)
- `overlay` (se algum modal está aberto)
- `phone` (estado do telefone)

## HUD (indicadores)

Todas as funções abaixo atualizam a tela imediatamente e retornam o valor final.

### Dinheiro
- `controllers.setDinheiro(valor)`
- `controllers.addDinheiro(delta)`

(aliases: `setMoney`, `addMoney`)

### Popularidade (0–100)
- `controllers.setPopularidade(valor)`
- `controllers.addPopularidade(delta)`

(aliases: `setPopularity`, `addPopularity`)

### Saúde (0–100)
- `controllers.setSaude(valor)`
- `controllers.addSaude(delta)`

(aliases: `setHealth`, `addHealth`)

### Educação (0–100)
- `controllers.setEducacao(valor)`
- `controllers.addEducacao(delta)`

(aliases: `setEducation`, `addEducation`)

### Round
- `controllers.setRoundAtual(valor)`
- `controllers.proximoRound()`

(aliases: `setRound`, `nextRound`)
- `controllers.definirRounds(inicio, fim)`
  - Define o intervalo de rounds que o jogo irá apresentar (por exemplo `definirRounds(1, 6)`). Assim que o round sair do intervalo configurado, o jogo mostra a tela final e o modal compara os indicadores atuais com os valores no início dos rounds.

## Pergunta e opções

### Pergunta (recomendado)
- `controllers.setpergunta(pergunta, respostas)`

`respostas` é um array (máx. 3 itens). Cada item vira um botão e pode ter:

- `text` ou `texto`: texto do botão
- `tone` ou `cor`: `'green' | 'blue' | 'red'`
- `enabled`: `true|false`
- `visible`: `true|false`
- `onSelect` / `onClick` / `acao`: função chamada ao clicar

A função recebe:

```js
({ index, event, state, answer }) => {
  // index: 1..3 (posição do botão)
  // event: MouseEvent
  // state: snapshot de controllers.getState()
  // answer: o objeto da resposta que você passou
}
```

Compatível:
- `controllers.setPergunta(texto)` continua funcionando (só muda o texto da pergunta).


### Texto das opções
- `controllers.setOptionText(indice, texto)`
  - `indice`: `1`, `2` ou `3`

Atalho:
- `controllers.setTextosOpcoes(op1, op2, op3)`

### Pergunta + opções (atalho)
- `controllers.setPerguntaEOpcoes(pergunta, op1, op2, op3)`

### Habilitar / esconder
- `controllers.setOptionEnabled(indice, boolean)`
- `controllers.setOptionVisible(indice, boolean)`

### Cor do botão
- `controllers.setOptionTone(indice, 'green' | 'blue' | 'red')`

### Ação ao clicar (handler)

- `controllers.setOptionAction(indice, fn)`

A função `fn` recebe:

```js
({ index, event, state }) => {
  // index: 1..3
  // event: MouseEvent
  // state: snapshot de controllers.getState()
}
```

### Definir tudo de uma vez

- `controllers.setOptions([op1, op2, op3])`

Cada item pode ter:

- `text`: string
- `enabled`: boolean
- `visible`: boolean
- `tone`: `'green'|'blue'|'red'`
- `onClick`: function

Exemplo:

```js
controllers.setOptions([
  { text: 'Investir', tone: 'green', onClick: () => controllers.addDinheiro(-1000) },
  { text: 'Esperar', tone: 'blue', onClick: () => controllers.proximoRound() },
  { text: 'Ignorar', tone: 'red', onClick: () => controllers.addPopularidade(-5) },
]);
```

## Template rápido (setAll)

### `controllers.setAll(payload)`

Aceita (qualquer subset):

- `money`, `popularity`, `health`, `education`, `round`
- `question`
- `options` (mesmo formato do `setOptions`)
- `background` (URL para forçar fundo)

Retorna `controllers.getState()`.

## Notificações (toasts)

### `controllers.notificar(texto, options?)` (alias: `notify`)

- `options.type`: `'info' | 'success' | 'warning' | 'error'` (padrão: `info`)
- `options.duration`: ms (padrão: `2500`). Use `0` para não sumir sozinho.

Retorna um `id` numérico.

### `controllers.removeNotification(id)`
Remove um toast específico.

### `controllers.limparNotificacoes()` (alias: `clearNotifications`)
Remove todos os toasts.

Exemplo:

```js
const id = controllers.notificar('Salvo com sucesso', { type: 'success', duration: 2000 });
// controllers.removeNotification(id);
```

## Modal genérico

### `controllers.abrirModal(options)` (alias: `modalOpen`)

- `options.title`: string (padrão: `Modal`)
- `options.text`: string (texto simples)
- `options.html`: string (HTML) — se existir, tem prioridade sobre `text`
- `options.buttons`: array de botões

Formato do botão:

- `text`: string
- `tone`: `'blue' | 'green' | 'red'` (padrão: `blue`)
- `onClick`: function
- `close`: boolean (padrão: `true`) — se `false`, não fecha ao clicar

### `controllers.fecharModal()` (alias: `modalClose`)
Fecha qualquer modal aberto.

Exemplo:

```js
controllers.abrirModal({
  title: 'Confirma?',
  text: 'Tem certeza que deseja fazer isso?',
  buttons: [
    { text: 'Sim', tone: 'green', onClick: () => controllers.notificar('OK', { type: 'success' }) },
    { text: 'Cancelar', tone: 'red' },
  ],
});
```

## Alert e prompt (interceptados)

O projeto **intercepta `alert()` e `prompt()`** e exibe como **modal do jogo** (mesmo estilo/UI).

- `alert('texto')` abre um modal simples (OK).
- `prompt('texto', 'padrao')` abre um modal com input.

Importante:
- `alert()` e `prompt()` retornam uma **Promise** (não dá para bloquear a execução como os nativos).
  - Use `await alert(...)`/`await prompt(...)` ou `.then(...)`.

Exemplo:

```js
await alert('Bem-vindo!');
const nome = await prompt('Qual seu nome?', '');
if (nome) controllers.notificar('Olá, ' + nome);
```

API (para customizar títulos/botões e controlar o interceptador):

- `controllers.dialogs.alert(texto, options?)`
- `controllers.dialogs.prompt(texto, valorPadrao?, options?)`
- `controllers.dialogs.restore()` / `controllers.dialogos.restaurar()` — volta pro `alert/prompt` do navegador
- `controllers.dialogs.install()` / `controllers.dialogos.instalar()` — reinstala o interceptador
- `controllers.dialogs.native.alert` / `controllers.dialogs.native.prompt` — referências aos nativos

## Cena (modal com imagem)

### `controllers.setCena(caminhoDaImagem, options?)`

Abre um modal “Cena” com uma moldura de quadro e exibe a imagem.

- `caminhoDaImagem`: string (URL/caminho da imagem)
- `options.title`: string (padrão: `Cena`)
- `options.caption` / `options.legenda`: string (opcional) — define a legenda inicial (substitui a atual)
- `options.duration`: ms (opcional) — se passar, a legenda some após esse tempo; se não passar, só some ao fechar/trocar
- `options.clearCaptions`: `false` para não limpar a legenda atual

Atalhos:
- `controllers.setCena('img.png', 'Uma legenda')` (2º parâmetro string vira legenda)
- `controllers.setCena(null)` ou `controllers.setCena('')` fecha a cena.

### Fechar

- `controllers.fecharCena()` (ou `controllers.fecharModal()`)

### Legendas (1 por vez)

Por padrão, a legenda fica na tela até você fechar a cena ou definir outra legenda. Se você passar `duration`, ela some sozinha depois desse tempo.

Obs.: sem `duration`, o `await` só resolve quando a legenda for removida (fechar/trocar).

- `controllers.cena.setLegenda(texto, options?)`
- `controllers.cena.setLegendas(payload, options?)`
- `controllers.cena.limparLegendas()`

`options.duration`: duração em ms (opcional). Também aceita passar um número direto como 2º parâmetro.

Exemplo:

```js
controllers.setCena('./images/cenas/ponte.png');
await controllers.cena.setLegenda('A cidade está em silêncio...', 1800);
await controllers.cena.setLegenda('Mas algo vai acontecer.', 1800);
```

Extras:

- `controllers.cena.abrir(caminho, options?)` / `controllers.cena.fechar()`
- `controllers.cena.aoAbrir(fn)` / `controllers.cena.aoFechar(fn)`

## Sistema de ligações (telefone)

Existe um botão flutuante “Chamadas” com **badge controlável**, e um modal de telefone com:

- Nome da pessoa
- Status
- Botões `Ligar` e `Desligar`

### Botão do telefone

Por padrão, o botão começa **oculto**. Para mostrar:

- `controllers.mostrarBotaoChamada(true)`
- `controllers.ligacao.mostrarBotaoChamada(true)` (alias: `mostrarBotao`)
- `controllers.ligacao.setTextoBotao(texto)`
- `controllers.ligacao.setBadge(numero)`

(aliases equivalentes em `controllers.phone.*`)

### Controlar a ligação

- `controllers.ligacao.setNome(nome)`
- `controllers.ligacao.setStatus('idle'|'ringing'|'connected')`
  - Também aceita PT-BR: `'tocando'` e `'conectado'`.

### Simular chamada entrando

- `controllers.ligacao.tocar(nome, options?)`
  - `options.badge`: número (padrão `1`)
  - `options.autoOpen`: `true` para abrir o modal automaticamente

Isso coloca status em `ringing` e atualiza badge.

### Abrir/fechar modal do telefone

- `controllers.ligacao.abrir()`
- `controllers.ligacao.fechar()`

### Atender e desligar

- `controllers.ligacao.ligar()`
  - muda para `connected` e zera badge
  - dispara callback `aoLigar`

- `controllers.ligacao.desligar()`
  - muda para `idle`, zera badge e fecha modal
  - dispara callback `aoDesligar`


### Legendas (fala) — fila (1 por vez)

Por padrão, a legenda fica na tela até você fechar a cena ou definir outra legenda. Se você passar `duration`, ela some sozinha depois desse tempo.

- `controllers.ligacao.setLegendaPessoa(texto, options?)`
- `controllers.ligacao.setLegendaPrefeito(texto, options?)`
- `controllers.ligacao.limparLegendas()`

`options.duration`: duração em ms (opcional). Também aceita passar um número direto como 2º parâmetro.

Exemplo (sem `await`, ainda respeita a ordem):

```js
controllers.ligacao.setLegendaPessoa('Prefeito, precisamos de leitos.', { duration: 1800 });
controllers.ligacao.setLegendaPrefeito('Entendi. Vou agir agora.', { duration: 1800 });
```

Exemplo com `await`:

```js
await controllers.ligacao.setLegendaPessoa('Prefeito, precisamos de leitos.', 1800);
await controllers.ligacao.setLegendaPrefeito('Entendi. Vou agir agora.', 1800);
```

### Callbacks (eventos)

- `controllers.ligacao.aoAbrir(fn)`
- `controllers.ligacao.aoFechar(fn)`
- `controllers.ligacao.aoLigar(fn)`
- `controllers.ligacao.aoDesligar(fn)`

A função recebe:

```js
({ name, status, state }) => {}
```

Exemplo completo:

```js
controllers.ligacao.aoLigar(({ name }) => {
  controllers.notificar(`Atendeu ${name}`, { type: 'success' });
});

controllers.ligacao.aoDesligar(({ name }) => {
  controllers.notificar(`Desligou ${name}`, { type: 'warning' });
});

controllers.ligacao.tocar('Secretária da Saúde', { badge: 3, autoOpen: true });
```

## Dicas

- Se a tela ficar escurecida e sem clique: é o overlay do modal. Use `controllers.fecharModal()`.
- Para manter o fundo automático (desktop/mobile), use `controllers.setFundoAuto()`.

<!-- HUD_AUTOFIT_DOC_START -->

## HUD (auto-fit)

- O HUD nunca deve mostrar `...`.
- Se um número ficar grande demais (ex.: dinheiro muito alto), o valor é reduzido automaticamente para caber.
- Se ainda assim não couber, o label pode ser ocultado automaticamente (o ícone continua indicando o status).
- Passe o mouse (desktop) ou toque (celular) em cima do indicador para ver o nome: `dinheiro`, `popularidade`, `saúde`, `educação`, `round`.

<!-- HUD_AUTOFIT_DOC_END -->
