"""Implementação de referência do workshop "Attention is All You Need:
construindo um Transformer do zero" (CESUPA Tech Summit 2026).

O código é idêntico ao desenvolvido no notebook. Ele é usado:
  * pelas células de recuperação do notebook, que importam daqui a solução;
  * pelo script scripts/pretreinar.py, que treina o modelo de referência.

A arquitetura é um Transformer decoder-only (no estilo do GPT), com todos os
componentes escritos explicitamente, sem nn.Transformer,
nn.MultiheadAttention ou F.scaled_dot_product_attention.
"""

import math
import random
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

@dataclass
class Config:
    vocab_size: int
    block_size: int = 256   # tamanho máximo do contexto (em tokens)
    n_layer: int = 4        # quantos blocos empilhados
    n_head: int = 4         # quantas cabeças de atenção por bloco
    n_embd: int = 128       # dimensão dos vetores (d_model no paper)
    dropout: float = 0.0


# ---------------------------------------------------------------------------
# As peças do Transformer
# ---------------------------------------------------------------------------

class Head(nn.Module):
    """Cabeça de self-attention causal: softmax(Q Kᵀ / √d_k + máscara) V."""

    def __init__(self, cfg, head_size):
        super().__init__()
        self.query = nn.Linear(cfg.n_embd, head_size, bias=False)
        self.key = nn.Linear(cfg.n_embd, head_size, bias=False)
        self.value = nn.Linear(cfg.n_embd, head_size, bias=False)
        # máscara causal: 1 onde pode olhar (passado e presente), 0 no futuro.
        # persistent=False: não é parâmetro aprendido, então não vai para o arquivo salvo
        self.register_buffer("tril", torch.tril(torch.ones(cfg.block_size, cfg.block_size)), persistent=False)
        self.dropout = nn.Dropout(cfg.dropout)
        self.att = None  # pesos da última chamada, usados nas visualizações

    def forward(self, x):
        B, T, C = x.shape
        q = self.query(x)                                        # (B, T, hs)
        k = self.key(x)                                          # (B, T, hs)
        v = self.value(x)                                        # (B, T, hs)
        scores = q @ k.transpose(-2, -1) / math.sqrt(k.shape[-1])  # (B, T, T)
        scores = scores.masked_fill(self.tril[:T, :T] == 0, float("-inf"))
        att = F.softmax(scores, dim=-1)                          # cada linha soma 1
        self.att = att.detach()
        att = self.dropout(att)
        return att @ v                                           # (B, T, hs)


class MultiHeadAttention(nn.Module):
    """Cabeças em paralelo; as saídas são concatenadas e projetadas de volta a n_embd."""

    def __init__(self, cfg):
        super().__init__()
        head_size = cfg.n_embd // cfg.n_head
        self.heads = nn.ModuleList([Head(cfg, head_size) for _ in range(cfg.n_head)])
        self.proj = nn.Linear(cfg.n_embd, cfg.n_embd)
        self.dropout = nn.Dropout(cfg.dropout)

    def forward(self, x):
        out = torch.cat([h(x) for h in self.heads], dim=-1)     # (B, T, n_embd)
        return self.dropout(self.proj(out))


class FeedForward(nn.Module):
    """MLP aplicada a cada posição de forma independente (a FFN do paper)."""

    def __init__(self, cfg):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(cfg.n_embd, 4 * cfg.n_embd),
            nn.GELU(),
            nn.Linear(4 * cfg.n_embd, cfg.n_embd),
            nn.Dropout(cfg.dropout),
        )

    def forward(self, x):
        return self.net(x)


class Block(nn.Module):
    """Bloco do Transformer: atenção (comunicação entre posições) seguida da FFN
    (computação por posição), ambas com conexão residual.

    Usamos pre-LayerNorm (como GPT-2 e quase todo modelo moderno); o paper
    original usa post-LN: x = LayerNorm(x + Sublayer(x)).
    """

    def __init__(self, cfg):
        super().__init__()
        self.ln1 = nn.LayerNorm(cfg.n_embd)
        self.attn = MultiHeadAttention(cfg)
        self.ln2 = nn.LayerNorm(cfg.n_embd)
        self.ffn = FeedForward(cfg)

    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        x = x + self.ffn(self.ln2(x))
        return x


class GPT(nn.Module):
    """Modelo de linguagem decoder-only: tokens -> embeddings -> N blocos -> logits."""

    def __init__(self, cfg):
        super().__init__()
        self.cfg = cfg
        self.tok_emb = nn.Embedding(cfg.vocab_size, cfg.n_embd)
        self.pos_emb = nn.Embedding(cfg.block_size, cfg.n_embd)
        self.blocks = nn.Sequential(*[Block(cfg) for _ in range(cfg.n_layer)])
        self.ln_f = nn.LayerNorm(cfg.n_embd)
        self.lm_head = nn.Linear(cfg.n_embd, cfg.vocab_size)

    def forward(self, idx, targets=None):
        B, T = idx.shape
        pos = torch.arange(T, device=idx.device)
        x = self.tok_emb(idx) + self.pos_emb(pos)               # (B, T, n_embd)
        x = self.blocks(x)
        logits = self.lm_head(self.ln_f(x))                     # (B, T, vocab)
        loss = None
        if targets is not None:
            loss = F.cross_entropy(
                logits.view(-1, logits.size(-1)), targets.view(-1), ignore_index=-1
            )
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, stop_token=None):
        """Geração autorregressiva: um token por vez, condicionado apenas ao passado."""
        for _ in range(max_new_tokens):
            idx_cond = idx[:, -self.cfg.block_size:]
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] / temperature
            probs = F.softmax(logits, dim=-1)
            nxt = torch.multinomial(probs, num_samples=1)
            idx = torch.cat([idx, nxt], dim=1)
            if stop_token is not None and nxt.item() == stop_token:
                break
        return idx

    def n_params(self):
        return sum(p.numel() for p in self.parameters())


