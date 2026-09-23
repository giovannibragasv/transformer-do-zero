"""Tabuleiro interativo para jogar contra o modelo no Google Colab.

O estado da partida fica em Python (classe PartidaInterativa); o tabuleiro é
desenhado em JavaScript puro, sem bibliotecas externas, e conversa com o Python
pelas callbacks do Colab (google.colab.kernel.invokeFunction). As peças são os
SVGs do python-chess embutidos na página, de modo que nada é baixado da internet.

Fora do Colab, jogar_contra() recorre à versão em texto (jogar_texto).
"""

import base64
import json
import uuid

import chess
import chess.svg

from mini_gpt import historico_pgn, lance_do_modelo


# ---------------------------------------------------------------------------
# Estado da partida
# ---------------------------------------------------------------------------

class PartidaInterativa:
    """Partida humano x modelo. Todos os métodos públicos devolvem o estado (dict)."""

    def __init__(self, modelo, tok, humano=chess.WHITE, temperatura=0.3, device="cpu"):
        self.modelo, self.tok = modelo, tok
        self.temperatura, self.device = temperatura, device
        self.nova(humano)

    def nova(self, humano=None):
        if humano is not None:
            self.humano = humano
        self.board = chess.Board()
        self.acertos = self.total = 0
        self.aviso = ""
        self._vez_do_modelo()
        return self.estado()

    def trocar_cores(self):
        return self.nova(not self.humano)

    def desfazer(self):
        # desfaz o último lance do modelo e o último lance humano
        if not self.board.move_stack:
            return self.estado()
        self.board.pop()
        if self.board.move_stack and self.board.turn != self.humano:
            self.board.pop()
        self.aviso = ""
        return self.estado()

    def jogar(self, texto):
        """Recebe um lance em UCI (e2e4, vindo do arraste) ou SAN (Nf3, digitado)."""
        if self.board.is_game_over() or self.board.turn != self.humano:
            return self.estado()
        lance = self._interpreta(texto.strip())
        if lance is None:
            self.aviso = f"'{texto}' não é um lance legal nesta posição."
            return self.estado()
        self.board.push(lance)
        self.aviso = ""
        self._vez_do_modelo()
        return self.estado()

    def _interpreta(self, texto):
        for tentativa in (texto, texto + "q"):          # promoção automática para dama
            try:
                lance = chess.Move.from_uci(tentativa)
                if lance in self.board.legal_moves:
                    return lance
            except ValueError:
                pass
        try:
            return self.board.parse_san(texto)
        except ValueError:
            return None

    def _vez_do_modelo(self):
        if self.board.is_game_over() or self.board.turn == self.humano:
            return
        lance, ok = lance_do_modelo(self.modelo, self.tok, self.board, self.temperatura, device=self.device)
        self.total += 1
        self.acertos += ok
        if not ok:
            self.aviso = "O modelo não produziu um lance legal em 10 tentativas; um lance foi sorteado."
        self.board.push(lance)

    def estado(self):
        b = self.board
        pecas = {chess.square_name(sq): p.symbol() for sq, p in b.piece_map().items()}
        ultimo = None
        if b.move_stack:
            m = b.peek()
            ultimo = [chess.square_name(m.from_square), chess.square_name(m.to_square)]
        xeque = chess.square_name(b.king(b.turn)) if b.is_check() else None
        sans, tmp = [], chess.Board()
        for m in b.move_stack:
            sans.append(tmp.san(m))
            tmp.push(m)
        fim = b.is_game_over()
        if fim:
            res = b.result()
            vencedor = {"1-0": chess.WHITE, "0-1": chess.BLACK}.get(res)
            if vencedor is None:
                status = f"Empate ({res})."
            else:
                status = "Você venceu." if vencedor == self.humano else "O modelo venceu."
        elif b.turn == self.humano:
            status = "Sua vez." + (" Você está em xeque." if b.is_check() else "")
        else:
            status = "Vez do modelo."
        return {
            "pecas": pecas,
            "legais": [m.uci()[:4] for m in b.legal_moves] if (b.turn == self.humano and not fim) else [],
            "ultimo": ultimo,
            "xeque": xeque,
            "historico": sans,
            "humano": "w" if self.humano == chess.WHITE else "b",
            "status": status,
            "aviso": self.aviso,
            "fim": fim,
            "acertos": self.acertos,
            "total": self.total,
            "pgn": historico_pgn(b),
        }


# ---------------------------------------------------------------------------
# Página (HTML + CSS + JS)
# ---------------------------------------------------------------------------

def _imagens_pecas():
    imgs = {}
    for s in "PNBRQKpnbrqk":
        svg = chess.svg.piece(chess.Piece.from_symbol(s))
        if "xmlns" not in svg:
            svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
        imgs[s] = "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()
    return imgs


