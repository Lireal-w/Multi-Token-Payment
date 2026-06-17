// 各网络的主流代币地址
const TOKENS = {
  mainnet: {
    USDT: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6
    },
    USDC: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6
    }
  },
  goerli: {
    USDT: {
      address: '0xC2C527C0CACF457746Bd31B2a698Fe89de2b6d49',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6
    },
    USDC: {
      address: '0x07865c6E87B9F70255377e024ace6630C1Eaa37F',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6
    }
  },
  polygon: {
    USDT: {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6
    },
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6
    }
  },
  bsc: {
    USDT: {
      address: '0x55d398326f99059fF775485246999027B3197955',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18
    },
    USDC: {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 18
    }
  }
};

module.exports = TOKENS;