"""Gera a cola de xadrez de uma página, em duas versões.

- docs/cola_xadrez.tex: versão pública, para a turma.
- ministrante/cola_xadrez_ministrante.tex: versão do ministrante, com a frase
  de abertura e respostas para perguntas prováveis (fora do repositório).

Os tabuleiros são desenhados em TikZ a partir de posições calculadas com
python-chess, e as peças são os mesmos SVGs usados no tabuleiro interativo do
notebook (convertidos para PDF com rsvg-convert).

Uso:
    python scripts/gerar_cola.py
    cd docs && xelatex cola_xadrez.tex
    cd ministrante && xelatex cola_xadrez_ministrante.tex
"""

import subprocess
from pathlib import Path

import chess
import chess.svg

RAIZ = Path(__file__).resolve().parent.parent
DOCS = RAIZ / "docs"
PECAS = DOCS / "pecas"
MINISTRANTE = RAIZ / "ministrante"


# ---------------------------------------------------------------------------
# Peças: SVG do python-chess -> PDF
# ---------------------------------------------------------------------------

def gerar_pecas():
    PECAS.mkdir(parents=True, exist_ok=True)
    for s in "PNBRQKpnbrqk":
        nome = ("w" if s.isupper() else "b") + s.upper()
        svg = chess.svg.piece(chess.Piece.from_symbol(s))
        if "xmlns" not in svg:
            svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
        caminho = PECAS / f"{nome}.svg"
        caminho.write_text(svg)
        subprocess.run(["rsvg-convert", "-f", "pdf", "-o", str(PECAS / f"{nome}.pdf"), str(caminho)], check=True)
        caminho.unlink()


# ---------------------------------------------------------------------------
# Tabuleiro em TikZ
# ---------------------------------------------------------------------------

def casa(nome):
    return "abcdefgh".index(nome[0]), int(nome[1]) - 1


def tabuleiro(pecas, lado, pontos=(), aneis=(), setas=(), destaques=(), xeque=None, rotulos=False):
    """pecas: dict casa -> símbolo (ex.: {'d4': 'N'}). lado: largura do tabuleiro em cm."""
    s = lado / 8
    L = [r"\begin{tikzpicture}[x=%.4fcm,y=%.4fcm]" % (s, s)]
    for f in range(8):
        for r in range(8):
            cor = "claro" if (f + r) % 2 else "escuro"
            L.append(r"\fill[%s] (%d,%d) rectangle ++(1,1);" % (cor, f, r))
    for c in destaques:
        f, r = casa(c)
        L.append(r"\fill[ouro,opacity=.55] (%d,%d) rectangle ++(1,1);" % (f, r))
    if xeque:
        f, r = casa(xeque)
        L.append(r"\shade[inner color=acento, outer color=acento!0, opacity=.9] (%d.5,%d.5) circle (.62);" % (f, r))
    for c, p in pecas.items():
        f, r = casa(c)
        nome = ("w" if p.isupper() else "b") + p.upper()
        L.append(r"\node[inner sep=0] at (%d.5,%d.5) {\includegraphics[width=%.3fcm]{pecas/%s.pdf}};" % (f, r, s * 0.92, nome))
    for c in pontos:
        f, r = casa(c)
        L.append(r"\fill[tinta,opacity=.30] (%d.5,%d.5) circle (.15);" % (f, r))
    for c in aneis:
        f, r = casa(c)
        L.append(r"\draw[tinta,opacity=.32,line width=%.2fpt] (%d.5,%d.5) circle (.42);" % (s * 5.5, f, r))
    for de, para, estilo in setas:
        (f1, r1), (f2, r2) = casa(de), casa(para)
        L.append(r"\draw[%s] (%d.5,%d.5) -- (%d.5,%d.5);" % (estilo, f1, r1, f2, r2))
    L.append(r"\draw[tinta,line width=.5pt] (0,0) rectangle (8,8);")
    if rotulos:
        for i, a in enumerate("abcdefgh"):
            L.append(r"\node[mudo,font=\tiny] at (%d.5,-.42) {%s};" % (i, a))
        for i in range(8):
            L.append(r"\node[mudo,font=\tiny] at (-.42,%d.5) {%d};" % (i, i + 1))
    L.append(r"\end{tikzpicture}")
    return "\n".join(L)


