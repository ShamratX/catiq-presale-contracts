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

async function main() {
    const [deployer] = await ethers.getSigners();
    const { chainId } = await ethers.provider.getNetwork();
    const balance = await ethers.provider.getBalance(deployer.address);

    console.log(`Network: ${network.name} ChainId: ${chainId}`);
    console.log(`Deployer Address: ${deployer.address}`);
    console.log(`Deployer Balance: ${ethers.formatEther(balance)} BNB`);

    const publicPresale = requireAddress("PP_WALLET");
    const exchangeReserve = requireAddress("EXCHANGE_WALLET");
    const treasuryReserve = requireAddress("TREASURY_WALLET");
    const marketingReserve = requireAddress("MARKETING_WALLET");
    const teamReserve = requireAddress("TEAM_WALLET");
    const developmentReserve = requireAddress("DEV_WALLET");

    const CatIQ = await ethers.getContractFactory("CatIQ", deployer);
    const catIQ = await CatIQ.deploy(
        publicPresale,
        exchangeReserve,
        treasuryReserve,
        marketingReserve,
        teamReserve,
        developmentReserve
    );
    await catIQ.waitForDeployment();

    const contractAddress = await catIQ.getAddress();
    const deploymentTx = catIQ.deploymentTransaction();
    const txHash = deploymentTx ? deploymentTx.hash : "N/A";
    const totalSupply = await catIQ.totalSupply();

    console.log(`CatIQ Address: ${contractAddress}`);
    console.log(`Deployment Tx: ${txHash}`);
    console.log(`Total Supply: ${ethers.formatUnits(totalSupply, 18)} CIQ`);

    console.log("\nVerify with:");
    console.log(
        `npx hardhat verify --network ${hre.network.name} ${contractAddress} ${publicPresale} ${exchangeReserve} ${treasuryReserve} ${marketingReserve} ${teamReserve} ${developmentReserve}`
    );
}

main().catch((error) => {
    console.error("CatIQ deployment failed:", error);
    process.exitCode = 1;
});