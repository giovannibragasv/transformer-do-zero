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
// 1. Capa
{
  const s = base(null, null, `
Abertura (00:00). Apresente-se em uma frase e diga o combinado: o workshop é prático, cerca de metade do tempo é no notebook, e ninguém precisa ter visto Transformers antes. Quem estiver nos primeiros semestres vai acompanhar a intuição e usar as células de recuperação sem constrangimento; quem já conhece redes neurais vai escrever as partes centrais.

Mensagem central do dia: a mesma equação de uma linha que aparece no artigo de 2017 é o núcleo do GPT, do Claude e do Gemini. Ao final, a turma terá escrito essa equação e treinado um modelo que joga xadrez.`);
  t(s, "CESUPA TECH SUMMIT 2026  ·  WORKSHOP", MX, 1.2, 8, 0.3, { fontSize: 12, color: C.accent, charSpacing: 2, bold: true });
  t(s, "Attention is All You Need", MX, 1.75, 7.6, 1.0, { fontFace: F.title, fontSize: 48, bold: true });
  t(s, "Construindo um Transformer do zero", MX, 2.75, 7.6, 0.7, { fontFace: F.title, fontSize: 28, color: C.muted, italic: true });
  t(s, "Giovanni Vasconcelos", MX, 5.3, 6, 0.4, { fontSize: 18, bold: true });
  t(s, "14 de outubro de 2026", MX, 5.72, 6, 0.4, { fontSize: 15, color: C.muted });
  // motivo: matriz de atenção causal ao lado de um tabuleiro
  const M = [];
  for (let i = 0; i < 8; i++) { const r = []; for (let j = 0; j < 8; j++) r.push(j > i ? 0 : [0.9, 0.3, 0.6, 0.15, 0.8, 0.35, 0.55, 0.2][(i * 3 + j * 5) % 8]); M.push(r); }
  grid(s, 8.55, 1.5, 0.52, M);
  t(s, "softmax(QKᵀ/√dₖ), com máscara causal", 8.55, 5.75, 4.2, 0.3, { fontSize: 11, color: C.faint, italic: true });
}

// 2. Roteiro
{
  const s = base("Roteiro", "Roteiro das duas horas", `
Mostre o roteiro rapidamente (1 minuto). Destaque que as faixas escuras são tempo de notebook e que a parte teórica vem sempre imediatamente antes da prática correspondente.

Combine o sinal para pedir ajuda (por exemplo, mão levantada ou um post-it no monitor) e apresente os monitores, que vão circular pela sala durante os exercícios.`);
  const blocks = [
    ["00:00", "Abertura e acesso ao Colab", 0.15, false],
    ["00:15", "Atenção: teoria", 0.1, false],
    ["00:25", "Parte 1 no notebook (NumPy)", 0.2, true],
    ["00:45", "Arquitetura do Transformer", 0.1, false],
    ["00:55", "Parte 2 no notebook (PyTorch)", 0.2, true],
    ["01:15", "Intervalo", 0.05, false],
    ["01:20", "Xadrez como linguagem", 0.1, false],
    ["01:30", "Parte 3 no notebook (xadrez)", 0.2, true],
    ["01:50", "Encerramento e perguntas", 0.1, false],
  ];
  let y = 1.75;
  blocks.forEach(([hh, label, _f, dark]) => {
    t(s, hh, MX, y, 1.0, 0.44, { fontFace: F.mono, fontSize: 14, color: C.muted, valign: "middle" });
    s.addShape(pres.shapes.RECTANGLE, { x: MX + 1.1, y: y + 0.06, w: 0.32, h: 0.32, fill: { color: dark ? C.blue : C.white }, line: { color: C.blue, width: 1 } });
    t(s, label, MX + 1.65, y, 6.5, 0.44, { fontSize: 17, valign: "middle", bold: dark });
    y += 0.52;
  });
  box(s, 9.0, 1.9, 3.6, 2.2, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: "Legenda", options: { bold: true, breakLine: true } },
    { text: "Quadrado cheio: trabalho no notebook.", options: { breakLine: true } },
    { text: "Quadrado vazado: exposição com slides.", options: {} },
  ], 9.25, 2.1, 3.2, 1.8, { fontSize: 14, paraSpaceAfter: 6 });
}

// 3. Onde vamos chegar
{
  const s = base("Motivação", "Onde vamos chegar", `
Este é o gancho. Se o modelo de referência já estiver treinado, faça uma demonstração ao vivo de 1 a 2 minutos: abra o notebook de gabarito, rode a seção 3.5 e jogue três ou quatro lances contra o modelo.

Ponto a enfatizar: o modelo nunca recebe o tabuleiro. Ele vê somente a sequência de caracteres à esquerda e aprende a prever o caractere seguinte. Qualquer noção de "onde estão as peças" precisa emergir dentro da rede. Essa observação volta no slide sobre modelos de mundo.`);
  box(s, MX, 1.75, 6.4, 2.6, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: ";1.e4 e5 2.Nf3 Nc6 3.Bb5 a6", options: { breakLine: true } },
    { text: " 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5", options: { breakLine: true } },
    { text: " 7.Bb3 d6 8.c3 O-O 9.h3 ", options: {} },
    { text: "Nb8", options: { color: C.accent, bold: true } },
  ], MX + 0.35, 2.05, 5.9, 1.6, { fontFace: F.mono, fontSize: 18, paraSpaceAfter: 6 });
  t(s, "O modelo recebe apenas o texto e prevê o próximo caractere.", MX + 0.35, 3.65, 5.8, 0.5, { fontSize: 15, color: C.muted, italic: true });
  arrow(s, 7.35, 3.5, 8.05, 3.5);
  chessboard(s, 8.3, 1.75, 0.44, { "0,1": "E8C4C4", "2,2": "E8C4C4" });
  t(s, "O tabuleiro nunca é mostrado ao modelo.", 8.3, 5.4, 3.6, 0.4, { fontSize: 14, color: C.muted, italic: true });
  t(s, "Um Transformer de ~1M de parâmetros, escrito pela turma, treinado em 6 minutos.", MX, 5.95, 11.5, 0.5, { fontSize: 18, bold: true });
}

// 4. Acesso ao Colab
{
  const s = base("Preparação", "Abrindo o notebook", `
Reserve até 10 minutos. Este é o ponto em que a turma mais trava, então espere todos concluírem antes de seguir. Os monitores devem circular pela sala.

Passo 2 é essencial: sem "Salvar uma cópia no Drive", as alterações se perdem ao fechar a aba. Passo 3: sem GPU, a Parte 3 fica inviável. Se o Colab recusar GPU por cota, a pessoa pode seguir em CPU até a Parte 2 e fazer a Parte 3 em dupla com um colega.

Peça que executem as duas primeiras células agora. A primeira baixa o repositório e o conjunto de dados (cerca de 10 MB); a segunda deve imprimir "Dispositivo: cuda".`);
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
  t(s, "Requisitos: navegador e conta Google. Nada é instalado no computador.", MX, 6.45, 11, 0.4, { fontSize: 14, italic: true, color: C.muted });
}

// 5. Modelo de linguagem
{
  const s = base("Motivação", "Um modelo de linguagem prevê o próximo token", `
Defina o objeto de estudo antes da arquitetura. Um modelo de linguagem atribui uma distribuição de probabilidade ao próximo token, dado o contexto. Gerar texto é repetir essa previsão: sorteia-se um token, ele é anexado ao contexto, e o processo recomeça.

Os valores do gráfico são ilustrativos. A pergunta de fundo para o resto do workshop é como a previsão em uma posição consegue usar a informação espalhada pelas posições anteriores. A resposta do artigo é a atenção.`);
  t(s, [
    { text: "o rei protege a ", options: {} },
    { text: "____", options: { color: C.accent, bold: true } },
  ], MX, 1.8, 6, 0.6, { fontFace: F.title, fontSize: 30 });
  eq(s, "eq_loss.png", MX, 2.8, 1.25);
  t(s, "Treinar é minimizar a entropia cruzada da previsão do token seguinte, em cada posição.", MX, 4.3, 5.5, 0.9, { fontSize: 15, color: C.muted });
  t(s, "Gerar é amostrar dessa distribuição, anexar o token e repetir.", MX, 5.2, 5.5, 0.9, { fontSize: 15, color: C.muted });
  img(s, "ch_nexttoken.png", 7.0, 1.7, 5.6, 4.6);
}

