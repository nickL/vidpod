#!/usr/bin/env bash
set -euo pipefail

set -a
source .env.cloudflare-dev.local
set +a

pnpm exec opennextjs-cloudflare build
pnpm exec opennextjs-cloudflare deploy --env dev
