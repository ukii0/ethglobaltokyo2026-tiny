# Tiny Sprout

**A little care. A little growth.**

A tiny onchain garden that turns daily care into a growing plant. Choose a pot, name your sprout, and return each day to water it. Your wallet owns the garden, and a smart contract keeps its care history.

[Open the app](https://ukii0.github.io/ethglobaltokyo2026-tiny/) · [Product plan](./PROJECT_PLAN.md) · [Design guide](./DESIGN.md)

![Tiny Sprout](./submission-assets/cover.png)

## How it works

1. **Make it yours.** Connect an Ethereum browser wallet, choose Paper, Pebble, or Sunshine, and name your sprout.
2. **Water daily.** Approve one watering transaction per UTC day.
3. **Watch it grow.** Reach new leaves after 3 care days and a flower after 7. Each pot has its own illustration and flower.

Track recent watering, your current streak, and your longest streak in the care journal. Missing a day breaks the streak but preserves accumulated growth. Reconnecting the same wallet to the same contract restores your garden.

## Project status

The frontend is live on GitHub Pages. The contract and wallet flows have been tested on a local EVM. A shared Base Sepolia contract address still needs to be configured for the public app; until then, it displays the contract setup flow.

This version includes one plant per wallet, name changes, daily watering, growth stages, and care history. NFT minting, trading, friends, shared gardens, and rankings are outside its scope.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Wallet and chain access | viem, injected Ethereum wallets |
| Smart contract | Solidity 0.8.30, targeting Base Sepolia |
| Local blockchain | Ganache |
| Testing | Node.js test runner, tsx |
| Hosting | GitHub Pages and GitHub Actions |
| Typography | Caveat and DM Sans via Fontsource |

The blockchain is the backend. There is no application server or database. The contract stores each wallet's pot style, name, planting time, and watering days. It enforces daily watering with block timestamps. The frontend reads those records to calculate growth and streaks.

```text
React interface → viem → browser wallet → TinySprout contract
                     → public RPC → records and transaction receipts
```

Local storage holds connection preferences and pending transaction references. Garden records are read from the contract. The interface shows wallet approval, pending confirmation, and confirmed transaction states, with explorer links.

## Run locally

Use Node.js 22 and npm. From the project directory:

```sh
npm ci
npm run chain:local
```

In a second terminal:

```sh
npm run dev -- --port 5173
```

Open [localhost:5173](http://127.0.0.1:5173/). Keep both terminals running.

The local chain uses real EVM transactions with an unlocked development wallet. Its state persists in `.local-chain/`. The startup script writes `.env.development.local`; production builds ignore this local-chain configuration and target Base Sepolia.

## Deploy the contract

You need an Ethereum browser wallet and Base Sepolia test ETH.

1. Open the [app](https://ukii0.github.io/ethglobaltokyo2026-tiny/) in a browser with your wallet extension.
2. Choose **Set up garden**, connect your wallet, and approve **Deploy garden contract**. You can also enter an existing matching contract address.
3. Copy the deployed contract address. The app checks its runtime bytecode before accepting it.
4. Configure that address for the website using one of the options below.

An address saved through the setup screen applies only to that browser until included in the site's build configuration. Never enter a private key or recovery phrase in the app.

### GitHub Pages

In the repository's **Settings → Secrets and variables → Actions → Variables**, set:

```text
VITE_GARDEN_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

Rerun **Deploy GitHub Pages** from the Actions tab. The workflow also runs on pushes to `main`, installs dependencies, runs tests, and publishes the build. All visitors then use the configured contract.

### Other static hosting

Create `.env.production.local`:

```dotenv
VITE_GARDEN_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
VITE_GARDEN_RPC_URL=https://sepolia.base.org
```

Then validate the deployment and build:

```sh
npm run build:submission
```

Publish the resulting `dist/` directory. For a local production preview, run `npm run preview -- --port 5175`.

[Base network settings](https://docs.base.org/get-started/connect-to-base) · [Test ETH](https://docs.base.org/get-started/get-funds) · [Base Sepolia explorer](https://sepolia.basescan.org)

## Validation

```sh
npm test                  # Model, contract, and wallet tests
npm run build             # Compile the contract and frontend
npm run check:deployment  # Verify the configured public contract
```

Tests cover input validation, wallet ownership, duplicate watering, UTC rollover, growth milestones, streaks, history pagination, rejected signatures, account changes, and reconnection.

`check:deployment` and `build:submission` require a configured public deployment. A successful regular build does not mean the smart contract is deployed.

For contract source verification, use Solidity **0.8.30**, optimizer **200 runs**, and EVM target **Shanghai**. Compilation produces `artifacts/compiler-input.json`.

## Source map

| Path | Purpose |
| --- | --- |
| `contracts/TinySprout.sol` | Ownership, planting, watering, names, and history |
| `src/sproutService.ts` | Wallet sessions, transactions, and recovery |
| `src/chain/readGarden.ts` | Consistent reads from a single block |
| `src/gardenModel.ts` | Growth, streaks, and calendar calculations |
| `src/GardenCare.tsx` | Plant illustrations and care interface |
| `tests/` | Model, EVM, and wallet integration tests |
| `submission-assets/` | Logo, cover, and screenshots |

## Notes and credits

This is a testnet project. Writes require wallet approval and test ETH for gas. Names and care records are public; renaming changes the current name but does not erase past events. The contract has not been independently audited.

Caveat and DM Sans are bundled under their respective licenses. Raster illustrations, the logo, and the cover were created with AI image generation. Code and design implementation were assisted by Codex.
