"""Gera workshop_aluno.ipynb, workshop_gabarito.ipynb e pretreino_referencia.ipynb.

Os dois notebooks do workshop saem de uma fonte única: células `ambos(...)` são
idênticas nas duas versões; `exercicio(aluno, gabarito)` difere entre elas.
Execute novamente após qualquer edição:
    python scripts/gerar_notebooks.py
"""

from pathlib import Path

import nbformat as nbf

RAIZ = Path(__file__).resolve().parent.parent
REPO_GIT = "https://github.com/giovannibragasv/transformer-do-zero.git"

CELULAS = []


def md(s):
    CELULAS.append(("md", s.strip("\n"), s.strip("\n")))


def ambos(s):
    CELULAS.append(("code", s.strip("\n"), s.strip("\n")))


def exercicio(aluno, gabarito):
    CELULAS.append(("code", aluno.strip("\n"), gabarito.strip("\n")))


# =============================================================================
md(r"""
# Attention is All You Need: construindo um Transformer do zero
CESUPA Tech Summit 2026

Neste notebook, montamos um Transformer peça por peça e o treinamos para jogar xadrez. O modelo nunca vê um
tabuleiro: ele só lê partidas escritas como texto e aprende a prever o próximo caractere.

| Parte | O que acontece |
|---|---|
| 1 | A atenção, a ideia central do Transformer, escrita em NumPy |
| 2 | O Transformer completo em PyTorch, testado numa tarefa de ordenar números |
| Intervalo | O modelo de xadrez treina durante a pausa |
| 3 | Gerar partidas e jogar contra o modelo |

Convenções usadas nas células:

- `[Executar]`: a célula está pronta; basta executá-la (Shift + Enter).
- `[Exercício N]`: há um trecho curto para completar. A própria célula confere a resposta.
- `[Recuperação]`: carrega a solução pronta, para quem quiser seguir adiante sem resolver o exercício.

Antes de começar, selecione uma GPU em *Ambiente de execução > Alterar o tipo de ambiente de execução > T4 GPU*.
""")

md("## 0. Preparação")

ambos(rf"""
# [Executar] Baixa o código de apoio e as partidas de xadrez.
import os, gzip, shutil
if not os.path.exists("mini_gpt.py"):
    !git clone -q {REPO_GIT} repo
    %cd repo
if not os.path.exists("data/xadrez.txt"):
    with gzip.open("data/xadrez.txt.gz", "rb") as f, open("data/xadrez.txt", "wb") as g:
        shutil.copyfileobj(f, g)
%pip install -q chess
""")

ambos(r"""
# [Executar] Bibliotecas e funções auxiliares.
import math, time, random
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import matplotlib.pyplot as plt
from dataclasses import dataclass
import checagens

RAPIDO = os.environ.get("WORKSHOP_RAPIDO") == "1"   # usado apenas em testes automatizados
device = "cuda" if torch.cuda.is_available() else "cpu"
print("Dispositivo:", device)
if device == "cpu":
    print("Atenção: sem GPU, o treino da Parte 3 será bem mais lento.")

def mostra_atencao(pesos, rotulos_x, rotulos_y=None, titulo="", ax=None):
    # Cada linha é uma palavra perguntando; cada coluna, uma palavra sendo consultada.
    rotulos_y = rotulos_x if rotulos_y is None else rotulos_y
    ax = ax or plt.figure(figsize=(4.5, 4)).gca()
    ax.imshow(np.asarray(pesos), cmap="Blues", vmin=0, vmax=1)
    ax.set_xticks(range(len(rotulos_x)), rotulos_x, rotation=90)
    ax.set_yticks(range(len(rotulos_y)), rotulos_y)
    ax.set_title(titulo)
""")

