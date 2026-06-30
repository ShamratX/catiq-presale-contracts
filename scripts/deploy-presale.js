require("dotenv").config();
const hre = require("hardhat");
const { ethers, network } = hre;

function requireAddress(name) {
    const value = process.env[name];
    if (!value || !ethers.isAddress(value)) {
        throw new Error(`Invalid or missing ${name}`);
    }
    return value;
}

function requireBigInt(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing ${name}`);
    }
    try {
        return BigInt(value);
    } catch {
        throw new Error(`Invalid bigint value for ${name}: ${value}`);
    }
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const { chainId } = await ethers.provider.getNetwork();
    const balance = await ethers.provider.getBalance(deployer.address);

    console.log(`Network: ${network.name} ChainId: ${chainId}`);
    console.log(`Deployer Address: ${deployer.address}`);
    console.log(`Deployer Balance: ${ethers.formatEther(balance)} ETH`);

    const tokenAddress = requireAddress("CATIQ_ADDRESS");
    const bnbUsdFeed = requireAddress("BNB_USD_PRICE_FEED");
    const stage1UsdPrice = requireBigInt("PRESALE_USD_PRICE_STAGE1");
    const stage2UsdPrice = requireBigInt("PRESALE_USD_PRICE_STAGE2");
    const stage3UsdPrice = requireBigInt("PRESALE_USD_PRICE_STAGE3");
    const startTime = requireBigInt("PRESALE_START_TIME");
    const endTime = requireBigInt("PRESALE_END_TIME");
    const tgeTime = requireBigInt("PRESALE_TGE_TIME");

    if (startTime >= endTime) {
        throw new Error("PRESALE_START_TIME must be less than PRESALE_END_TIME");
    }
    if (tgeTime < endTime) {
        throw new Error("PRESALE_TGE_TIME must be >= PRESALE_END_TIME");
    }

    const Presale = await ethers.getContractFactory("Presale", deployer);
    const presale = await Presale.deploy(
        tokenAddress,
        bnbUsdFeed,
        [stage1UsdPrice, stage2UsdPrice, stage3UsdPrice],
        startTime,
        endTime,
        tgeTime
    );
    await presale.waitForDeployment();

    const contractAddress = await presale.getAddress();
    const deploymentTx = presale.deploymentTransaction();
    const txHash = deploymentTx ? deploymentTx.hash : "N/A";

    console.log(`Presale Address: ${contractAddress}`);
    console.log(`Deployment Tx: ${txHash}`);

    console.log(
        "USDT/USDC/ETH: treasury wallet only. After sale end, use batchSetAllocation."
    );

    const token = await ethers.getContractAt("IERC20", tokenAddress);
    const presaleBalance = await token.balanceOf(contractAddress);
    console.log(`Presale CIQ Balance: ${presaleBalance.toString()}`);
    console.log("Reminder: fund Presale with CIQ tokens before opening sale.");

    console.log("\nVerify with:");
    console.log(
        `npx hardhat verify --network ${hre.network.name} ${contractAddress} ${tokenAddress} ${bnbUsdFeed} "[${stage1UsdPrice},${stage2UsdPrice},${stage3UsdPrice}]" ${startTime} ${endTime} ${tgeTime}`
    );
}

main().catch((error) => {
    console.error("Presale deployment failed:", error);
    process.exitCode = 1;
});