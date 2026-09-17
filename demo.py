"""Compare resting and sugar-stimulated activity using Eon's original model."""
import argparse
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'vendor' / 'fly-brain-main' / 'code'))
os.environ['CUDA_VISIBLE_DEVICES'] = ''
os.environ.pop('FLY_BRAIN_DISABLE_SPIKE_IO', None)

import pandas as pd
import pyarrow
import torch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import benchmark
from run_pytorch import run_single_benchmark


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--seconds', type=float, default=0.1)
    args = parser.parse_args()
    if not 0 < args.seconds <= 10:
        parser.error('--seconds must be greater than 0 and at most 10')
    output = ROOT / 'results'
    output.mkdir(exist_ok=True)
    benchmark.path_res = output
    torch.set_num_threads(4)
    logger = benchmark.BenchmarkLogger(str(output / 'demo.log'))
    results = []
    fig, axes = plt.subplots(2, 1, figsize=(11, 7), constrained_layout=True)
    try:
        for ax, name, rate in zip(axes, ['Reposo', 'Azucar'], [0.0, 200.0]):
            experiment = dict(benchmark.get_experiment('sugar'))
            experiment['stim_rate'] = rate
            experiment['name'] = name
            torch.manual_seed(42)
            result = run_single_benchmark(args.seconds, 1, experiment, logger,
                                          run_label=name.lower(), round_idx=1)
            if result['status'] != 'success':
                raise RuntimeError(result['status'])
            spikes = pd.read_parquet(result['spike_path'])
            if not spikes.empty:
                assert spikes.time_ms.between(0, args.seconds * 1000, inclusive='left').all()
                ax.scatter(spikes.time_ms, spikes.neuron_index, s=2, alpha=0.6)
            stimulated = set(experiment['neu_exc'])
            result['downstream_active_neurons'] = len(set(spikes.flywire_id) - stimulated)
            result['seed'] = 42
            results.append(result)
            ax.set(title=f'{name}: {result["n_spikes"]} impulsos, '
                         f'{result["n_active_neurons"]} neuronas activas',
                   xlabel='Tiempo simulado (ms)', ylabel='Indice de neurona',
                   xlim=(0, args.seconds * 1000))
        if results[0]['n_spikes'] != 0 or results[1]['downstream_active_neurons'] <= 0:
            raise RuntimeError('Unexpected resting activity or no downstream stimulus response')
        fig.savefig(output / 'actividad.png', dpi=150)
        (output / 'summary.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
        rows = ''.join(f'<tr><td>{r["experiment_name"]}</td><td>{r["n_spikes"]}</td>'
                       f'<td>{r["n_active_neurons"]}</td><td>{r["downstream_active_neurons"]}</td></tr>'
                       for r in results)
        (output / 'informe.html').write_text('''<!doctype html><html lang="es"><meta charset="utf-8">
<title>Fruit Fly Brain: primera prueba</title>
<style>body{font:18px system-ui;max-width:1000px;margin:40px auto;padding:20px;background:#111827;color:#f3f4f6}table{border-collapse:collapse}td,th{padding:14px;border-bottom:1px solid #475569}img{width:100%;margin-top:24px}a{color:#93c5fd}</style>
<h1>Fruit Fly Brain: respuesta al azucar</h1>
<p>Modelo publico de Eon Systems, conectoma FlyWire v783. Se compara reposo con la estimulacion de 21 neuronas gustativas a 200 Hz, usando PyTorch en CPU.</p>
<table><tr><th>Condicion</th><th>Impulsos</th><th>Neuronas activas</th><th>Activas fuera del grupo estimulado</th></tr>'''
            + rows + '''</table><img src="actividad.png" alt="Actividad neuronal en reposo y con azucar">
<p>Cada punto representa un impulso neuronal. Es una prueba tecnica breve de propagacion de actividad, no una validacion biologica ni la simulacion de un cuerpo.</p>
<p><a href="https://github.com/eonsystemspbc/fly-brain">Codigo original de Eon Systems</a></p></html>''', encoding='utf-8')
        print('\nPrueba correcta. Abre:', output / 'informe.html')
    finally:
        logger.close()
        plt.close(fig)


if __name__ == '__main__':
    main()