# =============================================================================
md(r"""
# Parte 1. A atenção

Para entender uma palavra, olhamos para as outras. Em "o rei protege a rainha", entender "protege" depende de
saber quem protege e quem é protegido. A atenção faz exatamente isso: cada palavra decide **quanto olhar para
cada uma das outras** e mistura o que encontra.

Cada palavra produz três vetores:

- uma **query**: o que ela está procurando;
- uma **key**: o que ela oferece para ser encontrada;
- um **value**: o conteúdo que ela entrega.

O cálculo tem três passos:

1. comparar a query com cada key (produto escalar): quanto maior, mais parecidas;
2. transformar essas comparações em pesos que somam 1 (softmax);
3. fazer a média dos values usando esses pesos.

Em uma linha, como está no artigo:

$$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$$

A divisão por $\sqrt{d_k}$ só evita que os números fiquem grandes demais; não muda a ideia.

## 1.1 Softmax

A softmax transforma uma lista de números quaisquer em pesos positivos que somam 1. Números maiores recebem
pesos maiores. Ela já está pronta:
""")

ambos(r"""
# [Executar]
def softmax(x):
    x = x - x.max(axis=-1, keepdims=True)      # evita overflow; o resultado não muda
    e = np.exp(x)
    return e / e.sum(axis=-1, keepdims=True)

print(softmax(np.array([1.0, 2.0, 3.0])))      # o maior número leva o maior peso
""")

md(r"""
## 1.2 A atenção

Complete os três passos. `Q`, `K` e `V` são matrizes com uma linha por palavra.

| Passo | Código |
|---|---|
| comparar cada query com cada key | `Q @ K.T`, dividido por `np.sqrt(d_k)` |
| transformar em pesos | `softmax(scores)` |
| média ponderada dos values | `pesos @ V` |

O trecho da máscara já está pronto; ele é o assunto da seção 1.3.
""")

exercicio(r"""
def atencao(Q, K, V, mascara=None):
    d_k = K.shape[-1]
    # [Exercício 1a] compare cada query com cada key
    scores = ...

    if mascara is not None:                                   # seção 1.3
        scores = np.where(mascara == 0, -np.inf, scores)

    # [Exercício 1b] transforme os scores em pesos e faça a média dos values
    pesos = ...
    saida = ...
    return saida, pesos

checagens.checa_atencao(atencao)
""", r"""
def atencao(Q, K, V, mascara=None):
    d_k = K.shape[-1]
    scores = Q @ K.T / np.sqrt(d_k)

    if mascara is not None:
        scores = np.where(mascara == 0, -np.inf, scores)

    pesos = softmax(scores)
    saida = pesos @ V
    return saida, pesos

checagens.checa_atencao(atencao)
""")

ambos(r"""
# [Recuperação] Remova o # da linha abaixo e execute.
# from checagens import _atencao_ref as atencao
""")

md(r"""
### Experimente: atenção como um dicionário

Num dicionário comum, você procura `"cavalo"` e recebe exatamente o valor do cavalo. Na atenção, a busca é
"suave": a resposta é uma mistura dos valores, pesada pela semelhança entre o que você procura e cada chave.
Abaixo, as chaves são peças de xadrez e os valores são quantos pontos cada peça vale.
""")

ambos(r"""
# [Executar] Mude as consultas e veja como os pesos se distribuem.
pecas = ["peão", "cavalo", "bispo", "torre", "dama"]
K_dic = np.eye(5) * 3                                # uma key para cada peça
V_dic = np.array([[1.], [3.], [3.], [5.], [9.]])     # quantos pontos cada peça vale

def consulta(*nomes):
    q = sum(K_dic[pecas.index(n)] for n in nomes)[None, :]
    saida, pesos = atencao(q, K_dic, V_dic)
    print(f"consulta {nomes}: pesos = {np.round(pesos[0], 2)}, resultado = {saida[0, 0]:.2f}")

consulta("dama")
consulta("cavalo", "bispo")
consulta("peão", "dama")
""")

