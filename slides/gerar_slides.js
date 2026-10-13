const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const OUT = process.argv[2] || "attention_workshop.pptx";
// --sem-notas gera a versão pública, sem as notas do apresentador
const SEM_NOTAS = process.argv.includes("--sem-notas");
const REPO_USER = "giovannibragasv";
const COLAB_URL = `colab.research.google.com/github/${REPO_USER}/transformer-do-zero/blob/main/workshop_aluno.ipynb`;
const A = (f) => path.join(__dirname, "assets", f);

const C = {
  ink: "1B1B1B", muted: "5F5F5F", faint: "9A9A9A", line: "C9C9C9", soft: "F3F4F6",
  accent: "9E2A2B", blue: "2F5D8A", b1: "E8EEF5", b2: "BFD0E3", b3: "7FA0C4", b4: "2F5D8A",
  white: "FFFFFF",
};
const F = { title: "Cambria", body: "Calibri", mono: "Courier New" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "Attention is All You Need: construindo um Transformer do zero";
pres.author = "Giovanni Vasconcelos";

let n = 0;
const W = 13.333, H = 7.5, MX = 0.7;

function png(f) {
  const b = fs.readFileSync(A(f));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function eq(s, f, x, y, h) {
  const d = png(f);
  const w = h * d.w / d.h;
  s.addImage({ path: A(f), x, y, w, h });
  return w;
}
function eqW(s, f, x, y, w) {
  const d = png(f);
  const h = w * d.h / d.w;
  s.addImage({ path: A(f), x, y, w, h });
  return h;
}
function img(s, f, x, y, w, h) {
  const d = png(f);
  let iw = w, ih = w * d.h / d.w;
  if (ih > h) { ih = h; iw = h * d.w / d.h; }
  s.addImage({ path: A(f), x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih });
}
function t(s, text, x, y, w, h, o = {}) {
  s.addText(text, {
    x, y, w, h, fontFace: F.body, fontSize: 16, color: C.ink, margin: 0, valign: "top",
    isTextBox: true, ...o,
  });
}
function bullets(s, items, x, y, w, h, o = {}) {
  const runs = items.map((it, i) => ({
    text: it, options: { bullet: { indent: 16 }, breakLine: i < items.length - 1, paraSpaceAfter: 8 },
  }));
  t(s, runs, x, y, w, h, o);
}
function box(s, x, y, w, h, label, o = {}) {
  s.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: o.fill || C.white }, line: { color: o.lineColor || C.ink, width: o.lw || 1 },
  });
  if (label !== undefined)
    t(s, label, x, y, w, h, {
      align: "center", valign: "middle", fontSize: o.fs || 14, color: o.color || C.ink,
      fontFace: o.font || F.body, bold: o.bold || false,
    });
}
function arrow(s, x1, y1, x2, y2, o = {}) {
  s.addShape(pres.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color: o.color || C.ink, width: o.w || 1.25, endArrowType: o.noHead ? undefined : "triangle", dashType: o.dash },
  });
}
function shade(v) {
  if (v === null) return C.white;
  if (v < 0.05) return C.white;
  if (v < 0.25) return C.b1;
  if (v < 0.5) return C.b2;
  if (v < 0.75) return C.b3;
  return C.b4;
}
function grid(s, x, y, cell, M, o = {}) {
  M.forEach((row, i) => row.forEach((v, j) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + j * cell, y: y + i * cell, w: cell, h: cell,
      fill: { color: typeof v === "string" ? v : shade(v) }, line: { color: o.lineColor || C.line, width: 0.75 },
    });
    if (o.text && o.text[i][j] !== "")
      t(s, o.text[i][j], x + j * cell, y + i * cell, cell, cell, {
        align: "center", valign: "middle", fontSize: o.fs || 11, fontFace: o.font || F.body,
        color: (typeof v === "number" && v >= 0.5) ? C.white : (o.tc || C.ink),
      });
  }));
  if (o.rows) o.rows.forEach((r, i) => t(s, r, x - 1.2, y + i * cell, 1.1, cell, { align: "right", valign: "middle", fontSize: o.lfs || 12, color: C.muted }));
  if (o.cols) o.cols.forEach((c, j) => t(s, c, x + j * cell - 0.3, y - 0.35, cell + 0.6, 0.3, { align: "center", fontSize: o.lfs || 12, color: C.muted }));
}
function base(section, title, notes) {
  const s = pres.addSlide();
  n += 1;
  s.background = { color: C.white };
  if (section) t(s, section.toUpperCase(), MX, 0.35, 8, 0.3, { fontSize: 11, color: C.accent, charSpacing: 2, bold: true });
  if (title) t(s, title, MX, 0.62, W - 2 * MX, 0.8, { fontFace: F.title, fontSize: 32, bold: true });
  t(s, String(n), W - MX - 0.6, H - 0.45, 0.6, 0.25, { fontSize: 10, color: C.faint, align: "right" });
  if (notes && !SEM_NOTAS) s.addNotes(notes.trim());
  return s;
}
function chessboard(s, x, y, cell, hi = {}) {
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const key = `${i},${j}`;
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + j * cell, y: y + i * cell, w: cell, h: cell,
      fill: { color: hi[key] || ((i + j) % 2 ? "D9DEE5" : C.white) }, line: { color: "D9DEE5", width: 0.5 },
    });
  }
  s.addShape(pres.shapes.RECTANGLE, { x, y, w: 8 * cell, h: 8 * cell, fill: { type: "none" }, line: { color: C.ink, width: 1 } });
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 1. Capa
{
  const s = base(null, null, `
Abertura (00:00). Apresente-se em uma frase e combine o formato: a oficina é prática, a maior parte do tempo é no notebook, e ninguém precisa saber nada de Transformers ou de xadrez para acompanhar.

A ideia para a turma levar: a fórmula de uma linha do artigo de 2017 é o coração do ChatGPT, do Claude e do Gemini. Hoje cada um vai escrever essa fórmula e treinar um modelo que joga xadrez.`);
  t(s, "CESUPA TECH SUMMIT 2026  ·  WORKSHOP", MX, 1.2, 8, 0.3, { fontSize: 12, color: C.accent, charSpacing: 2, bold: true });
  t(s, "Attention is All You Need", MX, 1.75, 7.6, 1.0, { fontFace: F.title, fontSize: 48, bold: true });
  t(s, "Construindo um Transformer do zero", MX, 2.75, 7.6, 0.7, { fontFace: F.title, fontSize: 28, color: C.muted, italic: true });
  t(s, "Giovanni Vasconcelos", MX, 5.3, 6, 0.4, { fontSize: 18, bold: true });
  t(s, "14 de outubro de 2026", MX, 5.72, 6, 0.4, { fontSize: 15, color: C.muted });
  const M = [];
  for (let i = 0; i < 8; i++) { const r = []; for (let j = 0; j < 8; j++) r.push(j > i ? 0 : [0.9, 0.3, 0.6, 0.15, 0.8, 0.35, 0.55, 0.2][(i * 3 + j * 5) % 8]); M.push(r); }
  grid(s, 8.55, 1.5, 0.52, M);
}

