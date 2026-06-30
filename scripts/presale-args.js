require("dotenv").config();

module.exports = [
    process.env.CATIQ_ADDRESS,
    process.env.BNB_USD_PRICE_FEED,
    [
        process.env.PRESALE_USD_PRICE_STAGE1,
        process.env.PRESALE_USD_PRICE_STAGE2,
        process.env.PRESALE_USD_PRICE_STAGE3,
    ],
    process.env.PRESALE_START_TIME,
    process.env.PRESALE_END_TIME,
    process.env.PRESALE_TGE_TIME,
];