// 6. RNNs
{
  const s = base("Motivação", "Antes de 2017: redes recorrentes", `
Contexto histórico. Em 2017, o estado da arte em tradução eram RNNs (LSTM, GRU) em arquiteturas encoder-decoder, frequentemente já com um mecanismo de atenção (Bahdanau et al., 2015) acoplado.

Dois problemas motivam o artigo. Primeiro, o cálculo é sequencial: h_t depende de h_{t-1}, então não é possível paralelizar ao longo da sequência durante o treino, o que desperdiça GPUs. Segundo, a informação do primeiro token precisa atravessar n passos para chegar ao último, e o sinal (e o gradiente) se degrada no caminho.

A proposta do artigo, já no título, é abandonar a recorrência e usar apenas atenção.`);
  const toks = ["o", "rei", "protege", "a", "rainha"];
  const x0 = 1.2, dx = 2.25, yb = 2.6;
  toks.forEach((tk, i) => {
    box(s, x0 + i * dx, yb, 1.3, 0.9, `h${String.fromCharCode(8321 + i)}`, { fs: 18, font: F.title });
    t(s, tk, x0 + i * dx, yb + 1.45, 1.3, 0.4, { align: "center", fontSize: 16, color: C.muted });
    arrow(s, x0 + i * dx + 0.65, yb + 1.4, x0 + i * dx + 0.65, yb + 0.95);
    if (i < 4) arrow(s, x0 + i * dx + 1.3, yb + 0.45, x0 + (i + 1) * dx, yb + 0.45);
  });
  t(s, "hₜ = f(hₜ₋₁, xₜ)", x0, 1.75, 5, 0.5, { fontFace: F.title, fontSize: 20, italic: true });
  const cols = [
    ["Cálculo sequencial", "Cada estado depende do anterior. O treino não pode ser paralelizado ao longo da sequência."],
    ["Caminho longo", "A informação de “o” percorre n passos até “rainha”. Dependências distantes se degradam."],
  ];
  cols.forEach(([h, b], i) => {
    t(s, h, MX + i * 6.1, 4.95, 5.6, 0.4, { fontSize: 19, bold: true, color: C.accent });
    t(s, b, MX + i * 6.1, 5.4, 5.6, 1.0, { fontSize: 16 });
  });
}

// 7. Tabela 1 do artigo
{
  const s = base("Motivação", "A proposta: apenas atenção", `
Esta é a Tabela 1 do artigo, que resume o argumento. n é o comprimento da sequência, d a dimensão da representação e k o tamanho do kernel da convolução.

Leitura: a self-attention conecta quaisquer duas posições em um número constante de operações sequenciais, e o caminho máximo entre elas tem comprimento 1. O custo é quadrático em n por camada, o que é aceitável quando n é menor que d, como era o caso em tradução de frases.

Vale antecipar que esse custo O(n²) é exatamente o que limita o tamanho do contexto dos LLMs atuais e motiva variantes como FlashAttention e atenção esparsa.`);
  const hdr = (x) => ({ text: x, options: { bold: true, color: C.ink, fill: { color: C.soft } } });
  const rows = [
    [hdr("Tipo de camada"), hdr("Custo por camada"), hdr("Operações sequenciais"), hdr("Caminho máximo")],
    [{ text: "Self-attention", options: { bold: true, color: C.accent } }, "O(n² · d)", "O(1)", "O(1)"],
    ["Recorrente", "O(n · d²)", "O(n)", "O(n)"],
    ["Convolucional", "O(k · n · d²)", "O(1)", "O(logₖ n)"],
  ];
  s.addTable(rows, {
    x: MX, y: 1.85, w: W - 2 * MX, colW: [3.2, 2.9, 3.0, 2.833], fontFace: F.body, fontSize: 18, color: C.ink,
    border: { type: "solid", pt: 0.75, color: C.line }, rowH: 0.62, valign: "middle", margin: 0.12,
  });
  t(s, "Fonte: Vaswani et al. (2017), Tabela 1. n = comprimento da sequência; d = dimensão; k = tamanho do kernel.", MX, 4.55, 11.5, 0.4, { fontSize: 12, color: C.muted, italic: true });
  t(s, "Qualquer posição acessa qualquer outra em um único passo, e todas as posições são processadas em paralelo.", MX, 5.3, 11.5, 0.8, { fontSize: 20, fontFace: F.title });
}

// 8. Dicionário suave
{
  const s = base("Atenção", "Atenção como consulta a um dicionário", `
A analogia que sustenta o resto do workshop. Em um dicionário convencional, a consulta precisa coincidir exatamente com uma chave. Na atenção, a consulta é comparada com todas as chaves, cada comparação vira um peso, e o resultado é a média dos valores ponderada por esses pesos.

No exemplo (o mesmo do notebook), a consulta mistura "cavalo" e "bispo". Os pesos se dividem entre essas duas chaves e o resultado é aproximadamente 3, o valor material de ambas. Pergunte à turma o que aconteceria com a consulta "peão + dama" (resposta: cerca de 5, a média de 1 e 9).

Vocabulário para fixar: query é o que se procura, key é o que cada item anuncia, value é o conteúdo que cada item entrega.`);
  const pecas = ["peão", "cavalo", "bispo", "torre", "dama"];
  const pesos = [0.01, 0.49, 0.49, 0.01, 0.01];
  const vals = ["1", "3", "3", "5", "9"];
  box(s, MX, 2.95, 2.4, 0.9, "cavalo + bispo", { fill: C.soft, lineColor: C.accent, lw: 1.5, fs: 16, bold: true });
  t(s, "query", MX, 2.5, 2.4, 0.4, { align: "center", fontSize: 14, color: C.accent, bold: true });
  const x0 = 4.2, y0 = 1.95, rh = 0.55;
  [["key", x0, 1.8], ["peso", x0 + 2.0, 1.4], ["value", x0 + 3.6, 1.2]].forEach(([h, x, w]) => t(s, h, x, y0 - 0.45, w, 0.4, { align: "center", fontSize: 14, color: C.muted, bold: true }));
  pecas.forEach((p, i) => {
    const y = y0 + i * rh;
    box(s, x0, y, 1.8, rh - 0.08, p, { fs: 15 });
    s.addShape(pres.shapes.RECTANGLE, { x: x0 + 2.0, y, w: 1.4, h: rh - 0.08, fill: { color: shade(pesos[i] * 1.6) }, line: { color: C.line, width: 0.75 } });
    t(s, pesos[i].toFixed(2), x0 + 2.0, y, 1.4, rh - 0.08, { align: "center", valign: "middle", fontSize: 15, color: pesos[i] > 0.3 ? C.white : C.ink });
    box(s, x0 + 3.6, y, 1.2, rh - 0.08, vals[i], { fs: 15 });
  });
  arrow(s, MX + 2.45, 3.4, x0 - 0.1, 3.4);
  arrow(s, x0 + 4.95, 3.4, 9.75, 3.4);
  t(s, "Σ peso · value", x0 + 4.9, 2.95, 1.6, 0.4, { fontSize: 13, color: C.muted, align: "center" });
  box(s, 9.9, 2.95, 2.1, 0.9, "3.05", { fs: 26, font: F.title, bold: true, lineColor: C.ink });
  t(s, "saída", 9.9, 2.5, 2.1, 0.4, { align: "center", fontSize: 14, color: C.muted, bold: true });
  t(s, "Os pesos vêm da similaridade entre a query e cada key (produto escalar seguido de softmax). A saída é uma média ponderada dos values.", MX, 5.25, 11.8, 0.9, { fontSize: 18 });
}

