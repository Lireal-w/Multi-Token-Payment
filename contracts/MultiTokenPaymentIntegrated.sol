// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title IUSDT
 * @dev USDT等非标准ERC20代币的接口（无返回值的transfer/transferFrom）
 */
interface IUSDT {
    function transfer(address to, uint256 value) external;
    function transferFrom(address from, address to, uint256 value) external;
    function approve(address spender, uint256 value) external;
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MultiTokenPaymentIntegrated
 * @author 开发者
 * @notice 支持多代币支付的整合合约，兼容标准ERC20和非标准代币（如USDT）
 * @dev 整合版本避免重复定义，实现代币管理、单笔/批量支付功能
 */
contract MultiTokenPaymentIntegrated is Ownable, ReentrancyGuard {
    // 支持的代币列表（存储地址）
    address[] public supportedTokens;
    // 代币地址 => 是否支持的映射
    mapping(address => bool) public isTokenSupported;
    // 代币地址 => 是否为非标准代币的映射
    mapping(address => bool) public isNonStandardToken;
    // 已知的非标准代币列表（手动标记）
    mapping(address => bool) public knownNonStandardTokens;
    
    /**
     * @dev 代币信息结构体
     * @param symbol 代币符号（如USDT、ETH）
     * @param name 代币名称（如Tether USD）
     * @param decimals 代币小数位数
     * @param exists 是否存在该代币信息
     * @param isNonStandard 是否为非标准代币
     */
    struct TokenInfo {
        string symbol;
        string name;
        uint8 decimals;
        bool exists;
        bool isNonStandard;
    }
    // 代币地址 => 代币信息的映射
    mapping(address => TokenInfo) public tokenInfo;
    
    /**
     * @dev 事件：添加支持的代币
     * @param token 代币地址
     * @param symbol 代币符号
     * @param name 代币名称
     * @param isNonStandard 是否为非标准代币
     */
    event TokenAdded(address indexed token, string symbol, string name, bool isNonStandard);
    
    /**
     * @dev 事件：移除支持的代币
     * @param token 代币地址
     */
    event TokenRemoved(address indexed token);
    
    /**
     * @dev 事件：单笔支付完成
     * @param from 支付发起方
     * @param to 接收方
     * @param token 支付代币地址
     * @param amount 支付金额
     * @param timestamp 支付时间戳
     * @param isNonStandardToken 是否为非标准代币
     */
    event PaymentProcessed(
        address indexed from,
        address indexed to,
        address indexed token,
        uint256 amount,
        uint256 timestamp,
        bool isNonStandardToken
    );
    
    /**
     * @dev 事件：多代币批量支付完成
     * @param from 支付发起方
     * @param recipients 接收方列表
     * @param tokens 支付代币列表
     * @param amounts 支付金额列表
     * @param timestamp 支付时间戳
     */
    event MultiTokenPaymentProcessed(
        address indexed from,
        address[] recipients,
        address[] tokens,
        uint256[] amounts,
        uint256 timestamp
    );
    
    /**
     * @dev 修饰器：检查代币是否被支持
     * @param token 代币地址
     */
    modifier tokenSupported(address token) {
        require(isTokenSupported[token], "Token not supported");
        _;
    }

    /**
     * @dev 构造函数：初始化已知的非标准代币（默认注释，可手动启用）
     */
    constructor() {
        // 预标记已知的非标准代币（主网/BSC/Polygon USDT）
        // _addKnownNonStandardToken(0xdAC17F958D2ee523a2206206994597C13D831ec7);
        // _addKnownNonStandardToken(0x55d398326f99059fF775485246999027B3197955);
        // _addKnownNonStandardToken(0xc2132D05D31c914a87C6611C10748AEb04B58e8F);
    }

    /**
     * @dev 添加已知的非标准代币（仅Owner）
     * @param token 代币地址
     */
    function addKnownNonStandardToken(address token) public onlyOwner {
        knownNonStandardTokens[token] = true;
    }

    /**
     * @dev 检查代币是否为标准ERC20（通过尝试调用metadata接口）
     * @param token 代币地址
     * @return 是否为非标准代币
     */
    function checkTokenStandard(address token) public view returns (bool) {
        if (knownNonStandardTokens[token]) {
            return true;
        }
        
        try IERC20Metadata(token).decimals() returns (uint8) {
            return false; // 标准代币
        } catch {
            return true; // 非标准代币
        }
    }

    /**
     * @dev 手动添加支持的代币（指定信息，仅Owner）
     * @param token 代币地址
     * @param symbol 代币符号
     * @param name 代币名称
     * @param decimals 小数位数
     * @param isNonStandard 是否为非标准代币
     */
    function addSupportedToken(
        address token, 
        string memory symbol, 
        string memory name, 
        uint8 decimals,
        bool isNonStandard
    ) public onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!isTokenSupported[token], "Token already supported");
        
