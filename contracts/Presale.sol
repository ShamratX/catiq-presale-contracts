// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract Presale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 private constant NATIVE_DECIMALS = 18;
    uint8 private constant MAX_STAGE = 2;
    uint8 private constant USD_DECIMALS = 8;
    uint256 private constant MAX_ORACLE_DELAY = 1 hours;

    IERC20 public immutable token;
    AggregatorV3Interface public immutable bnbUsdPriceFeed;

    uint8 public currentStage;
    uint256[3] public usdPricePerTokenByStage;
    uint256 public startTime;
    uint256 public endTime;
    uint256 public tgeTime;
    uint256 public totalTokensSold;
    uint256 public totalTokensClaimed;
    bool public saleFinalized;

    mapping(address => uint256) public purchasedBy;
    mapping(address => uint256) public claimedBy;

    event TokensPurchased(
        address indexed buyer,
        uint256 bnbPaid,
        uint256 tokenAmount
    );
    event SaleWindowUpdated(uint256 startTime, uint256 endTime);
    event TgeTimeUpdated(uint256 tgeTime);
    event StageUpdated(uint8 stage);
    event StagePricesUpdated(uint256 stage1, uint256 stage2, uint256 stage3);
    event SaleFinalized();
    event NativeWithdrawn(address indexed to, uint256 amount);
    event UnsoldTokensWithdrawn(address indexed to, uint256 amount);
    event TokensClaimed(address indexed buyer, uint256 amount);
    event TokensAllocated(address indexed beneficiary, uint256 tokenAmount);
    event BatchTokensAllocated(uint256 beneficiaryCount, uint256 totalAmount);

    uint256 public constant MAX_ALLOCATION_BATCH = 200;

    constructor(
        address _token,
        address _bnbUsdPriceFeed,
        uint256[3] memory _usdPricePerTokenByStage,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _tgeTime
    ) Ownable(msg.sender) {
        require(_token != address(0), "Token zero address");
        require(_bnbUsdPriceFeed != address(0), "Feed zero address");
        require(
            _usdPricePerTokenByStage[0] > 0 &&
                _usdPricePerTokenByStage[1] > 0 &&
                _usdPricePerTokenByStage[2] > 0,
            "Invalid rate"
        );
        require(_startTime < _endTime, "Invalid sale window");
        require(_tgeTime >= _endTime, "Invalid TGE time");

        token = IERC20(_token);
        bnbUsdPriceFeed = AggregatorV3Interface(_bnbUsdPriceFeed);
        usdPricePerTokenByStage = _usdPricePerTokenByStage;
        startTime = _startTime;
        endTime = _endTime;
        tgeTime = _tgeTime;
        currentStage = 0;
    }

    function buyWithBnb() external payable nonReentrant {
        require(isSaleActive(), "Sale not active");
        require(msg.value > 0, "No payment sent");

        uint256 tokenAmount = _quoteTokens(
            _bnbUsdValue(msg.value)
        );
        require(tokenAmount > 0, "Amount too small");

        _creditPurchase(msg.sender, tokenAmount);
        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }

    function quoteBuyWithBnb(uint256 amount) external view returns (uint256) {
        if (amount == 0) {
            return 0;
        }

        return _quoteTokens(_bnbUsdValue(amount));
    }

    function isSaleActive() public view returns (bool) {
        return
            !saleFinalized &&
            block.timestamp >= startTime &&
            block.timestamp <= endTime;
    }

    function setSaleWindow(
        uint256 _startTime,
        uint256 _endTime
    ) external onlyOwner {
        require(!saleFinalized, "Sale finalized");
        require(_startTime < _endTime, "Invalid sale window");
        require(_endTime <= tgeTime, "End after TGE");

        startTime = _startTime;
        endTime = _endTime;

        emit SaleWindowUpdated(_startTime, _endTime);
    }

    function setTgeTime(uint256 _tgeTime) external onlyOwner {
        require(!saleFinalized, "Sale finalized");
        require(_tgeTime >= endTime, "Invalid TGE time");
        tgeTime = _tgeTime;
        emit TgeTimeUpdated(_tgeTime);
    }

    function setCurrentStage(uint8 _stage) external onlyOwner {
        require(!saleFinalized, "Sale finalized");
        require(_stage <= MAX_STAGE, "Invalid stage");

        currentStage = _stage;
        emit StageUpdated(_stage);
    }

    function setStagePrices(
        uint256[3] calldata _usdPricePerTokenByStage
    ) external onlyOwner {
        require(!saleFinalized, "Sale finalized");
        require(
            _usdPricePerTokenByStage[0] > 0 &&
                _usdPricePerTokenByStage[1] > 0 &&
                _usdPricePerTokenByStage[2] > 0,
            "Invalid rate"
        );

        usdPricePerTokenByStage = _usdPricePerTokenByStage;
        emit StagePricesUpdated(
            _usdPricePerTokenByStage[0],
            _usdPricePerTokenByStage[1],
            _usdPricePerTokenByStage[2]
        );
    }

    function finalizeSale() external onlyOwner {
        require(!saleFinalized, "Already finalized");
        saleFinalized = true;
        emit SaleFinalized();
    }

    function batchSetAllocation(
        address[] calldata beneficiaries,
        uint256[] calldata tokenAmounts
    ) external onlyOwner {
        _requireSaleEndedForAllocation();
        uint256 length = beneficiaries.length;
        require(length == tokenAmounts.length, "Length mismatch");
        require(length > 0, "Empty batch");
        require(length <= MAX_ALLOCATION_BATCH, "Batch too large");

        uint256 totalAmount;
        for (uint256 i = 0; i < length; ) {
            _allocateTokens(beneficiaries[i], tokenAmounts[i]);
            totalAmount += tokenAmounts[i];
            unchecked {
                ++i;
            }
        }

        emit BatchTokensAllocated(length, totalAmount);
    }

    function withdrawBnb(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(amount <= address(this).balance, "Insufficient BNB");

        (bool success, ) = to.call{value: amount}("");
        require(success, "BNB transfer failed");

        emit NativeWithdrawn(to, amount);
    }

    function withdrawUnsoldTokens(address to, uint256 amount) external onlyOwner {
        require(saleFinalized || block.timestamp > endTime, "Sale not ended");
        require(to != address(0), "Zero address");
        uint256 outstandingClaims = totalTokensSold - totalTokensClaimed;
        uint256 withdrawable = token.balanceOf(address(this)) - outstandingClaims;
        require(amount <= withdrawable, "Amount exceeds unsold");

        token.safeTransfer(to, amount);

        emit UnsoldTokensWithdrawn(to, amount);
    }

    function claim() external nonReentrant {
        require(block.timestamp >= tgeTime, "Claim not started");
        uint256 claimable = claimableBy(msg.sender);
        require(claimable > 0, "Nothing to claim");

        claimedBy[msg.sender] += claimable;
        totalTokensClaimed += claimable;
        token.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable);
    }

    function claimableBy(address account) public view returns (uint256) {
        return purchasedBy[account] - claimedBy[account];
    }

    function _quoteTokens(uint256 usdValue) internal view returns (uint256) {
        uint256 usdPricePerToken = usdPricePerTokenByStage[currentStage];
        require(usdPricePerToken > 0, "Price not set");
        return (usdValue * (10 ** 18)) / usdPricePerToken;
    }

    function _bnbUsdValue(uint256 bnbAmount) internal view returns (uint256) {
        return _usdValueFromFeed(bnbAmount, NATIVE_DECIMALS, bnbUsdPriceFeed);
    }

    function _usdValueFromFeed(
        uint256 paymentAmount,
        uint8 paymentDecimals,
        AggregatorV3Interface usdFeed
    ) internal view returns (uint256) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = usdFeed.latestRoundData();
        require(answer > 0, "Invalid oracle price");
        require(answeredInRound >= roundId, "Incomplete oracle round");
        require(
            updatedAt > 0 && updatedAt <= block.timestamp,
            "Invalid oracle timestamp"
        );
        require(
            block.timestamp - updatedAt <= MAX_ORACLE_DELAY,
            "Stale oracle price"
        );

        uint8 feedDecimals = usdFeed.decimals();
        uint256 price = uint256(answer);

        if (feedDecimals > USD_DECIMALS) {
            price = price / (10 ** (feedDecimals - USD_DECIMALS));
        } else if (feedDecimals < USD_DECIMALS) {
            price = price * (10 ** (USD_DECIMALS - feedDecimals));
        }

        return (paymentAmount * price) / (10 ** paymentDecimals);
    }

    function _creditPurchase(address buyer, uint256 tokenAmount) internal {
        uint256 totalAllocatedAfterPurchase = totalTokensSold + tokenAmount;
        require(
            token.balanceOf(address(this)) + totalTokensClaimed >=
                totalAllocatedAfterPurchase,
            "Insufficient CIQ"
        );

        purchasedBy[buyer] += tokenAmount;
        totalTokensSold += tokenAmount;
    }

    function _requireSaleEndedForAllocation() internal view {
        require(saleFinalized || block.timestamp > endTime, "Sale not ended");
    }

    function _allocateTokens(address beneficiary, uint256 tokenAmount) internal {
        require(beneficiary != address(0), "Zero address");
        require(tokenAmount > 0, "Zero amount");

        _creditPurchase(beneficiary, tokenAmount);
        emit TokensAllocated(beneficiary, tokenAmount);
    }

    receive() external payable {}
}
