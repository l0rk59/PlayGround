#!/usr/bin/env bash
# Contrôle syntaxique ESM strict de tous les modules (node --check sur .js
# n'analyse PAS les modules : il faut forcer l'extension .mjs).
cd "$(dirname "$0")"
fail=0
for f in src/*.js; do
  cp "$f" /tmp/_nd_check.mjs
  out=$(node --check /tmp/_nd_check.mjs 2>&1)
  if [ -n "$out" ]; then
    echo "✗ $f"
    echo "$out" | head -4
    fail=1
  fi
done
rm -f /tmp/_nd_check.mjs
[ $fail -eq 0 ] && echo "✓ Syntaxe ESM : tous les modules OK"
exit $fail
