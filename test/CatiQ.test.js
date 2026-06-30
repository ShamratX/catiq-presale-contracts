// test/CatIQ.test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CatIQ Token", function () {
    let CatIQ;
    let catIQ;

    let owner;
    let publicPresale;
    let exchangeReserve;
    let treasuryReserve;
    let marketingReserve;
    let teamReserve;
    let developmentReserve;
    let user;

    const toWei = (value) => ethers.parseEther(value);

    beforeEach(async function () {
        [
            owner,
            publicPresale,
            exchangeReserve,
            treasuryReserve,
            marketingReserve,
            teamReserve,
            developmentReserve,
            user,
        ] = await ethers.getSigners();

        CatIQ = await ethers.getContractFactory("CatIQ");

        catIQ = await CatIQ.deploy(
            publicPresale.address,
            exchangeReserve.address,
            treasuryReserve.address,
            marketingReserve.address,
            teamReserve.address,
            developmentReserve.address
        );

        await catIQ.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set correct token name and symbol", async function () {
            expect(await catIQ.name()).to.equal("CatIQ");
            expect(await catIQ.symbol()).to.equal("CIQ");
        });

        it("Should mint correct amount to public presale wallet", async function () {
            expect(
                await catIQ.balanceOf(publicPresale.address)
            ).to.equal(toWei("250000000"));
        });

        it("Should mint correct amount to reserve wallets", async function () {
            const reserveAmount = toWei("150000000");

            expect(
                await catIQ.balanceOf(exchangeReserve.address)
            ).to.equal(reserveAmount);

            expect(
                await catIQ.balanceOf(treasuryReserve.address)
            ).to.equal(reserveAmount);

            expect(
                await catIQ.balanceOf(marketingReserve.address)
            ).to.equal(reserveAmount);

            expect(
                await catIQ.balanceOf(teamReserve.address)
            ).to.equal(reserveAmount);

            expect(
                await catIQ.balanceOf(developmentReserve.address)
            ).to.equal(reserveAmount);
        });

        it("Should have correct total supply", async function () {
            const expectedSupply = toWei("1000000000"); // 1 Billion

            expect(await catIQ.totalSupply()).to.equal(expectedSupply);
        });

        it("Should set deployer as owner", async function () {
            expect(await catIQ.owner()).to.equal(owner.address);
        });
    });

    describe("Transfers", function () {
        it("Should transfer tokens successfully", async function () {
            const transferAmount = toWei("1000");

            await catIQ
                .connect(publicPresale)
                .transfer(user.address, transferAmount);

            expect(
                await catIQ.balanceOf(user.address)
            ).to.equal(transferAmount);
        });
    });

    describe("Reverts", function () {
        it("Should revert if any constructor address is zero", async function () {
            await expect(
                CatIQ.deploy(
                    ethers.ZeroAddress,
                    exchangeReserve.address,
                    treasuryReserve.address,
                    marketingReserve.address,
                    teamReserve.address,
                    developmentReserve.address
                )
            ).to.be.revertedWith("Zero Address");
        });
    });
});