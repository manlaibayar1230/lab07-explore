#!/usr/bin/env bash
# API түвшний согог бүрийн curl -i нотолгоог ШИНЭЭР АСААСАН апп дээр цуглуулна -> evidence/bug-NN-curl.txt
cd "$(dirname "$0")/.."
fresh() { [ -n "$APP" ] && { kill $APP; wait $APP 2>/dev/null; }; node app.js >/dev/null 2>&1 & APP=$!; until curl -s -o /dev/null localhost:3000/api/books; do sleep 0.2; done; }
q() { if [[ "$1" =~ ^[A-Za-z0-9_./:?=\&-]+$ ]]; then printf ' %s' "$1"; else printf " '%s'" "${1//\'/\'\\\'\'}"; fi; }
run() { printf '$'; for a in "$@"; do q "$a"; done; echo; "$@" 2>&1; echo; echo; }
fresh; { echo "# BUG-03: node app.js шинээр асаасан (анхны 3 ном)"; run curl -s -i localhost:3000/api/books; run curl -s -i localhost:3000/api/stats; } > evidence/bug-03-curl.txt
fresh; { echo "# BUG-05: node app.js шинээр асаасан"; run curl -s -i localhost:3000/old; } > evidence/bug-05-curl.txt
fresh; { echo "# BUG-06: node app.js шинээр асаасан"; run curl -s -i -X POST localhost:3000/api/books -H 'Content-Type: application/json' -d '{}'; run curl -s -i -X POST localhost:3000/api/books -H 'Content-Type: application/json' -d '{"title":"   ","author":"   ","year":"2000"}'; run curl -s -i localhost:3000/api/books; } > evidence/bug-06-curl.txt
fresh; { echo "# BUG-07: node app.js шинээр асаасан"; for y in 999 2101 abc 1999.5; do run curl -s -i -X POST localhost:3000/api/books -H 'Content-Type: application/json' -d "{\"title\":\"Он $y\",\"author\":\"Тест\",\"year\":\"$y\"}"; done; run curl -s -i localhost:3000/api/books; } > evidence/bug-07-curl.txt
fresh; { echo "# BUG-09: node app.js шинээр асаасан"; run curl -s -i "localhost:3000/api/books?q=Clean"; run curl -s -i "localhost:3000/api/books?q=clean"; run curl -s -i "localhost:3000/api/books?q=Martin"; run curl -s -i "localhost:3000/api/books?q=martin"; } > evidence/bug-09-curl.txt
fresh; { echo "# BUG-12: node app.js шинээр асаасан"; run curl -s -i -X POST localhost:3000/api/books -H 'Content-Type: application/json' -d '{"title": "abc", bad json'; run curl -s -i -X POST localhost:3000/api/books -d 'буруу оролт'; run curl -s -i localhost:3000/api/books; } > evidence/bug-12-curl.txt
kill $APP; wait $APP 2>/dev/null