md(r"""
## 1.3 Máscara causal: ninguém olha para o futuro

Um modelo que escreve texto gera uma palavra de cada vez. Quando ele está escrevendo a terceira palavra, a
quarta ainda não existe. Por isso, cada palavra só pode olhar para ela mesma e para as anteriores.

A máscara é uma tabela de 1s e 0s: 1 onde pode olhar, 0 onde não pode. Onde é 0, o peso vira zero.

```
          o   rei  protege  a   rainha
o         1    0      0     0     0
rei       1    1      0     0     0
protege   1    1      1     0     0
a         1    1      1     1     0
rainha    1    1      1     1     1
```
""")

exercicio(r"""
def mascara_causal(T):
    # [Exercício 2] Uma matriz T x T com 1 na diagonal e abaixo dela, e 0 acima.
    # Dica: np.tril(np.ones((T, T)))
    raise NotImplementedError("Exercício 2")

checagens.checa_mascara(mascara_causal, atencao)
""", r"""
def mascara_causal(T):
    return np.tril(np.ones((T, T)))

checagens.checa_mascara(mascara_causal, atencao)
""")

ambos(r"""
# [Recuperação] Remova o # da linha abaixo e execute.
# mascara_causal = lambda T: np.tril(np.ones((T, T)))
""")

ambos(r"""
# [Executar] A atenção numa frase, com e sem máscara.
tokens = ["o", "rei", "protege", "a", "rainha"]
rng = np.random.default_rng(42)
X = rng.normal(size=(5, 16))                         # um vetor para cada palavra
W_Q, W_K, W_V = (rng.normal(size=(16, 8)) for _ in range(3))
Q, K, V = X @ W_Q, X @ W_K, X @ W_V                  # queries, keys e values

_, p_livre  = atencao(Q, K, V)
_, p_causal = atencao(Q, K, V, mascara=mascara_causal(5))

fig, axs = plt.subplots(1, 2, figsize=(9, 4))
mostra_atencao(p_livre, tokens, titulo="sem máscara", ax=axs[0])
mostra_atencao(p_causal, tokens, titulo="com máscara causal", ax=axs[1])
plt.tight_layout(); plt.show()
""")

md(r"""
Cada linha mostra para onde uma palavra olha. Por enquanto, os padrões são aleatórios, porque as matrizes
$W_Q$, $W_K$ e $W_V$ foram sorteadas. **Treinar o modelo é ajustar essas matrizes** até que os pesos passem a
fazer sentido. É isso que vamos ver na Parte 2.
""")

# =============================================================================
md(r"""
# Parte 2. O Transformer em PyTorch

O Transformer empilha **blocos**. Cada bloco tem duas etapas:

1. **atenção**: as palavras trocam informação entre si (o que você escreveu na Parte 1);
2. **rede feed-forward**: cada palavra processa sozinha o que recebeu.

Para um modelo que gera texto, o caminho completo é:

```
caracteres -> vetores -> [ atenção -> feed-forward ] x N blocos -> probabilidade do próximo caractere
```

## 2.1 As peças prontas

A célula abaixo traz a sua função `atencao` reescrita em PyTorch (`Head`), várias atenções em paralelo
(`MultiHeadAttention`) e a rede feed-forward. A diferença para o NumPy é só de sintaxe: o PyTorch guarda as
matrizes $W_Q$, $W_K$, $W_V$ e sabe ajustá-las durante o treino. Não é preciso alterar nada; vale ler o
`forward` da `Head` e comparar com o Exercício 1.
""")

