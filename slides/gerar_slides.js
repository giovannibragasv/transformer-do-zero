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

// 2. Roteiro
{
  const s = base("Roteiro", "Roteiro das duas horas", `
Um minuto. Os quadrados cheios são tempo de notebook; a explicação vem sempre logo antes da prática correspondente.

Combine o sinal para pedir ajuda (por exemplo, um papel dobrado sobre o monitor) e apresente os monitores.`);
  const blocks = [
    ["00:00", "Abertura e acesso ao Colab", false],
    ["00:15", "O que é atenção", false],
    ["00:27", "Parte 1 no notebook: a atenção", true],
    ["00:47", "O Transformer em uma imagem", false],
    ["00:53", "Parte 2 no notebook: o Transformer", true],
    ["01:15", "Intervalo", false],
    ["01:20", "Xadrez como linguagem", false],
    ["01:27", "Parte 3 no notebook: jogar contra o modelo", true],
    ["01:50", "Encerramento e perguntas", false],
  ];
  let y = 1.75;
  blocks.forEach(([hh, label, dark]) => {
    t(s, hh, MX, y, 1.0, 0.44, { fontFace: F.mono, fontSize: 14, color: C.muted, valign: "middle" });
    s.addShape(pres.shapes.RECTANGLE, { x: MX + 1.1, y: y + 0.06, w: 0.32, h: 0.32, fill: { color: dark ? C.blue : C.white }, line: { color: C.blue, width: 1 } });
    t(s, label, MX + 1.65, y, 7, 0.44, { fontSize: 17, valign: "middle", bold: dark });
    y += 0.52;
  });
  box(s, 9.0, 1.9, 3.6, 1.6, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: "Quadrado cheio: notebook.", options: { breakLine: true } },
    { text: "Quadrado vazado: explicação.", options: {} },
  ], 9.25, 2.1, 3.2, 1.3, { fontSize: 15, paraSpaceAfter: 6 });
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
  t(s, "Um Transformer escrito pela turma, treinado em 6 minutos.", MX, 5.95, 11.5, 0.5, { fontSize: 20, bold: true });
}

