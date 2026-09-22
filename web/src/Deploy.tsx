import { useEffect, useState } from 'react'
import { createPublicClient, http, type Address, type Hash } from 'viem'
import { arcTestnet } from 'viem/chains'
import { useConnect, useConnection, useDeployContract, useSwitchChain } from 'wagmi'
import { arcPayProofAbi } from './contract/abi'
import { arcPayProofBytecode } from './contract/deployment'
import { deploymentStorageKey, displayUsdc, gasReserve, isTransactionHash } from './lib/deploy'

const client = createPublicClient({ chain: arcTestnet, transport: http('https://rpc.testnet.arc.io') })
const explorer = 'https://explorer.testnet.arc.io'

type Phase = 'idle' | 'wallet' | 'verifying' | 'success' | 'unverified' | 'failed'

function readableError(cause: unknown): string {
  if (cause instanceof Error) {
    const message = 'shortMessage' in cause && typeof cause.shortMessage === 'string'
      ? cause.shortMessage
      : cause.message
    if (/user rejected|user denied|rejected the request/i.test(message)) return 'The wallet request was cancelled. No deployment was sent.'
    return message.length > 260 ? `${message.slice(0, 260)}…` : message
  }
  return 'The request failed. Check the wallet and Arc Testnet, then try again.'
}

