"""Small, repeatable integration patch; official physics/assets are unchanged."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent
game = ROOT / 'web/habitat/wasm/game/game.js'
source = game.read_text(encoding='utf-8')
if 'attachHabitat' not in source:
    source = "import { attachHabitat } from '../../adapt.js';\n" + source
    assert 'const PLAYBACK_SPEED = 0.1;' in source
    source = source.replace('const PLAYBACK_SPEED = 0.1;', 'let PLAYBACK_SPEED = 0.1;')
    assert 'new Game(mj, model, data, meta).start();' in source
    source = source.replace('new Game(mj, model, data, meta).start();',
        'const game = new Game(mj, model, data, meta);\n  game.start();\n  attachHabitat(game, value => { PLAYBACK_SPEED = value; });')
    game.write_text(source, encoding='utf-8')
print('Habitat integration ready. MuJoCo model and locomotion controller unchanged.')
