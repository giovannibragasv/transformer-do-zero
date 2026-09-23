"""Verificações automáticas dos exercícios do workshop.

Cada função imprime uma confirmação quando a implementação está correta e, caso
contrário, levanta AssertionError com uma indicação do provável erro.
"""

import functools
import math

import numpy as np
import torch

from mini_gpt import Config


def _ok(msg):
    print("Correto:", msg)


def _falhou(msg):
    raise AssertionError("Incorreto: " + msg)


def _protege(checa):
    """Traduz os erros típicos de exercício incompleto em uma mensagem legível."""

    @functools.wraps(checa)
    def envolto(*args):
        try:
            return checa(*args)
        except AssertionError:
            raise
        except NotImplementedError as e:
            raise AssertionError(f"Incompleto: o {e} ainda não foi implementado.") from None
        except (TypeError, AttributeError) as e:
            if "ellipsis" in str(e):
                raise AssertionError(
                    "Incompleto: ainda há '...' no código. Substitua cada '...' pela expressão pedida."
                ) from None
            raise

    return envolto


# ---------------------------------------------------------------------------
# Parte 1 (NumPy)
# ---------------------------------------------------------------------------

def _softmax_ref(x):
    x = x - x.max(axis=-1, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=-1, keepdims=True)


@_protege
def checa_softmax(softmax):
    x = np.array([[1.0, 2.0, 3.0], [1.0, 1.0, 1.0]])
    out = softmax(x)
    if out is None:
        _falhou("a função retornou None; falta a instrução return.")
    if out.shape != x.shape:
        _falhou(f"shape esperado {x.shape}, obtido {out.shape}. A soma deve ser feita ao longo do último eixo (axis=-1, keepdims=True).")
    if not np.allclose(out.sum(axis=-1), 1.0):
        _falhou("cada linha deveria somar 1. Verifique se a divisão usa a soma da própria linha (axis=-1).")
    if not np.allclose(out, _softmax_ref(x)):
        _falhou("os valores divergem da implementação de referência.")
    grande = softmax(np.array([[1000.0, 1001.0]]))
    if not np.all(np.isfinite(grande)):
        _falhou("entradas grandes (1000) produziram overflow ou NaN. Subtraia o máximo de cada linha antes de aplicar np.exp.")
    _ok("softmax implementada e numericamente estável.")


def _atencao_ref(Q, K, V, mascara=None):
    s = Q @ K.T / math.sqrt(K.shape[-1])
    if mascara is not None:
        s = np.where(mascara == 0, -np.inf, s)
    p = _softmax_ref(s)
    return p @ V, p


@_protege
def checa_atencao(atencao):
    rng = np.random.default_rng(0)
    Q, K, V = rng.normal(size=(4, 8)), rng.normal(size=(4, 8)), rng.normal(size=(4, 3))
    res = atencao(Q, K, V)
    if res is None or len(res) != 2:
        _falhou("a função deve retornar a tupla (saida, pesos).")
    saida, pesos = res
    ref_saida, ref_pesos = _atencao_ref(Q, K, V)
    if pesos.shape != (4, 4):
        _falhou(f"os pesos deveriam ter shape (T, T) = (4, 4), mas têm {pesos.shape}. Verifique a transposição de K.")
    sem_escala = _softmax_ref(Q @ K.T)
    if np.allclose(pesos, sem_escala) and not np.allclose(pesos, ref_pesos):
        _falhou("os scores não foram divididos por √d_k (np.sqrt(K.shape[-1])).")
    if not np.allclose(pesos, ref_pesos):
        _falhou("os pesos de atenção divergem de softmax(Q @ K.T / √d_k).")
    if saida.shape != (4, 3) or not np.allclose(saida, ref_saida):
        _falhou("os pesos estão corretos, mas a saída não. A saída é pesos @ V.")
    _ok("atenção sem máscara implementada.")