# ---------------------------------------------------------------------------
# Tokenizer de caracteres
# ---------------------------------------------------------------------------

class CharTokenizer:
    def __init__(self, chars):
        self.chars = sorted(set(chars))
        self.stoi = {c: i for i, c in enumerate(self.chars)}
        self.itos = {i: c for i, c in enumerate(self.chars)}

    @property
    def vocab_size(self):
        return len(self.chars)

    def encode(self, s):
        return [self.stoi[c] for c in s]

    def decode(self, ids):
        return "".join(self.itos[int(i)] for i in ids)


# ---------------------------------------------------------------------------
# Tarefa de brinquedo: ordenar dígitos
# ---------------------------------------------------------------------------

SORT_N = 8     # quantos números por sequência
SORT_SEP = 10  # token separador "|" (os dígitos são 0..9)


def batch_ordenacao(batch_size, device="cpu"):
    """Sequências tipo [3 1 4 1 5 9 2 6 | 1 1 2 3 4 5 6 9].

    Entrada x = tudo menos o último token; alvo y = tudo menos o primeiro.
    Só cobramos a loss na parte ordenada (o resto do alvo vira -1 = ignorado).
    """
    nums = torch.randint(0, 10, (batch_size, SORT_N))
    ordenado, _ = torch.sort(nums, dim=1)
    sep = torch.full((batch_size, 1), SORT_SEP)
    seq = torch.cat([nums, sep, ordenado], dim=1)               # (B, 2N+1)
    x, y = seq[:, :-1].clone(), seq[:, 1:].clone()
    y[:, : SORT_N - 1] = -1                                     # não cobrar prever a entrada
    return x.to(device), y.to(device)


# ---------------------------------------------------------------------------
# Xadrez
# ---------------------------------------------------------------------------

class DadosXadrez:
    """Partidas no formato ';1.e4 e5 2.Nf3 ...', uma por linha."""

    def __init__(self, texto, block_size, frac_treino=0.95):
        self.tok = CharTokenizer(texto)
        self.block_size = block_size
        dados = torch.tensor(self.tok.encode(texto), dtype=torch.long)
        n = int(frac_treino * len(dados))
        self.treino, self.val = dados[:n], dados[n:]
        # índices de início de partida: toda janela de treino começa em ';'
        sep = self.tok.stoi[";"]
        self.inicios = {
            "treino": (self.treino[:-block_size - 1] == sep).nonzero().squeeze(1),
            "val": (self.val[:-block_size - 1] == sep).nonzero().squeeze(1),
        }

    def batch(self, split, batch_size, device="cpu"):
        d = self.treino if split == "treino" else self.val
        ini = self.inicios[split]
        ix = ini[torch.randint(len(ini), (batch_size,))]
        x = torch.stack([d[i: i + self.block_size] for i in ix])
        y = torch.stack([d[i + 1: i + self.block_size + 1] for i in ix])
        return x.to(device), y.to(device)


def historico_pgn(board):
    """python-chess Board -> ';1.e4 e5 2.Nf3' (o prompt que o modelo entende)."""
    import chess

    b = chess.Board()
    partes = []
    for i, lance in enumerate(board.move_stack):
        san = b.san(lance)
        partes.append(f"{i // 2 + 1}.{san}" if i % 2 == 0 else san)
        b.push(lance)
    return ";" + " ".join(partes)


@torch.no_grad()
def lance_do_modelo(model, tok, board, temperatura=0.5, tentativas=10, device="cpu"):
    """Solicita um lance ao modelo e devolve (lance, legal_na_primeira_tentativa).

    Se o modelo produzir lances ilegais em todas as `tentativas`, um lance legal
    é sorteado, e a jogada é contabilizada como falha.
    """
    import chess

    prompt = historico_pgn(board)
    if board.turn == chess.WHITE:
        prompt += (" " if board.move_stack else "") + f"{board.fullmove_number}."
    else:
        prompt += " "
    idx = torch.tensor([tok.encode(prompt)], dtype=torch.long, device=device)
    espaco = tok.stoi[" "]
    for t in range(tentativas):
        out = model.generate(idx, max_new_tokens=10, temperature=temperatura, stop_token=espaco)
        san = tok.decode(out[0, idx.shape[1]:].tolist()).strip()
        try:
            return board.parse_san(san), t == 0
        except ValueError:
            continue
    return random.choice(list(board.legal_moves)), False


def taxa_de_legalidade(model, tok, n_partidas=20, max_lances=40, device="cpu", temperatura=0.5):
    """Modelo (brancas) contra jogador aleatório (pretas).

    Retorna a fração de lances do modelo que são legais na primeira tentativa.
    """
    import chess

    model.eval()
    legais = total = 0
    for _ in range(n_partidas):
        board = chess.Board()
        while not board.is_game_over() and len(board.move_stack) < max_lances:
            if board.turn == chess.WHITE:
                lance, ok = lance_do_modelo(model, tok, board, temperatura, device=device)
                legais += ok
                total += 1
            else:
                lance = random.choice(list(board.legal_moves))
            board.push(lance)
    return legais / max(total, 1)