// Auxiliares dos slides novos
function codigo(s, linhas, x, y, w, o = {}) {
  // linhas: array de arrays de [texto, destaque?]
  const h = o.h || (0.42 * linhas.length + 0.4);
  box(s, x, y, w, h, undefined, { fill: C.soft, lineColor: C.soft });
  const runs = [];
  linhas.forEach((ln, i) => ln.forEach(([txt, dest], j) => runs.push({
    text: txt,
    options: { color: dest === "lac" ? C.accent : dest === "com" ? C.faint : C.ink, bold: dest === "lac", breakLine: j === ln.length - 1 && i < linhas.length - 1 },
  })));
  t(s, runs, x + 0.3, y + 0.2, w - 0.5, h - 0.3, { fontFace: F.mono, fontSize: o.fs || 16, paraSpaceAfter: 4 });
  return h;
}
function frase(s, palavras, x, y, w, o = {}) {
  // desenha palavras em caixas lado a lado; devolve os centros
  const gap = 0.12, bw = (w - gap * (palavras.length - 1)) / palavras.length;
  return palavras.map((p, i) => {
    const bx = x + i * (bw + gap);
    const st = (o.estilo && o.estilo[i]) || {};
    box(s, bx, y, bw, o.h || 0.7, p, { fs: o.fs || 17, fill: st.fill || C.white, lineColor: st.line || C.ink, bold: !!st.bold, color: st.color });
    return { x: bx, w: bw, cx: bx + bw / 2 };
  });
}
function tabelaNum(s, x, y, cell, M, linhas, colunas, o = {}) {
  const max = o.max || Math.max(...M.flat());
  grid(s, x, y, cell, M.map((r) => r.map((v) => (o.semCor ? 0 : v / max))), {
    text: M.map((r) => r.map((v) => (o.fmt ? o.fmt(v) : v.toFixed(2)))), rows: linhas, cols: colunas, fs: o.fs || 15, lfs: 14,
  });
}
const P3 = ["rei", "protege", "rainha"];
const SCORES = [[0.71, 0, 0.71], [0, 0.71, 0.71], [0.71, 0.71, 1.41]];
const PESOS = [[0.4, 0.2, 0.4], [0.2, 0.4, 0.4], [0.25, 0.25, 0.5]];
const VS = [[10, 0], [0, 10], [5, 5]];
const SAIDA = [[6, 4], [4, 6], [5, 5]];

// 2. Roteiro
{
  const s = base("Roteiro", "O que vamos fazer hoje", `
Um minuto. Mostre que a oficina tem três partes práticas e que a explicação vem sempre logo antes de cada uma.

Horário de referência (só para você): 00:00 abertura · 00:05 Colab · 00:13 história e ideia da atenção · 00:33 Parte 1 · 00:48 o Transformer · 00:52 Parte 2 · 01:10 heatmap · 01:13 iniciar treino de xadrez · 01:15 intervalo · 01:20 xadrez · 01:25 Parte 3 · 01:47 por que mudou tudo e encerramento.

Combine o sinal para pedir ajuda (por exemplo, um papel dobrado sobre o monitor) e apresente os monitores.`);
  const partes = [
    ["", "De onde veio a ideia de atenção, e por que ela mudou a computação", false],
    ["Parte 1", "Fazer a atenção passo a passo, num exemplo de três palavras", true],
    ["", "Como a atenção vira um Transformer", false],
    ["Parte 2", "Montar o Transformer e ensiná-lo a ordenar números", true],
    ["", "Intervalo", false],
    ["Parte 3", "Treinar um modelo de xadrez e jogar contra ele", true],
  ];
  let y = 1.8;
  partes.forEach(([tag, label, dark]) => {
    s.addShape(pres.shapes.RECTANGLE, { x: MX, y: y + 0.08, w: 0.32, h: 0.32, fill: { color: dark ? C.blue : C.white }, line: { color: C.blue, width: 1 } });
    t(s, tag, MX + 0.55, y, 1.3, 0.48, { fontSize: 15, bold: true, color: C.blue, valign: "middle" });
    t(s, label, MX + 1.9, y, 8.5, 0.48, { fontSize: 19, valign: "middle", bold: dark });
    y += 0.68;
  });
  t(s, "Ninguém precisa saber nada de inteligência artificial, nem de xadrez.", MX, 6.2, 11.5, 0.5, { fontSize: 17, italic: true, color: C.muted });
}

// 3. Onde vamos chegar
{
  const s = base("Motivação", "Onde vamos chegar", `
Gancho. Se possível, jogue três ou quatro lances ao vivo contra o modelo de referência (seção 3.5 do gabarito).

Ponto central: o modelo nunca recebe o tabuleiro. Ele vê só a sequência de caracteres à esquerda e aprende a prever o caractere seguinte. Se ele joga lances válidos, alguma noção de onde estão as peças surgiu dentro dele.`);
  box(s, MX, 1.75, 6.4, 2.6, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: ";1.e4 e5 2.Nf3 Nc6 3.Bb5 a6", options: { breakLine: true } },
    { text: " 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5", options: { breakLine: true } },
    { text: " 7.Bb3 d6 8.c3 O-O 9.h3 ", options: {} },
    { text: "Nb8", options: { color: C.accent, bold: true } },
  ], MX + 0.35, 2.05, 5.9, 1.6, { fontFace: F.mono, fontSize: 18, paraSpaceAfter: 6 });
  t(s, "O modelo lê apenas o texto e prevê o próximo caractere.", MX + 0.35, 3.65, 5.8, 0.5, { fontSize: 15, color: C.muted, italic: true });
  arrow(s, 7.35, 3.5, 8.05, 3.5);
  chessboard(s, 8.3, 1.75, 0.44, { "0,1": "E8C4C4", "2,2": "E8C4C4" });
  t(s, "O tabuleiro nunca é mostrado ao modelo.", 8.3, 5.4, 3.6, 0.4, { fontSize: 14, color: C.muted, italic: true });
  t(s, "Um Transformer montado por vocês, que aprende xadrez só lendo partidas.", MX, 5.95, 11.5, 0.5, { fontSize: 20, bold: true });
}

// 4. Acesso ao Colab
{
  const s = base("Preparação", "Abrindo o notebook", `
Até 8 minutos. Espere todos concluírem antes de seguir; os monitores circulam.

Sem "Salvar uma cópia no Drive", as alterações se perdem. Sem GPU, a Parte 3 fica lenta demais; quem não conseguir GPU faz a Parte 3 em dupla.

Peça que executem as duas células da seção 0. A segunda deve imprimir "Dispositivo: cuda". Comente que algumas células aparecem só com um título: o código está escondido de propósito.`);
  const steps = [
    ["1", "Abra o link", COLAB_URL],
    ["2", "Salve uma cópia", "Arquivo > Salvar uma cópia no Drive"],
    ["3", "Ative a GPU", "Ambiente de execução > Alterar o tipo de ambiente > T4 GPU"],
    ["4", "Execute as células da seção 0", "Clique na célula e aperte Shift + Enter. A segunda deve imprimir: Dispositivo: cuda"],
  ];
  let y = 1.8;
  steps.forEach(([num, head, body]) => {
    t(s, num, MX, y, 0.7, 0.8, { fontFace: F.title, fontSize: 40, color: C.accent, bold: true });
    t(s, head, MX + 0.9, y + 0.05, 10, 0.4, { fontSize: 20, bold: true });
    t(s, body, MX + 0.9, y + 0.47, 11.2, 0.4, { fontSize: 15, color: C.muted, fontFace: num === "1" ? F.mono : F.body });
    y += 1.12;
  });
  t(s, "Você só precisa de um navegador e de uma conta Google.", MX, 6.45, 11, 0.4, { fontSize: 14, italic: true, color: C.muted });
}