_HTML = r"""
<div id="__ID__" class="xz">
<style>
#__ID__ { --claro:#E8EEF5; --escuro:#7FA0C4; --tinta:#1B1B1B; --mudo:#5F5F5F; --acento:#9E2A2B;
  font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--tinta);
  display:flex; gap:24px; flex-wrap:wrap; align-items:flex-start; padding:8px 0; user-select:none; }
#__ID__ .tab { position:relative; width:min(88vw, 440px); aspect-ratio:1; border:1px solid var(--tinta);
  display:grid; grid-template-columns:repeat(8,1fr); grid-template-rows:repeat(8,1fr); touch-action:none; }
#__ID__ .casa { position:relative; }
#__ID__ .casa.c { background:var(--claro); } #__ID__ .casa.e { background:var(--escuro); }
#__ID__ .casa.ult::after { content:""; position:absolute; inset:0; background:rgba(226,186,72,.50); }
#__ID__ .casa.sel::after { content:""; position:absolute; inset:0; background:rgba(27,27,27,.18); }
#__ID__ .casa.xq { background:radial-gradient(circle, rgba(158,42,43,.9) 0%, rgba(158,42,43,.35) 45%, transparent 75%); }
#__ID__ .casa .ponto { position:absolute; left:50%; top:50%; width:26%; height:26%; transform:translate(-50%,-50%);
  border-radius:50%; background:rgba(27,27,27,.28); pointer-events:none; }
#__ID__ .casa .anel { position:absolute; inset:4%; border-radius:50%; border:5px solid rgba(27,27,27,.28); pointer-events:none; }
#__ID__ .coord { position:absolute; font-size:10px; font-weight:600; pointer-events:none; }
#__ID__ .coord.f { right:3px; bottom:1px; } #__ID__ .coord.r { left:3px; top:1px; }
#__ID__ .casa.c .coord { color:var(--escuro); } #__ID__ .casa.e .coord { color:var(--claro); }
#__ID__ .peca { position:absolute; inset:0; width:100%; height:100%; cursor:grab; z-index:2;
  transition: transform 220ms ease; }
#__ID__ .peca.arr { cursor:grabbing; transition:none; z-index:10; }
#__ID__ .painel { flex:1; min-width:230px; max-width:320px; }
#__ID__ h3 { font-family: Cambria, Georgia, serif; font-size:19px; margin:0 0 4px; }
#__ID__ .sub { color:var(--mudo); font-size:13px; margin-bottom:12px; }
#__ID__ .status { font-weight:600; font-size:15px; min-height:22px; }
#__ID__ .aviso { color:var(--acento); font-size:13px; min-height:18px; margin:4px 0 8px; }
#__ID__ .lances { font-family: Menlo, Consolas, monospace; font-size:13px; height:170px; overflow-y:auto;
  border-top:1px solid #D0D0D0; border-bottom:1px solid #D0D0D0; padding:6px 0; margin-bottom:10px;
  display:grid; grid-template-columns:34px 1fr 1fr; row-gap:2px; align-content:start; }
#__ID__ .lances .n { color:var(--mudo); }
#__ID__ .lances .m { color:var(--acento); font-weight:600; }
#__ID__ .stats { font-size:13px; color:var(--mudo); margin-bottom:10px; }
#__ID__ .linha { display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap; }
#__ID__ button { font:inherit; font-size:13px; padding:5px 10px; border:1px solid var(--tinta); background:#fff;
  border-radius:4px; cursor:pointer; }
#__ID__ button:hover { background:var(--claro); }
#__ID__ input { font:inherit; font-size:13px; padding:5px 8px; border:1px solid #B0B0B0; border-radius:4px; width:90px; }
#__ID__.pensando .tab { opacity:.85; }
</style>
<div class="tab"></div>
<div class="painel">
  <h3>Você × modelo</h3>
  <div class="sub"></div>
  <div class="status"></div>
  <div class="aviso"></div>
  <div class="lances"></div>
  <div class="stats"></div>
  <div class="linha"><input class="txt" placeholder="ex.: Nf3" aria-label="Digite um lance"><button class="bjogar">Jogar</button></div>
  <div class="linha"><button class="bnova">Nova partida</button><button class="bdesf">Desfazer</button><button class="btroca">Trocar cores</button></div>
</div>
</div>
<script>
(function(){
const raiz = document.getElementById("__ID__");
const IMGS = __IMGS__;
const CB = __CB__;
let E = __ESTADO__;
let sel = null, ocupado = false;
const tab = raiz.querySelector(".tab");
const arquivos = "abcdefgh";

function nomeCasa(i, j) {       // i = linha na tela (0 no topo), j = coluna na tela
  const branco = E.humano === "w";
  const f = branco ? j : 7 - j, r = branco ? 7 - i : i;
  return arquivos[f] + (r + 1);
}
function posTela(casa) {
  const f = arquivos.indexOf(casa[0]), r = +casa[1] - 1, branco = E.humano === "w";
  return branco ? [7 - r, f] : [r, 7 - f];
}
function destinos(de) { return E.legais.filter(u => u.slice(0,2) === de).map(u => u.slice(2,4)); }

function desenha(anima) {
  tab.innerHTML = "";
  const alvos = sel ? destinos(sel) : [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const nm = nomeCasa(i, j), d = document.createElement("div");
    const clara = (arquivos.indexOf(nm[0]) + (+nm[1])) % 2 === 1;
    d.className = "casa " + (clara ? "c" : "e");
    d.dataset.casa = nm;
    if (E.ultimo && E.ultimo.includes(nm)) d.classList.add("ult");
    if (sel === nm) d.classList.add("sel");
    if (E.xeque === nm) d.classList.add("xq");
    if (j === 0) d.insertAdjacentHTML("beforeend", `<span class="coord r">${nm[1]}</span>`);
    if (i === 7) d.insertAdjacentHTML("beforeend", `<span class="coord f">${nm[0]}</span>`);
    const p = E.pecas[nm];
    if (p) {
      const im = document.createElement("img");
      im.src = IMGS[p]; im.className = "peca"; im.draggable = false; im.alt = p;
      d.appendChild(im);
    }
    if (alvos.includes(nm)) d.insertAdjacentHTML("beforeend", p ? '<div class="anel"></div>' : '<div class="ponto"></div>');
    tab.appendChild(d);
  }
  if (anima && E.ultimo) {       // desliza a peça da casa de origem até o destino
    const [a, b] = [posTela(E.ultimo[0]), posTela(E.ultimo[1])];
    const im = tab.querySelector(`[data-casa="${E.ultimo[1]}"] .peca`);
    if (im) {
      im.style.transition = "none";
      im.style.transform = `translate(${(a[1]-b[1])*100}%, ${(a[0]-b[0])*100}%)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { im.style.transition = ""; im.style.transform = ""; }));
    }
  }
  painel();
}

function painel() {
  raiz.querySelector(".sub").textContent = "Você joga de " + (E.humano === "w" ? "brancas" : "pretas") + ". Arraste uma peça ou clique na peça e depois na casa.";
  raiz.querySelector(".status").textContent = ocupado ? "O modelo está pensando..." : E.status;
  raiz.querySelector(".aviso").textContent = E.aviso || "";
  const L = raiz.querySelector(".lances"); L.innerHTML = "";
  const modeloBrancas = E.humano === "b";
  for (let k = 0; k < E.historico.length; k += 2) {
    L.insertAdjacentHTML("beforeend", `<span class="n">${k/2+1}.</span>`);
    [k, k+1].forEach(t => {
      const s = document.createElement("span");
      s.textContent = E.historico[t] || "";
      if (E.historico[t] && ((t % 2 === 0) === modeloBrancas)) s.className = "m";
      L.appendChild(s);
    });
  }
  L.scrollTop = L.scrollHeight;
  raiz.querySelector(".stats").textContent = E.total
    ? `Lances do modelo legais na primeira tentativa: ${E.acertos} de ${E.total}.  Em vermelho: lances do modelo.`
    : "Em vermelho: lances do modelo.";
}

async function chama(nome, args) {
  if (ocupado) return;
  ocupado = true; raiz.classList.add("pensando"); painel();
  try {
    const r = await google.colab.kernel.invokeFunction(CB + "." + nome, args, {});
    E = r.data["application/json"];
  } catch (e) {
    E.aviso = "Falha ao falar com o Python. Execute a célula de novo.";
  }
  ocupado = false; raiz.classList.remove("pensando"); sel = null;
  desenha(true);
}

function tenta(de, para) {
  if (destinos(de).includes(para)) { sel = null; E.pecas[para] = E.pecas[de]; delete E.pecas[de]; E.ultimo = [de, para]; E.legais = []; desenha(false); chama("lance", [de + para]); return true; }
  return false;
}

// arrastar e soltar (mouse e toque) + clique-clique
let arr = null;
tab.addEventListener("pointerdown", ev => {
  if (ocupado || E.fim) return;
  const casa = ev.target.closest(".casa"); if (!casa) return;
  const nm = casa.dataset.casa;
  if (sel && sel !== nm && tenta(sel, nm)) return;
  const p = E.pecas[nm];
  const minha = p && ((p === p.toUpperCase()) === (E.humano === "w"));
  if (!minha || !destinos(nm).length) { sel = null; desenha(false); return; }
  sel = nm; desenha(false);
  const im = tab.querySelector(`[data-casa="${nm}"] .peca`);
  const r = tab.getBoundingClientRect();
  arr = { de: nm, im, x0: ev.clientX, y0: ev.clientY, moveu: false, lado: r.width / 8 };
  im.classList.add("arr");
  tab.setPointerCapture(ev.pointerId);
  ev.preventDefault();
});
tab.addEventListener("pointermove", ev => {
  if (!arr) return;
  const dx = ev.clientX - arr.x0, dy = ev.clientY - arr.y0;
  if (Math.abs(dx) + Math.abs(dy) > 4) arr.moveu = true;
  arr.im.style.transform = `translate(${dx}px, ${dy}px)`;
});
tab.addEventListener("pointerup", ev => {
  if (!arr) return;
  const a = arr; arr = null;
  a.im.classList.remove("arr"); a.im.style.transform = "";
  if (!a.moveu) return;               // foi um clique: a peça fica selecionada
  const r = tab.getBoundingClientRect();
  const j = Math.floor((ev.clientX - r.left) / a.lado), i = Math.floor((ev.clientY - r.top) / a.lado);
  if (i < 0 || i > 7 || j < 0 || j > 7 || !tenta(a.de, nomeCasa(i, j))) { sel = null; desenha(false); }
});

const txt = raiz.querySelector(".txt");
const envia = () => { if (txt.value.trim()) { chama("lance", [txt.value.trim()]); txt.value = ""; } };
raiz.querySelector(".bjogar").onclick = envia;
txt.addEventListener("keydown", ev => { if (ev.key === "Enter") envia(); });
raiz.querySelector(".bnova").onclick = () => chama("nova", []);
raiz.querySelector(".bdesf").onclick = () => chama("desfazer", []);
raiz.querySelector(".btroca").onclick = () => chama("trocar", []);
desenha(true);
})();
</script>
"""