// 9. Q, K, V
{
  const s = base("Atenção", "Queries, keys e values vêm da própria sequência", `
Em self-attention, as três matrizes são projeções lineares da mesma entrada X, que tem uma linha por token. W_Q, W_K e W_V são os parâmetros aprendidos da camada; o resto é álgebra sem parâmetros.

Ênfase nos shapes: X é T × d_model, as projeções levam para T × d_k. No notebook, d_model = 16 e d_k = 8 no exemplo em NumPy.

Observação útil para a turma mais avançada: as mesmas posições desempenham os três papéis. Cada token pergunta (query), é consultado (key) e entrega conteúdo (value).`);
  eq(s, "eq_qkv.png", MX, 1.75, 0.55);
  // X
  const gx = MX, gy = 3.0;
  grid(s, gx, gy, 0.42, Array.from({ length: 5 }, () => Array(6).fill(C.soft)));
  t(s, "X", gx, gy + 2.2, 2.52, 0.4, { align: "center", fontFace: F.title, fontSize: 20, bold: true });
  t(s, "T × d_model", gx, gy + 2.6, 2.52, 0.35, { align: "center", fontSize: 13, color: C.muted });
  const outs = [["Q", C.b2, "consultas"], ["K", C.b3, "chaves"], ["V", C.b1, "conteúdos"]];
  outs.forEach(([nm, col, desc], i) => {
    const y = 2.5 + i * 1.35;
    arrow(s, gx + 2.7, gy + 1.05, 5.0, y + 0.5);
    grid(s, 5.15, y, 0.2, Array.from({ length: 5 }, () => Array(4).fill(col)));
    t(s, nm, 6.1, y + 0.2, 0.6, 0.6, { fontFace: F.title, fontSize: 22, bold: true, valign: "middle" });
    t(s, `= X W_${nm}  ·  T × d_k  ·  ${desc}`, 6.6, y + 0.2, 2.9, 0.6, { fontSize: 14, color: C.muted, valign: "middle" });
  });
  box(s, 9.6, 2.6, 3.0, 3.1, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: "Parâmetros aprendidos", options: { bold: true, breakLine: true } },
    { text: "Somente W_Q, W_K e W_V. Treinar a camada é ajustar essas três matrizes.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "Cada token desempenha os três papéis ao mesmo tempo.", options: {} },
  ], 9.85, 2.8, 2.6, 2.8, { fontSize: 14 });
}

// 10. A equação
{
  const s = base("Atenção", "Scaled dot-product attention", `
A equação central do artigo. Leia da direita para a esquerda, em três etapas, que são exatamente os passos do Exercício 2.

1. QKᵀ produz uma matriz T × T. A entrada (i, j) é o produto escalar entre a query da posição i e a key da posição j, isto é, a compatibilidade entre elas.
2. Divide-se por √d_k (próximo slide) e aplica-se a softmax em cada linha. Cada linha passa a ser uma distribuição de probabilidade sobre as posições.
3. Multiplica-se por V. A saída da posição i é a média dos values ponderada pela linha i.

Custo: a matriz T × T é a origem do custo quadrático mencionado na tabela anterior.`);
  eqW(s, "eq_attention.png", 2.2, 1.65, 8.9);
  const steps = [
    ["1", "Compatibilidade", "QKᵀ gera uma matriz T × T. A entrada (i, j) mede o quanto a posição i se relaciona com a posição j."],
    ["2", "Normalização", "Divide-se por √dₖ e aplica-se a softmax em cada linha, que passa a somar 1."],
    ["3", "Combinação", "Multiplica-se por V: cada posição recebe uma média ponderada dos values."],
  ];
  steps.forEach(([num, h, b], i) => {
    const x = MX + i * 4.05;
    t(s, num, x, 3.85, 0.6, 0.7, { fontFace: F.title, fontSize: 34, bold: true, color: C.accent });
    t(s, h, x + 0.6, 3.95, 3.2, 0.45, { fontSize: 19, bold: true });
    t(s, b, x + 0.6, 4.45, 3.2, 1.6, { fontSize: 15 });
  });
}

// 11. Por que raiz de dk
{
  const s = base("Atenção", "Por que dividir por √dₖ?", `
Argumento do artigo (nota de rodapé 4): se as componentes de q e k são independentes, com média 0 e variância 1, o produto escalar tem variância d_k. Com d_k grande, os scores ficam grandes em módulo, a softmax satura e seus gradientes ficam muito pequenos.

O gráfico reproduz o experimento da seção 1.3 do notebook: 10 keys aleatórias; a barra mede o maior peso médio da softmax. Sem escala, com d_k = 512, o maior peso já é 0.95, ou seja, quase one-hot. Com a escala, fica em torno de 0.3 para qualquer d_k.

Pergunta para a turma: o que aconteceria se dividíssemos por d_k em vez de √d_k? (A variância ficaria 1/d_k e a softmax tenderia à distribuição uniforme.)`);
  eq(s, "eq_var.png", MX, 1.75, 1.15);
  t(s, "Com variância dₖ, os scores crescem com a dimensão, a softmax satura e o gradiente se anula. Dividir por √dₖ restaura a variância 1.", MX, 3.25, 5.2, 1.6, { fontSize: 17 });
  t(s, "Com 10 keys, pesos uniformes valeriam 0.10.", MX, 4.8, 5.2, 0.5, { fontSize: 14, color: C.muted, italic: true });
  img(s, "ch_sqrtdk.png", 6.4, 1.6, 6.3, 4.8);
}

// 12. Máscara causal
{
  const s = base("Atenção", "Máscara causal: ninguém olha para o futuro", `
Para gerar texto, a previsão na posição t só pode depender das posições 1 a t. Caso contrário, durante o treino o modelo "colaria" olhando o próximo token.

A implementação é simples: antes da softmax, os scores acima da diagonal recebem menos infinito. Como e^(-∞) = 0, esses pesos saem exatamente zero, e cada linha continua somando 1 sobre as posições permitidas.

Consequência prática importante: com a máscara, uma única passada pela sequência treina T previsões ao mesmo tempo, uma por posição. É isso que torna o treino de Transformers tão eficiente em comparação com RNNs.

Este é o Exercício 3 do notebook.`);
  const toks = ["o", "rei", "protege", "a", "rainha"];
  const S = [[1.2, null, null, null, null], [0.3, 2.1, null, null, null], [0.8, 1.7, 0.4, null, null], [0.1, 0.6, 0.9, 1.1, null], [0.2, 1.9, 1.3, 0.5, 0.7]];
  grid(s, 2.1, 2.2, 0.62, S.map((r) => r.map((v) => v === null ? "F6E7E7" : C.white)), { text: S.map((r) => r.map((v) => v === null ? "−∞" : v.toFixed(1))), rows: toks, cols: toks, fs: 13, lfs: 13 });
  t(s, "scores com máscara", 2.1, 5.45, 3.1, 0.35, { align: "center", fontSize: 14, color: C.muted });
  arrow(s, 5.5, 3.75, 6.6, 3.75);
  t(s, "softmax", 5.45, 3.3, 1.2, 0.35, { align: "center", fontSize: 14, color: C.muted });
  // pesos resultantes
  const P = S.map((r) => { const e = r.map((v) => v === null ? 0 : Math.exp(v)); const z = e.reduce((a, b) => a + b, 0); return e.map((v) => v / z); });
  grid(s, 8.1, 2.2, 0.62, P, { text: P.map((r) => r.map((v) => v === 0 ? "0" : v.toFixed(2))), rows: toks, cols: toks, fs: 12, lfs: 13 });
  t(s, "pesos (cada linha soma 1)", 8.1, 5.45, 3.1, 0.35, { align: "center", fontSize: 14, color: C.muted });
  t(s, "Onde a máscara vale 0, o score recebe −∞ antes da softmax, e o peso resultante é exatamente zero.", MX, 6.0, 11.8, 0.6, { fontSize: 17 });
}

