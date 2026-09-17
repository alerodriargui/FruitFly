"""Vendor the official NeuroMechFly WASM model, pinned to a site commit."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
TREE = json.loads((ROOT / 'data/flygym-site-tree.json').read_text(encoding='utf-8-sig'))
DEST = ROOT / 'web/habitat'
COMMIT = TREE['sha']
FILES = [f for f in TREE['tree'] if f['type'] == 'blob' and f['path'].startswith(('wasm/game/', 'wasm/shared/'))]

def get_file(entry):
    path = DEST / entry['path']
    path.parent.mkdir(parents=True, exist_ok=True)
    url = f'https://raw.githubusercontent.com/NeLy-EPFL/flygym/{COMMIT}/{entry["path"]}'
    existing = path.read_bytes() if path.exists() else None
    current_hash = hashlib.sha1(f'blob {len(existing)}\0'.encode() + existing).hexdigest() if existing is not None else None
    if current_hash != entry['sha']:
        subprocess.run(['curl.exe', '--ssl-revoke-best-effort', '-fsSL', '--retry', '2', '--connect-timeout', '15', '--max-time', '120', url, '-o', str(path)], check=True)
    content = path.read_bytes()
    git_hash = hashlib.sha1(f'blob {len(content)}\0'.encode() + content).hexdigest()
    if git_hash != entry['sha']:
        raise ValueError(f'Git hash mismatch: {path}')
    return {'path': entry['path'], 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)}

with ThreadPoolExecutor(max_workers=4) as pool:
    records = list(pool.map(get_file, FILES))
(DEST / 'upstream-manifest.json').write_text(json.dumps({'repository':'https://github.com/NeLy-EPFL/flygym', 'commit':COMMIT,'files':records},indent=2),encoding='utf-8')
for name,url in {
    'LICENSE-flygym.txt':'https://raw.githubusercontent.com/NeLy-EPFL/flygym/main/LICENSE',
    'LICENSE-mujoco.txt':'https://raw.githubusercontent.com/google-deepmind/mujoco/main/LICENSE',
    'LICENSE-three.txt':'https://raw.githubusercontent.com/mrdoob/three.js/dev/LICENSE',
}.items():
    subprocess.run(['curl.exe','--ssl-revoke-best-effort','-fsSL','--max-time','30',url,'-o',str(DEST / name)],check=True)
print(f'Installed {len(records)} verified files ({sum(r["bytes"] for r in records)/1e6:.1f} MB), commit {COMMIT}',flush=True)
