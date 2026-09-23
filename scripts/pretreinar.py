"""Treina o modelo de referência: o mesmo GPT do notebook, maior e por mais tempo.

Uso:
    python scripts/pretreinar.py --minutos 45 --saida modelos/xadrez_referencia.pt
"""

import argparse
import sys
import time
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from mini_gpt import GPT, Config, DadosXadrez, taxa_de_legalidade  # noqa: E402


def salvar(model, cfg, dados, caminho):
    Path(caminho).parent.mkdir(parents=True, exist_ok=True)
    sd = {k: v.detach().cpu() for k, v in model.state_dict().items()}
    torch.save({"config": cfg.__dict__, "chars": dados.tok.chars, "state_dict": sd}, caminho)
    print("salvo em", caminho, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dados", default="data/xadrez.txt")
    ap.add_argument("--saida", default="modelos/xadrez_referencia.pt")
    ap.add_argument("--minutos", type=float, default=45)
    ap.add_argument("--n-layer", type=int, default=6)
    ap.add_argument("--n-head", type=int, default=8)
    ap.add_argument("--n-embd", type=int, default=256)
    ap.add_argument("--block-size", type=int, default=384)
    ap.add_argument("--batch", type=int, default=48)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--max-passos", type=int, default=10**9)
    ap.add_argument("--salvar-a-cada", type=float, default=10, help="minutos entre checkpoints")
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    torch.manual_seed(1337)
    dados = DadosXadrez(open(args.dados).read(), args.block_size)
    cfg = Config(dados.tok.vocab_size, args.block_size, args.n_layer, args.n_head, args.n_embd)
    model = GPT(cfg).to(device)
    print(f"{device} | {model.n_params() / 1e6:.2f}M parâmetros | vocab {cfg.vocab_size}")

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.1)
    # precisão mista (fp16) na GPU do Colab reduz o tempo de treino
    usar_amp = device == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=usar_amp)
    ultimo_save = time.time()
    limite = time.time() + args.minutos * 60
    # cosine decay até o fim do tempo (estimado pela velocidade dos primeiros passos)
    passo, t0, total_estimado = 0, time.time(), None
    while time.time() < limite and passo < args.max_passos:
        if passo == 50:
            total_estimado = int(50 * args.minutos * 60 / (time.time() - t0))
            print(f"~{total_estimado} passos no total")
        if total_estimado:
            frac = min(passo / total_estimado, 1.0)
            for g in opt.param_groups:
                g["lr"] = args.lr * (0.1 + 0.9 * 0.5 * (1 + torch.cos(torch.tensor(frac * 3.14159)).item()))
        x, y = dados.batch("treino", args.batch, device)
        with torch.autocast("cuda", dtype=torch.float16, enabled=usar_amp):
            _, loss = model(x, y)
        opt.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.unscale_(opt)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(opt)
        scaler.update()
        if time.time() - ultimo_save > args.salvar_a_cada * 60:
            salvar(model, cfg, dados, args.saida)
            ultimo_save = time.time()
        if passo % 250 == 0:
            model.eval()
            with torch.no_grad():
                xv, yv = dados.batch("val", args.batch, device)
                _, lv = model(xv, yv)
            model.train()
            print(f"passo {passo:6d} | treino {loss.item():.3f} | val {lv.item():.3f} | {(time.time() - t0) / 60:.1f} min", flush=True)
        passo += 1

    salvar(model, cfg, dados, args.saida)
    model.cpu().eval()
    print(f"taxa de lances legais (vs aleatório): {taxa_de_legalidade(model, dados.tok, n_partidas=30):.1%}")


if __name__ == "__main__":
    main()