def alcance(peca, origem, extras=None):
    """Casas alcançáveis por uma peça sozinha no tabuleiro (mais peças extras opcionais)."""
    b = chess.Board(None)
    b.set_piece_at(chess.parse_square(origem), chess.Piece.from_symbol(peca))
    for c, p in (extras or {}).items():
        b.set_piece_at(chess.parse_square(c), chess.Piece.from_symbol(p))
    b.turn = chess.WHITE
    livres, capturas = [], []
    for m in b.pseudo_legal_moves:
        if m.from_square != chess.parse_square(origem):
            continue
        destino = chess.square_name(m.to_square)
        (capturas if b.piece_at(m.to_square) else livres).append(destino)
    return sorted(set(livres)), sorted(set(capturas))


def posicao(lances):
    b = chess.Board()
    for san in lances:
        b.push_san(san)
    return b, {chess.square_name(sq): p.symbol() for sq, p in b.piece_map().items()}


# ---------------------------------------------------------------------------
# Conteúdo
# ---------------------------------------------------------------------------

PECAS_INFO = [
    ("P", "e2", {"d3": "n", "f3": "b"}, "Peão", "sem letra",
     "Anda uma casa para a frente (duas no primeiro lance). Captura na diagonal."),
    ("N", "d4", None, "Cavalo", "N",
     "Anda em L. É a única peça que pula por cima das outras."),
    ("B", "d4", None, "Bispo", "B",
     "Anda na diagonal, quantas casas quiser."),
    ("R", "d4", None, "Torre", "R",
     "Anda na horizontal ou na vertical, quantas casas quiser."),
    ("Q", "d4", None, "Dama", "Q",
     "Torre e bispo juntos. É a peça mais forte."),
    ("K", "d4", None, "Rei", "K",
     "Uma casa em qualquer direção. Se não tem como escapar do ataque, é xeque-mate."),
]


def celula_peca(simbolo, origem, extras, nome, letra, texto):
    livres, capturas = alcance(simbolo, origem, extras)
    pecas = {origem: simbolo, **(extras or {})}
    tab = tabuleiro(pecas, 2.2, pontos=livres, aneis=capturas)
    return (r"\begin{minipage}[t]{2.3cm}\vspace{0pt}" + tab + r"\end{minipage}\hspace{.22cm}"
            r"\begin{minipage}[t]{3.2cm}\vspace{1pt}\raggedright"
            r"{\large\textbf{%s}}\hfill\letra{%s}\par\vspace{2pt}{\small %s}\end{minipage}" % (nome, letra, texto))


PUBLICA = {
    "subtitulo": r"Referência rápida para a Parte 3 do workshop \emph{Attention is All You Need}",
    "abertura": "",
    "demos": "Duas partidas para experimentar",
    "espanhola": r"O modelo viu essa abertura milhares de vezes no treino. Com temperatura 0,3 ainda há sorteio, então ele pode sair da linha.",
    "final": r"""\secao{Para observar}
\begin{minipage}[t]{.485\linewidth}
\raggedright\textbf{Em que lance ele erra primeiro?}\enspace Aberturas aparecem milhares de vezes nos dados; posições do meio-jogo são quase sempre inéditas. Veja onde a qualidade cai.\par\vspace{5pt}
\textbf{Temperatura.}\enspace Com valores baixos o modelo repete as linhas mais comuns; com valores altos, inventa mais e erra mais.
\end{minipage}\hfill
\begin{minipage}[t]{.485\linewidth}
\raggedright\textbf{Seu modelo contra o de referência.}\enspace O de referência tem seis vezes mais parâmetros e treinou dez vezes mais. Compare as taxas de lances legais na seção 3.4.\par\vspace{5pt}
\textbf{Ele nunca viu um tabuleiro.}\enspace Tudo o que ele sabe veio de ler partidas como texto, um caractere por vez.
\end{minipage}""",
    "grafico": "",
}