// 5. Linha do tempo
{
  const s = base("A história", "Uma ideia de 2017 que mudou a computação", `
O objetivo é mostrar que o assunto de hoje não é um detalhe técnico: é a base de quase tudo que se chama de IA hoje.

2017: oito pesquisadores do Google publicam "Attention Is All You Need", pensando em tradução automática. Hoje é um dos artigos mais citados da história da computação.
2018: a OpenAI lança o primeiro GPT e o Google lança o BERT. Os dois são Transformers.
2020: o GPT-3 mostra que, aumentando o modelo, ele passa a fazer coisas que ninguém ensinou. A atenção chega às imagens (Vision Transformer) e à biologia (AlphaFold 2, que prevê a forma de proteínas).
2022: o ChatGPT chega ao público e alcança 100 milhões de usuários em cerca de dois meses.
Hoje: ChatGPT, Claude, Gemini, Copilot. Em 2024, os criadores do AlphaFold dividiram o Nobel de Química.

Frase para fechar: o T de GPT significa Transformer. Generative Pre-trained Transformer.`);
  const marcos = [
    ["2017", "O Google publica Attention Is All You Need"],
    ["2018", "Surgem os primeiros GPT e BERT, ambos Transformers"],
    ["2020", "GPT-3. A atenção chega às imagens e às proteínas"],
    ["2022", "ChatGPT: 100 milhões de usuários em dois meses"],
    ["Hoje", "ChatGPT, Claude, Gemini, Copilot. Nobel de 2024 para o AlphaFold"],
  ];
  const y0 = 2.6, x0 = MX + 0.3, passo = 2.45;
  s.addShape(pres.shapes.LINE, { x: x0, y: y0, w: passo * 4 + 0.2, h: 0, line: { color: C.line, width: 2 } });
  marcos.forEach(([ano, txt], i) => {
    const x = x0 + i * passo;
    s.addShape(pres.shapes.OVAL, { x: x - 0.14, y: y0 - 0.14, w: 0.28, h: 0.28, fill: { color: i === 0 ? C.accent : C.blue }, line: { color: C.white, width: 1 } });
    t(s, ano, x - 0.6, y0 - 0.75, 1.6, 0.5, { fontFace: F.title, fontSize: 24, bold: true, color: i === 0 ? C.accent : C.ink });
    t(s, txt, x - 0.1, y0 + 0.35, 2.25, 1.6, { fontSize: 15 });
  });
  box(s, MX, 5.0, W - 2 * MX, 1.2, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: "O \"T\" de ChatGPT significa ", options: {} },
    { text: "Transformer", options: { bold: true, color: C.accent } },
    { text: ". É ele que vamos construir hoje.", options: {} },
  ], MX + 0.3, 5.0, W - 2 * MX - 0.6, 1.2, { fontFace: F.title, fontSize: 24, valign: "middle" });
}

// 6. Antes de 2017
{
  const s = base("A história", "Antes de 2017: ler uma palavra de cada vez", `
Os modelos anteriores (redes recorrentes) liam o texto como nós lemos em voz alta: uma palavra por vez, guardando um resumo na memória.

Problema 1, esquecer: quando o modelo chega em "ele", a informação sobre "gato" já passou por várias palavras e foi se diluindo, como num telefone sem fio.

Problema 2, lentidão: a palavra 5 só pode ser lida depois da 4. Não dá para dividir o trabalho entre os milhares de núcleos de uma GPU.

A atenção resolve os dois de uma vez, e é isso que vem no próximo slide.`);
  const palavras = ["O", "gato", "subiu", "no", "telhado", "porque", "ele", "estava", "com", "medo"];
  const cs = frase(s, palavras, MX, 1.9, W - 2 * MX, { fs: 16, estilo: { 1: { fill: C.b1, line: C.blue, bold: true }, 6: { line: C.accent, bold: true, color: C.accent } } });
  arrow(s, cs[0].cx, 2.85, cs[cs.length - 1].cx, 2.85, { color: C.muted, w: 2 });
  t(s, "uma palavra por vez, passando um resumo adiante", MX, 3.0, W - 2 * MX, 0.4, { fontSize: 15, color: C.muted, italic: true, align: "center" });
  const probs = [
    ["Esquece", "Quando chega em \"ele\", o \"gato\" já ficou lá atrás. É como um telefone sem fio: a mensagem se perde no caminho."],
    ["É lento", "Cada palavra espera a anterior. Não dá para aproveitar a GPU, que faz milhares de contas ao mesmo tempo."],
  ];
  probs.forEach(([h, b], i) => {
    const x = MX + i * 6.1;
    t(s, h, x, 4.05, 5.6, 0.5, { fontSize: 22, bold: true, color: C.accent });
    t(s, b, x, 4.6, 5.6, 1.5, { fontSize: 18 });
  });
}

// 7. Próximo token
{
  const s = base("A ideia", "Um modelo de linguagem adivinha o que vem depois", `
Defina o jogo antes da arquitetura. O ChatGPT, no fundo, faz uma coisa só: olha o texto até aqui e dá uma chance para cada continuação possível. Gerar texto é repetir isso: sortear, acrescentar, prever de novo.

Os números do gráfico são ilustrativos. A pergunta que guia o resto: como a previsão usa as palavras anteriores? Para adivinhar "rainha", o modelo precisa prestar atenção em "rei" e em "protege". Essa é a atenção.`);
  t(s, [
    { text: "o rei protege a ", options: {} },
    { text: "____", options: { color: C.accent, bold: true } },
  ], MX, 1.8, 6, 0.6, { fontFace: F.title, fontSize: 32 });
  const passos = [
    ["Treinar", "mostrar muito texto e ajustar o modelo até ele dar a maior chance à palavra certa."],
    ["Gerar", "sortear uma palavra, acrescentar ao texto e prever de novo. É assim que o ChatGPT escreve."],
  ];
  passos.forEach(([h, b], i) => {
    t(s, h, MX, 3.0 + i * 1.3, 5.5, 0.45, { fontSize: 20, bold: true, color: C.accent });
    t(s, b, MX, 3.45 + i * 1.3, 5.5, 0.85, { fontSize: 17 });
  });
  img(s, "ch_nexttoken.png", 7.0, 1.7, 5.6, 4.6);
}

