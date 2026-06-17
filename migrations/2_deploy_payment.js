const MultiTokenPaymentIntegrated = artifacts.require("MultiTokenPaymentIntegrated");
const REAL_TOKENS = require('../config/tokens');

module.exports = async function (deployer, network, accounts) {
  console.log(`正在部署到网络: ${network}`);
  
  // 部署整合版本的合约
  await deployer.deploy(MultiTokenPaymentIntegrated);
  const payment = await MultiTokenPaymentIntegrated.deployed();
  await payment.addKnownNonStandardToken("0xdAC17F958D2ee523a2206206994597C13D831ec7")
  await payment.addKnownNonStandardToken("0x55d398326f99059fF775485246999027B3197955")
  await payment.addKnownNonStandardToken("0xc2132D05D31c914a87C6611C10748AEb04B58e8F")
  console.log(`MultiTokenPaymentIntegrated 已部署在地址: ${payment.address}`);
  
  if (network === 'development' || network === 'develop' || network === 'test') {
    // 开发网络：使用模拟代币
    console.log('正在为开发环境配置模拟代币...');
    
    // 假设您有模拟代币的部署
    // 这里添加模拟代币的配置
    
  } else if (network === 'mainnet') {
    // 主网配置
    console.log('正在为以太坊主网配置真实代币...');
    
    const networkTokens = REAL_TOKENS[network];
    if (networkTokens) {
      // 添加 USDT（标记为非标准代币）
      if (networkTokens.USDT) {
        let tokenInfo = networkTokens.USDT;
        await payment.addSupportedToken(
          tokenInfo.address,
          tokenInfo.symbol,
          tokenInfo.name,
          tokenInfo.decimals,
          true, // USDT 是非标准代币
          { from: accounts[0] }
        );
        console.log(`${tokenInfo.symbol} 已添加到支付合约（非标准代币）`);
      }
      
      // 添加 USDC（标准代币）
      if (networkTokens.USDC) {
        let tokenInfo = networkTokens.USDC;
        await payment.addSupportedToken(
          tokenInfo.address,
          tokenInfo.symbol,
          tokenInfo.name,
          tokenInfo.decimals,
          false, // USDC 是标准代币
          { from: accounts[0] }
        );
        console.log(`${tokenInfo.symbol} 已添加到支付合约`);
      }
    }
  }
  
  // 验证合约
  const version = await payment.getVersion();
  const supportedTokens = await payment.getSupportedTokens();
  
  console.log(`合约版本: ${version}`);
  console.log(`支持的代币数量: ${supportedTokens.length}`);
  
  for (let i = 0; i < supportedTokens.length; i++) {
    const token = supportedTokens[i];
    try {
      const tokenInfo = await payment.getTokenInfo(token);
      console.log(`  - ${tokenInfo.symbol} (${tokenInfo.name}): ${token}, 小数位数: ${tokenInfo.decimals}, 非标准代币: ${tokenInfo.isNonStandard}`);
    } catch (error) {
      console.log(`  - 未知代币: ${token}`);
    }
  }
};