MINISTRO = {
    "subtitulo": r"Uma página para conduzir a Parte 3 do workshop \emph{Attention is All You Need}",
    "abertura": r"""\begin{tcolorbox}[colback=suave,colframe=suave,boxrule=0pt,arc=3pt,left=10pt,right=10pt,top=4pt,bottom=4pt]
{\itshape ``Eu nunca joguei xadrez. O modelo também não: ele só leu 60 mil partidas.''}\hfill{\small\color{mudo} uma boa frase de abertura}
\end{tcolorbox}""",
    "demos": "Duas demonstrações prontas",
    "espanhola": r"Mostra que o modelo reproduz a teoria que viu milhares de vezes. Se ele sair da linha, também serve: com temperatura 0,3 ainda há sorteio.",
    "final": r"""\secao{Se alguém perguntar}
\begin{minipage}[t]{.485\linewidth}
\raggedright\textbf{``Ele joga bem?''}\enspace Não medimos rating, só se os lances são legais: cerca de 85\% nos primeiros 20 lances, contra um adversário que joga ao acaso.\par\vspace{5pt}
\textbf{``Ele entende xadrez?''}\enspace Ele nunca vê o tabuleiro, mas para acertar lances precisa representar as peças por dentro. Karvonen (2024) consegue ler o tabuleiro nas ativações. É o slide 25.
\end{minipage}\hfill
\begin{minipage}[t]{.485\linewidth}
\raggedright\textbf{``E o Stockfish, o AlphaZero?''}\enspace Eles recebem o tabuleiro e calculam variantes antes de jogar. O nosso não calcula nada: prevê o próximo caractere, imitando partidas humanas.\par\vspace{5pt}
\textbf{``Você joga?''}\enspace Não. E essa é a graça: nem eu nem o modelo aprendemos com as regras.
\end{minipage}""",
    "grafico": r"\graphicspath{{../docs/}}",
}


