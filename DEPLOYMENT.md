# Deployment checklist

The app is not live until a contract is deployed, a public site is published,
and a real mainnet invoice has been created and paid. Never send a private key
or seed phrase to a collaborator, chat, issue, or Git commit.

## 1. Prepare a dedicated wallet

Use a new wallet only for this demo. Keep its recovery phrase offline. Add Arc
Testnet and Arc Mainnet with the values in the [official connection guide](https://docs.arc.io/arc/references/connect-to-arc).
Fund the testnet wallet through the [Circle Faucet](https://faucet.circle.com/)
using **Arc Testnet**. Testnet USDC has no monetary value. Both the invoice
creator and payer need a little native USDC for gas; the payer also needs the
invoice amount. Keep mainnet funding minimal.

## 2. Deploy on testnet

Install the official [Arc Foundry release](https://docs.arc.io/arc/tutorials/deploy-on-arc)
in WSL, with `arc-forge` on your PATH. Compile and test in `contracts/`, then
regenerate the web deployment bytecode from the same artifact:

```sh
arc-forge test --network arc
arc-forge build --network arc
cd ..
node scripts/sync-abi.mjs
```

In `web/`, run `npm ci` and `npm run dev`. Open the local URL printed by Vite,
adding `/deploy.html`, in the Chrome or Edge profile where MetaMask is
installed. For example, if Vite prints `http://127.0.0.1:5173/`, open
`http://127.0.0.1:5173/deploy.html`. The page is **local and testnet-only**;
it does not appear in the public production build.

Connect MetaMask, switch to Arc Testnet, and fund that public wallet address
through the Circle Faucet. Refresh the balance and fee estimate. Click the
deployment button only after checking the wallet address, network and final
fee shown by MetaMask. The wallet signs the transaction without exporting a
private key. If the page times out after receiving a transaction hash, check
that hash before trying anything else; the page can resume receipt checking
after a refresh. Save the verified contract address and transaction hash, check
them in the [Arc Testnet explorer](https://explorer.testnet.arc.io/), then put
the address in `web/.env.local` with `VITE_ARC_NETWORK=testnet` and restart
the web app. The advanced `contracts/script/deploy.sh testnet` command remains
available, but it prompts for a private key and is not the beginner workflow.

Complete a small two-wallet invoice and verify that the recipient balance
increases by the invoice amount, the invoice is marked paid, and the payment
transaction opens from the receipt link. Do not move to mainnet before this
works. If an RPC or wallet action fails, inspect the chain state before
retrying; a transaction may have succeeded even if the page timed out.

## 3. Deploy on mainnet

Do not use the testnet-only browser page for mainnet. After the two-wallet
testnet flow succeeds, prepare a separately reviewed mainnet signing route;
do not export a MetaMask private key merely to use the command-line fallback.
Use a dedicated wallet funded with a small amount of native USDC. Before each
mainnet signature, check the official RPC, chain ID, destination and expected
gas cost. Record the deployed address, transaction and block number. Verify
code exists at that address on
[Arc Mainnet explorer](https://explorer.arc.io/). Set
`VITE_ARC_NETWORK=mainnet` and `VITE_CONTRACT_ADDRESS` to this real address.
Create and pay one public 0.01 USDC demo invoice with two dedicated wallets.
Check the payout and save its share URL and payment transaction hash.

## 4. Publish and submit

Create a public GitHub repository, push this project, and set its repository
variable `ARC_MAINNET_CONTRACT_ADDRESS` to the verified mainnet contract
address. Enable GitHub Pages with **GitHub Actions** as the source. The
workflow will refuse to publish without that variable. Open the published
site and the demo invoice link in a private browser window to ensure visitors
can inspect them without a wallet or GitHub login.

Finally update README with the verified deployment and demo links, then submit
the public site, repository, builder profile, and concise description through
[Arc Microgrants](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq).
Save the submission confirmation before the official deadline.