ambos(r"""
# [Executar]
@dataclass
class Config:
    vocab_size: int
    block_size: int = 256   # quantos caracteres o modelo enxerga de uma vez
    n_layer: int = 4        # quantos blocos empilhados
    n_head: int = 4         # quantas atenções em paralelo
    n_embd: int = 128       # tamanho do vetor de cada caractere
    dropout: float = 0.0


class Head(nn.Module):
    # A mesma função atencao da Parte 1, agora em PyTorch.
    def __init__(self, cfg, head_size):
        super().__init__()
        self.query = nn.Linear(cfg.n_embd, head_size, bias=False)   # W_Q
        self.key   = nn.Linear(cfg.n_embd, head_size, bias=False)   # W_K
        self.value = nn.Linear(cfg.n_embd, head_size, bias=False)   # W_V
        self.register_buffer("tril", torch.tril(torch.ones(cfg.block_size, cfg.block_size)), persistent=False)
        self.dropout = nn.Dropout(cfg.dropout)
        self.att = None

    def forward(self, x):
        B, T, C = x.shape
        q, k, v = self.query(x), self.key(x), self.value(x)
        scores = q @ k.transpose(-2, -1) / math.sqrt(k.shape[-1])            # comparar
        scores = scores.masked_fill(self.tril[:T, :T] == 0, float("-inf"))   # máscara
        att = F.softmax(scores, dim=-1)                                      # pesos
        self.att = att.detach()                                              # guardado para os gráficos
        return self.dropout(att) @ v                                         # média dos values


class MultiHeadAttention(nn.Module):
    # Várias atenções em paralelo; cada uma pode aprender a procurar uma coisa diferente.
    def __init__(self, cfg):
        super().__init__()
        head_size = cfg.n_embd // cfg.n_head
        self.heads = nn.ModuleList([Head(cfg, head_size) for _ in range(cfg.n_head)])
        self.proj = nn.Linear(cfg.n_embd, cfg.n_embd)
        self.dropout = nn.Dropout(cfg.dropout)

    def forward(self, x):
        out = torch.cat([h(x) for h in self.heads], dim=-1)
        return self.dropout(self.proj(out))


class FeedForward(nn.Module):
    # Uma rede neural pequena aplicada a cada caractere separadamente.
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

checagens.checa_head(Head)
""")

md(r"""
## 2.2 O bloco

Falta juntar as duas etapas num bloco. Há um detalhe importante: cada etapa **soma** o seu resultado ao que já
existia, em vez de substituir. Isso se chama conexão residual. Na prática, cada etapa só acrescenta um ajuste,
e por isso dá para empilhar muitos blocos sem que o treino se perca.

```
x = x + atenção(x)
x = x + feed-forward(x)
```

(No código, antes de cada etapa há uma normalização, `ln1` e `ln2`, que mantém os números numa escala boa.)
""")

exercicio(r"""
class Block(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.ln1 = nn.LayerNorm(cfg.n_embd)
        self.attn = MultiHeadAttention(cfg)
        self.ln2 = nn.LayerNorm(cfg.n_embd)
        self.ffn = FeedForward(cfg)

    def forward(self, x):
        # [Exercício 3] Duas linhas:
        #   x = x + self.attn(self.ln1(x))
        #   x = x + ... (a mesma ideia, com ln2 e ffn)
        ...
        return x

checagens.checa_block(Block)
""", r"""
class Block(nn.Module):
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

checagens.checa_block(Block)
""")

ambos(r"""
# [Recuperação] Remova o # da linha abaixo e execute.
# from mini_gpt import Block
""")

md(r"""
## 2.3 O modelo completo

O modelo transforma cada caractere num vetor, soma um vetor que indica a **posição** (a atenção sozinha não sabe
a ordem das palavras), passa tudo pelos blocos e, no fim, dá uma nota para cada caractere possível: a chance de
ele ser o próximo. Treinar é ajustar tudo para que o caractere certo receba a nota mais alta.
""")