// 8. A ideia da atenção
{
  const s = base("A ideia", "A atenção: cada palavra olha para todas as outras", `
A ideia central do artigo. Em vez de passar a informação de mão em mão, cada palavra olha diretamente para todas as anteriores e decide quanto cada uma importa para ela.

Aqui, "ele" presta muita atenção em "gato", porque é quem "ele" é. Ninguém programa isso: o modelo aprende sozinho, no treino, onde vale a pena olhar.

Isso resolve os dois problemas: nada se perde no caminho (a distância não importa) e todas as palavras fazem isso ao mesmo tempo, o que a GPU faz muito bem.`);
  const palavras = ["O", "gato", "subiu", "no", "telhado", "porque", "ele"];
  const pesos = [0.03, 0.62, 0.06, 0.02, 0.13, 0.04, 0.10];
  const x0 = MX + 0.8, w = W - 2 * MX - 1.6;
  const base_y = 4.3, hmax = 2.0;
  const cs = frase(s, palavras, x0, base_y + 0.15, w, { fs: 18, estilo: { 1: { fill: C.b1, line: C.blue, bold: true }, 6: { line: C.accent, bold: true, color: C.accent } } });
  cs.forEach((c, i) => {
    const h = Math.max(0.04, pesos[i] / 0.62 * hmax);
    s.addShape(pres.shapes.RECTANGLE, { x: c.x + 0.25, y: base_y - h, w: c.w - 0.5, h, fill: { color: shade(pesos[i] / 0.62) === C.white ? C.b1 : shade(pesos[i] / 0.62) }, line: { color: C.blue, width: 0.75 } });
    t(s, `${Math.round(pesos[i] * 100)}%`, c.x, base_y - h - 0.4, c.w, 0.35, { align: "center", fontSize: 14, color: C.muted });
  });
  t(s, "quanto \"ele\" presta atenção em cada palavra", x0, 1.6, w, 0.4, { fontSize: 15, color: C.muted, italic: true, align: "center" });
  t(s, "Nada se perde no caminho, e todas as palavras fazem isso ao mesmo tempo.", MX, 5.65, W - 2 * MX, 0.6, { fontSize: 20, fontFace: F.title, align: "center" });
}

// 9. Palavras viram números
{
  const s = base("A ideia", "Para o computador, palavras viram listas de números", `
Pré-requisito para entender Q, K e V. O computador não entende letras; cada palavra (no nosso caso, cada caractere) vira uma lista de números, chamada vetor.

Os números não são escolhidos à mão: o modelo aprende no treino. Palavras com papel parecido acabam com números parecidos (rei e rainha, abaixo).

Uma frase vira uma tabela (matriz): uma linha por palavra. Toda a conta da atenção é feita com essas tabelas.`);
  const linhas = [["rei", "0.9   0.8   0.1"], ["rainha", "0.9   0.7   0.9"], ["peão", "0.1   0.2   0.3"]];
  linhas.forEach(([p, v], i) => {
    const y = 2.0 + i * 0.95;
    box(s, MX, y, 1.8, 0.7, p, { fs: 18, bold: true });
    arrow(s, MX + 1.9, y + 0.35, MX + 2.8, y + 0.35);
    box(s, MX + 2.9, y, 3.0, 0.7, `[ ${v} ]`, { fs: 18, font: F.mono, fill: C.b1, lineColor: C.blue });
  });
  t(s, "palavra", MX, 1.55, 1.8, 0.4, { align: "center", fontSize: 13, color: C.muted, bold: true });
  t(s, "vetor (lista de números)", MX + 2.9, 1.55, 3.0, 0.4, { align: "center", fontSize: 13, color: C.muted, bold: true });
  const pts = [
    ["O modelo aprende esses números", "no treino. Ninguém escolhe à mão."],
    ["Palavras parecidas", "ficam com números parecidos: veja rei e rainha."],
    ["Uma frase vira uma tabela", "com uma linha por palavra. É com ela que a atenção trabalha."],
  ];
  pts.forEach(([h, b], i) => {
    t(s, h, 7.0, 1.9 + i * 1.2, 5.6, 0.4, { fontSize: 19, bold: true });
    t(s, b, 7.0, 2.3 + i * 1.2, 5.6, 0.7, { fontSize: 17, color: C.muted });
  });
}

// 10. Query, key, value
{
  const s = base("A ideia", "Query, key e value: como uma busca no YouTube", `
A analogia que mais funciona. Na busca do YouTube, o que você digita (query) é comparado com o título de cada vídeo (key); os vídeos mais parecidos aparecem primeiro; e o que você recebe é o vídeo em si (value).

Na atenção, cada palavra produz os três: uma pergunta (o que ela procura), uma etiqueta (o que ela oferece) e um conteúdo (o que ela entrega).

A diferença: o YouTube te dá uma lista e você escolhe um vídeo. A atenção não escolhe um só: ela mistura um pouco de cada conteúdo, mais dos que combinam melhor.`);
  const cols = [
    ["Query (Q)", "o que você digita", "\"gol de bicicleta\"", "o que a palavra procura"],
    ["Key (K)", "o título de cada vídeo", "\"Top 10 gols de bicicleta\"", "o que a palavra oferece"],
    ["Value (V)", "o vídeo em si", "o vídeo que você assiste", "o conteúdo que a palavra entrega"],
  ];
  cols.forEach(([h, a, ex, b], i) => {
    const x = MX + i * 4.05;
    t(s, h, x, 1.7, 3.8, 0.55, { fontFace: F.title, fontSize: 26, bold: true, color: i === 0 ? C.accent : C.blue });
    t(s, "No YouTube", x, 2.35, 3.8, 0.35, { fontSize: 13, color: C.muted, bold: true });
    t(s, a, x, 2.7, 3.8, 0.45, { fontSize: 18 });
    t(s, ex, x, 3.15, 3.8, 0.45, { fontSize: 15, italic: true, color: C.muted });
    t(s, "Na frase", x, 3.8, 3.8, 0.35, { fontSize: 13, color: C.muted, bold: true });
    t(s, b, x, 4.15, 3.8, 0.5, { fontSize: 18 });
  });
  box(s, MX, 5.35, W - 2 * MX, 1.0, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, "A diferença: a atenção não escolhe um vídeo só. Ela mistura um pouco de cada, mais dos que combinam melhor.", MX + 0.3, 5.35, W - 2 * MX - 0.6, 1.0, { fontSize: 18, valign: "middle" });
}

