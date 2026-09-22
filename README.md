# Arc PayProof

Arc PayProof is an open-source proof of concept for one-time USDC invoices on Arc. A seller creates an invoice, shares its link, and receives a direct payout when the buyer pays. The invoice status and payment receipt can be verified onchain.

**Status:** Contract and web app are under local development. No public testnet or mainnet deployment has been claimed yet.

## How it works

1. Connect an EVM browser wallet on Arc and create an invoice with a public description and USDC amount.
2. Share the generated link. The link carries the description; the contract stores its hash, payee and exact amount.
3. A buyer opens the link, verifies the details and pays with native USDC. The contract forwards the amount to the payee in the same transaction.
4. The app reads the paid state and the indexed `InvoicePaid` event from Arc. Each invoice can be paid once.

The app has no account database or custody service. The contract has no admin withdrawal function. The recipient must still be able to receive Arc native USDC, and both parties need USDC for gas.

## Project layout

- `contracts/src/ArcPayProof.sol`: onchain invoice and payment logic
- `contracts/test/ArcPayProof.t.sol`: Arc Foundry contract tests
- `web/`: React, TypeScript and Vite app
- `scripts/sync-abi.mjs`: regenerates the frontend ABI and local deployment bytecode from the compiled contract
- `web/deploy.html`: local-only, MetaMask-signed Arc Testnet deployment page
- `contracts/script/deploy.sh`: advanced interactive command-line deployment fallback
- `DEPLOYMENT.md`: wallet, validation, publication and submission checklist
- `docs/superpowers/`: project design and implementation plan

## Run locally

Install [Arc Foundry](https://docs.arc.io/arc/tutorials/deploy-on-arc) and run the contract tests from `contracts/`:

```sh
arc-forge test --network arc
```

Then install web dependencies and start the frontend from `web/`:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`. For a testnet deployment without exporting a private key, open `/deploy.html` on the local URL printed by Vite in the Chrome or Edge profile where MetaMask is installed. The deployment page is deliberately absent from the production build.

Set `VITE_ARC_NETWORK` to `testnet` or `mainnet` and set `VITE_CONTRACT_ADDRESS` to a deployed contract on that network. The frontend requires an injected browser wallet such as MetaMask or Rabby for transactions. A visitor can inspect an existing invoice without connecting a wallet.

After changing the Solidity contract, compile and regenerate the ABI and deployment bytecode:

```sh
cd contracts
arc-forge build --network arc
cd ..
node scripts/sync-abi.mjs
```

For a local two-account contract integration check, start `arc-anvil --network arc` on port 8545 and run `node scripts/local-integration.mjs` from `web/`. This uses only the unlocked local Anvil accounts and never touches mainnet.

## Deployments

Deployment addresses and a public example invoice will be added after testnet and mainnet verification. Arc network parameters must be checked against the [official Arc connection guide](https://docs.arc.io/arc/references/connect-to-arc) before deployment.

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for the step-by-step release checklist.

The GitHub Pages workflow is prepared but deliberately refuses to publish until the repository variable `ARC_MAINNET_CONTRACT_ADDRESS` points to an address with code on Arc Mainnet. Enable GitHub Pages with the GitHub Actions source after the mainnet deployment is verified.

## Security and limits

This is a small hackathon proof of concept, not an audited financial product. Only small demo amounts should be used until the contract has received an independent review. A failed payout reverts the whole payment. Descriptions in shared URLs are public and cannot be recovered from the onchain hash if the link is lost. The app currently supports only a single full payment per invoice and does not support refunds, expiry, partial payments or disputes.

Never commit a private key, seed phrase or a funded wallet keystore. The repo ignores `.env` files and local tool binaries.

## References

- [Arc Microgrants rules](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq)
- [Arc network configuration](https://docs.arc.io/arc/references/connect-to-arc)
- [Arc native USDC and EVM differences](https://docs.arc.io/arc/references/evm-differences)