ambos(r"""
# [Executar]
class GPT(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.cfg = cfg
        self.tok_emb = nn.Embedding(cfg.vocab_size, cfg.n_embd)   # um vetor por caractere
        self.pos_emb = nn.Embedding(cfg.block_size, cfg.n_embd)   # um vetor por posição
        self.blocks = nn.Sequential(*[Block(cfg) for _ in range(cfg.n_layer)])
        self.ln_f = nn.LayerNorm(cfg.n_embd)
        self.lm_head = nn.Linear(cfg.n_embd, cfg.vocab_size)      # uma nota por caractere possível

    def forward(self, idx, targets=None):
        B, T = idx.shape
        x = self.tok_emb(idx) + self.pos_emb(torch.arange(T, device=idx.device))
        x = self.blocks(x)
        logits = self.lm_head(self.ln_f(x))
        loss = None
        if targets is not None:                          # erro da previsão (-1 = posição ignorada)
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1), ignore_index=-1)
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, stop_token=None):
        # Gera um caractere por vez: prevê, sorteia, acrescenta ao texto e repete.
        for _ in range(max_new_tokens):
            logits, _ = self(idx[:, -self.cfg.block_size:])
            probs = F.softmax(logits[:, -1, :] / temperature, dim=-1)
            nxt = torch.multinomial(probs, num_samples=1)
            idx = torch.cat([idx, nxt], dim=1)
            if stop_token is not None and nxt.item() == stop_token:
                break
        return idx

    def n_params(self):
        return sum(p.numel() for p in self.parameters())
""")

md(r"""
## 2.4 Primeiro teste: ordenar números

Antes do xadrez, uma tarefa em que dá para **ver** a atenção trabalhando. O modelo recebe oito dígitos e um
separador `|`, e precisa escrever os mesmos dígitos em ordem:

```
3 1 4 1 5 9 2 6 | 1 1 2 3 4 5 6 9
```

Para escrever cada número da resposta, ele precisa procurar na entrada o menor número que ainda não usou. Isso é
um trabalho de atenção.
""")

ambos(r"""
# [Executar] Treino, cerca de 30 segundos.
from mini_gpt import batch_ordenacao, SORT_N, SORT_SEP
rotulo = lambda i: "|" if i == SORT_SEP else str(i)

torch.manual_seed(42)
cfg_sort = Config(vocab_size=11, block_size=2 * SORT_N, n_layer=2, n_head=2, n_embd=64)
modelo_sort = GPT(cfg_sort).to(device)
opt = torch.optim.AdamW(modelo_sort.parameters(), lr=1e-3)
for passo in range(100 if RAPIDO else 2000):
    x, y = batch_ordenacao(128, device)
    _, loss = modelo_sort(x, y)
    opt.zero_grad(); loss.backward(); opt.step()
    if passo % 400 == 0:
        print(f"passo {passo:4d} | erro {loss.item():.4f}")
print(f"erro final {loss.item():.4f}")
""")

ambos(r"""
# [Executar] O modelo ordena 1000 sequências que nunca viu.
@torch.no_grad()
def ordena(modelo, nums):
    idx = torch.cat([nums, torch.full((nums.shape[0], 1), SORT_SEP, device=nums.device)], dim=1)
    for _ in range(SORT_N):
        logits, _ = modelo(idx)
        idx = torch.cat([idx, logits[:, -1].argmax(-1, keepdim=True)], dim=1)
    return idx[:, SORT_N + 1:]

modelo_sort.eval()
nums = torch.randint(0, 10, (1000, SORT_N), device=device)
acertos = (ordena(modelo_sort, nums) == nums.sort(dim=1).values).all(dim=1).float().mean()
print(f"sequências ordenadas corretamente: {acertos:.1%}")
exemplo = nums[:1]
print("entrada:", exemplo[0].tolist(), "| resposta do modelo:", ordena(modelo_sort, exemplo)[0].tolist())
""")

