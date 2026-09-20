import { describe, expect, it } from 'vitest'
import { formatUsdcAmount, hashDescription, parseInvoiceId, parseUsdcAmount } from './invoice'

describe('invoice inputs', () => {
  it('converts a two-decimal USDC amount to native 18-decimal units', () => {
    expect(parseUsdcAmount('0.01')).toBe(10n ** 16n)
    expect(formatUsdcAmount(123n * 10n ** 16n)).toBe('1.23')
  })

  it('rejects invalid amounts before a wallet transaction', () => {
    for (const input of ['0', '-1', '1.001', '1e3', 'abc']) {
      expect(() => parseUsdcAmount(input)).toThrow()
    }
  })

  it('hashes the exact description and rejects empty or oversized text', () => {
    expect(hashDescription('Invoice')).not.toBe(hashDescription('invoice'))
    expect(() => hashDescription('   ')).toThrow()
    expect(() => hashDescription('中'.repeat(41))).toThrow()
  })

  it('accepts only positive integer invoice IDs', () => {
    expect(parseInvoiceId('12')).toBe(12n)
    expect(parseInvoiceId('0')).toBeNull()
    expect(parseInvoiceId('1x')).toBeNull()
  })
})
