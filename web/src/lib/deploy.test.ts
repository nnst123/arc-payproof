import { describe, expect, it } from 'vitest'
import { deploymentStorageKey, displayUsdc, gasReserve, isTransactionHash } from './deploy'

describe('testnet deployment helpers', () => {
  it('reserves 20% above estimated gas cost', () => {
    expect(gasReserve(100n, 10n)).toBe(1200n)
    expect(() => gasReserve(0n, 10n)).toThrow()
  })

  it('rounds displayed cost up but never rounds balance up', () => {
    expect(displayUsdc(1n)).toBe('0')
    expect(displayUsdc(1n, true)).toBe('0.00000001')
    expect(displayUsdc(10n ** 16n)).toBe('0.01')
  })

  it('uses an address-scoped key and validates transaction hashes', () => {
    expect(deploymentStorageKey('0x0000000000000000000000000000000000000001')).toBe('arc-payproof:testnet-deployment:0x0000000000000000000000000000000000000001')
    expect(isTransactionHash(`0x${'a'.repeat(64)}`)).toBe(true)
    expect(isTransactionHash('0x1234')).toBe(false)
  })
})