def gerar_tex(v):
    celulas = [celula_peca(*info) for info in PECAS_INFO]
    grade = (celulas[0] + r"\hfill" + celulas[1] + r"\hfill" + celulas[2] + r"\par\vspace{6pt}"
             + celulas[3] + r"\hfill" + celulas[4] + r"\hfill" + celulas[5])

    # notação: Nf3 com seta e coordenadas
    _, ini = posicao([])
    tab_notacao = tabuleiro(ini, 3.2, setas=[("g1", "f3", "seta")], destaques=["g1", "f3"], rotulos=True)

    # demonstração 1: abertura espanhola
    b1, p1 = posicao(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"])
    tab_espanhola = tabuleiro(p1, 3.6, destaques=["g8", "f6"], rotulos=True)

    # demonstração 2: mate do pastor, posição antes do lance final
    b2, p2 = posicao(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"])
    tab_pastor = tabuleiro(p2, 3.6, setas=[("h5", "f7", "seta"), ("c4", "f7", "apoio")],
                           destaques=["g8", "f6"], xeque=None, rotulos=True)

    tex = r"""\documentclass[10pt]{article}
\usepackage[a4paper,margin=1.3cm,top=1.0cm,bottom=0.9cm]{geometry}
\usepackage{fontspec}
\setmainfont{Charter}
\setmonofont{Menlo}[Scale=0.84]
\usepackage[portuguese]{babel}
\usepackage{xcolor,graphicx,tikz,tabularx,array,enumitem}
\usepackage[most]{tcolorbox}
\usetikzlibrary{arrows.meta}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\definecolor{tinta}{HTML}{1B1B1B}\definecolor{mudo}{HTML}{5F5F5F}\definecolor{acento}{HTML}{9E2A2B}
\definecolor{azul}{HTML}{2F5D8A}\definecolor{claro}{HTML}{E8EEF5}\definecolor{escuro}{HTML}{7FA0C4}
\definecolor{suave}{HTML}{F3F4F6}\definecolor{ouro}{HTML}{E2BA48}
\color{tinta}
\tikzset{seta/.style={acento,line width=2.4pt,-{Triangle[length=7pt,width=8pt]},opacity=.9,shorten >=3pt,shorten <=3pt},
         apoio/.style={azul,line width=1.6pt,dashed,-{Triangle[length=6pt,width=7pt]},opacity=.85,shorten >=3pt,shorten <=3pt}}
\newcommand{\rotulo}[1]{{\small\color{acento}\bfseries\addfontfeature{LetterSpace=12}\MakeUppercase{#1}}}
\newcommand{\secao}[1]{\vspace{7pt}{\Large\bfseries #1}\par\vspace{4pt}}
\newcommand{\letra}[1]{\tikz[baseline=(x.base)]\node[fill=claro,rounded corners=2pt,inner xsep=4pt,inner ysep=2pt,font=\ttfamily\bfseries\color{azul}](x){#1};}
\newcommand{\lance}[1]{\texttt{#1}}
""" + v["grafico"] + r"""
\begin{document}

\rotulo{CESUPA Tech Summit 2026 \,·\, 14 de outubro}\par\vspace{4pt}
{\fontsize{26}{29}\selectfont\bfseries Xadrez para quem nunca jogou}\par\vspace{2pt}
{\large\itshape\color{mudo} """ + v["subtitulo"] + r"""}\par
\vspace{6pt}
""" + v["abertura"] + r"""

\secao{As peças}
{\small\color{mudo} Os pontos mostram para onde a peça pode ir; os anéis, o que ela pode capturar. É o mesmo desenho do tabuleiro do notebook.}\par\vspace{8pt}
""" + grade + r"""

\secao{Como ler um lance}
\begin{minipage}[t]{3.5cm}\vspace{0pt}
""" + tab_notacao + r"""
\end{minipage}\hspace{.5cm}%
\begin{minipage}[t]{\dimexpr\linewidth-3.9cm}\vspace{2pt}
As colunas vão de \textbf{a} a \textbf{h} e as linhas de \textbf{1} a \textbf{8}; as brancas começam embaixo.
Cada lance é a letra da peça seguida da casa de destino. No tabuleiro ao lado, \lance{Nf3} é o cavalo indo de g1 para f3.\par\vspace{7pt}
\renewcommand{\arraystretch}{1.35}
\begin{tabularx}{\linewidth}{@{}>{\ttfamily\bfseries}l@{\hspace{8pt}}X@{\hspace{14pt}}>{\ttfamily\bfseries}l@{\hspace{8pt}}X@{}}
\textcolor{azul}{e4}   & peão para e4 (peão não tem letra) & \textcolor{azul}{+}   & xeque: o rei está atacado \\
\textcolor{azul}{Nf3}  & cavalo para f3                    & \textcolor{azul}{\#}  & xeque-mate: fim de jogo \\
\textcolor{azul}{Bxe5} & bispo captura (x) a peça em e5    & \textcolor{azul}{O-O} & roque: rei e torre se protegem \\
\end{tabularx}
\end{minipage}

\secao{""" + v["demos"] + r"""}
\begin{minipage}[t]{.485\linewidth}\vspace{0pt}
\begin{minipage}[t]{3.85cm}\vspace{0pt}
""" + tab_espanhola + r"""
\end{minipage}\hfill
\begin{minipage}[t]{\dimexpr\linewidth-4.05cm}\vspace{0pt}\raggedright
{\large\bfseries 1. Abertura espanhola}\par\vspace{3pt}
{\small Uma das aberturas mais jogadas da história.}\par\vspace{5pt}
{\small\color{mudo}Você joga}\par \lance{e4 \ Nf3 \ Bb5 \ Ba4}\par\vspace{4pt}
{\small\color{mudo}O modelo deve responder}\par \lance{e5 \ Nc6 \ a6 \ Nf6}\par
\end{minipage}\par\vspace{6pt}
{\small\raggedright """ + v["espanhola"] + r"""}
\end{minipage}\hfill
\begin{minipage}[t]{.485\linewidth}\vspace{0pt}
\begin{minipage}[t]{3.85cm}\vspace{0pt}
""" + tab_pastor + r"""
\end{minipage}\hfill
\begin{minipage}[t]{\dimexpr\linewidth-4.05cm}\vspace{0pt}\raggedright
{\large\bfseries 2. Mate do pastor}\par\vspace{3pt}
{\small Mate em quatro lances que pega iniciantes.}\par\vspace{5pt}
{\small\color{mudo}Você joga}\par \lance{e4 \ Bc4 \ Qh5}\par\vspace{4pt}
{\small\color{mudo}Se ele jogar \lance{Nf6}}\par \lance{Qxf7\#}\par
\end{minipage}\par\vspace{6pt}
{\small\raggedright Dama (seta vermelha) e bispo (tracejada) atacam f7. Se o modelo defender com \lance{g6}, \lance{Qe7} ou \lance{Qf6}, aprendeu a defesa só lendo partidas.}
\end{minipage}

""" + v["final"] + r"""

\vspace{8pt}
\begin{tcolorbox}[colback=claro,colframe=claro,boxrule=0pt,arc=3pt,left=10pt,right=10pt,top=5pt,bottom=5pt]
\small\textbf{No tabuleiro do notebook (seção 3.5).}\enspace Clique numa peça e os pontos mostram os lances possíveis; não é preciso saber as regras.
Os lances do modelo aparecem em vermelho no histórico. \emph{Desfazer} volta o seu lance e o do modelo; \emph{Trocar cores} faz o modelo começar.
O peão que chega ao outro lado vira dama automaticamente.
\end{tcolorbox}

\end{document}
"""
    return tex


if __name__ == "__main__":
    gerar_pecas()
    (DOCS / "cola_xadrez.tex").write_text(gerar_tex(PUBLICA))
    MINISTRANTE.mkdir(exist_ok=True)
    (MINISTRANTE / "cola_xadrez_ministrante.tex").write_text(gerar_tex(MINISTRO))
    print("gerado: docs/cola_xadrez.tex e ministrante/cola_xadrez_ministrante.tex")
