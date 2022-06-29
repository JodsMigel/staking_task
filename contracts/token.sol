// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenTokenToken is ERC20, Ownable {


    constructor() ERC20("TokenTokenToken", "TTT") {
    }
    
    function mint(address _to, uint _amount) external onlyOwner {
        _mint(_to, _amount * 10 ** decimals());
    }

}