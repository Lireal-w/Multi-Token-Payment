function updateWalletStatus() {
    const walletStatusElements = document.querySelectorAll('#walletStatus');
    const connectButtons = document.querySelectorAll('#connectWallet');

    walletStatusElements.forEach(element => {
        if (APP_STATE.account) {
            const statusBadge = element.querySelector('.badge') || element;
            statusBadge.className = 'badge bg-success';
            statusBadge.textContent = `已连接: ${CommonUtils.formatAddress(APP_STATE.account)}`;

            // 显示网络信息
            const networkInfo = document.createElement('small');
            networkInfo.className = 'ms-2';
            networkInfo.textContent = `网络: ${CommonUtils.getNetworkName(APP_STATE.networkId)}`;
            element.appendChild(networkInfo);
        } else {
            element.innerHTML = '钱包状态: <span class="badge bg-secondary">未连接</span>';
        }
    });

    connectButtons.forEach(button => {
        if (APP_STATE.account) {
            button.innerHTML = '<i class="fas fa-check me-2"></i>已连接';
            button.className = 'btn btn-success';
            button.disabled = true;
        }
    });
}

// 通用工具函数
class CommonUtils {
    // 初始化Web3
    static async initWeb3() {
        if (window.ethereum) {
            try {
                APP_STATE.web3 = new Web3(window.ethereum);
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                return true;
            } catch (error) {
                console.error("用户拒绝连接钱包:", error);
                return false;
            }
        } else if (window.web3) {
            APP_STATE.web3 = new Web3(window.web3.currentProvider);
            return true;
        } else {
            console.error("请安装MetaMask!");
            return false;
        }
    }

    // 初始化合约
    static async initContract() {
        if (!APP_STATE.web3) {
            throw new Error("Web3未初始化");
        }

        APP_STATE.contract = new APP_STATE.web3.eth.Contract(
            CONTRACT_CONFIG.abi,
            CONTRACT_CONFIG.address
        );

        return APP_STATE.contract;
    }

    // 获取账户信息
    static async getAccounts() {
        if (!APP_STATE.web3) return null;

        try {
            const accounts = await APP_STATE.web3.eth.getAccounts();
            APP_STATE.account = accounts[0];
            return APP_STATE.account;
        } catch (error) {
            console.error("获取账户失败:", error);
            return null;
        }
    }

    // 获取网络信息
    static async getNetwork() {
        if (!APP_STATE.web3) return null;

        try {
            APP_STATE.networkId = await APP_STATE.web3.eth.net.getId();
            return APP_STATE.networkId;
        } catch (error) {
            console.error("获取网络失败:", error);
            return null;
        }
    }

    // 检查是否为合约所有者
    static async checkOwner() {
        if (!APP_STATE.contract) return false;

        try {
            const owner = await APP_STATE.contract.methods.owner().call();
            APP_STATE.isOwner = (owner.toLowerCase() === APP_STATE.account.toLowerCase());
            return APP_STATE.isOwner;
        } catch (error) {
            console.error("检查所有者失败:", error);
            return false;
        }
    }

    // 格式化地址显示
    static formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    // 格式化金额（考虑小数位数）
    static formatAmount(amount, decimals = 18) {
        if (!amount) return '0';
        const formatted = APP_STATE.web3.utils.fromWei(amount.toString(), 'ether');
        const parts = formatted.split('.');
        if (parts.length === 1) return formatted;

        // 根据小数位数调整显示精度
        let precision = Math.min(decimals, 6);
        return Number(formatted).toFixed(precision);
    }

    // 转换为Wei
    static toWei(amount, decimals = 18) {
        return APP_STATE.web3.utils.toWei(amount.toString(), 'ether');
    }

    // 从Wei转换
    static fromWei(amount, decimals = 18) {
        return APP_STATE.web3.utils.fromWei(amount.toString(), 'ether');
    }

    // 显示通知
    static showNotification(message, type = 'info') {
        // 移除现有的通知
        const existingNotification = document.querySelector('.custom-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 创建新通知
        const notification = document.createElement('div');
        notification.className = `custom-notification alert alert-${type} alert-dismissible fade show`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
        `;

        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        // 5秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // 显示加载状态
    static showLoading(element, text = '处理中...') {
        const originalHTML = element.innerHTML;
        element.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ${text}
        `;
        element.disabled = true;

        return () => {
            element.innerHTML = originalHTML;
            element.disabled = false;
        };
    }

    // 验证以太坊地址
    static isValidAddress(address) {
        return APP_STATE.web3.utils.isAddress(address);
    }

    // 获取网络名称
    static getNetworkName(networkId) {
        return CONTRACT_CONFIG.networks[networkId]?.name || `未知网络 (${networkId})`;
    }

    // 获取区块浏览器URL
    static getExplorerUrl(networkId) {
        return CONTRACT_CONFIG.networks[networkId]?.explorer || 'https://etherscan.io';
    }
}

// 钱包连接管理
class WalletManager {
    static async connectWallet() {
        try {
            const success = await CommonUtils.initWeb3();
            if (!success) {
                CommonUtils.showNotification('连接钱包失败', 'danger');
                return false;
            }

            await CommonUtils.initContract();
            await CommonUtils.getAccounts();
            await CommonUtils.getNetwork();
            await CommonUtils.checkOwner();

            updateWalletStatus();
            CommonUtils.showNotification('钱包连接成功', 'success');

            // 触发钱包连接事件
            window.dispatchEvent(new CustomEvent('walletConnected'));

            return true;
        } catch (error) {
            console.error("连接钱包失败:", error);
            CommonUtils.showNotification('连接钱包失败: ' + error.message, 'danger');
            return false;
        }
    }

    // 监听账户变化
    static setupAccountChangeListener() {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    CommonUtils.showNotification('钱包已断开连接', 'warning');
                    APP_STATE.account = null;
                } else {
                    APP_STATE.account = accounts[0];
                    CommonUtils.showNotification('账户已切换', 'info');
                }
                updateWalletStatus();
                window.dispatchEvent(new CustomEvent('accountChanged'));
            });

            window.ethereum.on('chainChanged', (chainId) => {
                CommonUtils.showNotification('网络已切换', 'info');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            });
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', async function () {
    // 设置钱包连接按钮事件
    const connectButtons = document.querySelectorAll('#connectWallet');
    connectButtons.forEach(button => {
        button.addEventListener('click', WalletManager.connectWallet);
    });

    // 设置账户变化监听
    WalletManager.setupAccountChangeListener();

    // 如果有缓存的连接状态，自动连接
    if (window.ethereum && window.ethereum.selectedAddress) {
        await WalletManager.connectWallet();
    }
});