// 11. Dicionário
{
  const s = base("A ideia", "Uma busca que mistura as respostas", `
O mesmo exemplo do notebook. Num dicionário comum, a consulta precisa ser exata. Na atenção, a consulta é comparada com todas as chaves, cada comparação vira um peso, e a resposta é a mistura dos valores com esses pesos.

A consulta "cavalo + bispo" divide o peso entre os dois, e o resultado é cerca de 3, o valor de ambos. Pergunte à turma: e "peão + dama"? (Cerca de 5.)`);
  const pecas = ["peão", "cavalo", "bispo", "torre", "dama"];
  const pesos = [0.01, 0.49, 0.49, 0.01, 0.01];
  const vals = ["1", "3", "3", "5", "9"];
  box(s, MX, 2.95, 2.4, 0.9, "cavalo + bispo", { fill: C.soft, lineColor: C.accent, lw: 1.5, fs: 16, bold: true });
  t(s, "o que procuro (query)", MX - 0.2, 2.5, 2.8, 0.4, { align: "center", fontSize: 13, color: C.accent, bold: true });
  const x0 = 4.2, y0 = 1.95, rh = 0.55;
  [["peça (key)", x0 - 0.1, 2.0], ["peso", x0 + 2.0, 1.4], ["pontos (value)", x0 + 3.4, 1.6]].forEach(([h, x, w]) => t(s, h, x, y0 - 0.45, w, 0.4, { align: "center", fontSize: 13, color: C.muted, bold: true }));
  pecas.forEach((p, i) => {
    const y = y0 + i * rh;
    box(s, x0, y, 1.8, rh - 0.08, p, { fs: 15 });
    s.addShape(pres.shapes.RECTANGLE, { x: x0 + 2.0, y, w: 1.4, h: rh - 0.08, fill: { color: shade(pesos[i] * 1.6) }, line: { color: C.line, width: 0.75 } });
    t(s, `${Math.round(pesos[i] * 100)}%`, x0 + 2.0, y, 1.4, rh - 0.08, { align: "center", valign: "middle", fontSize: 15, color: pesos[i] > 0.3 ? C.white : C.ink });
    box(s, x0 + 3.6, y, 1.2, rh - 0.08, vals[i], { fs: 15 });
  });
  arrow(s, MX + 2.45, 3.4, x0 - 0.1, 3.4);
  arrow(s, x0 + 4.95, 3.4, 10.35, 3.4);
  t(s, "mistura", x0 + 4.95, 2.95, 1.2, 0.4, { fontSize: 13, color: C.muted, align: "center" });
  box(s, 10.45, 2.95, 2.0, 0.9, "3.05", { fs: 26, font: F.title, bold: true, lineColor: C.ink });
  t(s, "resposta", 10.45, 2.5, 2.0, 0.4, { align: "center", fontSize: 13, color: C.muted, bold: true });
  t(s, "Em vez de achar uma única entrada, a atenção mistura todas, dando mais peso às que combinam com a consulta.", MX, 5.25, 11.8, 0.9, { fontSize: 19 });
}

// 12. Passo 1
{
  const s = base("Os três passos", "Passo 1: comparar", `
A partir daqui, os slides seguem exatamente o Exercício 1 do notebook, com os mesmos números.

Cada palavra tem uma query e uma key (aqui, listas de dois números). Comparar é multiplicar a query de uma pela key da outra e somar: quanto maior o resultado, mais elas combinam. Em Python, Q @ K.T faz todas as comparações de uma vez.

Leia a tabela por linhas: a linha "rainha" compara a pergunta de "rainha" com cada palavra. A divisão por raiz de d_k só evita números grandes demais; não precisa entrar nisso.`);
  t(s, "1", MX, 1.6, 0.8, 1.0, { fontFace: F.title, fontSize: 60, bold: true, color: C.accent });
  t(s, "Cada palavra compara o que procura (query) com o que cada uma das outras oferece (key).", MX + 0.9, 1.75, 5.0, 1.3, { fontSize: 19 });
  t(s, "Número maior: combinam mais.", MX + 0.9, 3.1, 5.0, 0.5, { fontSize: 17, color: C.muted });
  codigo(s, [[["scores = Q @ ", ""], ["K.T", "lac"], [" / np.sqrt(d_k)", ""]]], MX, 4.4, 5.9);
  t(s, "K.T é a tabela K \"deitada\" (transposta), para comparar linha com linha.", MX, 5.45, 5.9, 0.7, { fontSize: 14, color: C.muted, italic: true });
  tabelaNum(s, 8.5, 2.3, 1.15, SCORES, P3, P3, { max: 1.41 });
  t(s, "scores (comparações)", 8.5, 5.85, 3.45, 0.4, { align: "center", fontSize: 14, color: C.muted });
}

// 13. Passo 2
{
  const s = base("Os três passos", "Passo 2: pesar", `
A softmax transforma cada linha de scores em porcentagens que somam 100%. O maior score leva a maior fatia, mas ninguém fica com zero.

Exemplo da linha "rainha": ela combina mais com ela mesma (1.41), então fica com 50% da atenção; o resto se divide entre "rei" e "protege".

No notebook, a softmax já vem pronta. O aluno só escreve pesos = softmax(scores).`);
  t(s, "2", MX, 1.6, 0.8, 1.0, { fontFace: F.title, fontSize: 60, bold: true, color: C.accent });
  t(s, "A softmax transforma cada linha em porcentagens que somam 100%.", MX + 0.9, 1.75, 5.0, 1.3, { fontSize: 19 });
  t(s, "Quem combina mais leva a maior fatia.", MX + 0.9, 3.1, 5.0, 0.5, { fontSize: 17, color: C.muted });
  codigo(s, [[["pesos = ", ""], ["softmax", "lac"], ["(scores)", ""]]], MX, 4.4, 5.9);
  tabelaNum(s, 8.5, 2.3, 1.15, PESOS, P3, P3, { max: 0.5, fmt: (v) => `${Math.round(v * 100)}%` });
  t(s, "pesos: cada linha soma 100%", 8.5, 5.85, 3.45, 0.4, { align: "center", fontSize: 14, color: C.muted });
}

// 14. Passo 3
{
  const s = base("Os três passos", "Passo 3: misturar", `
Cada palavra recebe uma mistura dos conteúdos (values) de todas, com as porcentagens do passo 2.

Faça a conta da linha "rei" em voz alta: 40% de [10, 0] + 20% de [0, 10] + 40% de [5, 5] = [4, 0] + [0, 2] + [2, 2] = [6, 4].

O resultado é a nova versão de cada palavra, agora com informação das outras. É isso que "prestar atenção" quer dizer na prática.`);
  t(s, "3", MX, 1.6, 0.8, 1.0, { fontFace: F.title, fontSize: 60, bold: true, color: C.accent });
  t(s, "Cada palavra recebe uma mistura dos conteúdos (values), com essas porcentagens.", MX + 0.9, 1.75, 5.0, 1.3, { fontSize: 19 });
  codigo(s, [[["saida = pesos @ ", ""], ["V", "lac"]]], MX, 3.4, 5.9);
  box(s, MX, 4.55, 5.9, 1.55, undefined, { fill: C.white, lineColor: C.line });
  t(s, [
    { text: "rei recebe:", options: { bold: true, breakLine: true } },
    { text: "40% de rei + 20% de protege + 40% de rainha", options: { breakLine: true } },
    { text: "= [6, 4]", options: { bold: true, color: C.accent } },
  ], MX + 0.25, 4.65, 5.5, 1.4, { fontSize: 16, paraSpaceAfter: 4 });
  tabelaNum(s, 7.9, 2.3, 0.85, VS, P3, ["", ""], { semCor: true, fmt: (v) => String(v), fs: 15 });
  t(s, "V", 7.9, 4.95, 1.7, 0.4, { align: "center", fontSize: 14, color: C.muted });
  arrow(s, 9.85, 3.55, 10.45, 3.55);
  tabelaNum(s, 11.4, 2.3, 0.85, SAIDA, P3, ["", ""], { max: 6, fmt: (v) => String(v), fs: 15 });
  t(s, "saída", 11.4, 4.95, 1.7, 0.4, { align: "center", fontSize: 14, color: C.muted });
}

