"""Gera workshop_aluno.ipynb, workshop_gabarito.ipynb e pretreino_referencia.ipynb.

Os dois notebooks do workshop saem de uma fonte única: células `ambos(...)` são
idênticas nas duas versões; `exercicio(aluno, gabarito)` difere entre elas.
Execute novamente após qualquer edição:
    python scripts/gerar_notebooks.py
"""

from pathlib import Path

import nbformat as nbf

RAIZ = Path(__file__).resolve().parent.parent
REPO_GIT = "https://github.com/giovannibragasv/transformer-do-zero.git"  # substituir antes do workshop

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

Este notebook acompanha o workshop. Partimos da operação central do artigo de Vaswani et al. (2017), a atenção
por produto escalar, e terminamos com um modelo de linguagem que gera partidas de xadrez. Todos os componentes
do Transformer são implementados explicitamente; não usamos `nn.Transformer` nem módulos equivalentes.

| Horário | Parte | Conteúdo |
|---|---|---|
| 00:25 | 1 | Atenção implementada em NumPy |
| 00:55 | 2 | O Transformer em PyTorch e uma tarefa de ordenação |
| 01:15 | Intervalo | O modelo de xadrez treina durante a pausa |
| 01:30 | 3 | Um modelo de linguagem para partidas de xadrez |

Os intervalos entre as partes são ocupados pela exposição com slides.

Convenções usadas nas células:

- `[Executar]`: célula completa; basta executá-la (Shift + Enter).
- `[Exercício N]`: trecho a ser implementado. A própria célula verifica a resposta ao final.
- `[Recuperação]`: carrega a solução pronta. Use-a se um exercício não estiver funcionando, para acompanhar o restante do roteiro.

Antes de começar, selecione uma GPU em *Ambiente de execução > Alterar o tipo de ambiente de execução > T4 GPU*.
""")

md("## 0. Preparação do ambiente")

ambos(rf"""
# [Executar] Baixa o código de apoio e o conjunto de dados.
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
    print("Atenção: sem GPU, o treino da Parte 3 será consideravelmente mais lento.")

def mostra_atencao(pesos, rotulos_x, rotulos_y=None, titulo="", ax=None):
    # Cada linha corresponde a uma query; cada coluna, a uma key.
    rotulos_y = rotulos_x if rotulos_y is None else rotulos_y
    ax = ax or plt.figure(figsize=(4.5, 4)).gca()
    ax.imshow(np.asarray(pesos), cmap="Blues", vmin=0, vmax=1)
    ax.set_xticks(range(len(rotulos_x)), rotulos_x, rotation=90)
    ax.set_yticks(range(len(rotulos_y)), rotulos_y)
    ax.set_xlabel("key")
    ax.set_ylabel("query")
    ax.set_title(titulo)
""")

# =============================================================================
md(r"""
# Parte 1. Atenção implementada em NumPy

A operação central do artigo é a *scaled dot-product attention*:

$$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$$

Uma analogia útil é a consulta a um dicionário em que a correspondência não precisa ser exata. Cada posição da
sequência produz três vetores: uma *query* $q$ (o que ela procura), uma *key* $k$ (o que ela oferece para ser
encontrada) e um *value* $v$ (o conteúdo que ela transmite). O produto escalar $q \cdot k$ mede a compatibilidade
entre duas posições, a softmax converte essas compatibilidades em pesos que somam 1, e a saída é a média dos
*values* ponderada por esses pesos.

## 1.1 Softmax

$$\text{softmax}(x)_i = \frac{e^{x_i}}{\sum_j e^{x_j}}$$

Para valores grandes, $e^{x}$ excede a faixa representável em ponto flutuante. Como
$\text{softmax}(x) = \text{softmax}(x - c)$ para qualquer constante $c$, subtrai-se o máximo de cada linha antes
da exponenciação; o resultado é o mesmo e o cálculo permanece estável.
""")

exercicio(r"""
def softmax(x):
    # [Exercício 1] Softmax ao longo do último eixo: cada linha do resultado deve somar 1.
    # Funções úteis: x.max(axis=-1, keepdims=True), np.exp, .sum(axis=-1, keepdims=True)
    raise NotImplementedError("Exercício 1")

