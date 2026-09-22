#!/usr/bin/env python3
"""Serve the built _site directory over HTTP for LAN / ZeroTier access."""

from __future__ import annotations

import argparse
import gzip
import io
import os
import subprocess
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


DEFAULT_ROOT = Path(__file__).resolve().parents[1] / "_site"

COMPRESSIBLE_PREFIXES = ("text/",)
COMPRESSIBLE_TYPES = {
    "application/javascript",
    "application/json",
    "application/xml",
    "application/x-javascript",
    "image/svg+xml",
}


def is_compressible(content_type: str) -> bool:
    content_type = content_type.split(";")[0].strip()
    return content_type.startswith(COMPRESSIBLE_PREFIXES) or content_type in COMPRESSIBLE_TYPES


def ipv4_addresses() -> list[tuple[str, str]]:
    try:
        output = subprocess.run(
            ["ip", "-4", "-o", "addr", "show"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return []
    found = []
    for line in output.splitlines():
        parts = line.split()
        if len(parts) >= 4 and parts[2] == "inet":
            found.append((parts[1], parts[3].split("/")[0]))
    return [item for item in found if not item[1].startswith("127.")]


class SiteHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "blog-static/1.0"

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            if not self.path.endswith("/"):
                self.send_response(301)
                self.send_header("Location", self.path + "/")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None
            path = os.path.join(path, "index.html")
        try:
            data = Path(path).read_bytes()
        except OSError:
            self.send_error(404, "File not found")
            return None

        content_type = self.guess_type(path)
        if is_compressible(content_type) and "gzip" in self.headers.get("Accept-Encoding", ""):
            body = gzip.compress(data, 6)
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Encoding", "gzip")
        else:
            body = data
            self.send_response(200)
            self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        return io.BytesIO(body)

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} - {fmt % args}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="directory to serve")
    parser.add_argument("--host", default="0.0.0.0", help="bind address")
    parser.add_argument("--port", type=int, default=8000, help="listen port")
    args = parser.parse_args()

    root = args.root.resolve()
    if not (root / "index.html").is_file():
        parser.error(f"no index.html under {root}; run `jekyll build` first")

    handler = partial(SiteHandler, directory=str(root))
    httpd = ThreadingHTTPServer((args.host, args.port), handler)

    print(f"Serving {root} on {args.host}:{args.port}", flush=True)
    print(f"  local     http://127.0.0.1:{args.port}/", flush=True)
    for iface, addr in ipv4_addresses():
        tag = "zerotier" if iface.startswith("zt") else "lan"
        print(f"  {tag:<8}  http://{addr}:{args.port}/", flush=True)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
