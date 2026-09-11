# PROJECT_BRAIN — catiq-presale-contracts

## Purpose

On-chain CIQ token + BNB presale used by the CatIQ ICO stack. Frontend is separate (`catiq-ico`) and must not have its README edited in the docs-polish pass.

## Architecture

- `CatIQ`: fixed 1B ERC-20, PP 250M + five other 150M reserves
- `Presale`: Ownable + ReentrancyGuard; quote/buy with BNB; stages 0–2; claim after TGE; admin tools
- Local `AggregatorV3Interface` in Presale (Chainlink package may be present but interface is local)
- Tests: `CatiQ.test.js`, `Presale.test.js`

## Workflow

1. Deploy CatIQ with reserve wallets from env
2. Deploy Presale with token, feed, prices, times
3. Transfer CIQ sale allocation into Presale
4. Open window / set stage; users `buyWithBnb`
5. After end: finalize, optional batch allocations, TGE claims, withdraw BNB / unsold

## Integration notes

- Frontend BNB path calls `buyWithBnb`
- Stablecoin/ETH raises recorded off-chain then allocated
- Keep constructor arg scripts in sync with verify commands

## Gotchas

- package name `ciq-ico-contracts`
- Prefer `npx hardhat test`
- Oracle must return positive completed rounds within max delay