checagens.checa_softmax(softmax)
""", r"""
def softmax(x):
    x = x - x.max(axis=-1, keepdims=True)      # estabilidade numérica
    e = np.exp(x)
    return e / e.sum(axis=-1, keepdims=True)

checagens.checa_softmax(softmax)
""")

md(r"""
## 1.2 A fórmula da atenção

Considere `Q` com shape `(T, d_k)`, `K` com shape `(T, d_k)` e `V` com shape `(T, d_v)`, em que `T` é o
comprimento da sequência. O cálculo tem três etapas:

1. `scores = Q @ K.T / sqrt(d_k)`, uma matriz `(T, T)` em que a entrada $(i, j)$ mede quanto a posição $i$ se relaciona com a posição $j$;
2. `pesos = softmax(scores)`, que transforma cada linha em uma distribuição de probabilidade;
3. `saida = pesos @ V`, em que cada posição recebe uma combinação dos *values*.

O trecho que trata da máscara já está implementado e será discutido na seção 1.4.
""")

exercicio(r"""
def atencao(Q, K, V, mascara=None):
    d_k = K.shape[-1]
    # [Exercício 2a] scores = Q Kᵀ / √d_k
    scores = ...

    if mascara is not None:                                   # discutido na seção 1.4
        scores = np.where(mascara == 0, -np.inf, scores)

    # [Exercício 2b] pesos = softmax(scores); saida = pesos @ V
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
# [Recuperação] Seções 1.1 e 1.2: remova o comentário da linha abaixo e execute.
# from checagens import _softmax_ref as softmax, _atencao_ref as atencao
""")

md(r"""
### Atenção como consulta a um dicionário

Em um dicionário convencional, a consulta `"cavalo"` retorna exatamente o valor associado a essa chave. Na
atenção, a consulta retorna uma mistura dos valores, ponderada pela similaridade entre a *query* e cada *key*.
No exemplo abaixo, as chaves são as peças do xadrez e os valores são as pontuações materiais tradicionais.
""")

ambos(r"""
# [Executar] Altere as consultas e observe como os pesos se distribuem.
pecas = ["peão", "cavalo", "bispo", "torre", "dama"]
K_dic = np.eye(5) * 3                                # uma key aproximadamente one-hot por peça
V_dic = np.array([[1.], [3.], [3.], [5.], [9.]])     # valor material de cada peça

def consulta(*nomes):
    q = sum(K_dic[pecas.index(n)] for n in nomes)[None, :]   # (1, 5)
    saida, pesos = atencao(q, K_dic, V_dic)
    print(f"consulta {nomes}: pesos = {np.round(pesos[0], 2)}, resultado = {saida[0, 0]:.2f}")

consulta("dama")
consulta("cavalo", "bispo")
consulta("peão", "dama")
""")

md(r"""
## 1.3 O papel do fator $1/\sqrt{d_k}$

Se as componentes de $q$ e $k$ são independentes, com média 0 e variância 1, o produto escalar $q \cdot k$ tem
variância $d_k$. Para $d_k$ grande, os scores assumem valores extremos, a softmax fica saturada (próxima de um
vetor one-hot) e seus gradientes tendem a zero. A divisão por $\sqrt{d_k}$ restaura a variância unitária. A
célula a seguir mede esse efeito.
""")

ambos(r"""
# [Executar] Peso máximo médio da softmax, com e sem o fator de escala.
rng = np.random.default_rng(0)
for d in [4, 64, 512]:
    q, k = rng.normal(size=(1000, d)), rng.normal(size=(10, d))
    sem = softmax(q @ k.T).max(axis=-1).mean()
    com = softmax(q @ k.T / np.sqrt(d)).max(axis=-1).mean()
    print(f"d_k = {d:4d} | sem escala: {sem:.2f} | com escala: {com:.2f}")
print("Com 10 keys, pesos uniformes valeriam 0.10; valores próximos de 1.00 indicam saturação.")
""")

md(r"""
## 1.4 Self-attention com máscara causal

Em *self-attention*, $Q$, $K$ e $V$ são obtidas da mesma sequência $X$ por três matrizes de parâmetros:
$Q = XW_Q$, $K = XW_K$ e $V = XW_V$.

