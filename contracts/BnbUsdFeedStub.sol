// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Local Hardhat tests only. Mainnet uses real Chainlink BNB/USD feed.
contract BnbUsdFeedStub {
    uint8 public constant decimals = 8;
    int256 private immutable _price;

    constructor(int256 price_) {
        require(price_ > 0, "Invalid price");
        _price = price_;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        uint256 ts = block.timestamp;
        return (1, _price, ts, ts, 1);
    }
}
