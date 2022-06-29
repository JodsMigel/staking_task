const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Staking", function () {
    
    let owner
    let acc1
    let acc2
    let acc3
    let acc4
    let contract
    let ttt
    let usdt
    const decimals = 1e18;

    beforeEach(async function(){
        [owner, acc1, acc2, acc3, acc4] = await ethers.getSigners()
        const TTT = await ethers.getContractFactory("TokenTokenToken", owner)
        ttt = await TTT.deploy()
        await ttt.deployed()
        const USDT = await ethers.getContractFactory("TetherToken", owner)
        usdt = await USDT.deploy(1000000, "FakeUSDT", "FUSDT", 18)
        await usdt.deployed()
        usdt.transfer(acc1.address, 250000)
        usdt.transfer(acc2.address, 250000)
        usdt.transfer(acc3.address, 250000)
        usdt.transfer(acc4.address, 250000)
        const STAKING = await ethers.getContractFactory("Staking", owner)
        contract = await STAKING.deploy(ttt.address, usdt.address)
        await contract.deployed()
        await ttt.mint(contract.address, 30000)
    })

    //===============================regular function===============================

    async function wait_time (time) {
        await ethers.provider.send("evm_increaseTime", [time])
        await ethers.provider.send("evm_mine")
    }

    async function stake_wait() {
        await usdt.connect(acc1).approve(contract.address, 10000)
        await usdt.connect(acc2).approve(contract.address, 10000)
        await usdt.connect(acc3).approve(contract.address, 10000)
        await usdt.connect(acc4).approve(contract.address, 10000)
        await contract.connect(acc1).stake(500)
        await contract.connect(acc2).stake(500)
        await contract.connect(acc3).stake(500)
        await contract.connect(acc4).stake(500)
        wait_time(2592000)
    }

    //===============================require test===============================

    it("Owner address is correct", async function(){
        expect(await contract.owner()).to.eq(owner.address)
    })

    it("Only owner can mint", async function(){
        await expect(ttt.connect(acc1).mint(contract.address, 30000)).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("Can not stake 0", async function(){
        await usdt.connect(acc1).approve(contract.address, 10000)
        await expect (contract.connect(acc1).stake(0)).to.be.revertedWith("Can not stake 0")
    })

    it("Can not unstake if user balance is 0", async function(){
        await expect (contract.connect(acc1).unstake()).to.be.revertedWith("Nothing to unstake")
    })

    it("Can not claim before the end of staking", async function(){
        await expect (contract.connect(acc1).claim()).to.be.revertedWith("Please claim rewards after the end of staking")
    })

    it("Can not claim twice", async function(){
        await stake_wait()
        contract.connect(acc1).claim()
        await expect (contract.connect(acc1).claim()).to.be.revertedWith("Already claimed rewards")
    })

    it("Only Owner can withdraw token and only after the end of staking", async function(){
        await expect (contract.connect(acc1).withdrawToken(owner.address, ttt.balanceOf(contract.address))).to.be.revertedWith("Ownable: caller is not the owner")
        await expect ( contract.withdrawToken(owner.address, ttt.balanceOf(contract.address))).to.be.revertedWith("Staking is not over")
        wait_time(2592000)
        await expect (contract.connect(acc1).withdrawToken(owner.address, ttt.balanceOf(contract.address))).to.be.revertedWith("Ownable: caller is not the owner")
        const contractBalance = await ttt.balanceOf(contract.address)
        await contract.withdrawToken(owner.address, ttt.balanceOf(contract.address))
        expect(await ttt.balanceOf(contract.address)).to.eq(0)
        expect(await ttt.balanceOf(owner.address)).to.eq(contractBalance)
    })

    //===============================main test===============================

    it("Can stake", async function(){
        await usdt.connect(acc1).approve(contract.address, 10000)
        await usdt.connect(acc2).approve(contract.address, 10000)
        await contract.connect(acc1).stake(500)
        expect((await contract.stakers(acc1.address)).amount).to.eq(500)
        expect((await contract.stakers(acc1.address)).time).to.above(43195)
        expect(await usdt.balanceOf(contract.address)).to.eq(500)
        await contract.connect(acc1).stake(500)
        await contract.connect(acc2).stake(2000)
        expect((await contract.stakers(acc1.address)).amount).to.eq(1000)
        expect((await contract.stakers(acc2.address)).amount).to.eq(2000)
        expect(await usdt.balanceOf(contract.address)).to.eq(3000)
    })

    it("Can unstake", async function(){
        await usdt.connect(acc1).approve(contract.address, 10000)
        await usdt.connect(acc2).approve(contract.address, 10000)
        await contract.connect(acc1).stake(500)
        await contract.connect(acc2).stake(500)
        wait_time(60)
        await contract.connect(acc1).unstake()
        //console.log(await contract.test())
        expect((await contract.stakers(acc1.address)).amount).to.eq(0)
        expect((await contract.stakers(acc1.address)).time).to.eq(0)
        expect((await contract.stakers(acc1.address)).weight).to.above(499)
        expect(await usdt.balanceOf(acc1.address)).to.eq(250000)
    })

    it("Rewards calculating is correct", async function(){
        await stake_wait()
        expect(await contract.connect(acc1).myRewards()/decimals).to.eq(7500)
        expect(await contract.connect(acc2).myRewards()/decimals).to.eq(7500)
        expect(await contract.connect(acc3).myRewards()/decimals).to.eq(7500)
        expect(await contract.connect(acc4).myRewards()/decimals).to.eq(7500)
    })
    
    it("Can claim", async function(){
        await stake_wait()
        await contract.connect(acc1).claim()
        expect(await ttt.balanceOf(acc1.address)/decimals).to.be.closeTo(7500, 0.5)
        expect(await ttt.balanceOf(contract.address)/decimals).to.be.closeTo(22500, 0.5)
        await contract.connect(acc2).claim()
        expect(await ttt.balanceOf(acc2.address)/decimals).to.be.closeTo(7500, 0.5)
        expect(await ttt.balanceOf(contract.address)/decimals).to.be.closeTo(15000, 0.5)
        await contract.connect(acc3).claim()
        expect(await ttt.balanceOf(acc1.address)/decimals).to.be.closeTo(7500, 0.5)
        expect(await ttt.balanceOf(contract.address)/decimals).to.be.closeTo(7500, 0.5)
        await contract.connect(acc4).claim()
        expect(await ttt.balanceOf(acc2.address)/decimals).to.be.closeTo(7500, 0.5)
        expect(await ttt.balanceOf(contract.address)/decimals).to.be.closeTo(0, 0.5)
    })

    it("Keep reward on contract if nobody is staking", async function(){
        wait_time(86400)
        await usdt.connect(acc1).approve(contract.address, 10000)
        await contract.connect(acc1).stake(500)
        expect (await contract.leaveOnContract()/decimals).to.be.closeTo(1000, 0.5)
        wait_time(2600000)
        await contract.connect(acc1).claim()
        expect(await ttt.balanceOf(acc1.address)/decimals).to.be.closeTo(29000, 0.5)
        expect(await ttt.balanceOf(contract.address)/decimals).to.be.closeTo(1000, 0.5)
    })

    it("Empty Time is starting correctly", async function(){
        expect (await contract.emptyTimeStart()).to.eq(await contract.startAt())
        await usdt.connect(acc1).approve(contract.address, 10000)
        await contract.connect(acc1).stake(500)
        wait_time(86400)
        await contract.connect(acc1).unstake()
        expect (await contract.emptyTimeStart()).to.above(await contract.startAt())
    })

})