Em um modelo que gera texto, como o GPT, a predição na posição $t$ não pode depender de posições posteriores.
Isso é garantido por uma máscara causal, uma matriz triangular inferior de uns. Onde a máscara vale 0, o score
recebe $-\infty$ e, após a softmax, o peso correspondente é exatamente 0.

```
          o   rei  protege  a   rainha
o         1    0      0     0     0
rei       1    1      0     0     0
protege   1    1      1     0     0
...
```
""")

exercicio(r"""
def mascara_causal(T):
    # [Exercício 3] Matriz (T, T) com 1 na diagonal e abaixo dela, e 0 acima. Função útil: np.tril
    raise NotImplementedError("Exercício 3")

checagens.checa_mascara(mascara_causal, atencao)
""", r"""
def mascara_causal(T):
    return np.tril(np.ones((T, T)))

checagens.checa_mascara(mascara_causal, atencao)
""")

ambos(r"""
# [Recuperação] Seção 1.4: remova o comentário da linha abaixo e execute.
# mascara_causal = lambda T: np.tril(np.ones((T, T)))
""")

ambos(r"""
# [Executar] Self-attention completa: X -> (Q, K, V) -> atenção, com e sem máscara.
tokens = ["o", "rei", "protege", "a", "rainha"]
T, d_model, d_k = len(tokens), 16, 8
rng = np.random.default_rng(42)
X = rng.normal(size=(T, d_model))                    # embeddings (aleatórios neste exemplo)
W_Q, W_K, W_V = (rng.normal(size=(d_model, d_k)) for _ in range(3))
Q, K, V = X @ W_Q, X @ W_K, X @ W_V

_, p_livre  = atencao(Q, K, V)
_, p_causal = atencao(Q, K, V, mascara=mascara_causal(T))

fig, axs = plt.subplots(1, 2, figsize=(9, 4))
mostra_atencao(p_livre, tokens, titulo="sem máscara (encoder)", ax=axs[0])
mostra_atencao(p_causal, tokens, titulo="com máscara causal (decoder)", ax=axs[1])
plt.tight_layout(); plt.show()
""")

md(r"""
Os padrões acima não têm significado linguístico, pois $W_Q$, $W_K$ e $W_V$ são aleatórias. Treinar um
Transformer consiste, em grande parte, em ajustar essas matrizes para que os pesos de atenção passem a refletir
relações úteis entre as posições.
""")

# =============================================================================
md(r"""
# Parte 2. O Transformer em PyTorch

A operação é a mesma da Parte 1, com três diferenças práticas:

1. `nn.Linear` armazena as matrizes $W_Q$, $W_K$ e $W_V$, e o *autograd* calcula os gradientes necessários para ajustá-las.
2. Os tensores têm uma dimensão de lote: o shape passa a ser `(B, T, C)`, isto é, lote, posição e canais.
3. O cálculo é executado na GPU.

## 2.1 Hiperparâmetros
""")

ambos(r"""
# [Executar]
@dataclass
class Config:
    vocab_size: int
    block_size: int = 256   # comprimento máximo do contexto
    n_layer: int = 4        # número de blocos
    n_head: int = 4         # cabeças de atenção por bloco
    n_embd: int = 128       # dimensão dos vetores (d_model no artigo)
    dropout: float = 0.0
""")

md(r"""
## 2.2 Uma cabeça de atenção

O exercício consiste em traduzir a função `atencao` da Parte 1 para PyTorch. As correspondências de sintaxe são:

| NumPy | PyTorch |
|---|---|
| `K.T` | `k.transpose(-2, -1)`, que troca apenas as duas últimas dimensões e preserva a de lote |
| `np.where(m == 0, -np.inf, s)` | `s.masked_fill(m == 0, float("-inf"))` |
| `softmax(s)` | `F.softmax(s, dim=-1)` |