// 15. A fórmula
{
  const s = base("Os três passos", "Os três passos numa linha: a fórmula do artigo", `
A única fórmula do workshop, e a turma acabou de fazer cada pedaço dela. Aponte para cada parte enquanto fala: Q K transposta é comparar, softmax é pesar, multiplicar por V é misturar.

Mensagem: esta linha, de 2017, é o coração do ChatGPT. O resto do Transformer é organização em volta dela.`);
  eqW(s, "eq_attention.png", 2.2, 1.65, 8.9);
  const steps = [
    ["1", "Comparar", "Q @ K.T"],
    ["2", "Pesar", "softmax"],
    ["3", "Misturar", "@ V"],
  ];
  steps.forEach(([num, h, b], i) => {
    const x = MX + i * 4.05;
    t(s, num, x, 3.85, 0.6, 0.7, { fontFace: F.title, fontSize: 34, bold: true, color: C.accent });
    t(s, h, x + 0.6, 3.95, 3.2, 0.45, { fontSize: 20, bold: true });
    t(s, b, x + 0.6, 4.45, 3.2, 0.5, { fontSize: 17, fontFace: F.mono, color: C.muted });
  });
  t(s, "Esta linha é o coração do ChatGPT. O resto do Transformer é organização em volta dela.", MX, 5.75, 11.8, 0.6, { fontSize: 20, fontFace: F.title });
}

// 16. Máscara causal
{
  const s = base("Os três passos", "Ninguém olha para o futuro", `
O modelo escreve uma palavra de cada vez. Na hora de escrever a terceira, a quarta ainda não existe; então, no treino, cada palavra só pode olhar para ela mesma e para as anteriores.

Mostre a tabela da direita: a parte de cima ficou zerada, e cada linha continua somando 100%. É o Exercício 2, que é uma linha: np.tril (triângulo de baixo) aplicado a uma tabela de 1s.`);
  const toks = ["o", "rei", "protege", "a", "rainha"];
  const S = [[1.2, null, null, null, null], [0.3, 2.1, null, null, null], [0.8, 1.7, 0.4, null, null], [0.1, 0.6, 0.9, 1.1, null], [0.2, 1.9, 1.3, 0.5, 0.7]];
  const P = S.map((r) => { const e = r.map((v) => v === null ? 0 : Math.exp(v)); const z = e.reduce((a, b) => a + b, 0); return e.map((v) => v / z); });
  grid(s, 2.1, 2.2, 0.68, P, { text: P.map((r) => r.map((v) => v === 0 ? "0" : `${Math.round(v * 100)}%`)), rows: toks, cols: toks, fs: 13, lfs: 14 });
  t(s, "pesos de atenção com a máscara", 2.1, 5.7, 3.4, 0.35, { align: "center", fontSize: 14, color: C.muted });
  t(s, "Cada palavra só olha para ela mesma e para as anteriores. Acima da diagonal, o peso é zero.", 6.6, 2.2, 6.0, 1.3, { fontSize: 20, fontFace: F.title });
  t(s, "Por quê? Na hora de escrever uma palavra, as seguintes ainda não existem.", 6.6, 3.55, 6.0, 0.9, { fontSize: 17, color: C.muted });
  codigo(s, [[["np.tril(", ""], ["np.ones((T, T))", "lac"], [")", ""]]], 6.6, 4.65, 6.0);
  t(s, "tril = triângulo de baixo", 6.6, 5.7, 6.0, 0.4, { fontSize: 14, color: C.muted, italic: true });
}

// 17. Prática 1
{
  const s = base("Prática", "Parte 1 no notebook: a atenção", `
Tempo previsto: 15 minutos.

Os exercícios são de lacuna: o aluno troca ___ pela resposta, que está no comentário da própria célula. Cada célula confere sozinha.

Se aparecer "ainda há ___ no código", falta trocar alguma lacuna. Se aparecer "name 'scores' is not defined", a célula anterior não foi executada.

No fim, todos rodam o dicionário e os mapas de atenção. Comente que os padrões ainda são aleatórios porque os números não foram treinados.`);
  const ex = [
    ["Seção 1.1", "o exemplo das três palavras"],
    ["Exercício 1", "os três passos: comparar, pesar, misturar"],
    ["Experimente", "o dicionário de peças de xadrez"],
    ["Exercício 2", "a máscara causal"],
  ];
  ex.forEach(([h, b], i) => {
    const y = 1.75 + i * 0.7;
    t(s, h, MX, y, 2.2, 0.5, { fontSize: 18, bold: true, color: h.startsWith("Exerc") ? C.ink : C.muted });
    t(s, b, MX + 2.3, y, 4.2, 0.5, { fontSize: 17 });
  });
  codigo(s, [
    [["scores = Q @ ", ""], ["___", "lac"], ["  # troque por K.T", "com"]],
    [["pesos = ", ""], ["___", "lac"], ["(scores)  # troque por softmax", "com"]],
    [["saida = pesos @ ", ""], ["___", "lac"], ["  # troque por V", "com"]],
    [["return np.tril(", ""], ["___", "lac"], [")", ""]],
    [["# troque por np.ones((T, T))", "com"]],
  ], 7.0, 1.7, 5.65, { fs: 14 });
  box(s, MX, 5.6, W - 2 * MX, 1.0, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, "Troque cada ___ pela resposta do comentário e aperte Shift + Enter. A célula diz se está correto.", MX + 0.3, 5.6, W - 2 * MX - 0.6, 1.0, { fontSize: 18, valign: "middle" });
}

// 18. O Transformer em uma imagem
{
  const s = base("O Transformer", "O Transformer em uma imagem", `
O modelo inteiro em um diagrama. Percorra da esquerda para a direita.

1. Cada caractere vira um vetor, e soma-se um vetor de posição, porque a atenção sozinha não sabe a ordem.
2. O bloco tem duas etapas: atenção (as palavras trocam informação) e feed-forward (cada palavra "pensa sozinha"). Na prática, são várias atenções em paralelo, cada uma procurando uma coisa diferente.
3. Cada etapa soma o seu resultado ao que já havia, em vez de substituir (conexão residual). Analogia: anotar na margem em vez de apagar e reescrever. É o Exercício 3.
4. No fim, uma chance para cada caractere possível.

Se alguém perguntar pelo artigo original: ele tinha duas pilhas (encoder e decoder) porque fazia tradução. O GPT, e o nosso modelo, usam só uma.`);
  const y = 2.35, h = 1.35;
  box(s, MX, y, 1.75, h, "caracteres", { fs: 15 });
  arrow(s, MX + 1.8, y + h / 2, MX + 2.25, y + h / 2);
  box(s, MX + 2.3, y, 1.85, h, "vetores\n+ posição", { fs: 15 });
  arrow(s, MX + 4.2, y + h / 2, MX + 4.65, y + h / 2);
  s.addShape(pres.shapes.RECTANGLE, { x: MX + 4.7, y: y - 0.45, w: 4.3, h: h + 0.9, fill: { color: C.soft }, line: { color: C.blue, width: 1.25, dashType: "dash" } });
  t(s, "um bloco, repetido várias vezes", MX + 4.7, y - 0.88, 4.3, 0.38, { align: "center", fontSize: 14, color: C.blue, bold: true });
  box(s, MX + 4.95, y, 1.75, h, "atenção", { fs: 16, fill: C.b1, lineColor: C.blue, bold: true });
  arrow(s, MX + 6.75, y + h / 2, MX + 6.95, y + h / 2);
  box(s, MX + 7.0, y, 1.75, h, "feed-\nforward", { fs: 16, fill: C.white });
  arrow(s, MX + 9.05, y + h / 2, MX + 9.5, y + h / 2);
  box(s, MX + 9.55, y, 2.35, h, "chance de cada\npróximo caractere", { fs: 15, fill: C.soft });
  const notas = [
    ["Atenção", "as palavras trocam informação entre si. É o que vocês acabaram de fazer."],
    ["Feed-forward", "cada palavra \"pensa sozinha\" sobre o que recebeu."],
    ["Soma, não substitui", "cada etapa acrescenta anotações ao que já existia, como escrever na margem em vez de apagar."],
  ];
  notas.forEach(([h2, b], i) => {
    t(s, h2, MX + i * 4.05, 4.75, 3.8, 0.4, { fontSize: 18, bold: true, color: i === 2 ? C.accent : C.ink });
    t(s, b, MX + i * 4.05, 5.2, 3.8, 1.2, { fontSize: 15 });
  });
}

