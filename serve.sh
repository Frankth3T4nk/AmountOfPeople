#!/bin/bash
cd "$(dirname "$0")/static"
exec python3 -m http.server "${PORT:-3000}"
