"""Converte PGNs do Lichess (.pgn.zst) em um arquivo de texto simples para o workshop.

Formato de saída: uma partida por linha, no estilo usado por Adam Karvonen
(chess_llm_interpretability):

    ;1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 ...

Filtros: término "Normal" (xeque-mate, abandono, empate combinado),
Elo médio >= MIN_ELO, pelo menos MIN_LANCES meios-lances, e toda partida
é revalidada com python-chess (lances ilegais não entram no dataset).

Uso:
    python scripts/preparar_dados.py data_raw/*.pgn.zst -o data/xadrez.txt
"""

import argparse
import io
import re

import chess
import zstandard

MIN_ELO = 1500
MIN_LANCES = 20
MAX_CHARS = 1000  # partidas muito longas são cortadas (o modelo vê no máximo block_size chars)

TAG_RE = re.compile(r'^\[(\w+) "(.*)"\]$')
LIXO_RE = re.compile(r"\{[^}]*\}|\$\d+|[?!]+")  # comentários, NAGs, anotações
NUM_RE = re.compile(r"^\d+\.+$")
RESULTADOS = {"1-0", "0-1", "1/2-1/2", "*"}


def ler_partidas(caminho):
    """Gera (tags, texto_dos_lances) para cada partida de um .pgn.zst."""
    with open(caminho, "rb") as f:
        leitor = zstandard.ZstdDecompressor().stream_reader(f)
        texto = io.TextIOWrapper(leitor, encoding="utf-8", errors="replace")
        tags, lances = {}, []
        for linha in texto:
            linha = linha.strip()
            m = TAG_RE.match(linha)
            if m:
                if lances:  # começou uma nova partida
                    yield tags, " ".join(lances)
                    tags, lances = {}, []
                tags[m.group(1)] = m.group(2)
            elif linha:
                lances.append(linha)
        if lances:
            yield tags, " ".join(lances)


def formatar(texto_lances):
    """'1. e4 e5 2. Nf3 ...' -> ';1.e4 e5 2.Nf3 ...' (ou None se ilegal/curta)."""
    tokens = LIXO_RE.sub(" ", texto_lances).split()
    sans = [t for t in tokens if not NUM_RE.match(t) and t not in RESULTADOS]
    if len(sans) < MIN_LANCES:
        return None
    tabuleiro = chess.Board()
    partes = []
    for i, san in enumerate(sans):
        try:
            lance = tabuleiro.parse_san(san)
        except ValueError:
            return None
        san = tabuleiro.san(lance)  # normaliza a notação
        tabuleiro.push(lance)
        partes.append(f"{i // 2 + 1}.{san}" if i % 2 == 0 else san)
    s = ";" + " ".join(partes)
    return s[:MAX_CHARS].rsplit(" ", 1)[0] if len(s) > MAX_CHARS else s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("entradas", nargs="+")
    ap.add_argument("-o", "--saida", default="data/xadrez.txt")
    ap.add_argument("--max-partidas", type=int, default=60_000)
    args = ap.parse_args()

    n = 0
    with open(args.saida, "w") as out:
        for caminho in args.entradas:
            for tags, lances in ler_partidas(caminho):
                try:
                    elo = (int(tags["WhiteElo"]) + int(tags["BlackElo"])) / 2
                except (KeyError, ValueError):
                    continue
                if tags.get("Termination") != "Normal" or elo < MIN_ELO:
                    continue
                linha = formatar(lances)
                if linha:
                    out.write(linha + "\n")
                    n += 1
                    if n >= args.max_partidas:
                        print(f"{n} partidas -> {args.saida}")
                        return
    print(f"{n} partidas -> {args.saida}")


if __name__ == "__main__":
    main()