// 13. Prática 1
{
  const s = base("Prática", "Parte 1 no notebook: atenção em NumPy", `
Tempo: 20 minutos (00:25 a 00:45).

Instruções para a turma: cada exercício termina com uma célula de verificação que imprime "Correto" ou uma dica do erro. Quem travar por mais de 3 minutos em um exercício deve usar a célula de recuperação logo abaixo e seguir em frente.

Pontos para circular pela sala:
- Exercício 1: o erro mais comum é esquecer keepdims=True, o que quebra o broadcasting.
- Exercício 2: esquecer de transpor K (o erro de shape denuncia) ou esquecer a divisão por √d_k (a verificação detecta e avisa).
- Exercício 3: np.tril(np.ones((T, T))) resolve em uma linha.

Aos 40 minutos, avise que faltam 5 minutos e peça que todos rodem as células 1.3 e 1.4 para ver os mapas de atenção. Feche comentando que os padrões ainda são aleatórios, pois as matrizes W não foram treinadas.`);
  t(s, "20 min", MX, 1.7, 3.0, 1.0, { fontFace: F.title, fontSize: 54, bold: true, color: C.blue });
  t(s, "00:25 até 00:45", MX, 2.75, 3.0, 0.4, { fontSize: 15, color: C.muted });
  const ex = [
    ["Exercício 1", "softmax numericamente estável", "1.1"],
    ["Exercício 2", "atencao(Q, K, V): scores, softmax e média ponderada", "1.2"],
    ["Exercício 3", "mascara_causal(T) com np.tril", "1.4"],
    ["Executar", "experimento com √dₖ e mapas de self-attention", "1.3, 1.4"],
  ];
  ex.forEach(([h, b, sec], i) => {
    const y = 1.75 + i * 0.95;
    t(s, h, 4.4, y, 2.2, 0.5, { fontSize: 19, bold: true, color: h === "Executar" ? C.muted : C.ink });
    t(s, b, 6.7, y, 4.8, 0.5, { fontSize: 17 });
    t(s, `seção ${sec}`, 11.5, y, 1.2, 0.5, { fontSize: 13, color: C.muted, align: "right" });
  });
  box(s, MX, 5.75, W - 2 * MX, 0.85, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, "Travou por mais de 3 minutos? Use a célula [Recuperação] logo abaixo do exercício e siga adiante.", MX + 0.3, 5.75, W - 2 * MX - 0.6, 0.85, { fontSize: 17, valign: "middle" });
}

// 14. Multi-head
{
  const s = base("Arquitetura", "Multi-head attention", `
Em vez de uma atenção com dimensão d_model, o artigo usa h cabeças menores, cada uma com dimensão d_model / h, em paralelo. No modelo base do artigo, h = 8 e d_k = 64.

Motivação: uma única softmax produz uma única média ponderada por posição. Várias cabeças permitem que a mesma posição combine informação de lugares diferentes por critérios diferentes (por exemplo, uma cabeça pode seguir a sintaxe, outra a correferência). O custo total é similar ao de uma cabeça de dimensão completa.

No notebook (Exercício 5), a implementação é uma linha: concatenar as saídas das cabeças no último eixo e aplicar a projeção W_O.`);
  eq(s, "eq_mha.png", MX, 1.7, 0.55);
  box(s, MX, 3.6, 1.4, 1.0, "X", { fs: 22, font: F.title, bold: true });
  const hy = [2.6, 3.4, 4.2, 5.0];
  hy.forEach((y, i) => {
    arrow(s, MX + 1.45, 4.1, 3.0, y + 0.3);
    box(s, 3.1, y, 2.3, 0.6, i === 3 ? `cabeça h` : `cabeça ${i + 1}`, { fs: 14, fill: C.b1, lineColor: C.blue });
    arrow(s, 5.45, y + 0.3, 6.5, 4.1);
  });
  t(s, "⋮", 3.1, 4.7, 2.3, 0.35, { align: "center", fontSize: 14, color: C.muted });
  box(s, 6.6, 3.6, 1.8, 1.0, "Concat", { fs: 16 });
  arrow(s, 8.45, 4.1, 9.1, 4.1);
  box(s, 9.2, 3.6, 1.2, 1.0, "W_O", { fs: 16, font: F.title });
  arrow(s, 10.45, 4.1, 11.1, 4.1);
  box(s, 11.2, 3.6, 1.4, 1.0, "saída", { fs: 16 });
  t(s, "Cada cabeça tem suas próprias W_Q, W_K, W_V, com dimensão d_model / h.", MX, 6.0, 11.8, 0.5, { fontSize: 16, color: C.muted });
}

// 15. Posição
{
  const s = base("Arquitetura", "Codificação de posição", `
A atenção, como definida, é invariante a permutações: embaralhar os tokens da entrada apenas embaralha as linhas da saída. Portanto, a ordem precisa ser informada explicitamente.

O artigo soma a cada embedding um vetor de senos e cossenos com frequências em progressão geométrica. Cada dimensão oscila com um período diferente, e posições relativas correspondem a transformações lineares desses vetores.

O artigo relata que embeddings de posição aprendidos dão resultados praticamente idênticos (Tabela 3, linha E). No notebook usamos a versão aprendida, como no GPT, e deixamos a senoidal como exercício para casa. Modelos atuais costumam usar RoPE, que aplica rotações às queries e keys.`);
  eqW(s, "eq_pe.png", MX, 1.7, 8.2);
  t(s, "A atenção é invariante a permutações da entrada: sem essa informação, “o rei protege a rainha” e “a rainha protege o rei” seriam indistinguíveis.", MX, 2.75, 5.3, 1.8, { fontSize: 17 });
  t(s, "O artigo soma essa codificação ao embedding de cada token. No notebook, como no GPT, os vetores de posição são aprendidos.", MX, 4.55, 5.3, 1.6, { fontSize: 15, color: C.muted });
  img(s, "ch_pe.png", 6.4, 2.6, 6.3, 4.0);
}

// 16. Bloco
{
  const s = base("Arquitetura", "O bloco do Transformer", `
O bloco alterna comunicação (atenção, que mistura informação entre posições) e computação (FFN, uma MLP aplicada a cada posição de forma independente, com camada oculta 4 vezes maior).

As conexões residuais fazem com que cada subcamada aprenda apenas uma correção sobre x, e criam um caminho direto para o gradiente, o que permite empilhar muitos blocos. A LayerNorm mantém a escala das ativações.

Diferença em relação ao artigo: o original aplica a normalização depois da soma (post-LN). GPT-2 e praticamente todos os modelos atuais usam pre-LN, como no diagrama, porque treina de forma mais estável sem warm-up cuidadoso. Vale mencionar para quem for ler o artigo e estranhar.

Exercício 6: exatamente as duas linhas da equação.`);
  eq(s, "eq_block.png", MX, 1.7, 0.5);
  const y = 3.6, h = 0.9;
  t(s, "x", MX, y, 0.5, h, { fontFace: F.title, fontSize: 24, italic: true, valign: "middle" });
  const items = [
    [1.4, 1.5, "LayerNorm", C.white], [3.2, 1.8, "Multi-head\nattention", C.b1], [5.4, 0.6, "+", C.white],
    [6.4, 1.5, "LayerNorm", C.white], [8.2, 1.5, "FFN", C.soft], [10.05, 0.6, "+", C.white],
  ];
  arrow(s, MX + 0.35, y + h / 2, 1.35, y + h / 2);
  items.forEach(([x, w, label, fill], i) => {
    if (label === "+") {
      s.addShape(pres.shapes.OVAL, { x, y: y + 0.15, w, h: 0.6, fill: { color: C.white }, line: { color: C.ink, width: 1.25 } });
      t(s, "+", x, y + 0.15, w, 0.6, { align: "center", valign: "middle", fontSize: 22, bold: true });
    } else box(s, x, y, w, h, label, { fs: 14, fill, lineColor: fill === C.b1 ? C.blue : C.ink });
    if (i < items.length - 1) arrow(s, x + w + 0.03, y + h / 2, items[i + 1][0] - 0.03, y + h / 2);
  });
  arrow(s, 10.7, y + h / 2, 11.5, y + h / 2);
  t(s, "saída", 11.55, y, 1.2, h, { fontSize: 16, valign: "middle" });
  // residuais
  const res = (x1, x2) => {
    arrow(s, x1, y + h / 2, x1, y - 0.55, { noHead: true, color: C.accent });
    arrow(s, x1, y - 0.55, x2, y - 0.55, { noHead: true, color: C.accent });
    arrow(s, x2, y - 0.55, x2, y + 0.12, { color: C.accent });
  };
  res(1.1, 5.65); res(6.1, 10.35);
  t(s, "conexão residual", 2.8, y - 1.0, 2.4, 0.35, { fontSize: 13, color: C.accent, align: "center" });
  const notes = [["Atenção", "comunicação entre posições"], ["FFN", "computação em cada posição, isoladamente"], ["Residual + LayerNorm", "permitem empilhar dezenas de blocos"]];
  notes.forEach(([h2, b], i) => {
    t(s, h2, MX + i * 4.05, 5.35, 3.8, 0.4, { fontSize: 17, bold: true });
    t(s, b, MX + i * 4.05, 5.78, 3.8, 0.6, { fontSize: 15, color: C.muted });
  });
}

