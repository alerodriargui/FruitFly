"""Export real FlyWire positions and the latest recorded sugar experiment."""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'vendor/fly-brain-main/code'))
from benchmark import get_experiment

annotations = ROOT / 'data/neuron_annotations.tsv'
table = pd.read_csv(annotations, sep='\t', dtype={'root_id': str}, low_memory=False)
ids = pd.read_csv(ROOT / 'vendor/fly-brain-main/data/2025_Completeness_783.csv', index_col=0).index.astype(str)
table = table.set_index('root_id').reindex(ids)
soma = table[['soma_x', 'soma_y', 'soma_z']].apply(pd.to_numeric, errors='coerce').to_numpy(float)
anchor = table[['pos_x', 'pos_y', 'pos_z']].apply(pd.to_numeric, errors='coerce').to_numpy(float)
has_soma = np.isfinite(soma).all(axis=1)
coords = np.where(has_soma[:, None], soma, anchor) * [0.004, 0.004, 0.04]
valid = np.isfinite(coords).all(axis=1)
summary = json.loads((ROOT / 'results/summary.json').read_text())
run = next(r for r in summary if r['experiment_name'] == 'Azucar')
spikes = pd.read_parquet(run['spike_path'])
times = {str(k): v.time_ms.round(3).tolist() for k, v in spikes.groupby('flywire_id')}
stim = set(map(str, get_experiment('sugar')['neu_exc']))
classes = sorted(table.super_class.fillna('unknown').unique().tolist())
nodes = []
for i in np.flatnonzero(valid):
    row = table.iloc[i]
    label = next((str(row[k]) for k in ['cell_type', 'cell_class', 'super_class'] if pd.notna(row[k])), 'Sin clasificar')
    nodes.append([ids[i], *coords[i].round(3).tolist(), classes.index(row.super_class if pd.notna(row.super_class) else 'unknown'), label,
                  str(row.side) if pd.notna(row.side) else 'unknown', int(has_soma[i]), times.get(ids[i], []), int(ids[i] in stim)])
lookup = {n[0]: i for i, n in enumerate(nodes)}
active_indices = [i for i, x in enumerate(ids) if x in times]
con = pd.read_parquet(ROOT / 'vendor/fly-brain-main/data/2025_Connectivity_783.parquet')
subset = con[con.Presynaptic_Index.isin(active_indices) & con.Postsynaptic_Index.isin(active_indices)]
weight_col = 'Excitatory x Connectivity'
subset = subset.assign(magnitude=subset[weight_col].abs()).sort_values('magnitude', ascending=False).head(2500)
edges = []
for _, row in subset.iterrows():
    a, b = ids[int(row.Presynaptic_Index)], ids[int(row.Postsynaptic_Index)]
    if a in lookup and b in lookup:
        edges.append([lookup[a], lookup[b], float(row[weight_col])])
payload = {'nodes': nodes, 'classes': classes, 'edges': edges, 'duration': run['t_run_sec'] * 1000,
           'total': len(ids), 'missing': int((~valid).sum()), 'somas': int(has_soma[valid].sum()),
           'active': len(times), 'activeLocated': sum(bool(n[8]) for n in nodes), 'spikes': len(spikes),
           'source': 'https://github.com/flyconnectome/flywire_annotations',
           'annotationSha256': hashlib.sha256(annotations.read_bytes()).hexdigest()}
assert len(lookup) == len(nodes)
assert all(isinstance(n[0], str) and len(n[0]) == 18 for n in nodes)
assert all(0 <= t < payload['duration'] for n in nodes for t in n[8])
(ROOT / 'web/brain-data.js').write_text('window.BRAIN_DATA=' + json.dumps(payload, separators=(',', ':'), ensure_ascii=True) + ';', encoding='utf-8')
print(json.dumps({k: v for k, v in payload.items() if k not in ['nodes', 'classes', 'edges']}, indent=2))
