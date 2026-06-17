// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "@openzeppelin/contracts/access/Ownable.sol";
import "./TokenBase.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
contract TokenManagement is Ownable {
    // 支持的代币列表
    address[] public supportedTokens;
    mapping(address => bool) public isTokenSupported;
    
    // 特殊代币标记
    mapping(address => bool) public isNonStandardToken;
    
    // 已知的非标准代币列表（如 USDT）
    mapping(address => bool) public knownNonStandardTokens;
    
    // 代币信息存储
    mapping(address => TokenInfo) public tokenInfo;
    
    // 代币信息结构
    struct TokenInfo {
        string symbol;
        string name;
        uint8 decimals;
        bool exists;
        bool isNonStandard;
    }
    
    // 事件定义
    event TokenAdded(address indexed token, string symbol, string name, bool isNonStandard);
    event TokenRemoved(address indexed token);
    event NonStandardTokenMarked(address indexed token, bool isNonStandard);
    
    modifier tokenSupported(address token) {
        require(isTokenSupported[token], "Token not supported");
        _;
    }

    constructor() {
        // 预标记已知的非标准代币
        _addKnownNonStandardToken(0xdAC17F958D2ee523a2206206994597C13D831ec7); // 主网 USDT
        _addKnownNonStandardToken(0x55d398326f99059fF775485246999027B3197955); // BSC USDT
        _addKnownNonStandardToken(0xc2132D05D31c914a87C6611C10748AEb04B58e8F); // Polygon USDT
    }

    function _addKnownNonStandardToken(address token) internal {
        knownNonStandardTokens[token] = true;
    }

    /**
     * @dev 检查代币是否为非标准代币
     */
    function checkTokenStandard(address token) public view returns (bool) {
        if (knownNonStandardTokens[token]) {
            return true;
        }
        
        try IERC20Metadata(token).decimals() returns (uint8) {
            return false;
        } catch {
            return true;
        }
    }

    /**
     * @dev 添加支持的代币
     */
    function addSupportedToken(
        address token, 
        string memory symbol, 
        string memory name, 
        uint8 decimals,
        bool isNonStandard
    ) public virtual onlyOwner {
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
     * @dev 自动添加支持的代币
     */
   function addSupportedTokenAuto(address token) public virtual onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!isTokenSupported[token], "Token already supported");
        
        isTokenSupported[token] = true;
        supportedTokens.push(token);
        
        string memory symbol = "UNKNOWN";
        string memory name = "UNKNOWN";
        uint8 decimals = 18;
        bool isNonStandard = knownNonStandardTokens[token];
        
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
        
        if (!isNonStandard) {
            isNonStandard = checkTokenStandard(token); // 这里调用了 view 函数
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
     * @dev 手动标记代币为标准/非标准
     */
    function markTokenAsNonStandard(address token, bool nonStandard) external onlyOwner {
        require(tokenInfo[token].exists, "Token info not found");
        tokenInfo[token].isNonStandard = nonStandard;
        isNonStandardToken[token] = nonStandard;
        emit NonStandardTokenMarked(token, nonStandard);
    }

    /**
     * @dev 移除支持的代币
     */
    function removeSupportedToken(address token) public virtual onlyOwner {
        require(isTokenSupported[token], "Token not supported");
        
        isTokenSupported[token] = false;
        delete tokenInfo[token];
        isNonStandardToken[token] = false;
        
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
     * @dev 获取所有支持的代币
     */
    function getSupportedTokens() public view virtual returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @dev 获取代币信息
     */
    function getTokenInfo(address token) public view virtual returns (string memory symbol, string memory name, uint8 decimals, bool isNonStandard) {
        require(tokenInfo[token].exists, "Token info not found");
        TokenInfo memory info = tokenInfo[token];
        return (info.symbol, info.name, info.decimals, info.isNonStandard);
    }

    /**
     * @dev 获取代币符号
     */
    function getTokenSymbol(address token) public view virtual returns (string memory) {
        require(tokenInfo[token].exists, "Token info not found");
        return tokenInfo[token].symbol;
    }

    /**
     * @dev 获取代币名称
     */
    function getTokenName(address token) public view virtual returns (string memory) {
        require(tokenInfo[token].exists, "Token info not found");
        return tokenInfo[token].name;
    }

    /**
     * @dev 获取代币小数位数
     */
    function getTokenDecimals(address token) public view virtual returns (uint8) {
        require(tokenInfo[token].exists, "Token info not found");
        return tokenInfo[token].decimals;
    }

    /**
     * @dev 安全授权检查
     */
    function _safeAllowance(
        address token,
        address owner,
        address spender
    ) internal view returns (uint256) {
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
     * @dev 安全余额检查
     */
    function _safeBalanceOf(
        address token,
        address account
    ) internal view returns (uint256) {
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
}