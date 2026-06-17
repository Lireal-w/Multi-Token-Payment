// 代币管理功能
class TokenManagement {
    static async init() {
        // 监听钱包连接事件
        window.addEventListener('walletConnected', this.loadTokens.bind(this));
        window.addEventListener('accountChanged', this.loadTokens.bind(this));
        
        // 绑定表单提交事件
        document.getElementById('addTokenForm').addEventListener('submit', this.addToken.bind(this));
        document.getElementById('autoDetectToken').addEventListener('click', this.autoDetectToken.bind(this));
        document.getElementById('refreshTokens').addEventListener('click', this.loadTokens.bind(this));
        
        // 如果有已连接的钱包，立即加载代币
        if (APP_STATE.account) {
            this.loadTokens();
        }
    }

    static async loadTokens() {
        if (!APP_STATE.contract) {
            CommonUtils.showNotification('请先连接钱包', 'warning');
            return;
        }

        // 检查是否为所有者
        if (!APP_STATE.isOwner) {
            document.getElementById('addTokenForm').style.display = 'none';
            CommonUtils.showNotification('只有合约所有者可以管理代币', 'warning');
        }

        const button = document.getElementById('refreshTokens');
        const resetButton = button ? CommonUtils.showLoading(button, '加载中...') : () => {};

        try {
            const supportedTokens = await APP_STATE.contract.methods.getSupportedTokens().call();
            await this.displayTokens(supportedTokens);
        } catch (error) {
            console.error("加载代币列表失败:", error);
            CommonUtils.showNotification('加载代币列表失败', 'danger');
        } finally {
            resetButton();
        }
    }

    static async displayTokens(tokenAddresses) {
        const container = document.getElementById('tokensList');
        container.innerHTML = '';

        if (tokenAddresses.length === 0) {
            container.innerHTML = '<div class="col-12 text-center"><p class="text-muted">暂无支持的代币</p></div>';
            return;
        }

        for (const tokenAddress of tokenAddresses) {
            try {
                const tokenInfo = await APP_STATE.contract.methods.getTokenInfo(tokenAddress).call();
                
                const tokenCard = document.createElement('div');
                tokenCard.className = 'col-md-6 col-lg-4 mb-3';
                tokenCard.innerHTML = `
                    <div class="card token-card h-100">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h5 class="card-title">${tokenInfo.symbol}</h5>
                                <span class="badge ${tokenInfo.isNonStandard ? 'bg-warning' : 'bg-success'}">
                                    ${tokenInfo.isNonStandard ? '非标准' : '标准'}
                                </span>
                            </div>
                            <h6 class="card-subtitle mb-2 text-muted">${tokenInfo.name}</h6>
                            <p class="card-text small">
                                <strong>地址:</strong> <code>${CommonUtils.formatAddress(tokenAddress)}</code><br>
                                <strong>小数位:</strong> ${tokenInfo.decimals}
                            </p>
                        </div>
                        <div class="card-footer bg-transparent">
                            <button class="btn btn-sm btn-outline-danger remove-token" data-address="${tokenAddress}">
                                <i class="fas fa-trash me-1"></i>移除
                            </button>
                        </div>
                    </div>
                `;
                
                container.appendChild(tokenCard);
            } catch (error) {
                console.error(`显示代币 ${tokenAddress} 失败:`, error);
            }
        }

        // 绑定移除按钮事件
        document.querySelectorAll('.remove-token').forEach(button => {
            button.addEventListener('click', this.removeToken.bind(this));
        });
    }

    static async addToken(event) {
        event.preventDefault();
        
        if (!APP_STATE.isOwner) {
            CommonUtils.showNotification('只有合约所有者可以添加代币', 'warning');
            return;
        }

        const tokenAddress = document.getElementById('tokenAddress').value;
        const tokenSymbol = document.getElementById('tokenSymbol').value;
        const tokenName = document.getElementById('tokenName').value;
        const tokenDecimals = parseInt(document.getElementById('tokenDecimals').value);
        const isNonStandard = document.getElementById('isNonStandard').checked;

        if (!CommonUtils.isValidAddress(tokenAddress)) {
            CommonUtils.showNotification('无效的代币地址', 'danger');
            return;
        }

        const submitButton = event.target.querySelector('button[type="submit"]');
        const resetButton = CommonUtils.showLoading(submitButton, '添加中...');

        try {
            await APP_STATE.contract.methods.addSupportedToken(
                tokenAddress,
                tokenSymbol || "UNKNOWN",
                tokenName || "UNKNOWN",
                tokenDecimals || 18,
                isNonStandard
            ).send({ from: APP_STATE.account });

            CommonUtils.showNotification('代币添加成功', 'success');
            document.getElementById('addTokenForm').reset();
            this.loadTokens();
        } catch (error) {
            console.error("添加代币失败:", error);
            CommonUtils.showNotification('添加代币失败: ' + error.message, 'danger');
        } finally {
            resetButton();
        }
    }

    static async autoDetectToken() {
        const tokenAddress = document.getElementById('tokenAddress').value;
        
        if (!CommonUtils.isValidAddress(tokenAddress)) {
            CommonUtils.showNotification('请输入有效的代币地址', 'warning');
            return;
        }

        const button = document.getElementById('autoDetectToken');
        const resetButton = CommonUtils.showLoading(button, '检测中...');

        try {
            // 创建代币合约实例
            const tokenContract = new APP_STATE.web3.eth.Contract(CONTRACT_CONFIG.erc20Abi, tokenAddress);
            
            // 检测代币信息
            const [symbol, name, decimals] = await Promise.all([
                tokenContract.methods.symbol().call().catch(() => "UNKNOWN"),
                tokenContract.methods.name().call().catch(() => "UNKNOWN"),
                tokenContract.methods.decimals().call().catch(() => 18)
            ]);

            // 填充表单
            document.getElementById('tokenSymbol').value = symbol;
            document.getElementById('tokenName').value = name;
            document.getElementById('tokenDecimals').value = decimals;
            
            // 检查是否为非标准代币
            const isNonStandard = CONTRACT_CONFIG.knownNonStandardTokens[tokenAddress.toLowerCase()] || false;
            document.getElementById('isNonStandard').checked = isNonStandard;

            CommonUtils.showNotification('代币信息检测完成', 'success');
        } catch (error) {
            console.error("自动检测代币失败:", error);
            CommonUtils.showNotification('自动检测代币失败，请手动填写信息', 'warning');
        } finally {
            resetButton();
        }
    }

    static async removeToken(event) {
        if (!APP_STATE.isOwner) {
            CommonUtils.showNotification('只有合约所有者可以移除代币', 'warning');
            return;
        }

        const tokenAddress = event.target.getAttribute('data-address');
        const tokenSymbol = event.target.closest('.card').querySelector('.card-title').textContent;

        if (!confirm(`确定要移除代币 ${tokenSymbol} 吗？`)) {
            return;
        }

        const resetButton = CommonUtils.showLoading(event.target, '移除中...');

        try {
            await APP_STATE.contract.methods.removeSupportedToken(tokenAddress)
                .send({ from: APP_STATE.account });

            CommonUtils.showNotification('代币移除成功', 'success');
            this.loadTokens();
        } catch (error) {
            console.error("移除代币失败:", error);
            CommonUtils.showNotification('移除代币失败: ' + error.message, 'danger');
            resetButton();
        }
    }
}

// 初始化代币管理页面
document.addEventListener('DOMContentLoaded', function() {
    TokenManagement.init();
});