// 17. Encoder-decoder original
{
  const s = base("Arquitetura", "A arquitetura original: encoder-decoder", `
O artigo resolve tradução, então usa duas pilhas. O encoder lê a frase de origem inteira com self-attention sem máscara (cada palavra vê todas). O decoder gera a tradução token a token com self-attention causal e, em cada bloco, uma camada de cross-attention em que as queries vêm do decoder e as keys e values vêm da saída do encoder. É por ela que a tradução "consulta" a frase original.

Números do modelo base: N = 6 blocos em cada pilha, d_model = 512, h = 8 cabeças, d_ff = 2048, cerca de 65 milhões de parâmetros, treinado por 12 horas em 8 GPUs P100 (o modelo grande levou 3,5 dias).

Transição: no workshop vamos construir apenas a pilha da direita, sem a cross-attention. É isso que o GPT faz.`);
  const col = (x, title, layers, tag) => {
    t(s, title, x, 1.65, 3.6, 0.4, { fontSize: 18, bold: true, align: "center" });
    s.addShape(pres.shapes.RECTANGLE, { x, y: 2.15, w: 3.6, h: 0.45 + layers.length * 0.72, fill: { color: C.soft }, line: { color: C.faint, width: 1, dashType: "dash" } });
    layers.forEach(([lab, fill], i) => box(s, x + 0.3, 2.4 + i * 0.72, 3.0, 0.56, lab, { fs: 14, fill, lineColor: fill === C.b1 || fill === C.b2 ? C.blue : C.ink }));
    t(s, tag, x + 3.65, 2.2, 0.8, 0.4, { fontSize: 14, color: C.muted });
  };
  col(1.2, "Encoder", [["Self-attention", C.b1], ["FFN", C.white]], "× N");
  col(6.8, "Decoder", [["Self-attention causal", C.b1], ["Cross-attention", C.b2], ["FFN", C.white]], "× N");
  arrow(s, 4.85, 3.25, 7.05, 3.4, { color: C.accent, w: 1.75 });
  t(s, "keys e values do encoder", 4.6, 3.55, 2.6, 0.35, { fontSize: 12, color: C.accent, align: "center" });
  t(s, "The king protects the queen", 1.2, 4.25, 3.6, 0.4, { fontSize: 14, align: "center", italic: true });
  t(s, "frase de origem", 1.2, 4.6, 3.6, 0.35, { fontSize: 12, align: "center", color: C.muted });
  t(s, "‹início› O rei protege a", 6.8, 4.95, 3.6, 0.4, { fontSize: 14, align: "center", italic: true });
  t(s, "saída gerada até agora", 6.8, 5.3, 3.6, 0.35, { fontSize: 12, align: "center", color: C.muted });
  box(s, 10.9, 1.65, 1.8, 3.4, undefined, { fill: C.white, lineColor: C.line });
  t(s, [
    { text: "Modelo base", options: { bold: true, breakLine: true } },
    { text: "N = 6", options: { breakLine: true } },
    { text: "d_model = 512", options: { breakLine: true } },
    { text: "h = 8", options: { breakLine: true } },
    { text: "d_ff = 2048", options: { breakLine: true } },
    { text: "≈ 65M parâmetros", options: {} },
  ], 11.05, 1.8, 1.6, 3.2, { fontSize: 13, paraSpaceAfter: 5 });
  t(s, "Hoje construímos apenas a pilha do decoder, sem a cross-attention. Essa é a arquitetura do GPT.", MX, 6.05, 11.8, 0.6, { fontSize: 18, fontFace: F.title });
}

// 18. Famílias
{
  const s = base("Arquitetura", "Três famílias a partir do mesmo bloco", `
A partir de 2018 a arquitetura se dividiu em três famílias, conforme a parte do Transformer original que se mantém.

Encoder-only (BERT): atenção bidirecional, treinado para preencher lacunas. Bom para classificação e para gerar embeddings de busca.
Decoder-only (GPT, Llama, Claude): atenção causal, treinado para prever o próximo token. Tornou-se dominante porque o mesmo objetivo simples escala para praticamente qualquer tarefa formulada como texto.
Encoder-decoder (o original, T5, Whisper): natural quando entrada e saída são sequências distintas, como tradução e transcrição.

O workshop fica na linha do meio.`);
  const hdr = (x) => ({ text: x, options: { bold: true, fill: { color: C.soft } } });
  const hl = (x) => ({ text: x, options: { bold: true, color: C.accent } });
  s.addTable([
    [hdr("Família"), hdr("Atenção"), hdr("Objetivo de treino"), hdr("Exemplos")],
    ["Encoder-only", "bidirecional", "preencher tokens mascarados", "BERT, RoBERTa"],
    [hl("Decoder-only"), hl("causal"), hl("prever o próximo token"), hl("GPT, Llama, Claude, este workshop")],
    ["Encoder-decoder", "bidirecional + causal + cruzada", "gerar a saída condicionada à entrada", "Transformer original, T5, Whisper"],
  ], {
    x: MX, y: 1.85, w: W - 2 * MX, colW: [2.5, 3.1, 3.3, 3.033], fontFace: F.body, fontSize: 16, color: C.ink,
    border: { type: "solid", pt: 0.75, color: C.line }, rowH: 0.75, valign: "middle", margin: 0.12,
  });
  t(s, "O objetivo “prever o próximo token” é simples o bastante para usar qualquer texto como dado de treino, sem rotulação manual. Esse é o principal motivo de a família decoder-only ter se tornado dominante.", MX, 5.25, 11.8, 1.0, { fontSize: 17 });
}

// 19. GPT completo
{
  const s = base("Arquitetura", "O modelo completo", `
Percorra o fluxo da esquerda para a direita, sempre falando dos shapes, que é onde a turma mais se perde.

A entrada são índices inteiros com shape (B, T). O embedding de token e o de posição produzem (B, T, C), com C = n_embd. Os N blocos preservam esse shape. A LayerNorm final e a camada linear levam a (B, T, V), um logit por item do vocabulário em cada posição.

A perda é a entropia cruzada entre os logits da posição t e o token da posição t+1. Graças à máscara causal, uma passada gera T exemplos de treino.

No notebook, a classe GPT é fornecida pronta: ela apenas junta as peças escritas nos exercícios 4 a 6.`);
  const st = [
    ["tokens", "(B, T)", C.white], ["embedding\n+ posição", "(B, T, C)", C.white], ["bloco × N", "(B, T, C)", C.b1],
    ["LayerNorm", "(B, T, C)", C.white], ["linear", "(B, T, V)", C.white], ["softmax", "p(próximo)", C.soft],
  ];
  const w = 1.6, gap = 0.43;
  st.forEach(([lab, shp, fill], i) => {
    const x = MX + i * (w + gap);
    box(s, x, 2.4, w, 1.2, lab, { fs: 14, fill, lineColor: fill === C.b1 ? C.blue : C.ink });
    t(s, shp, x, 3.75, w, 0.4, { fontFace: F.mono, fontSize: 13, align: "center", color: C.muted });
    if (i < st.length - 1) arrow(s, x + w + 0.03, 3.0, x + w + gap - 0.03, 3.0);
  });
  t(s, "B = lote  ·  T = posições  ·  C = n_embd  ·  V = tamanho do vocabulário", MX, 4.5, 11.8, 0.4, { fontSize: 14, color: C.muted });
  eq(s, "eq_loss.png", MX, 5.0, 1.2);
  t(s, "Uma passada pela sequência produz T previsões, todas treinadas em paralelo.", 6.3, 5.25, 6.3, 0.6, { fontSize: 17 });
}