// 19. Prática 2
{
  const s = base("Prática", "Parte 2 no notebook: o Transformer", `
Tempo previsto: 18 minutos. Ao final, peça que executem as seções 3.1 e 3.2 antes do intervalo.

A seção 2.1 só precisa ser executada: o código está escondido (formulário do Colab). Quem tiver curiosidade clica duas vezes no título.

O Exercício 3 é trocar os dois ___ por x. Isso é a conexão residual: somar em vez de substituir.

Depois, todos treinam o modelo de ordenação (cerca de 30 segundos) e olham os gráficos de atenção.`);
  const ex = [
    ["Executar", "as peças prontas do Transformer"],
    ["Exercício 3", "o bloco: somar em vez de substituir"],
    ["Experimente", "treinar o modelo de ordenação"],
    ["Experimente", "ver para onde ele olhou"],
  ];
  ex.forEach(([h, b], i) => {
    const y = 1.75 + i * 0.7;
    t(s, h, MX, y, 2.2, 0.5, { fontSize: 18, bold: true, color: h.startsWith("Exerc") ? C.ink : C.muted });
    t(s, b, MX + 2.3, y, 4.2, 0.5, { fontSize: 17 });
  });
  codigo(s, [
    [["# troque os dois ___ por x", "com"]],
    [["x = ", ""], ["___", "lac"], [" + self.attn(self.ln1(x))", ""]],
    [["x = ", ""], ["___", "lac"], [" + self.ffn(self.ln2(x))", ""]],
  ], 7.0, 1.7, 5.65, { fs: 14 });
  box(s, MX, 5.6, W - 2 * MX, 1.0, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, "Antes do intervalo: execute as seções 3.1 e 3.2. O modelo de xadrez treina enquanto vocês descansam.", MX + 0.3, 5.6, W - 2 * MX - 0.6, 1.0, { fontSize: 18, valign: "middle" });
}

// 20. Ordenação
{
  const s = base("Prática", "O que o modelo de ordenação aprendeu", `
Resultado real do modelo da seção 2.4, para a entrada 3 1 4 1 5 9 2 6.

Cada linha é um passo da resposta; cada coluna, uma posição que o modelo pode olhar. Em cada passo, a parte escura cai sobre o número da entrada que ele vai escrever em seguida: para escrever o 9, ele olha para o 9.

Ninguém programou essa regra. O modelo só viu exemplos de entrada e saída, e a atenção virou um mecanismo de busca sozinha. Na turma, os gráficos variam de execução para execução; em geral, pelo menos uma das atenções mostra esse padrão.`);
  const d = png("sort_heatmap.png");
  const h = 4.6, w = h * d.w / d.h;
  s.addImage({ path: A("sort_heatmap.png"), x: MX, y: 1.65, w, h });
  const x2 = MX + w + 0.4;
  t(s, "Entrada: 3 1 4 1 5 9 2 6", x2, 1.8, W - x2 - MX, 0.5, { fontFace: F.mono, fontSize: 15 });
  t(s, "Em cada passo, o modelo olha para o número da entrada que vai escrever em seguida.", x2, 2.5, W - x2 - MX, 1.6, { fontSize: 18, bold: true });
  t(s, "Ninguém programou essa regra: ela surgiu do treino.", x2, 4.2, W - x2 - MX, 1.0, { fontSize: 17, color: C.accent });
}

// 21. Intervalo
{
  const s = base("Intervalo", null, `
Intervalo de 5 minutos. Antes de liberar a turma, confirme que a maioria executou as seções 3.1 e 3.2: a célula de treino deve estar imprimindo "passo ... | erro ...".

Quem estiver sem GPU interrompe o treino e usa o modelo de referência na seção 3.4.`);
  t(s, "Intervalo", MX, 1.9, 8, 1.0, { fontFace: F.title, fontSize: 54, bold: true });
  box(s, MX, 3.6, 7.4, 1.6, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: "Antes de sair, execute as seções 3.1 e 3.2.", options: { bold: true, breakLine: true } },
    { text: "O modelo de xadrez treina enquanto isso.", options: {} },
  ], MX + 0.3, 3.8, 6.9, 1.3, { fontSize: 19, paraSpaceAfter: 6 });
  chessboard(s, 9.0, 1.9, 0.44);
}

// 22. Xadrez como linguagem
{
  const s = base("Xadrez", "Xadrez é só mais um texto", `
Para o modelo, uma partida é uma linha de texto. Explique a notação em 30 segundos: a letra da peça e a casa de destino (Nf3 é o cavalo indo para f3); peão não tem letra. Não é preciso saber jogar: o tabuleiro do notebook mostra os lances possíveis.

São 60 mil partidas reais do Lichess. O modelo conhece só 33 caracteres e faz sempre a mesma coisa: prever o próximo.

A pergunta interessante: ele nunca vê o tabuleiro. Se mesmo assim joga lances válidos, alguma ideia de onde estão as peças surgiu dentro dele. Pesquisadores (Karvonen, 2024) conseguem ler o tabuleiro nas ativações de modelos assim. O modelo de referência acerta cerca de 85% dos lances; o da turma, bem menos. Os números aparecem na seção 3.4.`);
  box(s, MX, 1.75, 7.2, 1.3, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: ";1.e4 e5 2.Nf3 Nc6 3.Bb5 a6", options: { breakLine: true } },
    { text: " 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 ...", options: {} },
  ], MX + 0.3, 1.9, 6.8, 1.0, { fontFace: F.mono, fontSize: 18, paraSpaceAfter: 4 });
  const hdr = (x) => ({ text: x, options: { bold: true, fill: { color: C.soft } } });
  s.addTable([
    [hdr("Escrito"), hdr("Significa")],
    ["e4", "um peão vai para e4"],
    ["Nf3", "o cavalo (N) vai para f3"],
    ["Bxe5", "o bispo (B) captura em e5"],
    ["#", "xeque-mate"],
  ], { x: 8.3, y: 1.75, w: 4.33, colW: [1.4, 2.93], fontFace: F.body, fontSize: 14, border: { type: "solid", pt: 0.5, color: C.line }, rowH: 0.45, margin: 0.08, valign: "middle" });
  const stats = [["60 mil", "partidas reais"], ["33", "caracteres diferentes"], ["0", "tabuleiros vistos pelo modelo"]];
  stats.forEach(([big, small], i) => {
    const x = MX + i * 2.55;
    t(s, big, x, 3.55, 2.4, 0.9, { fontFace: F.title, fontSize: 40, bold: true, color: i === 2 ? C.accent : C.blue });
    t(s, small, x, 4.45, 2.4, 0.6, { fontSize: 14, color: C.muted });
  });
  t(s, "Se o modelo joga lances válidos sem nunca ter visto um tabuleiro, de onde vem essa noção de onde estão as peças?", MX, 5.55, 11.8, 0.9, { fontSize: 19, fontFace: F.title });
}