// 4. Acesso ao Colab
{
  const s = base("Preparação", "Abrindo o notebook", `
Até 10 minutos. Espere todos concluírem antes de seguir; os monitores circulam.

Sem "Salvar uma cópia no Drive", as alterações se perdem. Sem GPU, a Parte 3 fica lenta demais; quem não conseguir GPU faz a Parte 3 em dupla.

Peça que executem as duas células da seção 0. A segunda deve imprimir "Dispositivo: cuda".`);
  const steps = [
    ["1", "Abra o link", COLAB_URL],
    ["2", "Salve uma cópia", "Arquivo > Salvar uma cópia no Drive"],
    ["3", "Ative a GPU", "Ambiente de execução > Alterar o tipo de ambiente > T4 GPU"],
    ["4", "Execute as células da seção 0", "A segunda célula deve imprimir: Dispositivo: cuda"],
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

// 5. Próximo token
{
  const s = base("A ideia", "Um modelo de linguagem adivinha o que vem depois", `
Defina o jogo antes da arquitetura. O modelo olha o texto até aqui e dá uma probabilidade para cada continuação possível. Gerar texto é repetir isso: sortear, acrescentar, prever de novo.

Os números do gráfico são ilustrativos. A pergunta que guia o resto: como a previsão usa as palavras anteriores? Para adivinhar "rainha", o modelo precisa prestar atenção em "rei" e em "protege". Essa é a atenção.`);
  t(s, [
    { text: "o rei protege a ", options: {} },
    { text: "____", options: { color: C.accent, bold: true } },
  ], MX, 1.8, 6, 0.6, { fontFace: F.title, fontSize: 32 });
  const passos = [
    ["Treinar", "mostrar muito texto e ajustar o modelo até ele dar a maior chance à palavra certa."],
    ["Gerar", "sortear uma palavra, acrescentar ao texto e prever de novo."],
  ];
  passos.forEach(([h, b], i) => {
    t(s, h, MX, 3.0 + i * 1.25, 5.5, 0.45, { fontSize: 20, bold: true, color: C.accent });
    t(s, b, MX, 3.45 + i * 1.25, 5.5, 0.8, { fontSize: 17 });
  });
  img(s, "ch_nexttoken.png", 7.0, 1.7, 5.6, 4.6);
}

// 6. Dicionário
{
  const s = base("A ideia", "Atenção é uma consulta a um dicionário", `
A analogia central. No dicionário comum, a consulta precisa ser exata. Na atenção, a consulta é comparada com todas as chaves, cada comparação vira um peso, e a resposta é a mistura dos valores com esses pesos.

No exemplo (o mesmo do notebook), a consulta é "cavalo + bispo": o peso se divide entre os dois e o resultado é cerca de 3, o valor de ambos. Pergunte à turma: e "peão + dama"? (Cerca de 5.)

Nomes que vão aparecer no código: query é o que se procura, key é o que cada item oferece, value é o que cada item entrega.`);
  const pecas = ["peão", "cavalo", "bispo", "torre", "dama"];
  const pesos = [0.01, 0.49, 0.49, 0.01, 0.01];
  const vals = ["1", "3", "3", "5", "9"];
  box(s, MX, 2.95, 2.4, 0.9, "cavalo + bispo", { fill: C.soft, lineColor: C.accent, lw: 1.5, fs: 16, bold: true });
  t(s, "o que procuro (query)", MX - 0.2, 2.5, 2.8, 0.4, { align: "center", fontSize: 13, color: C.accent, bold: true });
  const x0 = 4.2, y0 = 1.95, rh = 0.55;
  [["chave (key)", x0 - 0.1, 2.0], ["peso", x0 + 2.0, 1.4], ["valor (value)", x0 + 3.4, 1.6]].forEach(([h, x, w]) => t(s, h, x, y0 - 0.45, w, 0.4, { align: "center", fontSize: 13, color: C.muted, bold: true }));
  pecas.forEach((p, i) => {
    const y = y0 + i * rh;
    box(s, x0, y, 1.8, rh - 0.08, p, { fs: 15 });
    s.addShape(pres.shapes.RECTANGLE, { x: x0 + 2.0, y, w: 1.4, h: rh - 0.08, fill: { color: shade(pesos[i] * 1.6) }, line: { color: C.line, width: 0.75 } });
    t(s, pesos[i].toFixed(2), x0 + 2.0, y, 1.4, rh - 0.08, { align: "center", valign: "middle", fontSize: 15, color: pesos[i] > 0.3 ? C.white : C.ink });
    box(s, x0 + 3.6, y, 1.2, rh - 0.08, vals[i], { fs: 15 });
  });
  arrow(s, MX + 2.45, 3.4, x0 - 0.1, 3.4);
  arrow(s, x0 + 4.95, 3.4, 10.35, 3.4);
  t(s, "mistura", x0 + 4.95, 2.95, 1.2, 0.4, { fontSize: 13, color: C.muted, align: "center" });
  box(s, 10.45, 2.95, 2.0, 0.9, "3.05", { fs: 26, font: F.title, bold: true, lineColor: C.ink });
  t(s, "resposta", 10.45, 2.5, 2.0, 0.4, { align: "center", fontSize: 13, color: C.muted, bold: true });
  t(s, "Em vez de achar uma única entrada, a atenção mistura todas, dando mais peso às mais parecidas com a consulta.", MX, 5.25, 11.8, 0.9, { fontSize: 19 });
}

// 7. A fórmula em três passos
{
  const s = base("A ideia", "A fórmula, em três passos", `
A única fórmula do workshop. Leia da esquerda para a direita junto com os três passos; eles são exatamente o Exercício 1.

1. Comparar: o produto escalar entre a query de uma palavra e a key de outra mede o quanto elas combinam.
2. Pesar: a softmax transforma as comparações em pesos que somam 1.
3. Misturar: a média dos values com esses pesos.

Sobre a raiz de d_k: diga apenas que ela evita números grandes demais, que atrapalhariam o treino. Não é preciso entrar no porquê.`);
  eqW(s, "eq_attention.png", 2.2, 1.65, 8.9);
  const steps = [
    ["1", "Comparar", "Cada palavra compara o que procura (Q) com o que as outras oferecem (K)."],
    ["2", "Pesar", "A softmax transforma as comparações em pesos que somam 1."],
    ["3", "Misturar", "Cada palavra recebe a média dos conteúdos (V), com esses pesos."],
  ];
  steps.forEach(([num, h, b], i) => {
    const x = MX + i * 4.05;
    t(s, num, x, 3.85, 0.6, 0.7, { fontFace: F.title, fontSize: 34, bold: true, color: C.accent });
    t(s, h, x + 0.6, 3.95, 3.2, 0.45, { fontSize: 20, bold: true });
    t(s, b, x + 0.6, 4.45, 3.2, 1.4, { fontSize: 16 });
  });
  t(s, "A divisão por √dₖ só evita números grandes demais.", MX, 6.25, 11, 0.4, { fontSize: 14, color: C.muted, italic: true });
}

// 8. Máscara causal
{
  const s = base("A ideia", "Ninguém olha para o futuro", `
O modelo escreve uma palavra de cada vez. Na hora de escrever a terceira, a quarta ainda não existe; então, no treino, cada palavra só pode olhar para ela mesma e para as anteriores.

Mostre a tabela da direita: a parte de cima ficou zerada, e cada linha continua somando 1. É o Exercício 2.

Bônus para quem perguntar: por causa disso, uma única passada pelo texto treina todas as posições de uma vez, e é por isso que Transformers treinam tão rápido.`);
  const toks = ["o", "rei", "protege", "a", "rainha"];
  const S = [[1.2, null, null, null, null], [0.3, 2.1, null, null, null], [0.8, 1.7, 0.4, null, null], [0.1, 0.6, 0.9, 1.1, null], [0.2, 1.9, 1.3, 0.5, 0.7]];
  const P = S.map((r) => { const e = r.map((v) => v === null ? 0 : Math.exp(v)); const z = e.reduce((a, b) => a + b, 0); return e.map((v) => v / z); });
  grid(s, 4.6, 2.2, 0.68, P, { text: P.map((r) => r.map((v) => v === 0 ? "0" : v.toFixed(2))), rows: toks, cols: toks, fs: 13, lfs: 14 });
  t(s, "pesos de atenção: cada linha soma 1", 4.6, 5.7, 3.4, 0.35, { align: "center", fontSize: 14, color: C.muted });
  t(s, "Cada palavra só olha para ela mesma e para as anteriores.", 8.7, 2.4, 4.0, 1.2, { fontSize: 19, fontFace: F.title });
  t(s, "Acima da diagonal, o peso é sempre zero.", 8.7, 3.7, 4.0, 1.0, { fontSize: 16, color: C.muted });
}

// 9. Prática 1
{
  const s = base("Prática", "Parte 1 no notebook: a atenção", `
20 minutos (00:27 a 00:47).

Cada exercício termina conferindo a resposta sozinho. Quem travar por mais de 3 minutos usa a célula [Recuperação] logo abaixo e segue.

Erros comuns: no Exercício 1, esquecer de transpor K (o erro de shape denuncia) ou de dividir por raiz de d_k (a verificação avisa). No Exercício 2, a resposta está na própria dica: np.tril(np.ones((T, T))).

No fim, todos rodam o dicionário e os mapas de atenção. Comente que os padrões ainda são aleatórios porque as matrizes não foram treinadas.`);
  t(s, "20 min", MX, 1.7, 3.0, 1.0, { fontFace: F.title, fontSize: 54, bold: true, color: C.blue });
  t(s, "00:27 até 00:47", MX, 2.75, 3.0, 0.4, { fontSize: 15, color: C.muted });
  const ex = [
    ["Exercício 1", "a atenção: comparar, pesar e misturar", "1.2"],
    ["Experimente", "o dicionário de peças de xadrez", "1.2"],
    ["Exercício 2", "a máscara causal", "1.3"],
    ["Experimente", "os mapas de atenção de uma frase", "1.3"],
  ];
  ex.forEach(([h, b, sec], i) => {
    const y = 1.75 + i * 0.95;
    t(s, h, 4.4, y, 2.2, 0.5, { fontSize: 19, bold: true, color: h.startsWith("Exp") ? C.muted : C.ink });
    t(s, b, 6.7, y, 4.8, 0.5, { fontSize: 17 });
    t(s, `seção ${sec}`, 11.5, y, 1.2, 0.5, { fontSize: 13, color: C.muted, align: "right" });
  });
  box(s, MX, 5.75, W - 2 * MX, 0.85, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, "Travou por mais de 3 minutos? Use a célula [Recuperação] logo abaixo do exercício e siga adiante.", MX + 0.3, 5.75, W - 2 * MX - 0.6, 0.85, { fontSize: 17, valign: "middle" });
}

// 10. O Transformer em uma imagem
{
  const s = base("O Transformer", "O Transformer em uma imagem", `
O modelo inteiro em um diagrama. Percorra da esquerda para a direita.

1. Cada caractere vira um vetor, e soma-se um vetor de posição, porque a atenção sozinha não sabe a ordem.
2. O bloco tem duas etapas: atenção (as palavras trocam informação) e feed-forward (cada palavra processa sozinha). Na prática, são várias atenções em paralelo, cada uma procurando uma coisa diferente.
3. Cada etapa soma o seu resultado ao que já havia, em vez de substituir (conexão residual). É o Exercício 3. É isso que permite empilhar muitos blocos.
4. No fim, uma nota para cada caractere possível: a chance de ele vir depois.

Se alguém perguntar pelo artigo original: ele tinha duas pilhas (encoder e decoder) porque fazia tradução. O GPT, e o nosso modelo, usam só uma.`);
  const y = 2.35, h = 1.35;
  box(s, MX, y, 1.75, h, "caracteres", { fs: 15 });
  arrow(s, MX + 1.8, y + h / 2, MX + 2.25, y + h / 2);
  box(s, MX + 2.3, y, 1.85, h, "vetores\n+ posição", { fs: 15 });
  arrow(s, MX + 4.2, y + h / 2, MX + 4.65, y + h / 2);
  // bloco
  s.addShape(pres.shapes.RECTANGLE, { x: MX + 4.7, y: y - 0.45, w: 4.3, h: h + 0.9, fill: { color: C.soft }, line: { color: C.blue, width: 1.25, dashType: "dash" } });
  t(s, "um bloco, repetido N vezes", MX + 4.7, y - 0.88, 4.3, 0.38, { align: "center", fontSize: 14, color: C.blue, bold: true });
  box(s, MX + 4.95, y, 1.75, h, "atenção", { fs: 16, fill: C.b1, lineColor: C.blue, bold: true });
  arrow(s, MX + 6.75, y + h / 2, MX + 6.95, y + h / 2);
  box(s, MX + 7.0, y, 1.75, h, "feed-\nforward", { fs: 16, fill: C.white });
  arrow(s, MX + 9.05, y + h / 2, MX + 9.5, y + h / 2);
  box(s, MX + 9.55, y, 2.35, h, "chance de cada\npróximo caractere", { fs: 15, fill: C.soft });
  const notas = [
    ["Atenção", "as palavras trocam informação entre si. São várias em paralelo, cada uma procurando algo diferente."],
    ["Feed-forward", "cada palavra processa sozinha o que recebeu."],
    ["Soma, não substitui", "cada etapa acrescenta um ajuste ao que já existia. Por isso dá para empilhar muitos blocos."],
  ];
  notas.forEach(([h2, b], i) => {
    t(s, h2, MX + i * 4.05, 4.75, 3.8, 0.4, { fontSize: 18, bold: true, color: i === 2 ? C.accent : C.ink });
    t(s, b, MX + i * 4.05, 5.2, 3.8, 1.2, { fontSize: 15 });
  });
}

// 11. Prática 2
{
  const s = base("Prática", "Parte 2 no notebook: o Transformer", `
20 minutos (00:53 a 01:13).

A seção 2.1 é só leitura: peça que comparem o forward da Head com o Exercício 1. É a mesma conta, e a célula confirma que dá o mesmo resultado.

O Exercício 3 são duas linhas, e a primeira já está no comentário. O erro comum é escrever x = self.attn(...) sem o "x +"; a verificação avisa.

Depois, todos treinam o modelo de ordenação (cerca de 30 segundos) e olham os gráficos de atenção. Aos 01:12, peça que executem as seções 3.1 e 3.2 antes do intervalo.`);
  t(s, "20 min", MX, 1.7, 3.0, 1.0, { fontFace: F.title, fontSize: 54, bold: true, color: C.blue });
  t(s, "00:53 até 01:13", MX, 2.75, 3.0, 0.4, { fontSize: 15, color: C.muted });
  const ex = [
    ["Ler", "a mesma atenção, agora em PyTorch", "2.1"],
    ["Exercício 3", "o bloco: as duas conexões residuais", "2.2"],
    ["Experimente", "treinar o modelo de ordenação", "2.4"],
    ["Experimente", "ver para onde ele olhou", "2.4"],
  ];
  ex.forEach(([h, b, sec], i) => {
    const y = 1.75 + i * 0.95;
    t(s, h, 4.4, y, 2.2, 0.5, { fontSize: 19, bold: true, color: h.startsWith("Exerc") ? C.ink : C.muted });
    t(s, b, 6.7, y, 4.8, 0.5, { fontSize: 17 });
    t(s, `seção ${sec}`, 11.5, y, 1.2, 0.5, { fontSize: 13, color: C.muted, align: "right" });
  });
  box(s, MX, 5.75, W - 2 * MX, 0.85, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: "Exercício 3: ", options: { bold: true } },
    { text: "x = x + self.attn(self.ln1(x)), e a mesma ideia com ln2 e ffn.", options: {} },
  ], MX + 0.3, 5.75, W - 2 * MX - 0.6, 0.85, { fontSize: 17, valign: "middle" });
}