function Deploy() {
  const connection = useConnection()
  const { connect, connectors, isPending: connecting, error: connectError } = useConnect()
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain()
  const { deployContractAsync } = useDeployContract()
  const [balance, setBalance] = useState<bigint | null>(null)
  const [reserve, setReserve] = useState<bigint | null>(null)
  const [checking, setChecking] = useState(false)
  const [readinessError, setReadinessError] = useState('')
  const [refreshCount, setRefreshCount] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [hash, setHash] = useState<Hash | null>(null)
  const [deployedAddress, setDeployedAddress] = useState<Address | null>(null)
  const [receiptRetry, setReceiptRetry] = useState(0)
  const [copyLabel, setCopyLabel] = useState('Copy address')

  const address = connection.address
  const onTestnet = connection.isConnected && connection.chainId === arcTestnet.id
  const hasInjectedWallet = typeof window !== 'undefined' && 'ethereum' in window
  const canDeploy = Boolean(onTestnet && address && !checking && reserve !== null && balance !== null && balance >= reserve && !hash && phase === 'idle')

  useEffect(() => {
    setBalance(null)
    setReserve(null)
    setReadinessError('')
    if (!address || !onTestnet) return
    let cancelled = false

    async function check() {
      setChecking(true)
      try {
        const nextBalance = await client.getBalance({ address: address! })
        if (cancelled) return
        setBalance(nextBalance)
        if (nextBalance === 0n) return

        const [gas, fees] = await Promise.all([
          client.estimateGas({ account: address!, data: arcPayProofBytecode }),
          client.estimateFeesPerGas(),
        ])
        if (!cancelled) setReserve(gasReserve(gas, fees.maxFeePerGas))
      } catch (cause) {
        if (!cancelled) setReadinessError(readableError(cause))
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    void check()
    return () => { cancelled = true }
  }, [address, onTestnet, refreshCount])

  useEffect(() => {
    setHash(null)
    setDeployedAddress(null)
    setError('')
    setPhase('idle')
    if (!address) return
    try {
      const saved = localStorage.getItem(deploymentStorageKey(address))
      if (isTransactionHash(saved)) setHash(saved)
    } catch {
      // Private browsing may block localStorage; new deployments still work.
    }
  }, [address])

  useEffect(() => {
    if (!hash) return
    let cancelled = false
    setPhase('verifying')
    setError('')

    async function verify() {
      try {
        const receipt = await client.waitForTransactionReceipt({ hash: hash!, timeout: 30_000 })
        if (cancelled) return
        if (receipt.status !== 'success') {
          setPhase('failed')
          setError('The deployment transaction reverted. Inspect the transaction before trying again.')
          return
        }
        if (!receipt.contractAddress) throw new Error('Transaction succeeded, but no contract address was returned.')
        const code = await client.getCode({ address: receipt.contractAddress })
        if (!code || code === '0x') throw new Error('No contract code was found at the deployed address.')
        const nextInvoiceId = await client.readContract({
          address: receipt.contractAddress,
          abi: arcPayProofAbi,
          functionName: 'nextInvoiceId',
        })
        if (nextInvoiceId !== 1n) throw new Error('The deployed contract did not pass its first read check.')
        if (!cancelled) {
          setDeployedAddress(receipt.contractAddress)
          setPhase('success')
        }
      } catch (cause) {
        if (!cancelled) {
          setError(`${readableError(cause)} The transaction hash is saved; refresh its status before sending anything else.`)
          setPhase('unverified')
        }
      }
    }

    void verify()
    return () => { cancelled = true }
  }, [hash, receiptRetry])

  async function deploy() {
    if (!canDeploy || !address || !connection.connector) return
    const activeAddress = address
    setError('')
    setPhase('wallet')
    try {
      const [chainId, accounts] = await Promise.all([
        connection.connector.getChainId(),
        connection.connector.getAccounts(),
      ])
      if (chainId !== arcTestnet.id) throw new Error('MetaMask is not on Arc Testnet. Switch networks and refresh.')
      if (!accounts.some((account) => account.toLowerCase() === activeAddress.toLowerCase())) {
        throw new Error('The selected MetaMask account changed. Refresh the page before deploying.')
      }
      const [currentBalance, gas, fees] = await Promise.all([
        client.getBalance({ address: activeAddress }),
        client.estimateGas({ account: activeAddress, data: arcPayProofBytecode }),
        client.estimateFeesPerGas(),
      ])
      if (currentBalance < gasReserve(gas, fees.maxFeePerGas)) {
        throw new Error('Not enough Arc Testnet USDC to cover the estimated deployment fee.')
      }

      const transactionHash = await deployContractAsync({
        abi: arcPayProofAbi,
        bytecode: arcPayProofBytecode,
        account: activeAddress,
        chainId: arcTestnet.id,
        value: 0n,
      })
      try { localStorage.setItem(deploymentStorageKey(activeAddress), transactionHash) } catch { /* Optional recovery only. */ }
      setHash(transactionHash)
    } catch (cause) {
      setError(readableError(cause))
      setPhase('idle')
    }
  }

  async function copyAddress() {
    if (!deployedAddress) return
    try {
      await navigator.clipboard.writeText(deployedAddress)
      setCopyLabel('Copied')
    } catch {
      setCopyLabel('Select the address above to copy')
    }
  }

  function forgetFailed() {
    if (!address || phase !== 'failed') return
    try { localStorage.removeItem(deploymentStorageKey(address)) } catch { /* Storage may be disabled. */ }
    setHash(null)
    setError('')
    setPhase('idle')
    setRefreshCount((count) => count + 1)
  }

  return (
    <div className="site-shell deploy-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Arc PayProof home"><span className="brand-mark"><span /></span><span>Arc <strong>PayProof</strong></span></a>
        <span className="network-pill"><span />LOCAL TOOL · ARC TESTNET ONLY</span>
      </header>
      <main>
        <div className="deploy-intro">
          <span className="eyebrow">SAFE DEPLOYMENT / 01</span>
          <h1>Deploy with your wallet.</h1>
          <p>This page runs only on your local development server. It never asks for a seed phrase or private key. MetaMask will show the final transaction for your approval.</p>
        </div>
        <div className="app-layout">
          <aside className="steps-panel">
            <span className="eyebrow">BEFORE YOU DEPLOY</span>
            <div className="step"><span>01</span><div><h3>Use Arc Testnet</h3><p>Chain ID 5042002. No mainnet funds are used here.</p></div></div>
            <div className="step"><span>02</span><div><h3>Get test USDC</h3><p>The deployment wallet needs native test USDC for gas.</p></div></div>
            <div className="step"><span>03</span><div><h3>Confirm in MetaMask</h3><p>One click requests a deployment. Your wallet makes the final decision.</p></div></div>
            <div className="steps-footer">Local deployment utility <span>↗</span></div>
          </aside>
          <section className="work-panel deploy-panel" aria-labelledby="deploy-heading">
            <div className="section-heading">
              <span className="eyebrow">ARC TESTNET / CONTRACT DEPLOYMENT</span>
              <h2 id="deploy-heading">Arc PayProof contract</h2>
              <p>Verify the wallet, network and fee estimate before signing. The transaction sends no invoice payment.</p>
            </div>

            {!hasInjectedWallet && <div className="alert warning">Open this page in the Chrome or Edge profile where MetaMask is installed.</div>}
            <div className="deploy-facts">
              <div className="invoice-row"><span>Target network</span><strong>Arc Testnet · 5042002</strong></div>
              <div className="invoice-row"><span>Wallet</span><strong>{address ?? 'Not connected'}</strong></div>
              <div className="invoice-row"><span>Wallet network</span><strong>{connection.isConnected ? (onTestnet ? 'Arc Testnet ✓' : `Different chain · ${connection.chainId ?? 'unknown'}`) : 'Not connected'}</strong></div>
              <div className="invoice-row"><span>Test USDC balance</span><strong>{balance === null ? '—' : `${displayUsdc(balance)} USDC`}</strong></div>
              <div className="invoice-row"><span>Estimated fee reserve</span><strong>{reserve === null ? '—' : `~${displayUsdc(reserve, true)} USDC`}</strong></div>
            </div>

            {!connection.isConnected && (
              <button className="button button-secondary button-wide" disabled={!hasInjectedWallet || connecting || !connectors[0]} onClick={() => connect({ connector: connectors[0] })}>
                {connecting ? 'Connecting…' : 'Connect MetaMask'} <span>↗</span>
              </button>
            )}
            {connection.isConnected && !onTestnet && (
              <button className="button button-warning button-wide" disabled={switching} onClick={() => switchChain({ chainId: arcTestnet.id })}>
                {switching ? 'Switching…' : 'Switch to Arc Testnet'} <span>↗</span>
              </button>
            )}
            {onTestnet && !hash && (
              <>
                <button className="button button-primary button-wide" disabled={!canDeploy} onClick={() => void deploy()}>
                  {phase === 'wallet' ? 'Confirm in MetaMask…' : checking ? 'Checking fee…' : 'Deploy to Arc Testnet'} <span>↗</span>
                </button>
                {balance === 0n && <p className="form-message">This wallet has no test USDC. Get it from the <a href="https://faucet.circle.com/" target="_blank" rel="noreferrer">Circle Faucet</a>, then refresh the balance.</p>}
                {balance !== null && reserve !== null && balance < reserve && <p className="form-message error">The balance is below the estimated fee reserve. Fund this wallet before deploying.</p>}
                <button className="refresh-button" onClick={() => setRefreshCount((count) => count + 1)} disabled={checking}>↻ Refresh balance and fee</button>
              </>
            )}

            {hash && (
              <div className="deploy-result" role="status">
                <span className="eyebrow">DEPLOYMENT TRANSACTION</span>
                <p className="deploy-hash">{hash}</p>
                <a className="text-link" href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">View transaction on Arc Testnet ↗</a>
                {phase === 'verifying' && <p className="form-message">Checking the receipt and contract code. Do not send another deployment.</p>}
                {phase === 'unverified' && <button className="refresh-button" onClick={() => setReceiptRetry((count) => count + 1)}>↻ Check this transaction again</button>}
                {phase === 'failed' && <button className="refresh-button" onClick={forgetFailed}>Forget confirmed failed transaction</button>}
                {phase === 'success' && deployedAddress && (
                  <div className="deploy-success">
                    <h3>Contract verified on Arc Testnet</h3>
                    <p className="deploy-hash">{deployedAddress}</p>
                    <div className="deploy-actions">
                      <button className="button button-secondary" onClick={() => void copyAddress()}>{copyLabel}</button>
                      <a className="button button-ghost" href={`${explorer}/address/${deployedAddress}`} target="_blank" rel="noreferrer">View contract ↗</a>
                    </div>
                    <p className="field-help">Keep this public address and transaction hash for the testnet deployment record. Never share your wallet recovery phrase.</p>
                  </div>
                )}
              </div>
            )}
            {readinessError && <p className="form-message error" role="alert">Fee check: {readinessError}</p>}
            {connectError && <p className="form-message error" role="alert">Wallet: {readableError(connectError)}</p>}
            {switchError && <p className="form-message error" role="alert">Network: {readableError(switchError)}</p>}
            {error && <p className="form-message error" role="alert">{error}</p>}
          </section>
        </div>
        <p className="deploy-footer-note">Local testnet utility · Not included in the public GitHub Pages build · No real USDC required</p>
      </main>
    </div>
  )
}

export default Deploy