A máscara causal, com o tamanho máximo do contexto, já está em `self.tril`; para uma sequência de comprimento
`T`, use `self.tril[:T, :T]`.
""")

exercicio(r"""
class Head(nn.Module):
    def __init__(self, cfg, head_size):
        super().__init__()
        self.query = nn.Linear(cfg.n_embd, head_size, bias=False)
        self.key   = nn.Linear(cfg.n_embd, head_size, bias=False)
        self.value = nn.Linear(cfg.n_embd, head_size, bias=False)
        self.register_buffer("tril", torch.tril(torch.ones(cfg.block_size, cfg.block_size)), persistent=False)
        self.dropout = nn.Dropout(cfg.dropout)
        self.att = None

    def forward(self, x):
        B, T, C = x.shape
        q, k, v = self.query(x), self.key(x), self.value(x)     # cada um com shape (B, T, head_size)
        # [Exercício 4]
        #   scores = q kᵀ / √head_size, com shape (B, T, T)
        #   aplique a máscara causal com masked_fill
        #   att = softmax ao longo das linhas
        scores = ...
        att = ...
        self.att = att.detach()          # armazenado para as visualizações
        att = self.dropout(att)
        return att @ v                   # (B, T, head_size)

checagens.checa_head(Head)
""", r"""
class Head(nn.Module):
    def __init__(self, cfg, head_size):
        super().__init__()
        self.query = nn.Linear(cfg.n_embd, head_size, bias=False)
        self.key   = nn.Linear(cfg.n_embd, head_size, bias=False)
        self.value = nn.Linear(cfg.n_embd, head_size, bias=False)
        self.register_buffer("tril", torch.tril(torch.ones(cfg.block_size, cfg.block_size)), persistent=False)
        self.dropout = nn.Dropout(cfg.dropout)
        self.att = None

    def forward(self, x):
        B, T, C = x.shape
        q, k, v = self.query(x), self.key(x), self.value(x)
        scores = q @ k.transpose(-2, -1) / math.sqrt(k.shape[-1])
        scores = scores.masked_fill(self.tril[:T, :T] == 0, float("-inf"))
        att = F.softmax(scores, dim=-1)
        self.att = att.detach()
        att = self.dropout(att)
        return att @ v

checagens.checa_head(Head)
""")

ambos(r"""
# [Recuperação] Seção 2.2: remova o comentário da linha abaixo e execute.
# from mini_gpt import Head
""")

md(r"""
## 2.3 Multi-head attention

