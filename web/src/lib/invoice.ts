import { formatUnits, keccak256, parseUnits, toBytes } from 'viem'

const amountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/
const idPattern = /^[1-9]\d*$/

export function parseUsdcAmount(input: string): bigint {
  const value = input.trim()
  if (!amountPattern.test(value)) {
    throw new Error('Enter a positive USDC amount with up to two decimal places.')
  }
  const amount = parseUnits(value, 18)
  if (amount <= 0n) throw new Error('The amount must be greater than zero.')
  return amount
}

export function formatUsdcAmount(amount: bigint): string {
  return formatUnits(amount, 18).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

export function hashDescription(description: string): `0x${string}` {
  const byteLength = new TextEncoder().encode(description).length
  if (description.trim().length === 0 || byteLength > 120) {
    throw new Error('The description must be 1–120 UTF-8 bytes and contain visible text.')
  }
  return keccak256(toBytes(description))
}

export function parseInvoiceId(raw: string | null): bigint | null {
  return raw && idPattern.test(raw) ? BigInt(raw) : null
}

export function invoiceLink(invoiceId: bigint, description: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('id', invoiceId.toString())
  url.searchParams.set('memo', description)
  return url.toString()
}