        isTokenSupported[token] = true;
        supportedTokens.push(token);
        
        bool detectedNonStandard = isNonStandard;
        if (!isNonStandard) {
            detectedNonStandard = checkTokenStandard(token);
        }
        
        tokenInfo[token] = TokenInfo({
            symbol: symbol,
            name: name,
            decimals: decimals,
            exists: true,
            isNonStandard: detectedNonStandard
        });
        
        isNonStandardToken[token] = detectedNonStandard;
        
        emit TokenAdded(token, symbol, name, detectedNonStandard);
    }

    /**
     * @dev 自动添加支持的代币（自动探测信息，仅Owner）
     * @param token 代币地址
     */
    function addSupportedTokenAuto(address token) public onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!isTokenSupported[token], "Token already supported");
        
        isTokenSupported[token] = true;
        supportedTokens.push(token);
        
        string memory symbol = "UNKNOWN";
        string memory name = "UNKNOWN";
        uint8 decimals = 18;
        bool isNonStandard = knownNonStandardTokens[token];
        
        // 尝试读取标准ERC20Metadata信息
        if (!isNonStandard) {
            try IERC20Metadata(token).symbol() returns (string memory s) {
                symbol = s;
            } catch {
                isNonStandard = true;
            }
            
            try IERC20Metadata(token).name() returns (string memory n) {
                name = n;
            } catch {
                isNonStandard = true;
            }
            
            try IERC20Metadata(token).decimals() returns (uint8 d) {
                decimals = d;
            } catch {
                isNonStandard = true;
            }
        }
        
        // 二次验证代币标准
        if (!isNonStandard) {
            isNonStandard = checkTokenStandard(token);
        }
        
        tokenInfo[token] = TokenInfo({
            symbol: symbol,
            name: name,
            decimals: decimals,
            exists: true,
            isNonStandard: isNonStandard
        });
        
        isNonStandardToken[token] = isNonStandard;
        
        emit TokenAdded(token, symbol, name, isNonStandard);
    }

    /**
     * @dev 移除支持的代币（仅Owner）
     * @param token 代币地址
     */
    function removeSupportedToken(address token) public onlyOwner {
        require(isTokenSupported[token], "Token not supported");
        
        isTokenSupported[token] = false;
        delete tokenInfo[token];
        isNonStandardToken[token] = false;
        
        // 从数组中移除代币地址（替换最后一个元素并弹出）
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }
        
        emit TokenRemoved(token);
    }

    /**
     * @dev 内部函数：安全获取授权额度（兼容标准/非标准代币）
     * @param token 代币地址
     * @param owner 授权方
     * @param spender 被授权方
     * @return 授权额度
     */
    function _safeAllowance(address token, address owner, address spender) internal view returns (uint256) {
        if (isNonStandardToken[token]) {
            try IUSDT(token).allowance(owner, spender) returns (uint256 allowanceAmount) {
                return allowanceAmount;
            } catch {
                return 0;
            }
        } else {
            try IERC20(token).allowance(owner, spender) returns (uint256 allowanceAmount) {
                return allowanceAmount;
            } catch {
                return 0;
            }
        }
    }

    /**
     * @dev 内部函数：安全获取余额（兼容标准/非标准代币）
     * @param token 代币地址
     * @param account 账户地址
     * @return 账户余额
     */
    function _safeBalanceOf(address token, address account) internal view returns (uint256) {
        if (isNonStandardToken[token]) {
            try IUSDT(token).balanceOf(account) returns (uint256 balance) {
                return balance;
            } catch {
                return 0;
            }
        } else {
            try IERC20(token).balanceOf(account) returns (uint256 balance) {
                return balance;
            } catch {
                return 0;
            }
        }
    }

    /**
     * @dev 内部函数：安全转账（兼容标准/非标准代币）
     * @param token 代币地址
     * @param from 转出方
     * @param to 转入方
     * @param amount 转账金额
     * @return 是否转账成功
     */
    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal returns (bool) {
        if (isNonStandardToken[token]) {
            try IUSDT(token).transferFrom(from, to, amount) {
                return true;
            } catch (bytes memory) {
                return false;
            }
        } else {
            try IERC20(token).transferFrom(from, to, amount) returns (bool success) {
                return success;
            } catch (bytes memory) {
                return false;
            }
        }
    }

    /**
     * @dev 单笔代币支付（用户调用）
     * @param token 支付代币地址
     * @param to 接收方地址
     * @param amount 支付金额
     * @return 是否支付成功
     */
    function makePayment(address token, address to, uint256 amount) external nonReentrant tokenSupported(token) returns (bool) {
        uint256 allowedAmount = _safeAllowance(token, msg.sender, address(this));
        require(allowedAmount >= amount, "Insufficient allowance");
        
        uint256 userBalance = _safeBalanceOf(token, msg.sender);
        require(userBalance >= amount, "Insufficient balance");
        
        bool success = _safeTransferFrom(token, msg.sender, to, amount);
        require(success, "Transfer failed");
        
        emit PaymentProcessed(msg.sender, to, token, amount, block.timestamp, isNonStandardToken[token]);
        return true;
    }

    /**
     * @dev 批量支付（同一代币，多接收方）
     * @param token 支付代币地址
     * @param recipients 接收方列表
     * @param amounts 支付金额列表
     * @return 是否支付成功
     */
    function batchPayments(address token, address[] calldata recipients, uint256[] calldata amounts) external nonReentrant tokenSupported(token) returns (bool) {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "No recipients provided");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            totalAmount += amounts[i];
        }
        
        uint256 allowedAmount = _safeAllowance(token, msg.sender, address(this));
        require(allowedAmount >= totalAmount, "Insufficient total allowance");
        
        uint256 userBalance = _safeBalanceOf(token, msg.sender);
        require(userBalance >= totalAmount, "Insufficient total balance");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient address");
            bool success = _safeTransferFrom(token, msg.sender, recipients[i], amounts[i]);
            require(success, "Batch transfer failed");
        }
        
        return true;
    }

    /**
     * @dev 获取所有支持的代币列表
     * @return 代币地址数组
     */
    function getSupportedTokens() public view returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @dev 获取代币详细信息
     * @param token 代币地址
     * @return symbol 代币符号
     * @return name 代币名称
     * @return decimals 小数位数
     * @return isNonStandard 是否为非标准代币
     */
    function getTokenInfo(address token) public view returns (string memory symbol, string memory name, uint8 decimals, bool isNonStandard) {
        require(tokenInfo[token].exists, "Token info not found");
        TokenInfo memory info = tokenInfo[token];
        return (info.symbol, info.name, info.decimals, info.isNonStandard);
    }

    /**
     * @dev 检查用户对合约的代币授权额度
     * @param token 代币地址
     * @param user 用户地址
     * @return 授权额度
     */
    function checkAllowance(address token, address user) public view tokenSupported(token) returns (uint256) {
        return _safeAllowance(token, user, address(this));
    }

    /**
     * @dev 检查用户的代币余额
     * @param token 代币地址
     * @param user 用户地址
     * @return 账户余额
     */
    function checkBalance(address token, address user) public view tokenSupported(token) returns (uint256) {
        return _safeBalanceOf(token, user);
    }

    /**
     * @dev 获取合约版本信息
     * @return 版本字符串
     */
    function getVersion() public pure returns (string memory) {
        return "MultiTokenPayment v2.1 - Integrated";
    }
    
    /**
     * @dev 检查用户对所有支持代币的授权额度
     * @return tokens 代币地址列表
     * @return allowances 对应授权额度列表
     */
    function checkAllAllowances(address user) 
        public 
        view 
        returns (address[] memory, uint256[] memory) 
    {
        uint256 length = supportedTokens.length;
        address[] memory tokens = new address[](length);
        uint256[] memory allowances = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            address token = supportedTokens[i];
            tokens[i] = token;
            allowances[i] = checkAllowance(token, user);
        }
        
        return (tokens, allowances);
    }
    
    /**
     * @dev 多代币批量支付（不同代币对应不同接收方）
     * @param tokens 代币列表
     * @param recipients 接收方列表
     * @param amounts 金额列表
     * @return 是否支付成功
     */
    function makeMultiTokenPayment(
        address[] calldata tokens,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) 
        external 
        nonReentrant 
        returns (bool) 
    {
        require(
            tokens.length == recipients.length && recipients.length == amounts.length,
            "Arrays length mismatch"
        );
        require(tokens.length > 0, "No tokens provided");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            require(isTokenSupported[tokens[i]], "Token not supported");
            require(recipients[i] != address(0), "Invalid recipient address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            
            uint256 allowedAmount = _safeAllowance(tokens[i], msg.sender, address(this));
            require(allowedAmount >= amounts[i], "Insufficient allowance for token");
            
            uint256 userBalance = _safeBalanceOf(tokens[i], msg.sender);
            require(userBalance >= amounts[i], "Insufficient balance for token");
            
            bool success = _safeTransferFrom(tokens[i], msg.sender, recipients[i], amounts[i]);
            require(success, "Transfer failed for token");
        }
        
        emit MultiTokenPaymentProcessed(
            msg.sender,
            recipients,
            tokens,
            amounts,
            block.timestamp
        );
        
        return true;
    }
}