// 20. Prática 2
{
  const s = base("Prática", "Parte 2 no notebook: o Transformer em PyTorch", `
Tempo: 20 minutos (00:55 a 01:15).

O Exercício 4 é o mais importante do dia: é a mesma função do Exercício 2, agora com a dimensão de lote. Os erros esperados são usar k.T (que em tensores 3D inverte todas as dimensões, não só as duas últimas) e esquecer de recortar a máscara com [:T, :T]. A verificação compara o resultado com a versão em NumPy, o que costuma ser um bom momento de "fechamento" para a turma.

Os Exercícios 5 e 6 são curtos. Depois deles, a turma executa a seção 2.6: o modelo de ordenação treina em cerca de 30 segundos e deve chegar perto de 100% de acerto.

Aos 01:12, peça que todos executem as células 3.1 e 3.2 antes do intervalo.`);
  t(s, "20 min", MX, 1.7, 3.0, 1.0, { fontFace: F.title, fontSize: 54, bold: true, color: C.blue });
  t(s, "00:55 até 01:15", MX, 2.75, 3.0, 0.4, { fontSize: 15, color: C.muted });
  const ex = [
    ["Exercício 4", "Head.forward: a atenção com lote e máscara", "2.2"],
    ["Exercício 5", "MultiHeadAttention: concatenar as cabeças", "2.3"],
    ["Exercício 6", "Block: as duas conexões residuais", "2.4"],
    ["Executar", "treinar o modelo de ordenação e ver a atenção", "2.6"],
  ];
  ex.forEach(([h, b, sec], i) => {
    const y = 1.75 + i * 0.95;
    t(s, h, 4.4, y, 2.2, 0.5, { fontSize: 19, bold: true, color: h === "Executar" ? C.muted : C.ink });
    t(s, b, 6.7, y, 4.8, 0.5, { fontSize: 17 });
    t(s, `seção ${sec}`, 11.5, y, 1.2, 0.5, { fontSize: 13, color: C.muted, align: "right" });
  });
  box(s, MX, 5.75, W - 2 * MX, 0.85, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: "Atenção ao shape: ", options: { bold: true } },
    { text: "em tensores (B, T, C), use k.transpose(-2, -1), e não k.T.", options: {} },
  ], MX + 0.3, 5.75, W - 2 * MX - 0.6, 0.85, { fontSize: 17, valign: "middle" });
}

// 21. Ordenação
{
  const s = base("Prática", "O que o modelo de ordenação aprendeu", `
Resultado real do modelo da seção 2.6 (2 camadas, 2 cabeças, cerca de 100 mil parâmetros, 2000 passos), para a entrada 3 1 4 1 5 9 2 6.

Cada linha é um passo da geração da parte ordenada; cada coluna é uma posição observada. A cabeça mostrada (camada 2, cabeça 0) concentra o peso, em cada passo, na posição da entrada que contém o dígito a ser escrito em seguida. Para escrever o 9, por exemplo, ela olha para o 9 da entrada.

Ninguém programou essa regra. O modelo recebeu apenas pares entrada/saída e a atenção emergiu como mecanismo de busca. Na turma, os padrões podem variar de cabeça para cabeça e de execução para execução; em geral, pelo menos uma das cabeças apresenta esse comportamento.`);
  const d = png("sort_heatmap.png");
  const h = 4.6, w = h * d.w / d.h;
  s.addImage({ path: A("sort_heatmap.png"), x: MX, y: 1.65, w, h });
  const x2 = MX + w + 0.4;
  t(s, "Entrada: 3 1 4 1 5 9 2 6", x2, 1.8, W - x2 - MX, 0.5, { fontFace: F.mono, fontSize: 15 });
  t(s, "Cada linha é um passo da geração; cada coluna, uma posição observada.", x2, 2.45, W - x2 - MX, 1.0, { fontSize: 16 });
  t(s, "Em cada passo, a cabeça se concentra no dígito da entrada que será escrito a seguir.", x2, 3.5, W - x2 - MX, 1.2, { fontSize: 16, bold: true });
  t(s, "A regra não foi programada: ela emergiu do treino.", x2, 4.75, W - x2 - MX, 0.8, { fontSize: 16, color: C.accent });
  t(s, "Camada 2, cabeça 0. A linha tracejada separa entrada e saída.", MX, 6.35, 8, 0.35, { fontSize: 12, color: C.muted, italic: true });
}

// 22. Intervalo
{
  const s = base("Intervalo", null, `
Intervalo de 5 minutos (01:15 a 01:20). Antes de liberar a turma, confirme que a maioria executou as células 3.1 e 3.2: a de treino deve estar imprimindo linhas "passo ... | perda ...". O treino dura 6 minutos e termina durante a pausa.

Se alguém estiver sem GPU, o treino em CPU será lento demais. Oriente essa pessoa a interromper a célula e usar o modelo de referência na seção 3.4.`);
  t(s, "Intervalo", MX, 1.9, 8, 1.0, { fontFace: F.title, fontSize: 54, bold: true });
  t(s, "5 minutos", MX, 2.95, 8, 0.6, { fontFace: F.title, fontSize: 26, color: C.muted, italic: true });
  box(s, MX, 4.2, 7.4, 1.6, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: "Antes de sair, execute as seções 3.1 e 3.2.", options: { bold: true, breakLine: true } },
    { text: "O modelo de xadrez treina por 6 minutos enquanto isso.", options: {} },
  ], MX + 0.3, 4.4, 6.9, 1.3, { fontSize: 19, paraSpaceAfter: 6 });
  chessboard(s, 9.0, 1.9, 0.44);
}

