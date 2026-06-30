// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract CatIQ is ERC20, Ownable {

    uint8 private constant _decimals = 18;
    uint256 public constant publicPresale      = 250_000_000 * (10 ** _decimals);
    uint256 public constant exchangeReserve    = 150_000_000 * (10 ** _decimals);
    uint256 public constant treasuryReserve    = 150_000_000 * (10 ** _decimals);
    uint256 public constant marketingReserve   = 150_000_000 * (10 ** _decimals);
    uint256 public constant teamReserve        = 150_000_000 * (10 ** _decimals);
    uint256 public constant developmentReserve = 150_000_000 * (10 ** _decimals);


    constructor(
        address _publicPresale,
        address _exchangeReserve,
        address _treasuryReserve,
        address _marketingReserve,
        address _teamReserve,
        address _developmentReserve
        
    ) ERC20("CatIQ", "CIQ") Ownable(msg.sender) {
        require(
            _publicPresale != address(0) &&
            _exchangeReserve != address(0) &&
            _treasuryReserve != address(0) &&
            _marketingReserve != address(0) &&
            _teamReserve != address(0) &&
            _developmentReserve != address(0), "Zero Address"
        );
 
        _mint(_publicPresale, publicPresale);
        _mint(_exchangeReserve, exchangeReserve);
        _mint(_treasuryReserve, treasuryReserve);
        _mint(_marketingReserve, marketingReserve);
        _mint(_teamReserve, teamReserve);
        _mint(_developmentReserve, developmentReserve);
    }
}