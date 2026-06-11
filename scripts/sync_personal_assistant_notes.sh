#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

python3 scripts/import_personal_assistant_notes.py --clean "$@"
python3 scripts/build_reader_data.py

if git diff --quiet --exit-code && git diff --cached --quiet --exit-code && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "No changes to commit."
  exit 0
fi

git add _posts assets/data/reader-posts.json
git commit -m "$(date +%F) sync"
git push
