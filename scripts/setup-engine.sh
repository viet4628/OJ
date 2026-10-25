#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
revision=d33f85b648b6705f6d06278de4e464672857e23d
patch="$PWD/patches/rsjudge-integration.patch"
if [ ! -d engine/rsjudge/.git ]; then
  git clone --no-checkout https://github.com/viet4628/rsjudge.git engine/rsjudge
  git -C engine/rsjudge checkout --detach "$revision"
fi
if git -C engine/rsjudge apply --reverse --check "$patch" >/dev/null 2>&1; then
  echo 'Engine integration patch already applied.'
  exit 0
fi
if [ "$(git -C engine/rsjudge rev-parse HEAD)" != "$revision" ]; then
  echo 'Engine checkout differs from pinned upstream. Preserve it and review patches/rsjudge-integration.patch manually.' >&2
  exit 1
fi
git -C engine/rsjudge apply --check "$patch"
git -C engine/rsjudge apply "$patch"
echo 'Pinned engine and integration patch prepared.'