Em vez de uma única cabeça com dimensão `n_embd`, o artigo usa `n_head` cabeças menores em paralelo, cada uma
com `head_size = n_embd // n_head`. Cada cabeça tem suas próprias projeções e pode, portanto, especializar-se em
um tipo diferente de relação entre posições. As saídas são concatenadas e passam por uma projeção linear final.
""")

exercicio(r"""
class MultiHeadAttention(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        head_size = cfg.n_embd // cfg.n_head
        self.heads = nn.ModuleList([Head(cfg, head_size) for _ in range(cfg.n_head)])
        self.proj = nn.Linear(cfg.n_embd, cfg.n_embd)
        self.dropout = nn.Dropout(cfg.dropout)

    def forward(self, x):
        # [Exercício 5] Aplique cada cabeça a x e concatene as saídas no último eixo.
        out = ...
        return self.dropout(self.proj(out))

checagens.checa_multihead(MultiHeadAttention)
""", r"""
class MultiHeadAttention(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        head_size = cfg.n_embd // cfg.n_head
        self.heads = nn.ModuleList([Head(cfg, head_size) for _ in range(cfg.n_head)])
        self.proj = nn.Linear(cfg.n_embd, cfg.n_embd)
        self.dropout = nn.Dropout(cfg.dropout)

    def forward(self, x):
        out = torch.cat([h(x) for h in self.heads], dim=-1)
        return self.dropout(self.proj(out))

checagens.checa_multihead(MultiHeadAttention)
""")

md(r"""
## 2.4 O bloco do Transformer

O bloco alterna duas subcamadas. A atenção é a etapa de comunicação, em que as posições trocam informação. A
rede *feed-forward* (FFN) é a etapa de computação, aplicada a cada posição de forma independente. Cada subcamada
é envolvida por uma conexão residual (`x = x + ...`), que facilita a propagação do gradiente em redes profundas,
e precedida de uma LayerNorm, que estabiliza a escala das ativações.

```
x ──┬──► LayerNorm ─► MultiHead ─►(+)──┬──► LayerNorm ─► FFN ─►(+)──► saída
    └──────────────────────────────────┘└───────────────────────────┘
```

O artigo original aplica a normalização depois da soma residual (*post-LN*). Usamos a variante *pre-LN*,
adotada pelo GPT-2 e pela maior parte dos modelos atuais, porque ela treina de forma mais estável.
""")

exercicio(r"""
class FeedForward(nn.Module):
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
    def __init__(self, cfg):
        super().__init__()
        self.ln1 = nn.LayerNorm(cfg.n_embd)
        self.attn = MultiHeadAttention(cfg)
        self.ln2 = nn.LayerNorm(cfg.n_embd)
        self.ffn = FeedForward(cfg)

    def forward(self, x):
        # [Exercício 6] Duas linhas, ambas na forma x = x + subcamada(norm(x)):
        #   primeiro a atenção (ln1, attn), depois a FFN (ln2, ffn).
        ...
        return x

checagens.checa_block(Block)
""", r"""
class FeedForward(nn.Module):
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
# [Recuperação] Seções 2.3 e 2.4: remova o comentário da linha abaixo e execute.
# from mini_gpt import Head, MultiHeadAttention, FeedForward, Block
""")

md(r"""
## 2.5 O modelo completo

Restam três componentes:

- o *token embedding*, que associa a cada identificador inteiro um vetor aprendido;
- o *positional embedding*. A atenção é invariante a permutações da entrada, então a informação de ordem precisa
  ser somada explicitamente. O artigo usa funções senoidais; aqui, como no GPT, os vetores de posição são aprendidos;
- uma pilha de `n_layer` blocos, seguida de uma LayerNorm e de uma camada linear que produz um *logit* para cada
  token do vocabulário.

O objetivo de treino é prever o próximo token. A função de perda é a entropia cruzada entre os logits e o token
seguinte de cada posição.
""")

ambos(r"""
# [Executar]
class GPT(nn.Module):
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
        x = self.tok_emb(idx) + self.pos_emb(pos)        # (B, T, n_embd)
        x = self.blocks(x)
        logits = self.lm_head(self.ln_f(x))              # (B, T, vocab_size)
        loss = None
        if targets is not None:                          # alvo -1: posição ignorada na perda
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1), ignore_index=-1)
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, stop_token=None):
        for _ in range(max_new_tokens):
            logits, _ = self(idx[:, -self.cfg.block_size:])  # o contexto é limitado a block_size
            probs = F.softmax(logits[:, -1, :] / temperature, dim=-1)
            nxt = torch.multinomial(probs, num_samples=1)    # amostra o próximo token
            idx = torch.cat([idx, nxt], dim=1)
            if stop_token is not None and nxt.item() == stop_token:
                break
        return idx

    def n_params(self):
        return sum(p.numel() for p in self.parameters())
""")

md(r"""
## 2.6 Primeiro experimento: ordenação

Antes do xadrez, usamos uma tarefa em que o funcionamento da atenção é fácil de inspecionar. Cada sequência
contém oito dígitos, um separador `|` e os mesmos dígitos em ordem crescente:

```
3 1 4 1 5 9 2 6 | 1 1 2 3 4 5 6 9
                  └── trecho que o modelo deve gerar
```

Para escrever cada dígito da saída, o modelo precisa localizar na entrada o menor dígito ainda não utilizado.
Essa localização é feita pela atenção, e poderemos observá-la diretamente nos pesos.
""")

ambos(r"""
# [Executar]
from mini_gpt import batch_ordenacao, SORT_N, SORT_SEP
rotulo = lambda i: "|" if i == SORT_SEP else str(i)

x, y = batch_ordenacao(1)
print("entrada x:", " ".join(rotulo(i) for i in x[0].tolist()))
print("alvo    y:", " ".join("." if i == -1 else rotulo(i) for i in y[0].tolist()), "  (. = posição ignorada)")
""")

ambos(r"""
# [Executar] Treino, cerca de 30 s em GPU.
torch.manual_seed(42)
cfg_sort = Config(vocab_size=11, block_size=2 * SORT_N, n_layer=2, n_head=2, n_embd=64)
modelo_sort = GPT(cfg_sort).to(device)
print(f"{modelo_sort.n_params():,} parâmetros")

opt = torch.optim.AdamW(modelo_sort.parameters(), lr=1e-3)
for passo in range(100 if RAPIDO else 2000):
    x, y = batch_ordenacao(128, device)
    _, loss = modelo_sort(x, y)
    opt.zero_grad(); loss.backward(); opt.step()
    if passo % 250 == 0:
        print(f"passo {passo:4d} | perda {loss.item():.4f}")
