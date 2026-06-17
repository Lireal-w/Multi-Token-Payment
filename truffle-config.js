// module.exports = {
//   // Uncommenting the defaults below 
//   // provides for an easier quick-start with Ganache.
//   // You can also follow this format for other networks;
//   // see <http://truffleframework.com/docs/advanced/configuration>
//   // for more details on how to specify configuration options!
//   //
//   networks: {
//     development: {
//       host: "127.0.0.1",
//       port: 8545,
//       network_id: "*"
//     }
//   }
//   //networks: {
//   //  development: {
//   //    host: "127.0.0.1",
//   //    port: 7545,
//   //    network_id: "*"
//   //  },
//   //  test: {
//   //    host: "127.0.0.1",
//   //    port: 7545,
//   //    network_id: "*"
//   //  }
//   //}
//   //
// };
const HDWalletProvider = require("@truffle/hdwallet-provider");
require('dotenv').config()
PRIVATE_KEYS = process.env.PRIVATE_KEYS
INFURA_API_KEY = process.env.INFURA_API_KEY
module.exports = {
  // 网络配置
  networks: {
    // 本地开发网络
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // 匹配任何网络ID
      gas: 6721975, // 区块Gas上限
      gasPrice: 20000000000 // 20 Gwei
    },
    // Ethereum测试网 - Sepolia
    sepolia: {
      provider: () => {
        // 使用环境变量或私钥文件加载私钥
        // const privateKeys = PRIVATE_KEYS || "";
        return new HDWalletProvider(
          PRIVATE_KEYS.split(','),
          `https://sepolia.infura.io/v3/${INFURA_API_KEY}`
        );
      },
      network_id: 11155111, // Sepolia网络ID
      gas: 8000000,
      gasPrice: 30000000000, // 30 Gwei
      confirmations: 2, // 确认区块数
      timeoutBlocks: 200, // 超时区块数
      skipDryRun: true // 跳过预部署检查
    },
    
    // Ethereum测试网 - Goerli (已弃用，但保留)
    goerli: {
      provider: () => {
        return new HDWalletProvider(
          PRIVATE_KEYS.split(','),
          `https://sepolia.infura.io/v3/${INFURA_API_KEY}`
        );
      },
      network_id: 5, // Goerli网络ID
      gas: 8000000,
      gasPrice: 30000000000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    
    // Ethereum主网
    mainnet: {
      provider: () => {
        // return new HDWalletProvider(
        //   PRIVATE_KEYS.split(','),
        //   `https://mainnet.infura.io/v3/${INFURA_API_KEY}`
        // );
        return new HDWalletProvider(PRIVATE_KEYS.split(','), `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`)
      },
      // network_id: 1, // 主网ID
      network_id: "*",
      gas: 8000000,
      // gasPrice: 20000000000, // 20 Gwei
      maxFeePerGas: 50000000000, // 50 Gwei
      maxPriorityFeePerGas: 2000000000, // 2 Gwei
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      networkCheckTimeout: 100000, // 增加网络检查超时时间
      deploymentPollingInterval: 8000,
    },
      
    // BSC测试网
    bscTestnet: {
      provider: () => {
        return new HDWalletProvider(
          PRIVATE_KEYS.split(','),
          `https://data-seed-prebsc-1-s1.binance.org:8545`
        );
      },
      network_id: 97, // BSC测试网ID
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    
    // BSC主网
    bscMainnet: {
      provider: () => {
        return new HDWalletProvider(
          PRIVATE_KEYS.split(','),
          `https://bsc-dataseed.binance.org/`
        );
      },
      network_id: 56, // BSC主网ID
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: false
    },
    
    // Polygon测试网
    mumbai: {
      provider: () => {
        return new HDWalletProvider(
          PRIVATE_KEYS.split(','),
          `https://rpc-mumbai.maticvigil.com`
        );
      },
      network_id: 80001, // Mumbai测试网ID
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    
    // Polygon主网
    polygon: {
      provider: () => {
        return new HDWalletProvider(
          PRIVATE_KEYS.split(','),
          `https://polygon-rpc.com`
        );
      },
      network_id: 137, // Polygon主网ID
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: false
    }
  },
  
  // 编译器配置
  compilers: {
    solc: {
      version: "0.8.0", // 指定编译器版本
      settings: {
        optimizer: {
          enabled: true, // 启用优化器
          runs: 200 // 优化运行次数
        }
      }
    }
  },
  
  // 测试配置
  mocha: {
    reporter: 'eth-gas-reporter', // 燃气报告器
    reporterOptions: {
      currency: 'USD', // 货币单位
      gasPrice: 20, // 燃气价格 (Gwei)
      showTimeSpent: true, // 显示测试耗时
      excludeContracts: ['Migrations'], // 排除的合约
      src: './contracts' // 合约目录
    },
    timeout: 60000 // 测试超时时间
  },
  
  // 插件配置
  plugins: [
    'truffle-plugin-verify', // 合约验证插件
    'solidity-coverage' // 代码覆盖率插件
  ],
  
  // Etherscan验证配置
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY, // Etherscan API密钥
    bscscan: process.env.BSCSCAN_API_KEY, // Bscscan API密钥
    polygonscan: process.env.POLYGONSCAN_API_KEY // Polygonscan API密钥
  }
};