// 23. Prática 3
{
  const s = base("Prática", "Parte 3 no notebook: xadrez", `
Tempo previsto: 22 minutos. O treino da seção 3.2 já terminou no intervalo.

Roteiro: gerar partidas e ver em que lance cada uma erra (3.3); mexer no controle de temperatura; comparar o próprio modelo com o de referência (3.4); jogar (3.5). A 3.6 é para quem terminar antes.

Para jogar não é preciso saber xadrez: clicando numa peça, os pontos mostram os lances possíveis. Se a turma quiser uma partida de demonstração, use as duas da cola.`);
  const ex = [
    ["3.3", "gerar partidas e ver onde o modelo erra"],
    ["3.3", "mexer no controle de temperatura"],
    ["3.4", "seu modelo contra o modelo de referência"],
    ["3.5", "jogar uma partida contra o modelo"],
  ];
  ex.forEach(([sec, b], i) => {
    const y = 1.85 + i * 0.85;
    t(s, `seção ${sec}`, MX, y, 1.6, 0.5, { fontSize: 15, color: C.muted });
    t(s, b, MX + 1.8, y, 9.5, 0.5, { fontSize: 21, bold: i === 3 });
  });
  box(s, MX, 5.6, W - 2 * MX, 1.0, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, "Não precisa saber xadrez: clique numa peça e os pontos mostram para onde ela pode ir.", MX + 0.3, 5.6, W - 2 * MX - 0.6, 1.0, { fontSize: 18, valign: "middle" });
}

// 24. Por que mudou tudo
{
  const s = base("Encerramento", "Por que a atenção mudou tudo", `
Feche o arco que começou na linha do tempo. Três motivos, todos visíveis no que a turma fez hoje.

Rápido: todas as palavras fazem a conta ao mesmo tempo. A GPU, que faz milhares de contas em paralelo, encaixa perfeitamente.

Escala: por ser rápido de treinar, deu para fazer modelos enormes. E descobriu-se que quanto maior o modelo e mais dados, melhor ele fica.

Serve para tudo: qualquer coisa que vire uma sequência entra no mesmo modelo. Texto, código, imagens (cortadas em pedacinhos), som, proteínas. Hoje, xadrez.`);
  const cols = [
    ["Rápido", "Todas as palavras fazem a conta ao mesmo tempo. Encaixa perfeitamente nas GPUs."],
    ["Escala", "Rápido de treinar, deu para fazer modelos enormes. E quanto maior, melhor ele fica."],
    ["Serve para tudo", "Texto, código, imagens, som, proteínas. Tudo que vira uma sequência. Hoje, xadrez."],
  ];
  cols.forEach(([h, b], i) => {
    const x = MX + i * 4.05;
    t(s, String(i + 1), x, 1.8, 0.6, 0.8, { fontFace: F.title, fontSize: 40, bold: true, color: C.accent });
    t(s, h, x + 0.65, 1.95, 3.2, 0.55, { fontSize: 24, bold: true });
    t(s, b, x, 2.85, 3.75, 2.0, { fontSize: 18 });
  });
  box(s, MX, 5.25, W - 2 * MX, 1.1, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, "A arquitetura dos grandes modelos é a mesma que vocês montaram hoje. A diferença é o tamanho.", MX + 0.3, 5.25, W - 2 * MX - 0.6, 1.1, { fontSize: 20, fontFace: F.title, valign: "middle" });
}

// 25. Encerramento
{
  const s = base("Encerramento", "Daqui até o ChatGPT", `
Feche mostrando que a distância entre o notebook e um LLM é principalmente de escala, mais uma etapa final de ajuste para seguir instruções. A arquitetura é a que a turma escreveu.

Abra para perguntas e lembre que o link do notebook continua funcionando depois do evento. Para quem quiser continuar, o vídeo do Karpathy é o próximo passo natural.`);
  const hdr = (x) => ({ text: x, options: { bold: true, fill: { color: C.soft } } });
  s.addTable([
    [hdr(""), hdr("Hoje"), hdr("ChatGPT, Claude, Gemini")],
    [{ text: "Lê", options: { bold: true } }, "caracteres", "pedaços de palavras"],
    [{ text: "Tamanho", options: { bold: true } }, "1 a 5 milhões de parâmetros", "bilhões de parâmetros"],
    [{ text: "Treino", options: { bold: true } }, "minutos, 1 GPU", "meses, milhares de GPUs"],
    [{ text: "Depois", options: { bold: true } }, "nada", "ajuste para seguir instruções"],
  ], {
    x: MX, y: 1.75, w: 7.6, colW: [1.6, 2.8, 3.2], fontFace: F.body, fontSize: 16, color: C.ink,
    border: { type: "solid", pt: 0.75, color: C.line }, rowH: 0.58, valign: "middle", margin: 0.1,
  });
  t(s, "A arquitetura é a que vocês escreveram hoje.", MX, 4.95, 7.6, 0.6, { fontSize: 20, fontFace: F.title });
  t(s, "Para continuar: o vídeo \"Let's build GPT\", de Andrej Karpathy, e a série sobre Transformers do 3Blue1Brown.", MX, 5.65, 7.6, 0.8, { fontSize: 14, color: C.muted });
  t(s, "Obrigado.", 9.0, 2.0, 3.7, 1.0, { fontFace: F.title, fontSize: 44, bold: true });
  t(s, "Perguntas?", 9.0, 3.0, 3.7, 0.7, { fontFace: F.title, fontSize: 26, color: C.muted, italic: true });
  t(s, "Giovanni Vasconcelos", 9.0, 4.3, 3.7, 0.4, { fontSize: 16, bold: true });
  t(s, "github.com/giovannibragasv/\ntransformer-do-zero", 9.0, 4.75, 3.9, 0.7, { fontFace: F.mono, fontSize: 12, color: C.muted });
}

pres.writeFile({ fileName: OUT }).then(() => console.log("ok", OUT, n, "slides"));
