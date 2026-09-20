import { createPublicClient, http, isAddress, zeroAddress } from 'viem'
import { arc } from 'viem/chains'

const network = process.env.VITE_ARC_NETWORK
const address = process.env.VITE_CONTRACT_ADDRESS ?? ''

if (network !== 'mainnet') {
  throw new Error('A public release must set VITE_ARC_NETWORK=mainnet.')
}
if (!isAddress(address) || address.toLowerCase() === zeroAddress) {
  throw new Error('A public release needs a deployed mainnet VITE_CONTRACT_ADDRESS.')
}

const client = createPublicClient({ chain: arc, transport: http('https://rpc.mainnet.arc.io') })
const chainId = await client.getChainId()
if (chainId !== arc.id) {
  throw new Error(`Arc Mainnet RPC returned unexpected chain ID ${chainId}.`)
}
const code = await client.getCode({ address })
if (!code || code === '0x') {
  throw new Error(`No contract code exists at ${address} on Arc Mainnet.`)
}

console.log(`Release configuration: Arc Mainnet contract ${address}; ${code.length / 2 - 1} runtime bytes found.`)
