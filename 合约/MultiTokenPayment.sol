// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PaymentOperations.sol";
import "./ViewFunctions.sol";

/**
 * @title MultiTokenPayment
 * @dev 多代币支付主合约，整合所有功能模块，特别支持 USDT 等非标准代币
 */
contract MultiTokenPayment is PaymentOperations, ViewFunctions {
    
    constructor() {
        // 构造函数
    }

    /**
     * @dev 重写版本函数以提供主合约版本信息
     */
    function getVersion() public pure override returns (string memory) {
        return "MultiTokenPayment v2.1 - Main Contract with USDT Support";
    }

    /**
     * @dev 重写代币管理函数
     */
    function addSupportedToken(
        address token, 
        string memory symbol, 
        string memory name, 
        uint8 decimals,
        bool isNonStandard
    ) public override(TokenManagement) onlyOwner {
        TokenManagement.addSupportedToken(token, symbol, name, decimals, isNonStandard);
    }

    function addSupportedTokenAuto(address token) public override(TokenManagement) onlyOwner {
        TokenManagement.addSupportedTokenAuto(token);
    }

    function removeSupportedToken(address token) public override(TokenManagement) onlyOwner {
        TokenManagement.removeSupportedToken(token);
    }

    /**
     * @dev 重写视图函数
     */
    function getSupportedTokens() public view override(TokenManagement) returns (address[] memory) {
        return TokenManagement.getSupportedTokens();
    }

    function getTokenInfo(address token) public view override(TokenManagement) returns (string memory symbol, string memory name, uint8 decimals, bool isNonStandard) {
        return TokenManagement.getTokenInfo(token);
    }

    /**
     * @dev 紧急停止函数
     */
    function emergencyWithdraw(address token, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient address");
        
        uint256 balance;
        if (isNonStandardToken[token]) {
            balance = IUSDT(token).balanceOf(address(this));
            if (balance > 0) {
                IUSDT(token).transfer(to, balance);
            }
        } else {
            balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                IERC20(token).transfer(to, balance);
            }
        }
    }
}