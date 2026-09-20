import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEventLogs,
  toBytes,
} from 'viem'
import { foundry } from 'viem/chains'

const rpc = 'http://127.0.0.1:8545'
const artifact = JSON.parse(readFileSync(resolve('../contracts/out/ArcPayProof.sol/ArcPayProof.json'), 'utf8'))
const publicClient = createPublicClient({ chain: foundry, transport: http(rpc) })
const accounts = await publicClient.request({ method: 'eth_accounts' })
if (accounts.length < 2) throw new Error('Arc Anvil needs two unlocked accounts.')

const [seller, buyer] = accounts
const sellerClient = createWalletClient({ account: seller, chain: foundry, transport: http(rpc) })
const buyerClient = createWalletClient({ account: buyer, chain: foundry, transport: http(rpc) })

const deploymentHash = await sellerClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
})
const deployment = await publicClient.waitForTransactionReceipt({ hash: deploymentHash })
if (deployment.status !== 'success' || !deployment.contractAddress) throw new Error('Local deployment failed.')
const contractAddress = deployment.contractAddress

const amount = 10n ** 16n // 0.01 native USDC
const descriptionHash = keccak256(toBytes('Local integration invoice'))
const createHash = await sellerClient.writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: 'createInvoice',
  args: [amount, descriptionHash],
})
const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash })
if (createReceipt.status !== 'success') throw new Error('Local invoice creation failed.')
const created = parseEventLogs({ abi: artifact.abi, eventName: 'InvoiceCreated', logs: createReceipt.logs })[0]
if (!created) throw new Error('InvoiceCreated event was not found.')
const invoiceId = created.args.invoiceId

const sellerBefore = await publicClient.getBalance({ address: seller })
const payHash = await buyerClient.writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: 'payInvoice',
  args: [invoiceId],
  value: amount,
})
const payReceipt = await publicClient.waitForTransactionReceipt({ hash: payHash })
if (payReceipt.status !== 'success') throw new Error('Local invoice payment failed.')

const invoice = await publicClient.readContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: 'getInvoice',
  args: [invoiceId],
})
const sellerAfter = await publicClient.getBalance({ address: seller })
const contractBalance = await publicClient.getBalance({ address: contractAddress })
const paidEvents = await publicClient.getContractEvents({
  address: contractAddress,
  abi: artifact.abi,
  eventName: 'InvoicePaid',
  args: { invoiceId },
  fromBlock: invoice.paidBlock,
  toBlock: invoice.paidBlock,
})

if (invoice.status !== 2) throw new Error('Invoice did not become paid.')
if (invoice.payer.toLowerCase() !== buyer.toLowerCase()) throw new Error('Wrong payer recorded.')
if (sellerAfter - sellerBefore !== amount) throw new Error('Seller did not receive the exact amount.')
if (contractBalance !== 0n) throw new Error('Contract retained payment funds.')
if (paidEvents[0]?.transactionHash !== payHash) throw new Error('Payment receipt was not recoverable.')

console.log(`Local Arc flow passed: contract ${contractAddress}, invoice ${invoiceId}, payment ${payHash}`)
