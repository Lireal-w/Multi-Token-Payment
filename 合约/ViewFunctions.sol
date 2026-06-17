// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TokenManagement.sol";

contract ViewFunctions is TokenManagement {
    /**
     * @dev 检查用户对特定代币的授权额度
     */
    function checkAllowance(address token, address user) 
        public 
        view 
        tokenSupported(token) 
        returns (uint256) 
    {
        return _safeAllowance(token, user, address(this));
    }

    /**
     * @dev 检查用户余额
     */
    function checkBalance(address token, address user) 
        public 
        view 
        tokenSupported(token) 
        returns (uint256) 
    {
        return _safeBalanceOf(token, user);
    }

    /**
     * @dev 检查用户对所有支持代币的授权额度
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
     * @dev 检查用户对所有支持代币的余额
     */
    function checkAllBalances(address user) 
        public 
        view 
        returns (address[] memory, uint256[] memory) 
    {
        uint256 length = supportedTokens.length;
        address[] memory tokens = new address[](length);
        uint256[] memory balances = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            address token = supportedTokens[i];
            tokens[i] = token;
            balances[i] = checkBalance(token, user);
        }
        
        return (tokens, balances);
    }

    /**
     * @dev 检查支付资格
     */
    function checkPaymentEligibility(
        address token,
        address user, 
        uint256 amount
    ) 
        external 
        view 
        tokenSupported(token) 
        returns (bool canPay, uint256 allowance, uint256 balance, bool isNonStandard) 
    {
        allowance = checkAllowance(token, user);
        balance = checkBalance(token, user);
        canPay = (allowance >= amount && balance >= amount);
        isNonStandard = isNonStandardToken[token];
    }

    /**
     * @dev 批量检查支付资格
     */
    function batchCheckPaymentEligibility(
        address token,
        address[] calldata users, 
        uint256[] calldata amounts
    ) 
        external 
        view 
        tokenSupported(token) 
        returns (bool[] memory canPay, uint256[] memory allowances, uint256[] memory balances) 
    {
        require(users.length == amounts.length, "Arrays length mismatch");
        
        canPay = new bool[](users.length);
        allowances = new uint256[](users.length);
        balances = new uint256[](users.length);
        
        for (uint256 i = 0; i < users.length; i++) {
            allowances[i] = checkAllowance(token, users[i]);
            balances[i] = checkBalance(token, users[i]);
            canPay[i] = (allowances[i] >= amounts[i] && balances[i] >= amounts[i]);
        }
    }

    /**
     * @dev 获取合约统计信息
     */
    function getContractStats() 
        external 
        view 
        returns (
            uint256 supportedTokensCount,
            uint256 standardTokensCount,
            uint256 nonStandardTokensCount
        ) 
    {
        supportedTokensCount = supportedTokens.length;
        
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (isNonStandardToken[supportedTokens[i]]) {
                nonStandardTokensCount++;
            } else {
                standardTokensCount++;
            }
        }
    }

    /**
     * @dev 获取合约版本信息 - 标记为 virtual 以便重写
     */
    function getVersion() public pure virtual returns (string memory) {
        return "MultiTokenPayment v2.1 - USDT Support";
    }
}