ambos(r"""
# [Executar] Para onde o modelo olhou enquanto escrevia a resposta?
seq = torch.cat([exemplo, torch.tensor([[SORT_SEP]], device=device), ordena(modelo_sort, exemplo)], dim=1)[:, :-1]
modelo_sort(seq)
rot = [rotulo(i) for i in seq[0].tolist()]
fig, axs = plt.subplots(1, cfg_sort.n_head, figsize=(5 * cfg_sort.n_head, 4.5))
for h, ax in enumerate(np.atleast_1d(axs)):
    att = modelo_sort.blocks[-1].attn.heads[h].att[0].cpu()
    mostra_atencao(att[SORT_N:], rot, rot[SORT_N:], titulo=f"atenção {h}", ax=ax)
plt.tight_layout(); plt.show()
""")

md(r"""
Cada linha é um passo da resposta. Em pelo menos um dos gráficos, a parte mais escura de cada linha cai sobre o
número da entrada que o modelo vai escrever em seguida. Ninguém programou essa regra: ela surgiu do treino.

---
# Intervalo (5 min)

Antes do intervalo, execute as duas primeiras células de código da Parte 3 (seções 3.1 e 3.2). O modelo de
xadrez treina por cerca de seis minutos durante a pausa.
""")

# =============================================================================
md(r"""
# Parte 3. Um modelo que joga xadrez

Para o modelo, xadrez é só mais um texto. Usamos cerca de 60 mil partidas reais do
[Lichess](https://database.lichess.org/), escritas assim:

```
;1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 ...
```

Cada lance é a letra da peça e a casa para onde ela vai: `N` é cavalo, `B` bispo, `R` torre, `Q` dama, `K`
rei; peão não tem letra. `x` indica captura e `#` xeque-mate.

O modelo nunca vê o tabuleiro. Se mesmo assim ele jogar lances válidos, é porque aprendeu, só lendo, alguma noção
de onde as peças estão.

## 3.1 As partidas
""")

ambos(r"""
# [Executar]
from mini_gpt import DadosXadrez, CharTokenizer, taxa_de_legalidade
import chess

texto = open("data/xadrez.txt").read()
print(f"{len(texto.splitlines()):,} partidas\n")
print(texto[:300])

dados = DadosXadrez(texto, block_size=256)
tok = dados.tok
print("\nO modelo conhece apenas estes", tok.vocab_size, "caracteres:", "".join(tok.chars).replace("\n", ""))
""")

md(r"""
## 3.2 Treino (cerca de 6 minutos)

É exatamente o `GPT` da Parte 2. A tarefa é sempre a mesma: olhar o texto até aqui e prever o próximo caractere.
""")

ambos(r"""
# [Executar]
torch.manual_seed(0)
cfg = Config(vocab_size=tok.vocab_size, block_size=256, n_layer=4, n_head=4, n_embd=128)
modelo = GPT(cfg).to(device)
print(f"{modelo.n_params()/1e6:.2f} milhão de parâmetros")

MINUTOS = 6
opt = torch.optim.AdamW(modelo.parameters(), lr=1e-3)
scaler = torch.amp.GradScaler("cuda", enabled=device == "cuda")   # deixa o treino mais rápido na GPU
t0, passo, historico = time.time(), 0, []
while time.time() - t0 < MINUTOS * 60 and not (RAPIDO and passo >= 30):
    x, y = dados.batch("treino", 64, device)
    with torch.autocast("cuda", dtype=torch.float16, enabled=device == "cuda"):
        _, loss = modelo(x, y)
    opt.zero_grad(); scaler.scale(loss).backward(); scaler.step(opt); scaler.update()
    historico.append(loss.item())
    if passo % 200 == 0:
        print(f"passo {passo:5d} | erro {loss.item():.3f} | {time.time()-t0:5.0f} s", flush=True)
    passo += 1
modelo.eval()
plt.figure(figsize=(6, 3)); plt.plot(historico); plt.xlabel("passo"); plt.ylabel("erro"); plt.show()
""")

