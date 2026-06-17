// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 只保留 USDT 特殊接口，移除重复的 ERC20 接口定义
interface IUSDT {
    function transfer(address to, uint256 value) external;
    function transferFrom(address from, address to, uint256 value) external;
    function approve(address spender, uint256 value) external;
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}