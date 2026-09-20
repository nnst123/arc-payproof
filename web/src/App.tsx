import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { parseEventLogs, type Address, type Hash } from 'viem'
import { useConnect, useConnection, useDisconnect, useSwitchChain, useWriteContract } from 'wagmi'
import { arcPayProofAbi } from './contract/abi'
import { formatUsdcAmount, hashDescription, invoiceLink, parseInvoiceId, parseUsdcAmount } from './lib/invoice'
import { contractAddress, explorerUrl, networkLabel, publicClient, targetChain } from './lib/network'

type InvoiceView = {
  payee: Address
  amount: bigint
  descriptionHash: Hash
  status: number
  payer: Address
  paidBlock: bigint
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function readableError(error: unknown) {
  if (error instanceof Error) {
    const message = 'shortMessage' in error && typeof error.shortMessage === 'string'
      ? error.shortMessage
      : error.message
    if (/user rejected|user denied|rejected the request/i.test(message)) return 'The wallet request was cancelled.'
    return message.length > 260 ? `${message.slice(0, 260)}…` : message
  }
  return 'Something went wrong. Please refresh the onchain state and try again.'
}

function WalletControl() {
  const connection = useConnection()
  const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain()
  const injectedConnector = connectors[0]

  if (!connection.isConnected) {
    return (
      <div className="wallet-wrap">
        <button
          className="button button-secondary"
          disabled={!injectedConnector || isConnecting}
          onClick={() => injectedConnector && connect({ connector: injectedConnector })}
        >
          {isConnecting ? 'Connecting…' : 'Connect wallet'}
        </button>
        {!injectedConnector && <span className="wallet-note">Install a browser wallet to transact.</span>}
        {connectError && <span className="wallet-note error">{readableError(connectError)}</span>}
      </div>
    )
  }

  return (
    <div className="wallet-wrap">
      {connection.chainId !== targetChain.id && (
        <button
          className="button button-warning"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: targetChain.id })}
        >
          {isSwitching ? 'Switching…' : `Switch to ${networkLabel}`}
        </button>
      )}
      <button className="wallet-pill" onClick={() => disconnect()} title="Disconnect wallet">
        <span className="wallet-dot" />{shortAddress(connection.address ?? '')}
      </button>
      {switchError && <span className="wallet-note error">{readableError(switchError)}</span>}
    </div>
  )
}

function CreateInvoice() {
  const connection = useConnection()
  const { writeContractAsync } = useWriteContract()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  const [transactionHash, setTransactionHash] = useState<Hash | null>(null)
  const [shareLink, setShareLink] = useState('')
  const [copyLabel, setCopyLabel] = useState('Copy link')
  const walletReady = connection.isConnected && connection.chainId === targetChain.id

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setShareLink('')
    setTransactionHash(null)

    if (!walletReady || !contractAddress) {
      setError(`Connect a wallet on ${networkLabel} before creating an invoice.`)
      return
    }
    const activeContract = contractAddress

    try {
      const parsedAmount = parseUsdcAmount(amount)
      const descriptionHash = hashDescription(description)
      setPhase('wallet')
      const hash = await writeContractAsync({
        address: activeContract,
        abi: arcPayProofAbi,
        functionName: 'createInvoice',
        args: [parsedAmount, descriptionHash],
        chainId: targetChain.id,
      })
      setTransactionHash(hash)
      setPhase('confirming')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('The transaction reverted onchain.')

      const events = parseEventLogs({
        abi: arcPayProofAbi,
        eventName: 'InvoiceCreated',
        logs: receipt.logs,
      })
      const created = events.find((item) => item.address.toLowerCase() === activeContract.toLowerCase())
      if (!created) throw new Error('The transaction succeeded, but the invoice event was not found. Check the transaction in the explorer.')

      setShareLink(invoiceLink(created.args.invoiceId, description))
      setPhase('done')
    } catch (cause) {
      setError(readableError(cause))
      setPhase('idle')
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopyLabel('Copied')
    } catch {
      setCopyLabel('Select and copy the link')
    }
  }

  return (
    <section className="work-panel" aria-labelledby="create-heading">
      <div className="section-heading">
        <span className="eyebrow">01 / CREATE</span>
        <h2 id="create-heading">Request a payment</h2>
        <p>Create a one-time USDC invoice. The amount and recipient are fixed onchain.</p>
      </div>

      <form onSubmit={submit} className="invoice-form">
        <label htmlFor="description">What is this payment for?</label>
        <input
          id="description"
          type="text"
          placeholder="e.g. Design prototype"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={120}
          required
        />
        <p className="field-help">This text is public to anyone with the link. Keep it short and non-sensitive.</p>

        <label htmlFor="amount">Amount in USDC</label>
        <div className="amount-input">
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          <span>USDC</span>
        </div>
        <p className="field-help">Minimum 0.01 USDC. Creating the invoice also uses a small amount of USDC for gas.</p>

        <button className="button button-primary button-wide" disabled={!walletReady || phase === 'wallet' || phase === 'confirming'}>
          {phase === 'wallet' ? 'Confirm in wallet…' : phase === 'confirming' ? 'Waiting for Arc…' : 'Create invoice'}
          <span aria-hidden="true">↗</span>
        </button>
        {!walletReady && <p className="form-message">Connect your wallet on {networkLabel} to continue.</p>}
        {error && <p className="form-message error" role="alert">{error}</p>}
        {transactionHash && explorerUrl && (
          <a className="text-link" href={`${explorerUrl}/tx/${transactionHash}`} target="_blank" rel="noreferrer">
            View creation transaction ↗
          </a>
        )}
      </form>

      {shareLink && (
        <div className="result-card" role="status">
          <span className="result-icon">✓</span>
          <div>
            <h3>Invoice is live</h3>
            <p>Send this link to the person who will pay.</p>
          </div>
          <input aria-label="Shareable invoice link" readOnly value={shareLink} onFocus={(event) => event.target.select()} />
          <div className="result-actions">
            <button className="button button-secondary" onClick={copyLink}>{copyLabel}</button>
            <a className="button button-ghost" href={shareLink}>Open invoice →</a>
          </div>
        </div>
      )}
    </section>
  )
}

