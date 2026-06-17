// 1_deploy_mock_tokens.js
const MockUSDT = artifacts.require("MockUSDT");
const MockUSDC = artifacts.require("MockUSDC");

module.exports = async function (deployer, network, accounts) {
  // 仅在开发网络部署模拟代币
  if (network === 'development' || network === 'develop' || network === 'test') {
    console.log('正在为开发网络部署模拟代币...');
    
    await deployer.deploy(MockUSDT);
    await deployer.deploy(MockUSDC);
    
    const usdt = await MockUSDT.deployed();
    const usdc = await MockUSDC.deployed();
    
    console.log('MockUSDT 部署地址:', usdt.address);
    console.log('MockUSDC 部署地址:', usdc.address);
    
    // 在开发网络中，可以给一些账户预分配代币以便测试
    if (accounts.length > 1) {
      const initialSupply = "10000000000"; // 10000 * 10^6
      
      // 给前几个测试账户分配代币
      for (let i = 1; i < Math.min(accounts.length, 5); i++) {
        await usdt.mint(accounts[i], initialSupply, { from: accounts[0] });
        await usdc.mint(accounts[i], initialSupply, { from: accounts[0] });
        console.log(`已为账户铸造模拟代币: ${accounts[i]}`);
      }
    }
  } else {
    console.log(`跳过模拟代币部署，当前网络: ${network}`);
    console.log('在此网络上使用真实代币。');
  }
};