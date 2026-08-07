#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHOPWARE_ROOT="$(cd "${PLUGIN_DIR}/../../.." && pwd)"

exec "${SHOPWARE_ROOT}/bin/build-storefront.sh"