print(f"perda final {loss.item():.4f}")
""")

ambos(r"""
# [Executar] Avaliação em 1000 sequências novas, escolhendo sempre o token mais provável.
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
print("entrada:", exemplo[0].tolist(), "| saída do modelo:", ordena(modelo_sort, exemplo)[0].tolist())
""")

ambos(r"""
# [Executar] Pesos de atenção da última camada, uma matriz por cabeça.
seq = torch.cat([exemplo, torch.tensor([[SORT_SEP]], device=device), ordena(modelo_sort, exemplo)], dim=1)[:, :-1]
modelo_sort(seq)
rot = [rotulo(i) for i in seq[0].tolist()]
fig, axs = plt.subplots(1, cfg_sort.n_head, figsize=(5 * cfg_sort.n_head, 4.5))
for h, ax in enumerate(np.atleast_1d(axs)):
    att = modelo_sort.blocks[-1].attn.heads[h].att[0].cpu()
    mostra_atencao(att[SORT_N:], rot, rot[SORT_N:], titulo=f"cabeça {h}", ax=ax)
plt.tight_layout(); plt.show()
""")

md(r"""
Cada linha corresponde a um passo da geração. Em geral, pelo menos uma das cabeças concentra o peso na posição da
entrada que contém o dígito a ser escrito em seguida. O modelo aprendeu a usar a atenção como um mecanismo de
busca, sem que essa regra tenha sido programada.

---
# Intervalo (5 min)

Antes do intervalo, execute as duas primeiras células de código da Parte 3 (seções 3.1 e 3.2). O treino do modelo
de xadrez leva cerca de seis minutos e acontece durante a pausa.
""")

# =============================================================================
md(r"""
# Parte 3. Um modelo de linguagem para partidas de xadrez

