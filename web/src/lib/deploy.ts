import { formatUnits, isAddress, type Address, type Hash } from 'viem'

const displayQuantum = 10n ** 10n // 0.00000001 native USDC

export function gasReserve(gas: bigint, maxFeePerGas: bigint): bigint {
  if (gas <= 0n || maxFeePerGas <= 0n) throw new Error('Invalid gas estimate.')
  return (gas * maxFeePerGas * 12n + 9n) / 10n // 20% headroom, rounded up
}

export function displayUsdc(value: bigint, roundUp = false): string {
  const adjusted = roundUp ? (value + displayQuantum - 1n) / displayQuantum : value / displayQuantum
  return formatUnits(adjusted, 8)
}

export function deploymentStorageKey(address: Address): string {
  if (!isAddress(address)) throw new Error('Invalid wallet address.')
  return `arc-payproof:testnet-deployment:${address.toLowerCase()}`
}

export function isTransactionHash(value: string | null): value is Hash {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}
