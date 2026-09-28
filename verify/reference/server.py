#!/usr/bin/env python3
"""C3 reference harness — static server for the 2012 reference SWF.

Serves the harness root `verify/reference/` (index.html + the pinned Ruffle
0.6.0 web self-hosted build under `ruffle/web/`) and maps the game's relative
fetches to the read-only `../kelimator-nostalji/calistir/` checkout:

    /kelimator_tr_2012_mochiads.swf  ->  ../kelimator-nostalji/calistir/...
    /xml64.php[?query]               ->  ../kelimator-nostalji/calistir/xml64.php

so the SWF is served from the same origin/root as the fixture XML and its
`xml64.php?<random>` fetch resolves locally. Nothing is copied out of the
read-only source tree (EXECUTION.md §6, task C3 rule).

Every request is logged to stdout as one line (plain text, flushed):

    <ISO-8601 UTC> <client-ip> "<request line>" -> <status> [<bytes>]

The Playwright harness (capture.mjs) appends this stream to
`evidence/logs/C3-server.log` and greps it for the `xml64.php` 200 request
(V6 evidence).

Usage:
    python3 verify/reference/server.py [port]     # default port 8797
"""

import http.server
import os
import socketserver
import sys
import time
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
CALISTIR = os.path.abspath(os.path.join(REPO, "..", "kelimator-nostalji", "calistir"))
RUFFLE_WEB = os.path.join(HERE, "ruffle", "web")
SWF_NAME = "kelimator_tr_2012_mochiads.swf"

DEFAULT_PORT = 8797

# The 2012 client Base64-decodes every round value; the archived fixture is
# plain ISO-8859-9, so the harness serves the derived fixture produced by
# `make-fixture.mjs` (task amendment 2026-09-28). The archived file stays
# read-only and unmodified.
SERVED_FIXTURE = os.path.join(HERE, "fixtures", "xml64.base64.php")

# Game fixtures: the SWF comes straight from the read-only source tree.
ROUTES = {
    "/": os.path.join(HERE, "index.html"),
    "/index.html": os.path.join(HERE, "index.html"),
    "/" + SWF_NAME: os.path.join(CALISTIR, SWF_NAME),
    "/xml64.php": SERVED_FIXTURE,
}

class Handler(http.server.SimpleHTTPRequestHandler):
    # Serve the Ruffle build's exact bytes with correct MIME types.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".wasm": "application/wasm",
        ".map": "application/json",
        ".json": "application/json",
        ".swf": "application/x-shockwave-flash",
        ".php": "text/xml; charset=iso-8859-9",
        ".png": "image/png",
    }

    def translate_path(self, path):
        route = urllib.parse.urlsplit(path).path
        target = ROUTES.get(route)
        if target is None and route.startswith("/ruffle/web/"):
            rel = route[len("/ruffle/web/"):]
            safe = os.path.normpath(rel).lstrip("/")
            if ".." not in safe.split(os.sep):
                target = os.path.join(RUFFLE_WEB, safe)
        if target is None or not os.path.isfile(target):
            # Not part of the harness: 404 without directory listings.
            return os.path.join(HERE, "__not_found__")
        return target

    def end_headers(self):
        # No caching: every run must fetch the SWF/XML fresh for stable evidence.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        sys.stdout.write("%s %s %s\n" % (stamp, self.client_address[0], fmt % args))
        sys.stdout.flush()

    def log_request(self, code="-", size="-"):
        # One line per request, including the raw request line (path + query).
        self.log_message('"%s" -> %s %s', self.requestline, code, size)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def main(argv):
    port = int(argv[1]) if len(argv) > 1 else DEFAULT_PORT
    with Server(("127.0.0.1", port), Handler) as httpd:
        print("C3 reference server on http://127.0.0.1:%d/" % port, flush=True)
        print("  harness root : %s" % HERE, flush=True)
        print("  ruffle web   : %s" % RUFFLE_WEB, flush=True)
        print("  /xml64.php   : %s (derived; archived input read-only at %s)" % (SERVED_FIXTURE, CALISTIR), flush=True)
        httpd.serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
