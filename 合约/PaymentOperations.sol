// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TokenManagement.sol";

contract PaymentOperations is TokenManagement, ReentrancyGuard {
    // 事件定义
    event PaymentProcessed(
        address indexed from,
        address indexed to,
        address indexed token,
        uint256 amount,
        uint256 timestamp,
        bool isNonStandardToken
    );

    event BatchPaymentProcessed(
        address indexed from,
        address[] recipients,
        address indexed token,
        uint256[] amounts,
        uint256 timestamp
    );

    event MultiTokenPaymentProcessed(
        address indexed from,
        address[] recipients,
        address[] tokens,
        uint256[] amounts,
        uint256 timestamp
    );

    /**
     * @dev 安全转账函数
     */
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal returns (bool) {
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
     * @dev 使用指定代币进行支付
     */
    function makePayment(
        address token,
        address to, 
        uint256 amount
    ) 
        external 
        nonReentrant
        tokenSupported(token) 
        returns (bool) 
    {
        uint256 allowedAmount = _safeAllowance(token, msg.sender, address(this));
        require(allowedAmount >= amount, "Insufficient allowance");
        
        uint256 userBalance = _safeBalanceOf(token, msg.sender);
        require(userBalance >= amount, "Insufficient balance");
        
        bool success = _safeTransferFrom(token, msg.sender, to, amount);
        require(success, "Transfer failed");
        
        emit PaymentProcessed(
            msg.sender, 
            to, 
            token, 
            amount, 
            block.timestamp,
            isNonStandardToken[token]
        );
        return true;
    }

    /**
     * @dev 批量支付
     */
    function batchPayments(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) 
        external 
        nonReentrant
        tokenSupported(token) 
        returns (bool) 
    {
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
        
        emit BatchPaymentProcessed(
            msg.sender,
            recipients,
            token,
            amounts,
            block.timestamp
        );
        
        return true;
    }

    /**
     * @dev 使用多种代币进行支付
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