// 23. Xadrez como linguagem
{
  const s = base("Xadrez", "Xadrez como linguagem", `
O conjunto de dados tem cerca de 60 mil partidas do banco público do Lichess (janeiro a março de 2013), filtradas por término normal e rating médio a partir de 1500, e revalidadas com python-chess. Cada partida é uma linha começando com ponto e vírgula, no formato usado por Adam Karvonen.

Tokenização: cada caractere é um token. O vocabulário inteiro tem 33 símbolos, mostrados embaixo. Isso simplifica muito o workshop, com o custo de sequências mais longas. LLMs de verdade usam BPE, com vocabulários de dezenas a centenas de milhares de subpalavras.

Um lance como "Nxe5" são quatro tokens. O modelo precisa aprender a soletrar lances, as regras de movimento e o estado do tabuleiro, tudo a partir do texto.`);
  box(s, MX, 1.75, 7.2, 1.3, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, [
    { text: ";1.e4 e5 2.Nf3 Nc6 3.Bb5 a6", options: { breakLine: true } },
    { text: " 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 ...", options: {} },
  ], MX + 0.3, 1.9, 6.8, 1.0, { fontFace: F.mono, fontSize: 18, paraSpaceAfter: 4 });
  const hdr = (x) => ({ text: x, options: { bold: true, fill: { color: C.soft } } });
  s.addTable([
    [hdr("Símbolo"), hdr("Significado")],
    ["N  B  R  Q  K", "cavalo, bispo, torre, dama, rei"],
    ["e4, Nf3", "casa de destino (peão quando não há letra)"],
    ["x", "captura"],
    ["+  #", "xeque, xeque-mate"],
    ["O-O  O-O-O", "roque pequeno, roque grande"],
  ], { x: 8.3, y: 1.75, w: 4.33, colW: [1.6, 2.73], fontFace: F.body, fontSize: 13, border: { type: "solid", pt: 0.5, color: C.line }, rowH: 0.42, margin: 0.08, valign: "middle" });
  t(s, "Vocabulário completo: 33 caracteres", MX, 3.45, 7, 0.4, { fontSize: 17, bold: true });
  const voc = ["⏎", "␣", "#", "+", "-", ".", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ";", "=", "B", "K", "N", "O", "Q", "R", "a", "b", "c", "d", "e", "f", "g", "h", "x"];
  const cell = 0.42;
  voc.forEach((c, i) => {
    const r = Math.floor(i / 17), j = i % 17;
    s.addShape(pres.shapes.RECTANGLE, { x: MX + j * cell, y: 3.95 + r * cell, w: cell, h: cell, fill: { color: C.white }, line: { color: C.line, width: 0.75 } });
    t(s, c, MX + j * cell, 3.95 + r * cell, cell, cell, { fontFace: F.mono, fontSize: 13, align: "center", valign: "middle" });
  });
  t(s, "60 mil partidas do Lichess (2013), rating médio ≥ 1500, 24 milhões de caracteres. Cada caractere é um token.", MX, 5.1, 7.4, 0.9, { fontSize: 15, color: C.muted });
}

// 24. Objetivo de treino
{
  const s = base("Xadrez", "O mesmo objetivo, outro texto", `
O treino é idêntico ao da ordenação e ao de qualquer LLM: o alvo é a própria entrada deslocada em uma posição. Não há rótulos manuais.

Mostre o alinhamento: em cada coluna, o modelo vê tudo o que está em x até aquela coluna e precisa prever o caractere de y na mesma coluna.

Números do modelo da turma: 4 blocos, 4 cabeças, n_embd = 128, contexto de 256 caracteres, cerca de 0,8 milhão de parâmetros. A perda inicial fica perto de ln(33) ≈ 3,5, que corresponde a chutar uniformemente entre 33 caracteres, e cai para algo em torno de 1,0 em poucos minutos.`);
  const xs = ";1.e4 e5 2.Nf3 Nc6".split("");
  const ys = "1.e4 e5 2.Nf3 Nc6 ".split("");
  const cell = 0.55, x0 = 1.9;
  t(s, "x", MX + 0.4, 2.0, 0.6, cell, { fontFace: F.title, fontSize: 22, italic: true, valign: "middle" });
  t(s, "y", MX + 0.4, 2.0 + cell + 0.12, 0.6, cell, { fontFace: F.title, fontSize: 22, italic: true, valign: "middle" });
  xs.forEach((c, j) => {
    s.addShape(pres.shapes.RECTANGLE, { x: x0 + j * cell, y: 2.0, w: cell, h: cell, fill: { color: C.white }, line: { color: C.line, width: 0.75 } });
    t(s, c === " " ? "␣" : c, x0 + j * cell, 2.0, cell, cell, { fontFace: F.mono, fontSize: 16, align: "center", valign: "middle" });
    s.addShape(pres.shapes.RECTANGLE, { x: x0 + j * cell, y: 2.0 + cell + 0.12, w: cell, h: cell, fill: { color: C.b1 }, line: { color: C.b2, width: 0.75 } });
    t(s, ys[j] === " " ? "␣" : ys[j], x0 + j * cell, 2.0 + cell + 0.12, cell, cell, { fontFace: F.mono, fontSize: 16, align: "center", valign: "middle" });
  });
  t(s, "O alvo y é a própria entrada deslocada em uma posição. Não há rotulação manual.", MX, 3.65, 11.8, 0.5, { fontSize: 18 });
  const stats = [["0,8M", "parâmetros"], ["4 × 4", "blocos × cabeças"], ["256", "caracteres de contexto"], ["6 min", "de treino em uma T4"]];
  stats.forEach(([big, small], i) => {
    const x = MX + i * 3.0;
    t(s, big, x, 4.55, 2.8, 0.9, { fontFace: F.title, fontSize: 40, bold: true, color: C.blue });
    t(s, small, x, 5.45, 2.8, 0.4, { fontSize: 15, color: C.muted });
  });
}

// 25. Modelo de mundo
{
  const s = base("Xadrez", "O modelo sabe onde estão as peças?", `
Esta é a pergunta científica interessante do exercício. O modelo só vê texto. Para prever um lance legal de forma consistente, ele precisa, de algum modo, acompanhar a posição das peças.

A métrica usada no notebook é a taxa de legalidade: o modelo joga de brancas contra um adversário que sorteia lances, e medimos a fração de lances do modelo que são legais na primeira tentativa. Modelos pequenos treinados por minutos acertam bem a abertura e se perdem no meio-jogo. O modelo de referência (4,85M de parâmetros, 1 hora de treino em uma T4) chegou a cerca de 85% de lances legais nessa métrica, com perda de validação de 0,48; um modelo pequeno treinado por 3 minutos ficou em torno de 30%. Os números da turma aparecem na seção 3.4. Vale lembrar que a métrica cobre só os primeiros 20 lances do modelo, a parte mais fácil da partida.

Karvonen (2024) treinou modelos maiores com o mesmo formato de dados e mostrou, com sondas lineares, que é possível ler o estado do tabuleiro a partir das ativações internas. Ou seja, uma representação do tabuleiro emerge do objetivo de prever o próximo caractere. Esse resultado conversa com o trabalho de Li et al. (2023) sobre Othello.`);
  chessboard(s, MX, 1.8, 0.5, { "3,4": C.b2, "4,4": C.b2, "5,5": C.b2 });
  t(s, "Hipótese: para prever lances legais, a rede precisa manter internamente uma representação do tabuleiro.", 5.4, 1.8, 7.2, 1.0, { fontSize: 19, fontFace: F.title });
  t(s, "Métrica do notebook", 5.4, 3.05, 7, 0.4, { fontSize: 17, bold: true });
  t(s, "Taxa de legalidade: fração dos lances do modelo que são legais na primeira tentativa, jogando contra um adversário aleatório.", 5.4, 3.45, 7.2, 0.9, { fontSize: 16 });
  t(s, "Evidência na literatura", 5.4, 4.5, 7, 0.4, { fontSize: 17, bold: true });
  t(s, "Karvonen (2024) mostra que sondas lineares recuperam o estado do tabuleiro a partir das ativações de modelos treinados apenas com texto PGN.", 5.4, 4.9, 7.2, 1.1, { fontSize: 16 });
}

// 26. Temperatura
{
  const s = base("Xadrez", "Temperatura de amostragem", `
Na geração, os logits são divididos por uma temperatura τ antes da softmax. τ menor que 1 acentua as diferenças e aproxima a escolha gulosa; τ maior que 1 achata a distribuição.

O gráfico usa logits ilustrativos para o lance das pretas depois de 1.e4. Com τ = 0,3, quase toda a massa vai para e5; com τ = 1,5, lances menos prováveis ganham espaço.

No xadrez isso tem um efeito visível: temperatura alta gera partidas mais variadas e mais lances ilegais. É o mesmo parâmetro "temperature" das APIs de LLMs. Na seção 3.3 a turma varia o valor e observa o efeito.`);
  eq(s, "eq_temp.png", MX, 1.7, 1.4);
  t(s, "τ < 1 concentra a probabilidade no token mais provável.", MX, 3.2, 5, 0.6, { fontSize: 17 });
  t(s, "τ > 1 aproxima a distribuição da uniforme.", MX, 3.85, 5, 0.6, { fontSize: 17 });
  t(s, "É o mesmo parâmetro “temperature” das APIs de modelos de linguagem.", MX, 4.7, 5, 0.9, { fontSize: 15, color: C.muted });
  img(s, "ch_temp.png", 6.3, 1.6, 6.4, 4.8);
}

