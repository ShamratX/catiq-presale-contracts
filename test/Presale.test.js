const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Presale", function () {
    const PRESALE_SUPPLY = ethers.parseEther("250000000");
    const USD_PRICE_STAGES = [
        1_000_000n, // $0.01 (8 decimals)
        2_000_000n, // $0.02
        3_000_000n, // $0.03
    ];
    const BNB_USD_PRICE = 600n * 10n ** 8n;

    let owner;
    let buyer1;
    let exchangeReserve;
    let treasuryReserve;
    let marketingReserve;
    let teamReserve;
    let developmentReserve;

    let catIQ;
    let presale;
    let bnbUsdFeed;
    let startTime;
    let endTime;
    let tgeTime;

    beforeEach(async function () {
        [
            owner,
            buyer1,
            exchangeReserve,
            treasuryReserve,
            marketingReserve,
            teamReserve,
            developmentReserve,
        ] = await ethers.getSigners();

        const latest = await time.latest();
        startTime = latest + 3600;
        endTime = startTime + 7 * 24 * 60 * 60;
        tgeTime = endTime + 24 * 60 * 60;

        const CatIQ = await ethers.getContractFactory("CatIQ");
        catIQ = await CatIQ.deploy(
            owner.address,
            exchangeReserve.address,
            treasuryReserve.address,
            marketingReserve.address,
            teamReserve.address,
            developmentReserve.address
        );
        await catIQ.waitForDeployment();

        const BnbUsdFeedStub = await ethers.getContractFactory("BnbUsdFeedStub");
        bnbUsdFeed = await BnbUsdFeedStub.deploy(BNB_USD_PRICE);
        await bnbUsdFeed.waitForDeployment();

        const Presale = await ethers.getContractFactory("Presale");
        presale = await Presale.deploy(
            await catIQ.getAddress(),
            await bnbUsdFeed.getAddress(),
            USD_PRICE_STAGES,
            startTime,
            endTime,
            tgeTime
        );
        await presale.waitForDeployment();

        await catIQ.transfer(await presale.getAddress(), PRESALE_SUPPLY);
    });

    describe("Deployment", function () {
        it("sets config correctly", async function () {
            expect(await presale.token()).to.equal(await catIQ.getAddress());
            expect(await presale.usdPricePerTokenByStage(0)).to.equal(USD_PRICE_STAGES[0]);
            expect(await presale.usdPricePerTokenByStage(1)).to.equal(USD_PRICE_STAGES[1]);
            expect(await presale.usdPricePerTokenByStage(2)).to.equal(USD_PRICE_STAGES[2]);
            expect(await presale.startTime()).to.equal(startTime);
            expect(await presale.endTime()).to.equal(endTime);
            expect(await presale.tgeTime()).to.equal(tgeTime);
        });
    });

    describe("Buying", function () {
        it("allows buying tokens with BNB", async function () {
            await time.increaseTo(startTime + 1);
            const ethAmount = ethers.parseEther("1");
            const expectedTokens = ethers.parseEther("60000");

            await expect(
                presale.connect(buyer1).buyWithBnb({ value: ethAmount })
            )
                .to.emit(presale, "TokensPurchased")
                .withArgs(buyer1.address, ethAmount, expectedTokens);

            expect(await catIQ.balanceOf(buyer1.address)).to.equal(0);
            expect(await presale.totalTokensSold()).to.equal(expectedTokens);
            expect(await presale.purchasedBy(buyer1.address)).to.equal(expectedTokens);
            expect(await presale.claimableBy(buyer1.address)).to.equal(expectedTokens);
        });

        it("reverts before start time", async function () {
            await expect(
                presale.connect(buyer1).buyWithBnb({ value: ethers.parseEther("1") })
            ).to.be.revertedWith("Sale not active");
        });

        it("uses tier-2 rate after stage update (BNB)", async function () {
            await time.increaseTo(startTime + 1);
            await presale.connect(owner).setCurrentStage(1);
            const bnbAmount = ethers.parseEther("1");
            const expectedTokens = ethers.parseEther("30000");

            await presale.connect(buyer1).buyWithBnb({ value: bnbAmount });

            expect(await presale.claimableBy(buyer1.address)).to.equal(expectedTokens);
        });

        it("quoteBuyWithBnb matches purchase amount", async function () {
            await time.increaseTo(startTime + 1);
            const bnbAmount = ethers.parseEther("1");
            const quoted = await presale.quoteBuyWithBnb(bnbAmount);
            expect(quoted).to.equal(ethers.parseEther("60000"));
        });
    });

    describe("Claim", function () {
        it("reverts claim before TGE", async function () {
            await time.increaseTo(startTime + 1);
            await presale.connect(buyer1).buyWithBnb({ value: ethers.parseEther("1") });

            await expect(presale.connect(buyer1).claim()).to.be.revertedWith("Claim not started");
        });

        it("allows claim after TGE", async function () {
            await time.increaseTo(startTime + 1);
            await presale.connect(buyer1).buyWithBnb({ value: ethers.parseEther("1") });

            await time.increaseTo(tgeTime + 1);
            await presale.connect(buyer1).claim();

            expect(await catIQ.balanceOf(buyer1.address)).to.equal(ethers.parseEther("60000"));
            expect(await presale.claimedBy(buyer1.address)).to.equal(ethers.parseEther("60000"));
            expect(await presale.claimableBy(buyer1.address)).to.equal(0);
        });
    });

    describe("Admin", function () {
        it("only owner can update stage", async function () {
            await expect(
                presale.connect(buyer1).setCurrentStage(1)
            ).to.be.revertedWithCustomError(presale, "OwnableUnauthorizedAccount");
        });

        it("receive accepts mistaken BNB without allocating tokens", async function () {
            const amount = ethers.parseEther("0.5");
            await buyer1.sendTransaction({
                to: await presale.getAddress(),
                value: amount,
            });

            expect(await presale.purchasedBy(buyer1.address)).to.equal(0);
            expect(await presale.totalTokensSold()).to.equal(0);
            expect(await ethers.provider.getBalance(await presale.getAddress())).to.equal(
                amount
            );

            await presale.connect(owner).withdrawBnb(owner.address, amount);
            expect(await ethers.provider.getBalance(await presale.getAddress())).to.equal(0);
        });

        it("owner can withdraw BNB", async function () {
            await time.increaseTo(startTime + 1);
            await presale.connect(buyer1).buyWithBnb({ value: ethers.parseEther("1") });

            const before = await ethers.provider.getBalance(owner.address);
            const tx = await presale
                .connect(owner)
                .withdrawBnb(owner.address, ethers.parseEther("1"));
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const after = await ethers.provider.getBalance(owner.address);

            expect(after).to.equal(before + ethers.parseEther("1") - gasUsed);
        });

        it("allows withdrawing unsold tokens after finalization", async function () {
            const contractTokenBefore = await catIQ.balanceOf(await presale.getAddress());
            await presale.connect(owner).finalizeSale();

            await presale
                .connect(owner)
                .withdrawUnsoldTokens(owner.address, ethers.parseEther("100"));

            expect(await catIQ.balanceOf(owner.address)).to.equal(ethers.parseEther("100"));
            expect(await catIQ.balanceOf(await presale.getAddress())).to.equal(
                contractTokenBefore - ethers.parseEther("100")
            );
        });

        it("batchSetAllocation with one wallet credits treasury buyer", async function () {
            await time.increaseTo(endTime + 1);
            const allocation = ethers.parseEther("1000");

            await expect(
                presale
                    .connect(owner)
                    .batchSetAllocation([buyer1.address], [allocation])
            )
                .to.emit(presale, "TokensAllocated")
                .withArgs(buyer1.address, allocation);

            expect(await presale.purchasedBy(buyer1.address)).to.equal(allocation);
            expect(await presale.totalTokensSold()).to.equal(allocation);
            expect(await presale.claimableBy(buyer1.address)).to.equal(allocation);
        });

        it("reverts batchSetAllocation before sale end", async function () {
            await time.increaseTo(startTime + 1);
            await expect(
                presale
                    .connect(owner)
                    .batchSetAllocation([buyer1.address], [ethers.parseEther("1")])
            ).to.be.revertedWith("Sale not ended");
        });

        it("batchSetAllocation credits multiple wallets", async function () {
            const [, , buyer2] = await ethers.getSigners();
            await time.increaseTo(endTime + 1);

            const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
            await presale
                .connect(owner)
                .batchSetAllocation([buyer1.address, buyer2.address], amounts);

            expect(await presale.purchasedBy(buyer1.address)).to.equal(amounts[0]);
            expect(await presale.purchasedBy(buyer2.address)).to.equal(amounts[1]);
            expect(await presale.totalTokensSold()).to.equal(ethers.parseEther("300"));
        });

        it("treasury allocation is claimable after TGE", async function () {
            await time.increaseTo(endTime + 1);
            const allocation = ethers.parseEther("500");
            await presale
                .connect(owner)
                .batchSetAllocation([buyer1.address], [allocation]);

            await time.increaseTo(tgeTime + 1);
            await presale.connect(buyer1).claim();

            expect(await catIQ.balanceOf(buyer1.address)).to.equal(allocation);
        });
    });
});
