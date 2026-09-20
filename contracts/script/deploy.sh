#!/usr/bin/env sh
set -eu

# Run from the contracts directory. Signing is interactive: no private key is
# accepted as a command-line argument or stored in this repository.
network="${1:-}"
case "$network" in
  testnet)
    rpc='https://rpc.testnet.arc.io'
    expected_chain_id='5042002'
    ;;
  mainnet)
    rpc='https://rpc.mainnet.arc.io'
    expected_chain_id='5042'
    ;;
  *)
    echo 'Usage: sh script/deploy.sh testnet|mainnet' >&2
    exit 2
    ;;
esac

forge_bin="${ARC_FORGE_BIN:-arc-forge}"
cast_bin="${ARC_CAST_BIN:-arc-cast}"
command -v "$forge_bin" >/dev/null 2>&1 || { echo 'Arc Foundry forge not found.' >&2; exit 1; }
command -v "$cast_bin" >/dev/null 2>&1 || { echo 'Arc Foundry cast not found.' >&2; exit 1; }

actual_chain_id="$($cast_bin chain-id --rpc-url "$rpc")"
if [ "$actual_chain_id" != "$expected_chain_id" ]; then
  echo "Chain ID mismatch: expected $expected_chain_id, received $actual_chain_id. Deployment stopped." >&2
  exit 1
fi

echo "Network: Arc $network (chain ID $actual_chain_id)"
echo "RPC: $rpc"
echo 'Contract: src/ArcPayProof.sol:ArcPayProof'
echo 'The signing wallet needs native USDC for deployment gas.'
if [ "$network" = mainnet ]; then
  echo 'This will spend real USDC. Inspect the network and wallet prompt before signing.'
  printf 'Type DEPLOY MAINNET to continue: '
  read -r confirmation
  if [ "$confirmation" != 'DEPLOY MAINNET' ]; then
    echo 'Cancelled.'
    exit 1
  fi
fi

"$forge_bin" create src/ArcPayProof.sol:ArcPayProof \
  --rpc-url "$rpc" \
  --interactive \
  --broadcast
