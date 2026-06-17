// 单笔支付功能
class SinglePayment {
    static async init() {
        // 监听钱包连接和账户变化事件
        window.addEventListener('walletConnected', this.initPaymentForm.bind(this));
        window.addEventListener('accountChanged', this.initPaymentForm.bind(this));
        
        // 绑定表单事件
        document.getElementById('paymentForm').addEventListener('submit', this.processPayment.bind(this));
        document.getElementById('tokenSelect').addEventListener('change', this.updateTokenInfo.bind(this));
        document.getElementById('checkAllowance').addEventListener('click', this.checkAllowance.bind(this));
        document.getElementById('approveToken').addEventListener('click', this.showApproveModal.bind(this));
        document.getElementById('confirmApprove').addEventListener('click', this.approveToken.bind(this));
        
        // 初始化支付表单
        if (APP_STATE.account) {
            this.initPaymentForm();
        }
    }

    static async initPaymentForm() {
        if (!APP_STATE.contract) return;

        try {
            // 加载支持的代币列表
            const supportedTokens = await APP_STATE.contract.methods.getSupportedTokens().call();
            await this.populateTokenSelect(supportedTokens);
        } catch (error) {
            console.error("初始化支付表单失败:", error);
            CommonUtils.showNotification('加载代币列表失败', 'danger');
        }
    }

    static async populateTokenSelect(tokenAddresses) {
        const select = document.getElementById('tokenSelect');
        select.innerHTML = '<option value="">请选择代币</option>';

        for (const tokenAddress of tokenAddresses) {
            try {
                const tokenInfo = await APP_STATE.contract.methods.getTokenInfo(tokenAddress).call();
                const option = document.createElement('option');
                option.value = tokenAddress;
                option.textContent = `${tokenInfo.symbol} - ${tokenInfo.name}`;
                option.setAttribute('data-decimals', tokenInfo.decimals);
                option.setAttribute('data-symbol', tokenInfo.symbol);
                select.appendChild(option);
            } catch (error) {
                console.error(`加载代币 ${tokenAddress} 信息失败:`, error);
            }
        }
    }

    static async updateTokenInfo() {
        const tokenSelect = document.getElementById('tokenSelect');
        const selectedOption = tokenSelect.options[tokenSelect.selectedIndex];
        
        if (!selectedOption.value) {
            document.getElementById('tokenSymbolDisplay').textContent = '-';
            return;
        }

        const tokenAddress = selectedOption.value;
        const symbol = selectedOption.getAttribute('data-symbol');
        
        document.getElementById('tokenSymbolDisplay').textContent = symbol;

        // 更新余额和授权信息
        await this.updateBalanceAndAllowance(tokenAddress);
    }

    static async updateBalanceAndAllowance(tokenAddress) {
        if (!APP_STATE.account) return;
        const sender = document.getElementById('senderAddress').value;
        if (!sender) return;
        try {
            const [balance, allowance] = await Promise.all([
                APP_STATE.contract.methods.checkBalance(tokenAddress, APP_STATE.account).call(),
                APP_STATE.contract.methods.checkAllowance(tokenAddress, APP_STATE.account).call()
            ]);

            const decimals = parseInt(document.getElementById('tokenSelect').selectedOptions[0].getAttribute('data-decimals') || 18);
            
            document.getElementById('balanceDisplay').textContent = 
                `${CommonUtils.formatAmount(balance, decimals)} ${document.getElementById('tokenSymbolDisplay').textContent}`;
            document.getElementById('allowanceDisplay').textContent = 
                `${CommonUtils.formatAmount(allowance, decimals)} ${document.getElementById('tokenSymbolDisplay').textContent}`;
        } catch (error) {
            console.error("更新余额和授权信息失败:", error);
        }
    }

    static async checkAllowance() {
        const tokenSelect = document.getElementById('tokenSelect');
        if (!tokenSelect.value) {
            CommonUtils.showNotification('请先选择代币', 'warning');
            return;
        }

        await this.updateBalanceAndAllowance(tokenSelect.value);
        CommonUtils.showNotification('授权检查完成', 'success');
    }

