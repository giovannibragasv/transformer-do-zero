# Attention is All You Need: construindo um Transformer do zero

Material do workshop apresentado no CESUPA Tech Summit 2026. Partimos da atenção por produto escalar,
implementada em NumPy, e chegamos a um Transformer decoder-only escrito à mão em PyTorch, treinado para
gerar partidas de xadrez a partir de 60 mil partidas do Lichess.

## Para participantes

Abra o notebook no Google Colab (é necessário apenas um navegador e uma conta Google):

https://colab.research.google.com/github/giovannibragasv/transformer-do-zero/blob/main/workshop_aluno.ipynb

Em seguida, salve uma cópia no Drive (*Arquivo > Salvar uma cópia no Drive*) e ative a GPU
(*Ambiente de execução > Alterar o tipo de ambiente de execução > T4 GPU*).

## Conteúdo

| Caminho | Descrição |
|---|---|
| `workshop_aluno.ipynb` | Notebook com seis exercícios e verificações automáticas |
| `workshop_gabarito.ipynb` | Soluções |
| `pretreino_referencia.ipynb` | Treino do modelo de referência (cerca de 60 min em uma T4) |
| `mini_gpt.py` | Implementação de referência do modelo |
| `checagens.py` | Verificações dos exercícios |
| `data/xadrez.txt.gz` | Partidas do Lichess (2013), filtradas e validadas com python-chess |
| `scripts/` | Preparação dos dados, pré-treino e geração dos notebooks |
| `slides/` | Apresentação (`.pptx`) e seu script gerador |
| `docs/` | Plano do workshop e guia de estudos (`.md`, `.tex` e `.pdf`) |

## Reprodução

```
python -m venv .venv && .venv/bin/pip install torch numpy matplotlib chess nbformat nbconvert ipykernel zstandard
.venv/bin/python scripts/preparar_dados.py data_raw/*.pgn.zst -o data/xadrez.txt   # PGNs de database.lichess.org
.venv/bin/python scripts/gerar_notebooks.py
WORKSHOP_RAPIDO=1 .venv/bin/jupyter nbconvert --to notebook --execute workshop_gabarito.ipynb --output /tmp/teste.ipynb
```

## Referências

- Vaswani, A. et al. (2017). Attention Is All You Need. NeurIPS. arXiv:1706.03762.
- Karpathy, A. (2023). nanoGPT e *Let's build GPT: from scratch, in code, spelled out*.
- Karvonen, A. (2024). Emergent World Models and Latent Variable Estimation in Chess-Playing Language Models. arXiv:2403.15498.

Os dados de partidas são do banco público do Lichess (database.lichess.org), distribuído sob CC0.
