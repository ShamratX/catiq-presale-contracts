# CatIQ Presale Contracts

Hardhat smart contracts for the **CatIQ** token and **BNB presale** on BNB Smart Chain. Includes Chainlink-style BNB/USD pricing, staged USD prices, TGE claim, and admin allocation tools.

## Features

| Contract | Role |
|----------|------|
| `CatIQ` | Fixed-supply ERC-20 (`CIQ`) with reserve mint split |
| `Presale` | BNB buys via price feed, stages, sale window, TGE `claim`, admin finalize/withdraw/batch allocate |
| `BnbUsdFeedStub` | Test oracle stub |

- On-chain payment path: **BNB only**
- Three USD price stages (8-decimal USD prices)
- Oracle freshness checks (max delay 1 hour in contract logic)
- `batchSetAllocation` after sale end (max 200 per call) for off-chain payment reconciliation

## Requirements

- Node.js 18+
- npm
- BSC RPC + deployer key

## Quick start

```bash
git clone https://github.com/ShamratX/catiq-presale-contracts.git
cd catiq-presale-contracts
npm install
cp .env.example .env
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy-catiq.js --network bscTestnet
npx hardhat run scripts/deploy-presale.js --network bscTestnet
```

Networks in config: `hardhat`, `bscMainnet`, `bscTestnet`.

Fund the Presale contract with CIQ before opening the sale. Verify with `scripts/args.js` / `presale-args.js` as needed.

## Config (env names)

`PRIVATE_KEY`, `BSC_MAINNET_RPC_URL`, `BSC_TESTNET_RPC_URL`, `BSCSCAN_API_KEY`, reserve wallets (`PP_WALLET`, `EXCHANGE_WALLET`, `TREASURY_WALLET`, `MARKETING_WALLET`, `TEAM_WALLET`, `DEV_WALLET`), `CATIQ_ADDRESS`, `BNB_USD_PRICE_FEED`, `PRESALE_USD_PRICE_STAGE1..3`, `PRESALE_START_TIME`, `PRESALE_END_TIME`, `PRESALE_TGE_TIME`

## Project structure

```text
contracts/CatIQ.sol
contracts/Presale.sol
contracts/BnbUsdFeedStub.sol
scripts/deploy-catiq.js
scripts/deploy-presale.js
scripts/args.js
scripts/presale-args.js
test/
```

## Limitations

- No on-chain USDT/USDC/ETH buy functions — those flows are handled off-chain then `batchSetAllocation`.
- BSC-focused Hardhat networks only (no Ethereum nets in this config).
- Frontend / treasury UX lives in separate repos (e.g. `catiq-ico`).

## Related

CatIQ product site: [catiq.xyz](https://www.catiq.xyz)