Um modelo de linguagem opera sobre sequências de símbolos, e nada exige que esses símbolos sejam palavras.
Usamos cerca de 60 mil partidas do [banco de dados público do Lichess](https://database.lichess.org/),
em notação algébrica (PGN):

```
;1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 ...
```

Na notação, `N` é cavalo, `B` bispo, `R` torre, `Q` dama e `K` rei; `x` indica captura, `+` xeque, `#` xeque-mate
e `O-O` o roque.

O modelo não tem acesso ao tabuleiro. Ele é treinado apenas para prever o próximo caractere. Se ele produz lances
legais, é porque construiu internamente alguma representação da posição das peças. Karvonen (2024) mostra que
modelos desse tipo de fato desenvolvem representações lineares do estado do tabuleiro.

## 3.1 Os dados
""")

ambos(r"""
# [Executar]
from mini_gpt import DadosXadrez, CharTokenizer, lance_do_modelo, taxa_de_legalidade, historico_pgn
import chess, chess.svg
from IPython.display import display, clear_output, SVG

texto = open("data/xadrez.txt").read()
print(f"{len(texto.splitlines()):,} partidas, {len(texto)/1e6:.1f} milhões de caracteres\n")
print(texto[:400])

dados = DadosXadrez(texto, block_size=256)
tok = dados.tok
print("vocabulário:", "".join(tok.chars).replace("\n", "\\n"), f"({tok.vocab_size} tokens)")
x, y = dados.batch("treino", 1)
print("\nx:", repr(tok.decode(x[0, :40].tolist())))
print("y:", repr(tok.decode(y[0, :40].tolist())), " (o mesmo texto deslocado em uma posição)")
""")

md(r"""
## 3.2 Treino do modelo

A classe é exatamente o `GPT` implementado na Parte 2. Mudam apenas o vocabulário (33 caracteres), o comprimento
do contexto (256 caracteres) e o volume de dados. O treino dura seis minutos.
""")

ambos(r"""
# [Executar] Cerca de 6 minutos em uma T4.
torch.manual_seed(0)
cfg = Config(vocab_size=tok.vocab_size, block_size=256, n_layer=4, n_head=4, n_embd=128)
modelo = GPT(cfg).to(device)
print(f"{modelo.n_params()/1e6:.2f}M parâmetros")

MINUTOS = 6
opt = torch.optim.AdamW(modelo.parameters(), lr=1e-3)
scaler = torch.amp.GradScaler("cuda", enabled=device == "cuda")   # precisão mista (fp16) na GPU
t0, passo, historico = time.time(), 0, []
while time.time() - t0 < MINUTOS * 60 and not (RAPIDO and passo >= 30):
    x, y = dados.batch("treino", 64, device)
    with torch.autocast("cuda", dtype=torch.float16, enabled=device == "cuda"):
        _, loss = modelo(x, y)
    opt.zero_grad(); scaler.scale(loss).backward(); scaler.step(opt); scaler.update()
    historico.append(loss.item())
    if passo % 200 == 0:
        print(f"passo {passo:5d} | perda {loss.item():.3f} | {time.time()-t0:5.0f} s", flush=True)
    passo += 1
modelo.eval()
plt.figure(figsize=(6, 3)); plt.plot(historico); plt.xlabel("passo"); plt.ylabel("perda"); plt.show()
""")

md(r"""
## 3.3 Avaliação das partidas geradas

O modelo recebe o prefixo `;1.` e continua a sequência. Cada lance gerado é verificado com a biblioteca
`python-chess`, que conhece as regras do jogo.
""")

ambos(r"""
# [Executar]
def confere_partida(pgn):
    # Conta quantos lances consecutivos são legais, até o primeiro lance ilegal.
    board = chess.Board()
    for token in pgn.lstrip(";").split():
        san = token.split(".")[-1]
        if not san:
            continue
        try:
            board.push_san(san)
        except ValueError:
            return board, f"lance ilegal '{san}' após {len(board.move_stack)} lances legais"
    return board, f"{len(board.move_stack)} lances, todos legais"

def gera_partida(modelo, tok, temperatura=0.8, n=300):
    idx = torch.tensor([tok.encode(";1.")], device=device)
    fim = tok.stoi["\n"]
    out = modelo.generate(idx, n, temperature=temperatura, stop_token=fim)
    return tok.decode(out[0].tolist()).strip()

for _ in range(3):
    pgn = gera_partida(modelo, tok)
    board, msg = confere_partida(pgn)
    print(pgn[:200], "\n   ->", msg, "\n")
""")

md(r"""
### Temperatura de amostragem

Antes da softmax, os logits são divididos pela temperatura. Valores baixos (por exemplo, 0.2) concentram a
probabilidade no token mais provável; valores altos (por exemplo, 1.5) tornam a distribuição mais uniforme, o
que aumenta a variedade das partidas e também a frequência de lances ilegais. Altere o valor abaixo e compare.
""")

ambos(r"""
TEMPERATURA = 0.3   # altere este valor
pgn = gera_partida(modelo, tok, temperatura=TEMPERATURA)
print(pgn[:200]); print("->", confere_partida(pgn)[1])
""")

ambos(r"""
# [Executar] Taxa de legalidade: o modelo joga de brancas contra um adversário que sorteia lances.
# Mede-se a fração dos lances do modelo que são legais na primeira tentativa.
print(f"lances legais: {taxa_de_legalidade(modelo, tok, n_partidas=3 if RAPIDO else 10, device=device):.1%}")
""")

md(r"""
## 3.4 Modelo de referência

O modelo a seguir usa o mesmo código, com mais capacidade (cerca de 4.8M parâmetros, 6 blocos, 8 cabeças,
contexto de 384 caracteres) e cerca de uma hora de treino. Compare a taxa de legalidade com a do modelo treinado
na seção anterior.
""")

ambos(r"""
# [Executar]
ref, tok_ref = modelo, tok      # se o arquivo não existir, seguimos com o modelo da seção 3.2
if os.path.exists("modelos/xadrez_referencia.pt"):
    ck = torch.load("modelos/xadrez_referencia.pt", map_location=device)
    ref = GPT(Config(**ck["config"])).to(device).eval()
    ref.load_state_dict(ck["state_dict"])
    tok_ref = CharTokenizer(ck["chars"])
    print(f"modelo de referência: {ref.n_params()/1e6:.1f}M parâmetros")
    print(f"lances legais: {taxa_de_legalidade(ref, tok_ref, n_partidas=3 if RAPIDO else 10, device=device):.1%}")
else:
    print("Arquivo modelos/xadrez_referencia.pt não encontrado; usando o modelo da seção 3.2.")
""")

md(r"""
## 3.5 Partida contra o modelo

Arraste uma peça até a casa de destino, ou clique na peça e depois na casa. As casas marcadas indicam os lances
legais. Quem preferir pode digitar o lance em notação algébrica (`e4`, `Nf3`, `O-O`) na caixa ao lado do
tabuleiro. Os lances do modelo aparecem em vermelho no histórico. Se o modelo produzir lances ilegais em dez
tentativas seguidas, um lance legal é sorteado em seu lugar, e isso é indicado no painel.

Os botões permitem começar uma nova partida, desfazer o último par de lances e trocar de cor. Para jogar contra
o modelo que você treinou na seção 3.2, troque `ref, tok_ref` por `modelo, tok`.
""")

ambos(r"""
# [Executar]
from tabuleiro import jogar_contra

if not RAPIDO:
    jogar_contra(ref, tok_ref, humano="brancas", temperatura=0.3, device=device)
""")

md(r"""
## 3.6 Complemento: atenção no modelo de xadrez

O gráfico mostra, para quatro cabeças da última camada, o peso que a posição final do contexto atribui a cada
caractere anterior no momento de prever o próximo lance. É comum encontrar cabeças que se concentram no último
lance do adversário e outras que retornam a lances anteriores da mesma peça.
""")

ambos(r"""
# [Executar]
prompt = ";1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5."
idx = torch.tensor([tok_ref.encode(prompt)], device=device)
with torch.no_grad():
    logits, _ = ref(idx)
print("caractere seguinte mais provável:", repr(tok_ref.itos[logits[0, -1].argmax().item()]))
cabecas = ref.blocks[-1].attn.heads[:4]
fig, axs = plt.subplots(len(cabecas), 1, figsize=(12, 1.6 * len(cabecas)), sharex=True)
for h, (cab, ax) in enumerate(zip(cabecas, np.atleast_1d(axs))):
    ax.bar(range(len(prompt)), cab.att[0, -1].cpu().numpy())
    ax.set_ylabel(f"cab. {h}")
ax.set_xticks(range(len(prompt)), list(prompt))
plt.tight_layout(); plt.show()
""")

md(r"""
---
# Considerações finais

A arquitetura implementada aqui é, em essência, a mesma dos grandes modelos de linguagem atuais. As diferenças
estão principalmente na escala e nas etapas posteriores ao pré-treino:

| Neste notebook | Em um LLM de grande porte |
|---|---|
| tokens de um caractere (33) | subpalavras obtidas por BPE (da ordem de 100 mil) |
| 0.8M a 5M parâmetros | bilhões de parâmetros ou mais |
| 25 MB de partidas | trilhões de tokens |
| minutos em uma GPU T4 | semanas ou meses em milhares de GPUs |
| apenas pré-treino | pré-treino seguido de ajuste por instruções e aprendizado por reforço com feedback humano |

Referências para aprofundamento:

- Vaswani, A. et al. *Attention Is All You Need*. NeurIPS, 2017. <https://arxiv.org/abs/1706.03762>
- Karpathy, A. *Let's build GPT: from scratch, in code, spelled out* (vídeo) e o repositório `nanoGPT`.
- Alammar, J. *The Illustrated Transformer*.
- Karvonen, A. *Emergent World Models and Latent Variable Estimation in Chess-Playing Language Models*, 2024.

Exercícios sugeridos:

1. Substitua o *positional embedding* aprendido pela codificação senoidal do artigo e compare as curvas de perda.
2. Aumente `n_layer` e `n_embd` e observe o efeito sobre a taxa de legalidade e o tempo de treino.
3. Treine o mesmo modelo em outro corpus, como código-fonte ou textos literários em domínio público.
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
            "Este notebook deve ser executado uma única vez, antes do workshop, em um ambiente com GPU "
            "(a T4 gratuita é suficiente; L4 ou A100 reduzem o tempo). O treino dura cerca de 60 minutos.\n\n"
            "Ao final, baixe `xadrez_referencia.pt` e adicione o arquivo à pasta `modelos/` do repositório. "
            "O script salva um checkpoint a cada 10 minutos; se a sessão do Colab for interrompida, "
            "o arquivo parcial já pode ser usado."
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