md(r"""
## 3.3 Partidas inventadas pelo modelo

O modelo começa com `;1.` e continua sozinho. Depois, conferimos lance por lance se as regras foram respeitadas.

A **temperatura** controla o sorteio: com valores baixos (0.2) o modelo escolhe quase sempre o caractere mais
provável; com valores altos (1.5) arrisca mais, e erra mais. Mude o valor e execute de novo.
""")

ambos(r"""
# [Executar]
TEMPERATURA = 0.5   # experimente 0.2, 0.5, 1.0, 1.5

def confere_partida(pgn):
    board = chess.Board()
    for token in pgn.lstrip(";").split():
        san = token.split(".")[-1]
        if not san:
            continue
        try:
            board.push_san(san)
        except ValueError:
            return f"lance inválido '{san}' depois de {len(board.move_stack)} lances válidos"
    return f"{len(board.move_stack)} lances, todos válidos"

def gera_partida(modelo, tok, temperatura):
    idx = torch.tensor([tok.encode(";1.")], device=device)
    out = modelo.generate(idx, 300, temperature=temperatura, stop_token=tok.stoi["\n"])
    return tok.decode(out[0].tolist()).strip()

for _ in range(3):
    pgn = gera_partida(modelo, tok, TEMPERATURA)
    print(pgn[:150], "\n   ->", confere_partida(pgn), "\n")
""")

md(r"""
## 3.4 O seu modelo e o modelo de referência

O modelo de referência usa o mesmo código, só que maior (cerca de 4,8 milhões de parâmetros) e treinado por uma
hora. A medida abaixo é a fração de lances válidos que cada modelo faz jogando contra um adversário que sorteia
lances.
""")

ambos(r"""
# [Executar]
ref, tok_ref = modelo, tok      # se o arquivo não existir, seguimos com o seu modelo
if os.path.exists("modelos/xadrez_referencia.pt"):
    ck = torch.load("modelos/xadrez_referencia.pt", map_location=device)
    ref = GPT(Config(**ck["config"])).to(device).eval()
    ref.load_state_dict(ck["state_dict"])
    tok_ref = CharTokenizer(ck["chars"])

n = 3 if RAPIDO else 10
print(f"seu modelo:            {taxa_de_legalidade(modelo, tok, n_partidas=n, device=device):.0%} de lances válidos")
print(f"modelo de referência:  {taxa_de_legalidade(ref, tok_ref, n_partidas=n, device=device):.0%} de lances válidos")
""")

md(r"""
## 3.5 Jogue contra o modelo

Arraste uma peça até a casa de destino, ou clique na peça e depois na casa. Os pontos mostram os lances
possíveis, então não é preciso saber as regras. Os lances do modelo aparecem em vermelho no histórico. Se o
modelo errar dez vezes seguidas, um lance válido é sorteado no lugar dele, e o painel avisa.

Para jogar contra o modelo que você treinou, troque `ref, tok_ref` por `modelo, tok`.
""")

ambos(r"""
# [Executar]
from tabuleiro import jogar_contra

if not RAPIDO:
    jogar_contra(ref, tok_ref, humano="brancas", temperatura=0.3, device=device)
""")

md(r"""
## 3.6 Complemento: para onde o modelo olha no xadrez

Para quem terminou antes. O gráfico mostra, em quatro atenções da última camada, quanto o modelo olha para cada
caractere do histórico na hora de escolher o próximo lance.
""")

ambos(r"""
# [Executar]
prompt = ";1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5."
idx = torch.tensor([tok_ref.encode(prompt)], device=device)
with torch.no_grad():
    logits, _ = ref(idx)
print("próximo caractere mais provável:", repr(tok_ref.itos[logits[0, -1].argmax().item()]))
cabecas = ref.blocks[-1].attn.heads[:4]
fig, axs = plt.subplots(len(cabecas), 1, figsize=(12, 1.6 * len(cabecas)), sharex=True)
for h, (cab, ax) in enumerate(zip(cabecas, np.atleast_1d(axs))):
    ax.bar(range(len(prompt)), cab.att[0, -1].cpu().numpy())
    ax.set_ylabel(f"atenção {h}")
ax.set_xticks(range(len(prompt)), list(prompt))
plt.tight_layout(); plt.show()
""")