// 27. Prática 3
{
  const s = base("Prática", "Parte 3 no notebook: xadrez", `
Tempo: 20 minutos (01:30 a 01:50). O treino da seção 3.2 já deve ter terminado durante o intervalo.

Roteiro sugerido: gerar três partidas e observar em que lance cada uma se torna ilegal (3.3); variar a temperatura; medir a taxa de legalidade do próprio modelo e comparar com a do modelo de referência (3.4); jogar contra o modelo (3.5).

O tabuleiro da seção 3.5 é interativo: basta arrastar as peças (ou clicar na peça e depois na casa), e os lances legais ficam marcados. Quem preferir pode digitar em notação algébrica. Os lances do modelo aparecem em vermelho no histórico, e o painel mostra quantos deles foram legais na primeira tentativa. Vale sugerir que a turma jogue também contra o próprio modelo (trocando ref por modelo na célula) para comparar. A seção 3.6 é um complemento para quem terminar antes.

Se o modelo de referência não estiver disponível, a seção 3.4 usa automaticamente o modelo treinado pela turma.`);
  t(s, "20 min", MX, 1.7, 3.0, 1.0, { fontFace: F.title, fontSize: 54, bold: true, color: C.blue });
  t(s, "01:30 até 01:50", MX, 2.75, 3.0, 0.4, { fontSize: 15, color: C.muted });
  const ex = [
    ["3.3", "gerar partidas e encontrar o primeiro lance ilegal"],
    ["3.3", "variar a temperatura e comparar"],
    ["3.4", "comparar a taxa de legalidade com o modelo de referência"],
    ["3.5", "jogar uma partida contra o modelo"],
    ["3.6", "complemento: visualizar a atenção no xadrez"],
  ];
  ex.forEach(([sec, b], i) => {
    const y = 1.75 + i * 0.8;
    t(s, `seção ${sec}`, 4.4, y, 1.6, 0.5, { fontSize: 15, color: C.muted });
    t(s, b, 6.1, y, 6.5, 0.5, { fontSize: 18, bold: i === 3 });
  });
  box(s, MX, 5.95, W - 2 * MX, 0.75, undefined, { fill: C.soft, lineColor: C.soft });
  t(s, "Arraste as peças ou clique na peça e depois na casa. Também é possível digitar o lance (e4, Nf3, O-O).", MX + 0.3, 5.95, W - 2 * MX - 0.6, 0.75, { fontSize: 16, valign: "middle" });
}

// 28. Daqui até um LLM
{
  const s = base("Encerramento", "Daqui até um LLM", `
Feche o conteúdo técnico mostrando que a distância entre o notebook e um LLM é, em grande parte, de escala e de pós-treino. A arquitetura é reconhecível: embeddings, blocos com atenção e FFN, residuais, LayerNorm, cabeça linear.

Diferenças que valem citar, se houver tempo: tokenização por BPE; posição via RoPE; atenção com KV cache na inferência e variantes como grouped-query attention; normalização RMSNorm; ativação SwiGLU. Depois do pré-treino vêm o ajuste por instruções e o aprendizado por reforço com feedback humano ou com recompensas verificáveis, que transformam um completador de texto em um assistente.`);
  const hdr = (x) => ({ text: x, options: { bold: true, fill: { color: C.soft } } });
  s.addTable([
    [hdr(""), hdr("Este workshop"), hdr("Um LLM de grande porte")],
    [{ text: "Tokens", options: { bold: true } }, "caracteres (33)", "subpalavras via BPE (~10⁵)"],
    [{ text: "Parâmetros", options: { bold: true } }, "0,8M a 5M", "10⁹ a 10¹²"],
    [{ text: "Dados", options: { bold: true } }, "24 MB de partidas", "trilhões de tokens"],
    [{ text: "Treino", options: { bold: true } }, "minutos em uma T4", "meses em milhares de GPUs"],
    [{ text: "Etapas", options: { bold: true } }, "pré-treino", "pré-treino, ajuste por instruções, RLHF"],
  ], {
    x: MX, y: 1.8, w: W - 2 * MX, colW: [2.4, 4.3, 5.233], fontFace: F.body, fontSize: 17, color: C.ink,
    border: { type: "solid", pt: 0.75, color: C.line }, rowH: 0.6, valign: "middle", margin: 0.12,
  });
  t(s, "A arquitetura é, em essência, a que foi escrita hoje.", MX, 5.8, 11.8, 0.6, { fontSize: 20, fontFace: F.title });
}

// 29. Referências
{
  const s = base("Encerramento", "Referências e próximos passos", `
Indique a ordem de leitura sugerida: começar pelo vídeo do Karpathy (reforça tudo o que foi feito hoje, com o mesmo estilo de código), depois o texto ilustrado do Alammar, e então o artigo original, que fica muito mais legível depois do workshop. Karvonen e Li et al. são para quem se interessou pela pergunta dos modelos de mundo.

O repositório do workshop fica público; os notebooks, o gabarito e o script de pré-treino continuam disponíveis.`);
  const refs = [
    ["Vaswani, A. et al. (2017).", " Attention Is All You Need. NeurIPS. arXiv:1706.03762."],
    ["Karpathy, A. (2023).", " Let's build GPT: from scratch, in code, spelled out. Vídeo; repositório nanoGPT."],
    ["Alammar, J. (2018).", " The Illustrated Transformer. jalammar.github.io."],
    ["Karvonen, A. (2024).", " Emergent World Models and Latent Variable Estimation in Chess-Playing Language Models. arXiv:2403.15498."],
    ["Li, K. et al. (2023).", " Emergent World Representations: Exploring a Sequence Model Trained on a Synthetic Task. ICLR."],
    ["Prince, S. (2023).", " Understanding Deep Learning, cap. 12 (Transformers). MIT Press."],
  ];
  t(s, refs.map(([a, b], i) => [{ text: a, options: { bold: true } }, { text: b, options: { breakLine: i < refs.length - 1 } }]).flat(), MX, 1.8, 11.8, 3.6, { fontSize: 16, paraSpaceAfter: 10 });
  t(s, "Exercícios para casa", MX, 5.35, 6, 0.4, { fontSize: 17, bold: true });
  t(s, "Trocar o embedding de posição pelo senoidal · aumentar n_layer e n_embd · treinar em outro corpus.", MX, 5.75, 11.8, 0.5, { fontSize: 15, color: C.muted });
}

// 30. Encerramento
{
  const s = base(null, null, `
Agradeça, abra para perguntas (cerca de 5 minutos) e lembre que o link do notebook continua válido depois do evento.

Perguntas frequentes para as quais vale ter resposta pronta (ver o guia de estudos, seção de perguntas difíceis): por que o custo é quadrático; o que é KV cache; como o GPT passou de prever texto a seguir instruções; se o modelo de xadrez "entende" xadrez; qual a diferença entre este modelo e o AlphaZero.`);
  t(s, "Obrigado.", MX, 2.0, 8, 1.2, { fontFace: F.title, fontSize: 60, bold: true });
  t(s, "Perguntas?", MX, 3.2, 8, 0.8, { fontFace: F.title, fontSize: 30, color: C.muted, italic: true });
  t(s, "Giovanni Vasconcelos", MX, 4.9, 7, 0.4, { fontSize: 18, bold: true });
  t(s, COLAB_URL, MX, 5.35, 11.5, 0.4, { fontFace: F.mono, fontSize: 13, color: C.muted });
  const M = [];
  for (let i = 0; i < 6; i++) { const r = []; for (let j = 0; j < 6; j++) r.push(j > i ? 0 : [0.9, 0.3, 0.6, 0.15, 0.8, 0.35][(i * 2 + j * 3) % 6]); M.push(r); }
  grid(s, 9.6, 1.9, 0.5, M);
}

pres.writeFile({ fileName: OUT }).then(() => console.log("ok", OUT, n, "slides"));
