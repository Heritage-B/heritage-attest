#!/usr/bin/env bash
# One-command end-to-end proof on a local anvil chain:
# starts anvil → deploys contracts → runs the attestor flow (mint/anchor/verify/tamper).
# Requires: foundry (anvil, forge) + node. No funds, no external RPC.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v anvil >/dev/null || { echo "install foundry: https://getfoundry.sh"; exit 1; }
ANVIL_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

echo "▸ starting anvil…"
anvil --silent & ANVIL_PID=$!
trap 'kill $ANVIL_PID 2>/dev/null || true' EXIT
sleep 3

echo "▸ deploying contracts…"
pushd contracts >/dev/null
[ -d lib/forge-std ] || forge install foundry-rs/forge-std --no-commit
OUT=$(DEPLOYER_PK=$ANVIL_PK forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast)
REGISTRY=$(echo "$OUT" | grep -oE 'VehicleRegistry: 0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}')
ATTEST=$(echo "$OUT"   | grep -oE 'Attestations:   0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}')
popd >/dev/null
echo "  VehicleRegistry: $REGISTRY"
echo "  Attestations:    $ATTEST"

echo "▸ building attestor…"
npm run build --workspace @heritageb/attestor >/dev/null

echo "▸ running end-to-end flow…"
REGISTRY=$REGISTRY ATTESTATIONS=$ATTEST RPC=http://127.0.0.1:8545 CHAIN_ID=31337 \
  node packages/attestor/scripts/e2e-anvil.mjs
