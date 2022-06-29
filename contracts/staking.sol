// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

//Для взаимодействия с USDT
interface non_standard_IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external ;

    function transfer(address _to, uint _value) external;
    function balanceOf(address account) external view returns (uint256);
}

interface token_mint {
    function mint(address _to, uint _amount) external;
}

contract Staking is Ownable {

    IERC20 public token;
    non_standard_IERC20 public usdt;

    uint public startAt;
    uint public totalReward = 30000 ether;

    constructor(address _address, address _usdtAddress) {
        token = IERC20(_address);
        usdt = non_standard_IERC20(_usdtAddress);
        startAt = block.timestamp;
    }

    struct Staker {
        uint amount;
        uint time;
        uint weight;
        bool claimed;
    }

    mapping(address => Staker) public stakers;

    uint public allWeight;
    uint public stakedUSDT;
    uint public emptyTimeStart = block.timestamp;
    uint public leaveOnContract;


    function stake(uint _amount) external {
        require(_amount > 0, "Can not stake 0");
        if (stakers[msg.sender].amount == 0){
            usdt.transferFrom(msg.sender,address(this),_amount);
            stakers[msg.sender].amount += _amount;
            stakers[msg.sender].time = leftStakingTime();
            allWeight += leftStakingTime()*_amount;
            stakedUSDT += _amount;
        }
        else {
            usdt.transferFrom(msg.sender,address(this),_amount);
            uint stakedTime = stakers[msg.sender].time - leftStakingTime();
            stakers[msg.sender].weight += stakers[msg.sender].amount * stakedTime;
            stakers[msg.sender].amount += _amount;
            stakers[msg.sender].time = leftStakingTime();
            allWeight += stakers[msg.sender].time*_amount - leftStakingTime()*_amount; //Отнимаем старый рассчитаный вес и прибавляем новый
            stakedUSDT += _amount;
            }
        
        if (emptyTimeStart != 0) {
            leaveOnContract += totalReward / 30 days * (block.timestamp - emptyTimeStart);
            emptyTimeStart = 0;
        }

    }

    function unstake() external {
        require(stakers[msg.sender].amount > 0, "Nothing to unstake");
        uint stakedTime = stakers[msg.sender].time - leftStakingTime();
        uint toSend = stakers[msg.sender].amount;
        stakers[msg.sender].weight += stakers[msg.sender].amount * stakedTime;
        stakers[msg.sender].amount = 0;
        stakers[msg.sender].time = 0;
        stakedUSDT -= toSend;
        usdt.transfer(msg.sender, toSend);
        if (stakedUSDT == 0) {
            emptyTimeStart = block.timestamp;
        }
    }

    function claim () external {
        require(startAt + 30 days < block.timestamp, "Please claim rewards after the end of staking");
        require(!stakers[msg.sender].claimed, "Already claimed rewards");
        stakers[msg.sender].claimed = true;
        if (leaveOnContract > 0) {
            totalReward -= leaveOnContract;
            leaveOnContract = 0;
        }
        token.transfer(msg.sender, myRewards());
    }

    function withdrawToken (address _address, uint _amount) external onlyOwner {
        require(startAt + 30 days < block.timestamp, "Staking is not over");
        token.transfer(_address, _amount);
    }

    //================================VIEW FUNCTIONS================================

    //rewards is calculating each 1 min
    function leftStakingTime() public view returns(uint) {
        return (30 days - block.timestamp%startAt)/60;
    }

    function myRewards() public view returns(uint reward) {
        reward = totalReward/(allWeight/(stakers[msg.sender].weight+stakers[msg.sender].time * stakers[msg.sender].amount));
    }

}