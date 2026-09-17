"""Extract a small, explicitly approximate connectome reservoir for the game."""
import json
import hashlib
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
annotations = pd.read_csv(ROOT / 'data/neuron_annotations.tsv', sep='\t', dtype={'root_id': str}, low_memory=False).set_index('root_id')
ids = pd.read_csv(ROOT / 'vendor/fly-brain-main/data/2025_Completeness_783.csv', index_col=0).index.astype(str)
con = pd.read_parquet(ROOT / 'vendor/fly-brain-main/data/2025_Connectivity_783.parquet', columns=['Presynaptic_Index', 'Postsynaptic_Index', 'Excitatory x Connectivity'])
meta = annotations.reindex(ids)
visual = np.flatnonzero((meta.super_class == 'visual_projection').to_numpy())
visual_edges = con[con.Presynaptic_Index.isin(visual)]
# Start with 48 well-connected projection neurons, then their strongest targets.
seeds = visual_edges.groupby('Presynaptic_Index')['Excitatory x Connectivity'].agg(lambda s: s.abs().sum()).nlargest(48).index.tolist()
neighbors = con[con.Presynaptic_Index.isin(seeds)].groupby('Postsynaptic_Index')['Excitatory x Connectivity'].agg(lambda s: s.abs().sum()).sort_values(ascending=False).index.tolist()
selected = list(dict.fromkeys(seeds + neighbors))[:192]
lookup = {old: i for i, old in enumerate(selected)}
edges = con[con.Presynaptic_Index.isin(selected) & con.Postsynaptic_Index.isin(selected)]
raw = [(lookup[int(a)], lookup[int(b)], float(w)) for a, b, w in edges.itertuples(index=False, name=None) if w != 0]
totals = np.zeros(len(selected))
for a, b, w in raw:
    totals[b] += abs(w)
normalized = [[a, b, round(w / max(totals[b], 1) * .65, 7)] for a, b, w in raw]
nodes = []
for i, original in enumerate(selected):
    row = meta.iloc[original]
    nodes.append({'id': ids[original], 'type': str(row.cell_type) if pd.notna(row.cell_type) else str(row.super_class), 'group': i % 8})
payload = {'version': 1, 'nodes': nodes, 'edges': normalized, 'rawEdges': [[a,b,w] for a,b,w in raw],
           'model': '192-node tanh reservoir; fixed FlyWire edges, engineered sensory encoding; evolved linear action readout',
           'source': 'https://github.com/eonsystemspbc/fly-brain',
           'annotationSource': 'https://github.com/flyconnectome/flywire_annotations'}
payload['fingerprint'] = hashlib.sha256(json.dumps(normalized).encode()).hexdigest()
(ROOT / 'web/flappy-circuit.js').write_text('self.FLY_CIRCUIT=' + json.dumps(payload, separators=(',', ':')) + ';', encoding='utf-8')
print(f'{len(nodes)} neurons, {len(raw)} signed edges exported.')
