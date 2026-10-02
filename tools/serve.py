"""Serve docs with enough queued connections for concurrent browser imports."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


if __name__ == "__main__":
    docs = Path(__file__).resolve().parent.parent / "docs"
    handler = partial(SimpleHTTPRequestHandler, directory=str(docs))
    with PreviewServer(("127.0.0.1", 8000), handler) as server:
        server.serve_forever()