@_protege
def checa_mascara(mascara_causal, atencao):
    m = mascara_causal(4)
    esperado = np.tril(np.ones((4, 4)))
    if m is None or m.shape != (4, 4) or not np.allclose(m, esperado):
        _falhou("a máscara causal deve ser uma matriz triangular inferior de uns (np.tril), com zeros acima da diagonal.")
    rng = np.random.default_rng(1)
    Q, K, V = rng.normal(size=(4, 8)), rng.normal(size=(4, 8)), rng.normal(size=(4, 3))
    saida, pesos = atencao(Q, K, V, mascara=m)
    ref_saida, ref_pesos = _atencao_ref(Q, K, V, m)
    if not np.allclose(pesos, ref_pesos):
        _falhou("com máscara, os pesos divergem da referência. Onde a máscara vale 0, o score deve receber -inf antes da softmax.")
    _ok("máscara causal implementada; nenhuma posição atende a posições futuras.")


# ---------------------------------------------------------------------------
# Parte 2 (PyTorch)
# ---------------------------------------------------------------------------

@_protege
def checa_head(Head):
    torch.manual_seed(0)
    cfg = Config(vocab_size=10, block_size=8, n_embd=16, n_head=2)
    h = Head(cfg, head_size=8)
    x = torch.randn(2, 5, 16)
    out = h(x)
    if out is None:
        _falhou("forward retornou None; falta a instrução return.")
    if out.shape != (2, 5, 8):
        _falhou(f"shape de saída esperado (B, T, head_size) = (2, 5, 8), obtido {tuple(out.shape)}.")
    q, k, v = h.query(x), h.key(x), h.value(x)
    s = q @ k.transpose(-2, -1) / math.sqrt(8)
    s = s.masked_fill(torch.tril(torch.ones(5, 5)) == 0, float("-inf"))
    ref = torch.softmax(s, dim=-1) @ v
    if torch.allclose(out, torch.softmax(q @ k.transpose(-2, -1) / math.sqrt(8), -1) @ v, atol=1e-5):
        _falhou("a máscara causal não foi aplicada. Use self.tril[:T, :T] com masked_fill(..., float('-inf')).")
    if not torch.allclose(out, ref, atol=1e-5):
        _falhou("a saída diverge de softmax(QKᵀ/√d + máscara) V. Verifique a transposição k.transpose(-2, -1).")
    if h.att is None:
        _falhou("os pesos devem ser armazenados em self.att, pois são usados nas visualizações.")
    # compara com a versão NumPy da Parte 1
    ref_np, _ = _atencao_ref(q[0].detach().numpy(), k[0].detach().numpy(), v[0].detach().numpy(), np.tril(np.ones((5, 5))))
    assert np.allclose(out[0].detach().numpy(), ref_np, atol=1e-5)
    _ok("Head implementada; o resultado coincide com a versão em NumPy.")


@_protege
def checa_multihead(MultiHeadAttention):
    torch.manual_seed(0)
    cfg = Config(vocab_size=10, block_size=8, n_embd=16, n_head=4)
    m = MultiHeadAttention(cfg)
    x = torch.randn(2, 5, 16)
    out = m(x)
    if out is None or out.shape != (2, 5, 16):
        _falhou("a saída deve ter shape (B, T, n_embd). As cabeças devem ser concatenadas no último eixo (dim=-1).")
    ref = m.proj(torch.cat([h(x) for h in m.heads], dim=-1))
    if not torch.allclose(out, ref, atol=1e-5):
        _falhou("as saídas de todas as cabeças devem ser concatenadas (torch.cat(..., dim=-1)) antes de self.proj.")
    _ok("multi-head attention implementada.")


@_protege
def checa_block(Block):
    torch.manual_seed(0)
    cfg = Config(vocab_size=10, block_size=8, n_embd=16, n_head=4)
    b = Block(cfg)
    x = torch.randn(2, 5, 16)
    out = b(x)
    if out is None or out.shape != x.shape:
        _falhou("a saída do bloco deve ter o mesmo shape da entrada.")
    if torch.equal(out, x):
        _falhou("o bloco devolveu a entrada sem alterações; as duas linhas do exercício ainda não foram escritas.")
    x1 = x + b.attn(b.ln1(x))
    ref = x1 + b.ffn(b.ln2(x1))
    if torch.allclose(out, b.ffn(b.ln2(b.attn(b.ln1(x)))), atol=1e-5):
        _falhou("faltam as conexões residuais, na forma x = x + subcamada(norm(x)).")
    if not torch.allclose(out, ref, atol=1e-5):
        _falhou("a ordem esperada é x = x + attn(ln1(x)) seguida de x = x + ffn(ln2(x)).")
    _ok("bloco do Transformer implementado.")
