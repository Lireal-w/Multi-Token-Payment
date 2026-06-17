# 💰 Multi-Token Payment（多代币支付系统）

基于以太坊智能合约的多代币支付系统，支持标准 ERC20 和非标准代币（如 USDT）的安全支付、批量支付与多代币混合支付。

## ✨ 功能特性

- **单笔支付** — 使用任意已支持的代币向指定地址支付
- **批量支付** — 同一种代币向多个接收方批量转账
- **多代币支付** — 在一次交易中使用不同代币向不同接收方支付
- **代币管理** — 合约 Owner 可添加/移除支持的代币，自动探测代币标准
- **非标准代币兼容** — 特别支持 USDT 等不遵循 ERC20 返回值的代币
- **安全防护** — 集成 OpenZeppelin 的 `Ownable` 和 `ReentrancyGuard`
- **代币提取** — `TokenExtractorV2` 合约支持从授权地址提取代币及误打代币回收
- **前端界面** — 基于 Bootstrap 5 的 Web UI，支持代币管理、支付操作和账户信息查询

## 🏗️ 项目结构

```
Multi-Token-Payment/
├── contracts/                          # Truffle 合约源码
│   ├── MultiTokenPaymentIntegrated.sol  # 整合版合约（单文件，推荐部署）
│   ├── TokenExtractorV2.sol             # 代币提取合约
│   ├── MockUSDT.sol                     # 模拟 USDT（测试用）
│   └── MockUSDC.sol                     # 模拟 USDC（测试用）
├── 合约/                                # 模块化合约源码
│   ├── MultiTokenPayment.sol            # 主合约
│   ├── TokenBase.sol                    # IUSDT 接口定义
│   ├── TokenManagement.sol              # 代币管理模块
│   ├── PaymentOperations.sol            # 支付操作模块
│   └── ViewFunctions.sol                # 查询函数模块
├── migrations/                          # 部署脚本
│   └── 2_deploy_payment.js
├── test/                                # 测试文件
│   └── multi_token_payment_test.js
├── config/                              # 配置文件
│   └── tokens.js                        # 各网络代币地址配置
├── static1/                             # 前端页面
│   ├── index.html                       # 首页
│   ├── token-management.html            # 代币管理
│   ├── single-payment.html              # 单笔支付
│   ├── batch-payment.html               # 批量支付
│   ├── multi-token-payment.html         # 多代币支付
│   ├── user-info.html                   # 账户信息
│   └── js/                              # 前端脚本
├── app.js                               # Express 服务器入口
├── truffle-config.js                    # Truffle 配置
└── package.json
```

## 📜 合约架构

项目提供两种合约版本：

### 整合版（推荐）

`MultiTokenPaymentIntegrated.sol` — 将所有功能整合在单个合约文件中，便于部署和验证。

### 模块化版

采用继承式模块设计，便于开发和维护：

```
TokenBase（IUSDT 接口）
    └── TokenManagement（Ownable，代币管理）
            ├── PaymentOperations（ReentrancyGuard，支付操作）
            └── ViewFunctions（查询函数）
                    └── MultiTokenPayment（主合约）
```

### TokenExtractorV2

独立的代币提取合约，支持：
- 从授权地址拉取代币到指定地址
- 回收误打到合约地址的代币
- 低级调用兼容非标准代币

## 🚀 快速开始

### 环境要求

- Node.js >= 14.x
- Truffle >= 5.11.5
- Ganache（本地开发）或连接到以太坊测试网/主网

### 安装依赖

```bash
npm install
```

### 本地开发

1. 启动 Ganache 或本地区块链节点：

```bash
ganache-cli
```

2. 编译合约：

```bash
npx truffle compile
```

3. 部署合约到本地网络：

```bash
npx truffle migrate --network development
```

4. 运行测试：

```bash
npx truffle test
```

### 部署到测试网/主网

1. 配置 `.env` 文件：

```
PRIVATE_KEYS=你的私钥1,你的私钥2
INFURA_API_KEY=你的Infura API密钥
```

2. 部署到 Sepolia 测试网：

```bash
npx truffle migrate --network sepolia
```

3. 部署到 BSC 主网：

```bash
npx truffle migrate --network bsc
```

### 启动前端服务

```bash
node app.js
```

访问 `http://127.0.0.1:8081` 即可使用 Web 界面。

## 🔧 合约接口

### 代币管理（仅 Owner）

```solidity
// 添加支持的代币（手动指定信息）
function addSupportedToken(
    address token,
    string memory symbol,
    string memory name,
    uint8 decimals,
    bool isNonStandard
) public onlyOwner

// 自动探测并添加支持的代币
function addSupportedTokenAuto(address token) public onlyOwner

// 移除支持的代币
function removeSupportedToken(address token) public onlyOwner

// 标记已知的非标准代币
function addKnownNonStandardToken(address token) public onlyOwner
```

### 支付操作

```solidity
// 单笔支付
function makePayment(address token, address to, uint256 amount) external nonReentrant returns (bool)

// 批量支付（同一代币，多接收方）
function batchPayments(
    address token,
    address[] calldata recipients,
    uint256[] calldata amounts
) external nonReentrant returns (bool)

// 多代币批量支付（不同代币对应不同接收方）
function makeMultiTokenPayment(
    address[] calldata tokens,
    address[] calldata recipients,
    uint256[] calldata amounts
) external nonReentrant returns (bool)
```

### 查询函数

```solidity
// 获取所有支持的代币
function getSupportedTokens() public view returns (address[] memory)

// 获取代币详细信息
function getTokenInfo(address token) public view returns (string memory symbol, string memory name, uint8 decimals, bool isNonStandard)

// 检查授权额度
function checkAllowance(address token, address user) public view returns (uint256)

// 检查余额
function checkBalance(address token, address user) public view returns (uint256)

// 检查所有代币的授权额度
function checkAllAllowances(address user) public view returns (address[] memory, uint256[] memory)

// 检查代币是否为非标准代币
function checkTokenStandard(address token) public view returns (bool)
```

## 🛡️ 安全特性

- **重入攻击防护** — 所有支付函数均使用 `nonReentrant` 修饰器
- **所有权控制** — 代币管理操作仅限合约 Owner
- **非标准代币安全处理** — 使用 try/catch 模式兼容 USDT 等不返回 `bool` 值的代币
- **余额与授权检查** — 支付前验证余额和授权额度是否充足
- **零地址校验** — 防止向零地址转账

## 🌐 支持的网络

| 网络     | 说明              |
| -------- | ----------------- |
| Ethereum | 主网 / Sepolia 测试网 |
| BSC      | BNB Smart Chain  |
| Polygon  | Polygon 主网      |

## 🧪 测试

测试覆盖以下场景：

- 合约部署与代币管理
- 单笔代币支付
- 批量支付
- 多代币支付
- 非标准代币（USDT）兼容性
- 授权额度与余额检查
- 异常情况处理

```bash
npx truffle test
```

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/your-feature`)
3. 提交更改 (`git commit -m 'Add some feature'`)
4. 推送到分支 (`git push origin feature/your-feature`)
5. 创建 Pull Request