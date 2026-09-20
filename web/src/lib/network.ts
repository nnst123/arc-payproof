import { createPublicClient, http, isAddress, zeroAddress, type Address } from 'viem'
import { arc, arcTestnet, foundry } from 'viem/chains'
import { createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'

const isMainnet = import.meta.env.VITE_ARC_NETWORK === 'mainnet'
const isLocal = import.meta.env.VITE_ARC_NETWORK === 'local'

export const targetChain = isLocal ? foundry : isMainnet ? arc : arcTestnet
export const networkLabel = isLocal ? 'Local Arc' : isMainnet ? 'Arc Mainnet' : 'Arc Testnet'
export const explorerUrl = isLocal ? null : isMainnet ? 'https://explorer.arc.io' : 'https://explorer.testnet.arc.io'
export const rpcUrl = isLocal ? 'http://127.0.0.1:8545' : isMainnet ? 'https://rpc.mainnet.arc.io' : 'https://rpc.testnet.arc.io'

const configuredAddress = import.meta.env.VITE_CONTRACT_ADDRESS ?? ''
export const contractAddress: Address | null =
  isAddress(configuredAddress) && configuredAddress.toLowerCase() !== zeroAddress
    ? (configuredAddress as Address)
    : null

export const publicClient = createPublicClient({
  chain: targetChain,
  transport: http(rpcUrl),
})

export const wagmiConfig = createConfig({
  chains: [arc, arcTestnet, foundry],
  connectors: [injected()],
  transports: {
    [arc.id]: http('https://rpc.mainnet.arc.io'),
    [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
    [foundry.id]: http('http://127.0.0.1:8545'),
  },
})
