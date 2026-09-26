# Tiny Sprout

A tiny onchain garden for small daily rituals. Choose a pot, name your sprout, and water it on different days to grow new leaves and a flower.

## What it does

- Connect an Ethereum browser wallet; its address is the garden account.
- Plant one sprout per wallet, with a pot style and a name.
- Save planting, watering, and name changes through signed transactions.
- Water once per UTC day, enforced by the contract using block time.
- Read care history, current/best streaks, and growth at 3 and 7 care days.
- Restore the same garden from another browser using the same wallet and contract.
- Show wallet approval, pending confirmation, confirmed transactions, and explorer links.

A missed day resets the current streak, not accumulated growth. Growth previews never write to the contract. There is no NFT, trading, email login, deposit, or administrator.

## Architecture

```text
React UI → viem → browser wallet (signatures) → TinySprout contract
             └→ public RPC (reads and transaction receipts) ─┘
```

The blockchain is the backend and source of truth. No application server or database is required. All garden data is public. Local storage contains connection preferences and pending transaction references, not authoritative garden records. Previous browser-only demo records are left untouched and are not imported as onchain activity.

- `contracts/TinySprout.sol`: wallet ownership, daily watering rules, name validation, paginated history, events.
- `src/sproutService.ts`: wallet sessions, contract validation, writes, receipt handling, and recovery.
- `src/chain/readGarden.ts`: consistent garden snapshots at one block.
- `src/gardenModel.ts`: presentation rules for calendars, streaks, and growth.
- `scripts/compile.mjs`: reproducible Solidity compilation and generated ABI/bytecode.

## Run a local blockchain

```sh
npm install
npm run chain:local
```

In another terminal:

```sh
npm run dev -- --port 5173
```

Open [the local app](http://127.0.0.1:5173/). The development chain has actual EVM transactions and disk persistence in `.local-chain/`. Its unlocked test wallet is only for localhost. The app labels this mode **Local blockchain · development only**. Keep both processes running.

`chain:local` writes `.env.development.local`. Production builds ignore that development configuration and always target Base Sepolia.

## Deploy to Base Sepolia

Public deployment requires a browser wallet and Base Sepolia test ETH. Private keys and recovery phrases are never entered in this app.

1. Run `npm run build`, then `npm run preview -- --port 5175`.
2. Open [the production preview](http://127.0.0.1:5175/) in a browser with MetaMask, Rabby, or another Ethereum wallet.
3. Select **Set up garden**, connect the wallet, and approve **Deploy garden contract**. The app validates the deployed runtime bytecode before accepting it. Alternatively, enter an existing matching contract address.
4. Put the resulting public address in `.env.production.local`:

   ```dotenv
   VITE_GARDEN_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
   VITE_GARDEN_RPC_URL=https://sepolia.base.org
   ```

5. Run `npm run build:submission`. This checks the chain ID and deployed bytecode before creating `dist/`.
6. Host `dist/` on a static website host. Every visitor uses the configured contract. A contract address saved only through the setup screen applies to that browser until included in the production build.

[Base network settings](https://docs.base.org/get-started/connect-to-base) · [Free test ETH](https://docs.base.org/get-started/get-funds) · [Base Sepolia explorer](https://sepolia.basescan.org)

For explorer source verification, compile with Solidity **0.8.30**, optimizer **200 runs**, and EVM target **Shanghai**. `artifacts/compiler-input.json` contains the standard JSON compiler input.

## Validation

```sh
npm test
npm run build
npm run check:deployment
```

Tests execute the real contract in an isolated EVM. They cover invalid input, owner separation, duplicate planting/watering, UTC rollover, streak gaps, growth milestones, history pagination, ETH rejection, fresh-client reads, wallet rejection, concurrent requests, account changes, and reconnect. Legacy demo tests remain separate from onchain behavior.

`check:deployment` and `build:submission` fail when a public deployment has not been configured. A successful local test or ordinary build does not mean the public testnet deployment is complete.

## Scope and limitations

Base Sepolia is a test network. Each write requires a wallet approval and test ETH for gas. Names and care history are public and immutable except that the current name can be updated; past events remain visible. One wallet represents one garden, not a verified person. Data availability depends on the selected network and RPC. The contract is not independently audited and is intended for this testnet project.

## Product and design

- [Product plan](./PROJECT_PLAN.md)
- [UI guide](./DESIGN.md)

Caveat and DM Sans are bundled through Fontsource under their respective licenses. The sprout illustration is AI-generated. Code and design implementation were assisted by Codex.

## GitHub Pages

The site is published at https://ukii0.github.io/ethglobaltokyo2026-tiny/ by `.github/workflows/deploy.yml` on pushes to `main`. The workflow runs tests and builds the app for the repository subpath.

Set the repository Actions variable `VITE_GARDEN_CONTRACT_ADDRESS` to the deployed Base Sepolia contract address and rerun the workflow to share the same garden contract with all visitors. Until configured, the site opens with the contract setup flow; website deployment does not deploy the smart contract.