def pagina(estado, cb, id_):
    return (_HTML.replace("__ID__", id_)
                 .replace("__IMGS__", json.dumps(_imagens_pecas()))
                 .replace("__CB__", json.dumps(cb))
                 .replace("__ESTADO__", json.dumps(estado)))


# ---------------------------------------------------------------------------
# Pontos de entrada
# ---------------------------------------------------------------------------

def jogar_contra(modelo, tok, humano="brancas", temperatura=0.3, device="cpu"):
    """Mostra o tabuleiro interativo no Colab. Fora do Colab, usa a versão em texto."""
    cor = chess.BLACK if humano in ("pretas", "black") else chess.WHITE
    try:
        from google.colab import output
    except ImportError:
        print("Tabuleiro interativo disponível apenas no Colab; usando a versão em texto.")
        return jogar_texto(modelo, tok, humano=cor, temperatura=temperatura, device=device)
    from IPython.display import HTML, JSON, display

    modelo.eval()
    partida = PartidaInterativa(modelo, tok, cor, temperatura, device)
    cb = "xadrez_" + uuid.uuid4().hex[:8]
    output.register_callback(cb + ".lance", lambda t: JSON(partida.jogar(t)))
    output.register_callback(cb + ".nova", lambda: JSON(partida.nova()))
    output.register_callback(cb + ".desfazer", lambda: JSON(partida.desfazer()))
    output.register_callback(cb + ".trocar", lambda: JSON(partida.trocar_cores()))
    display(HTML(pagina(partida.estado(), cb, "tab_" + cb)))
    return partida


def jogar_texto(modelo, tok, humano=chess.WHITE, temperatura=0.3, device="cpu"):
    """Versão de reserva: tabuleiro em SVG e lances digitados."""
    from IPython.display import SVG, clear_output, display

    board, aviso = chess.Board(), ""
    while not board.is_game_over():
        clear_output(wait=True)
        display(SVG(chess.svg.board(board, size=360, flipped=humano == chess.BLACK,
                                    lastmove=board.peek() if board.move_stack else None)))
        print(historico_pgn(board)[-120:])
        print(aviso)
        if board.turn == humano:
            s = input("Seu lance (ou 'sair'): ").strip()
            if s == "sair":
                return
            try:
                board.push_san(s)
                aviso = ""
            except ValueError:
                aviso = f"'{s}' não é um lance legal nesta posição."
        else:
            lance, ok = lance_do_modelo(modelo, tok, board, temperatura, device=device)
            aviso = "" if ok else "O modelo não produziu um lance legal; foi sorteado um lance."
            board.push(lance)
    clear_output(wait=True)
    display(SVG(chess.svg.board(board, size=360)))
    print("Fim de jogo:", board.result())