    static async processPayment(event) {
        event.preventDefault();

        if (!APP_STATE.account) {
            CommonUtils.showNotification('请先连接钱包', 'warning');
            return;
        }

        const tokenAddress = document.getElementById('tokenSelect').value;
        const recipient = document.getElementById('recipientAddress').value;
        const sender = document.getElementById('senderAddress').value;
        const amount = document.getElementById('paymentAmount').value;

        if (!tokenAddress || !recipient || !amount) {
            CommonUtils.showNotification('请填写完整的支付信息', 'warning');
            return;
        }

        if (!CommonUtils.isValidAddress(recipient)) {
            CommonUtils.showNotification('无效的收款地址', 'danger');
            return;
        }

        const selectedOption = document.getElementById('tokenSelect').selectedOptions[0];
        const decimals = parseInt(selectedOption.getAttribute('data-decimals') || 18);
        const amountInWei = CommonUtils.toWei(amount, decimals);

        const submitButton = event.target.querySelector('button[type="submit"]');
        const resetButton = CommonUtils.showLoading(submitButton, '支付中...');

        try {
            
            await APP_STATE.contract.methods.makePayment(
                tokenAddress,
                recipient,
                amountInWei
            ).send({ from: APP_STATE.account });

            CommonUtils.showNotification('支付成功', 'success');
            
            // 重置表单
            document.getElementById('paymentAmount').value = '';
            
            // 更新余额和授权信息
            await this.updateBalanceAndAllowance(tokenAddress);
            
            // 记录交易
            this.recordTransaction(tokenAddress, recipient, amount);
        } catch (error) {
            console.error("支付失败:", error);
            CommonUtils.showNotification('支付失败: ' + error.message, 'danger');
        } finally {
            resetButton();
        }
    }

    static showApproveModal() {
        const tokenSelect = document.getElementById('tokenSelect');
        if (!tokenSelect.value) {
            CommonUtils.showNotification('请先选择代币', 'warning');
            return;
        }

        const approveModal = new bootstrap.Modal(document.getElementById('approveModal'));
        approveModal.show();
    }

    static async approveToken() {
        const tokenAddress = document.getElementById('tokenSelect').value;
        const amount = document.getElementById('approveAmount').value;
        const unlimited = document.getElementById('unlimitedApprove').checked;

        if (!tokenAddress) {
            CommonUtils.showNotification('请先选择代币', 'warning');
            return;
        }

        const selectedOption = document.getElementById('tokenSelect').selectedOptions[0];
        const decimals = parseInt(selectedOption.getAttribute('data-decimals') || 18);
        const symbol = selectedOption.getAttribute('data-symbol');

        let amountInWei;
        if (unlimited) {
            // 无限授权 - 使用最大uint256值
            amountInWei = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
        } else {
            if (!amount || parseFloat(amount) <= 0) {
                CommonUtils.showNotification('请输入有效的授权金额', 'warning');
                return;
            }
            amountInWei = CommonUtils.toWei(amount, decimals);
        }

        const button = document.getElementById('confirmApprove');
        const resetButton = CommonUtils.showLoading(button, '授权中...');

        try {
            // 创建代币合约实例
            const tokenContract = new APP_STATE.web3.eth.Contract(CONTRACT_CONFIG.erc20Abi, tokenAddress);
            
            // 执行授权
            await tokenContract.methods.approve(CONTRACT_CONFIG.address, amountInWei)
                .send({ from: APP_STATE.account });

            CommonUtils.showNotification(
                unlimited ? `已无限授权 ${symbol}` : `已授权 ${amount} ${symbol}`,
                'success'
            );

            // 关闭模态框
            bootstrap.Modal.getInstance(document.getElementById('approveModal')).hide();
            
            // 更新授权显示
            await this.updateBalanceAndAllowance(tokenAddress);
        } catch (error) {
            console.error("授权失败:", error);
            CommonUtils.showNotification('授权失败: ' + error.message, 'danger');
        } finally {
            resetButton();
        }
    }

    static recordTransaction(tokenAddress, recipient, amount) {
        const historyContainer = document.getElementById('transactionHistory');
        const transactionItem = document.createElement('div');
        transactionItem.className = 'alert alert-light border';
        
        const symbol = document.getElementById('tokenSelect').selectedOptions[0].getAttribute('data-symbol');
        const timestamp = new Date().toLocaleString();
        
        transactionItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${amount} ${symbol}</strong> → ${CommonUtils.formatAddress(recipient)}
                    <br><small class="text-muted">${timestamp}</small>
                </div>
                <span class="badge bg-success">成功</span>
            </div>
        `;
        
        // 将新交易添加到顶部
        if (historyContainer.firstChild) {
            historyContainer.insertBefore(transactionItem, historyContainer.firstChild);
        } else {
            historyContainer.innerHTML = '';
            historyContainer.appendChild(transactionItem);
        }
    }
}

// 初始化单笔支付页面
document.addEventListener('DOMContentLoaded', function() {
    WalletManager.connectWallet()
    SinglePayment.init();
});