"""Check actual training, holdout improvement, persistence and browser controls."""
import json
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT / 'web')))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width':1440, 'height':1100})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/flappy.html')
        page.wait_for_function('window.flappyState?.ready')
        page.wait_for_function('window.flappyState.generation >= 1', timeout=180000)
        print('First generation:', page.evaluate('window.flappyState.lastReport'), flush=True)
        page.wait_for_function('window.flappyState.generation >= 15', timeout=300000)
        page.locator('#train').click()
        page.wait_for_function('document.getElementById("status").textContent.includes("Aprendizaje pausado")', timeout=120000)
        report = page.evaluate('window.flappyState.lastReport')
        print('Training outcome:', json.dumps(report), flush=True)
        assert report['test'] > report['baseline']['score'], report
        assert report['test'] >= 3, report
        page.locator('#restartFlight').click()
        page.locator('#speed').select_option('8')
        page.wait_for_function('window.flappyState.score >= 2', timeout=60000)
        page.locator('#speed').select_option('1')
        page.screenshot(path=str(ROOT / 'results/flappy-learning.png'), full_page=True)
        weights = page.evaluate('window.flappyState.weights')
        page.locator('#baseline').click()
        page.wait_for_function('window.flappyState.baseline')
        assert page.evaluate('window.flappyState.activeWeights.every(w => w === 0)')
        page.locator('#baseline').click()
        page.wait_for_function('!window.flappyState.baseline')
        assert page.evaluate('window.flappyState.activeWeights') == weights
        with page.expect_download() as download:
            page.locator('#download').click()
        exported = json.loads(Path(download.value.path()).read_text())
        assert exported['weights'] == weights
        page.reload()
        page.wait_for_function('window.flappyState?.ready')
        assert page.evaluate('window.flappyState.weights') == weights
        assert page.evaluate('window.flappyState.generation') >= 15
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(ROOT / 'results/flappy-mobile.png'), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        (ROOT / 'results/flappy-validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print('PASS: training improves on held-out courses, learned flight, comparison, download, persistence, responsive layout; no JS errors.', flush=True)
        browser.close()
finally:
    server.shutdown()
