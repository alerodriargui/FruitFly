"""Loopback-only static server: worker scripts require an HTTP origin."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
PORT = 8766
URL = f'http://127.0.0.1:{PORT}/flappy.html'
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/fruitfly-health':
            body = b'fruitfly-flappy-v1'
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()
    def log_message(self, *args):
        pass

def main():
    try:
        server = ThreadingHTTPServer(('127.0.0.1', PORT), partial(Handler, directory=str(ROOT / 'web')))
    except OSError:
        with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fruitfly-health', timeout=3) as response:
            if response.read() != b'fruitfly-flappy-v1':
                raise RuntimeError(f'Port {PORT} is occupied by another application')
        webbrowser.open(URL)
        return
    webbrowser.open(URL)
    server.serve_forever()

if __name__ == '__main__':
    try:
        main()
    except Exception:
        import traceback
        (ROOT / 'results/flappy-server-error.log').write_text(traceback.format_exc(), encoding='utf-8')
        raise