md(r"""
---
# Para continuar

O que você montou hoje é, em essência, a arquitetura do GPT, do Claude e do Gemini. A diferença está na escala:
eles leem pedaços de palavras em vez de caracteres, têm bilhões de parâmetros, treinam com trilhões de palavras
por meses e, depois, passam por um ajuste para seguir instruções.

- Vaswani, A. et al. *Attention Is All You Need*, 2017. <https://arxiv.org/abs/1706.03762>
- Andrej Karpathy, *Let's build GPT: from scratch, in code, spelled out* (vídeo no YouTube).
- Jay Alammar, *The Illustrated Transformer*.
- 3Blue1Brown, série sobre redes neurais, capítulos sobre Transformers e atenção (vídeos no YouTube).
""")


# =============================================================================

def construir(qual):
    nb = nbf.v4.new_notebook()
    nb.metadata = {
        "accelerator": "GPU",
        "colab": {"provenance": [], "gpuType": "T4"},
        "kernelspec": {"name": "python3", "display_name": "Python 3"},
        "language_info": {"name": "python"},
    }
    for tipo, aluno, gabarito in CELULAS:
        src = aluno if qual == "aluno" else gabarito
        if qual == "gabarito" and tipo == "md" and src.startswith("# Attention"):
            src = src.replace("CESUPA Tech Summit 2026", "CESUPA Tech Summit 2026 (gabarito)", 1)
        nb.cells.append(nbf.v4.new_markdown_cell(src) if tipo == "md" else nbf.v4.new_code_cell(src))
    destino = RAIZ / f"workshop_{qual}.ipynb"
    nbf.write(nb, destino)
    print("gerado:", destino.name, f"({len(nb.cells)} células)")


def pretreino():
    nb = nbf.v4.new_notebook()
    nb.metadata = {"accelerator": "GPU", "colab": {"gpuType": "T4"},
                   "kernelspec": {"name": "python3", "display_name": "Python 3"}}
    nb.cells = [
        nbf.v4.new_markdown_cell(
            "# Pré-treino do modelo de referência\n\n"
            "Treina o modelo de referência usado na seção 3.4 do workshop (6 blocos, 8 cabeças, "
            "cerca de 4,8 milhões de parâmetros). Não é necessário para acompanhar o workshop: "
            "o modelo já treinado está em `modelos/xadrez_referencia.pt`.\n\n"
            "Com uma GPU T4, o treino dura cerca de 60 minutos. O script salva um checkpoint a cada 10 minutos."
        ),
        nbf.v4.new_code_cell(
            "import os, gzip, shutil\n"
            f"if not os.path.exists('mini_gpt.py'):\n    !git clone -q {REPO_GIT} repo\n    %cd repo\n"
            "if not os.path.exists('data/xadrez.txt'):\n"
            "    with gzip.open('data/xadrez.txt.gz', 'rb') as f, open('data/xadrez.txt', 'wb') as g:\n"
            "        shutil.copyfileobj(f, g)\n"
            "%pip install -q chess\n!nvidia-smi --query-gpu=name,memory.total --format=csv"
        ),
        nbf.v4.new_code_cell(
            "!python scripts/pretreinar.py --minutos 60 --n-layer 6 --n-head 8 --n-embd 256 "
            "--block-size 384 --batch 48 --saida modelos/xadrez_referencia.pt"
        ),
        nbf.v4.new_code_cell("from google.colab import files\nfiles.download('modelos/xadrez_referencia.pt')"),
    ]
    nbf.write(nb, RAIZ / "pretreino_referencia.ipynb")
    print("gerado: pretreino_referencia.ipynb")


if __name__ == "__main__":
    construir("aluno")
    construir("gabarito")
    pretreino()