function InvoiceDetail({ invoiceId, description }: { invoiceId: bigint; description: string | null }) {
  const connection = useConnection()
  const { writeContractAsync } = useWriteContract()
  const [invoice, setInvoice] = useState<InvoiceView | null>(null)
  const [paidHash, setPaidHash] = useState<Hash | null>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  const [transactionHash, setTransactionHash] = useState<Hash | null>(null)
  const walletReady = connection.isConnected && connection.chainId === targetChain.id

  const refresh = useCallback(async () => {
    if (!contractAddress) return
    setLoading(true)
    setError('')
    try {
      const nextInvoice = await publicClient.readContract({
        address: contractAddress,
        abi: arcPayProofAbi,
        functionName: 'getInvoice',
        args: [invoiceId],
      })
      setInvoice(nextInvoice as InvoiceView)
      setPaidHash(null)

      if (nextInvoice.status === 2 && nextInvoice.paidBlock > 0n) {
        try {
          const paidEvents = await publicClient.getContractEvents({
            address: contractAddress,
            abi: arcPayProofAbi,
            eventName: 'InvoicePaid',
            args: { invoiceId },
            fromBlock: nextInvoice.paidBlock,
            toBlock: nextInvoice.paidBlock,
          })
          setPaidHash(paidEvents[0]?.transactionHash ?? null)
        } catch {
          // The invoice state is still authoritative when an RPC cannot serve event logs.
        }
      }
    } catch (cause) {
      setError(readableError(cause))
      setInvoice(null)
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function pay() {
    if (!invoice || !contractAddress || !walletReady) return
    setError('')
    setTransactionHash(null)
    try {
      setPhase('wallet')
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: arcPayProofAbi,
        functionName: 'payInvoice',
        args: [invoiceId],
        value: invoice.amount,
        chainId: targetChain.id,
      })
      setTransactionHash(hash)
      setPhase('confirming')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('The payment reverted onchain. No invoice payment was made.')
      await refresh()
      setPhase('done')
    } catch (cause) {
      setError(readableError(cause))
      setPhase('idle')
    }
  }

  const memoValid = invoice && description !== null && (() => {
    try {
      return hashDescription(description).toLowerCase() === invoice.descriptionHash.toLowerCase()
    } catch {
      return false
    }
  })()
  const isPaid = invoice?.status === 2
  const canPay = Boolean(invoice && invoice.status === 1 && memoValid && walletReady && phase !== 'wallet' && phase !== 'confirming')

  return (
    <section className="work-panel" aria-labelledby="invoice-heading">
      <div className="section-heading">
        <span className="eyebrow">02 / VERIFY & PAY</span>
        <h2 id="invoice-heading">Invoice #{invoiceId.toString()}</h2>
        <p>The recipient, amount and payment status come directly from Arc.</p>
      </div>

      {loading && <div className="loading-card">Reading the invoice from {networkLabel}…</div>}
      {!loading && error && <div className="alert error" role="alert">{error}</div>}

      {!loading && invoice && (
        <div className="invoice-card">
          <div className="invoice-topline">
            <span className="invoice-number">PAYPROOF / {invoiceId.toString()}</span>
            <span className={`status-badge ${isPaid ? 'status-paid' : 'status-open'}`}>{isPaid ? 'PAID' : 'AWAITING PAYMENT'}</span>
          </div>

          <div className="invoice-amount"><span>$</span>{formatUsdcAmount(invoice.amount)}<small>USDC</small></div>
          <div className="invoice-divider" />

          <div className="invoice-row">
            <span>Pay to</span>
            <strong title={invoice.payee}>{invoice.payee}</strong>
          </div>
          <div className="invoice-row">
            <span>Purpose</span>
            <strong>{memoValid ? description : 'Description unavailable or changed'}</strong>
          </div>
          <div className="invoice-row">
            <span>Network</span>
            <strong>{networkLabel}</strong>
          </div>
          {isPaid && (
            <div className="invoice-row">
              <span>Paid by</span>
              <strong title={invoice.payer}>{invoice.payer}</strong>
            </div>
          )}

          {!memoValid && !isPaid && (
            <div className="alert warning">The description in this link does not match the onchain invoice. Ask the sender for the original link before paying.</div>
          )}

          {isPaid ? (
            <div className="paid-panel">
              <span className="result-icon">✓</span>
              <div>
                <h3>Payment verified on Arc</h3>
                <p>This invoice can only be paid once.</p>
                {paidHash && explorerUrl && <a className="text-link" href={`${explorerUrl}/tx/${paidHash}`} target="_blank" rel="noreferrer">View payment transaction ↗</a>}
                {!paidHash && <p className="field-help">Transaction link temporarily unavailable. Refresh the onchain state to retry.</p>}
              </div>
            </div>
          ) : (
            <>
              <button className="button button-primary button-wide" disabled={!canPay} onClick={pay}>
                {phase === 'wallet' ? 'Confirm in wallet…' : phase === 'confirming' ? 'Waiting for Arc…' : `Pay ${formatUsdcAmount(invoice.amount)} USDC`}
                <span aria-hidden="true">↗</span>
              </button>
              {!walletReady && <p className="form-message">Connect a wallet on {networkLabel} to pay. Your wallet also needs USDC for gas.</p>}
            </>
          )}
          {transactionHash && explorerUrl && <a className="text-link" href={`${explorerUrl}/tx/${transactionHash}`} target="_blank" rel="noreferrer">View submitted transaction ↗</a>}
          {error && <p className="form-message error" role="alert">{error}</p>}
          <button className="refresh-button" onClick={() => void refresh()} disabled={loading}>↻ Refresh onchain status</button>
        </div>
      )}
      <a className="back-link" href={window.location.pathname}>← Create another invoice</a>
    </section>
  )
}

function App() {
  const params = new URLSearchParams(window.location.search)
  const rawId = params.get('id')
  const invoiceId = parseInvoiceId(rawId)
  const description = params.get('memo')

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href={window.location.pathname} aria-label="Arc PayProof home">
          <span className="brand-mark"><span /></span>
          <span>Arc <strong>PayProof</strong></span>
        </a>
        <div className="header-actions">
          <span className="network-pill"><span />{networkLabel}</span>
          <WalletControl />
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-kicker"><span className="sparkle">✦</span> ONE-TIME USDC INVOICES ON ARC</span>
            <h1>Pay once.<br /><em>Prove forever.</em></h1>
            <p>Create a payment request, share a link, and verify settlement directly on Arc. No account. No waiting for a middleman.</p>
            <div className="hero-traits">
              <span><i />Onchain proof</span>
              <span><i />Direct payout</span>
              <span><i />USDC native</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="art-card art-card-back"><span>PAYMENT REQUEST</span><b>01</b></div>
            <div className="art-card art-card-front"><span>SETTLED ON ARC</span><strong>✓</strong><small>VERIFIED · ONE-TIME</small></div>
            <div className="art-glow" />
          </div>
        </section>

        <section className="app-layout">
          <aside className="steps-panel">
            <span className="eyebrow">HOW IT WORKS</span>
            <div className="step"><span>01</span><div><h3>Create an invoice</h3><p>Lock the recipient and USDC amount on Arc.</p></div></div>
            <div className="step"><span>02</span><div><h3>Share the link</h3><p>Anyone can inspect it before connecting a wallet.</p></div></div>
            <div className="step"><span>03</span><div><h3>Get paid directly</h3><p>One transaction settles the invoice and leaves a public proof.</p></div></div>
            <div className="steps-footer">Built for Arc Microgrants <span>↗</span></div>
          </aside>

          {!contractAddress ? (
            <section className="work-panel"><span className="eyebrow">SETUP</span><h2>Contract not configured</h2><p>Set a deployed Arc PayProof contract address in <code>VITE_CONTRACT_ADDRESS</code> to enable the app.</p></section>
          ) : rawId && !invoiceId ? (
            <section className="work-panel"><span className="eyebrow">INVALID LINK</span><h2>Invoice link not found</h2><p>The invoice ID must be a positive whole number.</p><a className="back-link" href={window.location.pathname}>← Create an invoice</a></section>
          ) : invoiceId ? (
            <InvoiceDetail invoiceId={invoiceId} description={description} />
          ) : (
            <CreateInvoice />
          )}
        </section>

        <section className="trust-strip">
          <div><span>01</span><strong>Non-custodial</strong><p>Payments move to the recipient in the same transaction.</p></div>
          <div><span>02</span><strong>Verifiable</strong><p>Invoice state and payment proof live on Arc.</p></div>
          <div><span>03</span><strong>Simple</strong><p>One invoice. One payment. A permanent receipt.</p></div>
        </section>
      </main>

      <footer className="site-footer"><span>Arc PayProof · An open-source proof of concept</span><a href="https://docs.arc.io/" target="_blank" rel="noreferrer">Built on Arc ↗</a></footer>
    </div>
  )
}

export default App