// 12. Ordenação
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

// 13. Intervalo
{
  const s = base("Intervalo", null, `
Intervalo de 5 minutos (01:15 a 01:20). Antes de liberar a turma, confirme que a maioria executou as seções 3.1 e 3.2: a célula de treino deve estar imprimindo "passo ... | erro ...".

Quem estiver sem GPU interrompe o treino e usa o modelo de referência na seção 3.4.`);
  t(s, "Intervalo", MX, 1.9, 8, 1.0, { fontFace: F.title, fontSize: 54, bold: true });
  t(s, "5 minutos", MX, 2.95, 8, 0.6, { fontFace: F.title, fontSize: 26, color: C.muted, italic: true });
  box(s, MX, 4.2, 7.4, 1.6, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: "Antes de sair, execute as seções 3.1 e 3.2.", options: { bold: true, breakLine: true } },
    { text: "O modelo de xadrez treina por 6 minutos enquanto isso.", options: {} },
  ], MX + 0.3, 4.4, 6.9, 1.3, { fontSize: 19, paraSpaceAfter: 6 });
  chessboard(s, 9.0, 1.9, 0.44);
}

// 14. Xadrez como linguagem
{
  const s = base("Xadrez", "Xadrez é só mais um texto", `
Para o modelo, uma partida é uma linha de texto. Explique a notação em 30 segundos: a letra da peça e a casa de destino (Nf3 é o cavalo indo para f3); peão não tem letra. Não é preciso saber jogar: o tabuleiro do notebook mostra os lances possíveis.

São 60 mil partidas reais do Lichess. O modelo conhece só 33 caracteres e faz sempre a mesma coisa: prever o próximo.

A pergunta interessante: ele nunca vê o tabuleiro. Se mesmo assim joga lances válidos, alguma ideia de onde estão as peças surgiu dentro dele. Pesquisadores (Karvonen, 2024) conseguem ler o tabuleiro nas ativações de modelos assim. O modelo de referência acerta cerca de 85% dos lances; o da turma, treinado em 6 minutos, bem menos. Os números aparecem na seção 3.4.`);
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

// 15. Prática 3
{
  const s = base("Prática", "Parte 3 no notebook: xadrez", `
23 minutos (01:27 a 01:50). O treino da seção 3.2 já terminou no intervalo.

Roteiro: gerar partidas e ver em que lance cada uma erra (3.3); mexer na temperatura; comparar o próprio modelo com o de referência (3.4); jogar (3.5). A 3.6 é para quem terminar antes.

Para jogar não é preciso saber xadrez: clicando numa peça, os pontos mostram os lances possíveis. Se a turma quiser uma partida de demonstração, use as duas da cola.`);
  t(s, "23 min", MX, 1.7, 3.0, 1.0, { fontFace: F.title, fontSize: 54, bold: true, color: C.blue });
  t(s, "01:27 até 01:50", MX, 2.75, 3.0, 0.4, { fontSize: 15, color: C.muted });
  const ex = [
    ["3.3", "gerar partidas e ver onde o modelo erra"],
    ["3.3", "mudar a temperatura e comparar"],
    ["3.4", "seu modelo contra o modelo de referência"],
    ["3.5", "jogar uma partida contra o modelo"],
  ];
  ex.forEach(([sec, b], i) => {
    const y = 1.75 + i * 0.95;
    t(s, `seção ${sec}`, 4.4, y, 1.6, 0.5, { fontSize: 15, color: C.muted });
    t(s, b, 6.1, y, 6.5, 0.5, { fontSize: 19, bold: i === 3 });
  });
  box(s, MX, 5.75, W - 2 * MX, 0.85, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, "Não precisa saber xadrez: clique numa peça e os pontos mostram para onde ela pode ir.", MX + 0.3, 5.75, W - 2 * MX - 0.6, 0.85, { fontSize: 17, valign: "middle" });
}

// 16. Encerramento
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
