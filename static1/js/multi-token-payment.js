// 多代币支付功能
class MultiTokenPayment {
    static paymentItems = [];
    static supportedTokens = [];

    static async init() {
        // 监听钱包连接事件
        window.addEventListener('walletConnected', this.initMultiTokenPayment.bind(this));
        window.addEventListener('accountChanged', this.initMultiTokenPayment.bind(this));
        
        // 绑定事件
        document.getElementById('multiTokenPaymentForm').addEventListener('submit', this.processMultiTokenPayment.bind(this));
        document.getElementById('addPaymentItem').addEventListener('click', this.addPaymentItem.bind(this));
        document.getElementById('checkAllAllowances').addEventListener('click', this.checkAllAllowances.bind(this));
        document.getElementById('multiTokenApproveAll').addEventListener('click', this.approveAllTokens.bind(this));
        
        // 初始化
        if (APP_STATE.account) {
            this.initMultiTokenPayment();
        }
        
        // 添加第一个支付项
        this.addPaymentItem();
    }

    static async initMultiTokenPayment() {
        if (!APP_STATE.contract) return;

        try {
            this.supportedTokens = await APP_STATE.contract.methods.getSupportedTokens().call();
            await this.loadTokenBalances();
            this.updateTokenSelects();
        } catch (error) {
            console.error("初始化多代币支付失败:", error);
            CommonUtils.showNotification('加载代币列表失败', 'danger');
        }
    }

    static async loadTokenBalances() {
        if (!APP_STATE.account) return;

        const balancesContainer = document.getElementById('multiTokenBalances');
        balancesContainer.innerHTML = '';

        for (const tokenAddress of this.supportedTokens) {
            try {
                const [tokenInfo, balance] = await Promise.all([
                    APP_STATE.contract.methods.getTokenInfo(tokenAddress).call(),
                    APP_STATE.contract.methods.checkBalance(tokenAddress, APP_STATE.account).call()
                ]);

                const balanceElement = document.createElement('div');
                balanceElement.className = 'mb-2 p-2 border rounded';
                balanceElement.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <span><strong>${tokenInfo.symbol}</strong></span>
                        <span>${CommonUtils.formatAmount(balance, tokenInfo.decimals)}</span>
                    </div>
                    <small class="text-muted">${tokenInfo.name}</small>
                `;

                balancesContainer.appendChild(balanceElement);
            } catch (error) {
                console.error(`加载代币 ${tokenAddress} 余额失败:`, error);
            }
        }
    }

    static updateTokenSelects() {
        const tokenSelects = document.querySelectorAll('.token-select');
        
        tokenSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">选择代币</option>';
            
            this.supportedTokens.forEach(async (tokenAddress) => {
                try {
                    const tokenInfo = await APP_STATE.contract.methods.getTokenInfo(tokenAddress).call();
                    const option = document.createElement('option');
                    option.value = tokenAddress;
                    option.textContent = `${tokenInfo.symbol} - ${tokenInfo.name}`;
                    option.setAttribute('data-decimals', tokenInfo.decimals);
                    option.setAttribute('data-symbol', tokenInfo.symbol);
                    
                    if (tokenAddress === currentValue) {
                        option.selected = true;
                    }
                    
                    select.appendChild(option);
                } catch (error) {
                    console.error(`更新代币选择失败:`, error);
                }
            });
        });
    }

    static addPaymentItem() {
        const template = document.getElementById('paymentItemTemplate');
        const clone = template.content.cloneNode(true);
        const container = document.getElementById('paymentItemsContainer');
        
        const itemIndex = this.paymentItems.length + 1;
        clone.querySelector('.item-index').textContent = itemIndex;
        
        container.appendChild(clone);
        
        const newItem = container.lastElementChild;
        
        // 绑定事件
        newItem.querySelector('.remove-payment-item').addEventListener('click', () => {
            this.removePaymentItem(newItem);
        });
        
        newItem.querySelector('.token-select').addEventListener('change', (e) => {
            this.updatePaymentItemToken(e.target);
        });
        
        newItem.querySelector('.approve-single-item').addEventListener('click', (e) => {
            this.approveSingleItem(e.target.closest('.payment-item'));
        });
        
        newItem.querySelector('.recipient-address').addEventListener('input', this.updateSummary.bind(this));
        newItem.querySelector('.payment-amount').addEventListener('input', this.updateSummary.bind(this));
        
        // 初始化代币选择
        this.updateTokenSelects();
        
        // 添加到数据数组
        this.paymentItems.push({
            token: '',
            recipient: '',
            amount: '',
            element: newItem
        });
        
        this.updateSummary();
    }

    static removePaymentItem(element) {
        if (this.paymentItems.length <= 1) {
            CommonUtils.showNotification('至少需要一个支付项', 'warning');
            return;
        }
        
        const index = Array.from(element.parentNode.children).indexOf(element);
        element.remove();
        this.paymentItems.splice(index, 1);
        
        // 重新编号
        this.updateItemIndexes();
        this.updateSummary();
    }

    static updateItemIndexes() {
        const items = document.querySelectorAll('.payment-item');
        items.forEach((item, index) => {
            item.querySelector('.item-index').textContent = index + 1;
        });
    }

    static async updatePaymentItemToken(select) {
        const item = select.closest('.payment-item');
        const symbolSpan = item.querySelector('.token-symbol');
        const tokenInfo = item.querySelector('.token-select').selectedOptions[0];
        
        if (tokenInfo && tokenInfo.value) {
            symbolSpan.textContent = tokenInfo.getAttribute('data-symbol');
            await this.updateItemBalanceAndAllowance(item);
        } else {
            symbolSpan.textContent = '-';
        }
        
        this.updateSummary();
    }

    static async updateItemBalanceAndAllowance(item) {
        if (!APP_STATE.account) return;

        const tokenSelect = item.querySelector('.token-select');
        const tokenAddress = tokenSelect.value;
        
        if (!tokenAddress) return;

        try {
            const [balance, allowance] = await Promise.all([
                APP_STATE.contract.methods.checkBalance(tokenAddress, APP_STATE.account).call(),
                APP_STATE.contract.methods.checkAllowance(tokenAddress, APP_STATE.account).call()
            ]);

            const decimals = parseInt(tokenSelect.selectedOptions[0].getAttribute('data-decimals') || 18);
            const symbol = tokenSelect.selectedOptions[0].getAttribute('data-symbol');
            
            item.querySelector('.balance-info').textContent = 
                `余额: ${CommonUtils.formatAmount(balance, decimals)} ${symbol}`;
            item.querySelector('.allowance-info').textContent = 
                `授权: ${CommonUtils.formatAmount(allowance, decimals)} ${symbol}`;
        } catch (error) {
            console.error("更新支付项余额和授权失败:", error);
        }
    }

    static async checkAllAllowances() {
        if (!APP_STATE.account) {
            CommonUtils.showNotification('请先连接钱包', 'warning');
            return;
        }

        const button = document.getElementById('checkAllAllowances');
        const resetButton = CommonUtils.showLoading(button, '检查中...');

        try {
            const items = document.querySelectorAll('.payment-item');
            let allSufficient = true;
            const results = [];

            for (const item of items) {
                const tokenSelect = item.querySelector('.token-select');
                const amountInput = item.querySelector('.payment-amount');
                
                if (!tokenSelect.value || !amountInput.value) continue;

                const tokenAddress = tokenSelect.value;
                const amount = amountInput.value;
                const decimals = parseInt(tokenSelect.selectedOptions[0].getAttribute('data-decimals') || 18);
                const symbol = tokenSelect.selectedOptions[0].getAttribute('data-symbol');
                
                const allowance = await APP_STATE.contract.methods.checkAllowance(
                    tokenAddress, 
                    APP_STATE.account
                ).call();
                
                const amountInWei = CommonUtils.toWei(amount, decimals);
                const hasSufficientAllowance = parseFloat(allowance) >= parseFloat(amountInWei);
                
                if (!hasSufficientAllowance) {
                    allSufficient = false;
                    results.push(`<span class="text-warning">${symbol}: 授权不足</span>`);
                } else {
                    results.push(`<span class="text-success">${symbol}: 授权充足</span>`);
                }
                
                // 更新UI显示
                await this.updateItemBalanceAndAllowance(item);
            }

            CommonUtils.showNotification(
                allSufficient ? '所有代币授权充足' : '部分代币授权不足',
                allSufficient ? 'success' : 'warning'
            );

            if (results.length > 0) {
                document.getElementById('paymentSummary').innerHTML = 
                    `<div class="small">${results.join('<br>')}</div>`;
            }
        } catch (error) {
            console.error("检查所有授权失败:", error);
            CommonUtils.showNotification('检查授权失败', 'danger');
        } finally {
            resetButton();
        }
    }

    static updateSummary() {
        const summary = {};
        
        document.querySelectorAll('.payment-item').forEach(item => {
            const tokenSelect = item.querySelector('.token-select');
            const amountInput = item.querySelector('.payment-amount');
            
            if (tokenSelect.value && amountInput.value) {
                const symbol = tokenSelect.selectedOptions[0]?.getAttribute('data-symbol') || '未知';
                const amount = parseFloat(amountInput.value) || 0;
                
                if (!summary[symbol]) {
                    summary[symbol] = 0;
                }
                summary[symbol] += amount;
            }
        });
        
        const summaryContainer = document.getElementById('paymentSummary');
        
        if (Object.keys(summary).length === 0) {
            summaryContainer.innerHTML = '<p class="text-muted">暂无支付信息</p>';
            return;
        }
        
        let html = '';
        for (const [symbol, total] of Object.entries(summary)) {
            html += `<div><strong>${symbol}:</strong> ${total.toFixed(6)}</div>`;
        }
        
        summaryContainer.innerHTML = html;
    }

    static async processMultiTokenPayment(event) {
        event.preventDefault();

        if (!APP_STATE.account) {
            CommonUtils.showNotification('请先连接钱包', 'warning');
            return;
        }

        // 收集支付数据
        const tokens = [];
        const recipients = [];
        const amounts = [];
        
        let isValid = true;
        const errors = [];

        document.querySelectorAll('.payment-item').forEach((item, index) => {
            const tokenSelect = item.querySelector('.token-select');
            const recipientInput = item.querySelector('.recipient-address');
            const amountInput = item.querySelector('.payment-amount');
            
            const token = tokenSelect.value;
            const recipient = recipientInput.value;
            const amount = amountInput.value;
            
            if (!token || !recipient || !amount) {
                errors.push(`支付项 ${index + 1} 信息不完整`);
                isValid = false;
                return;
            }
            
            if (!CommonUtils.isValidAddress(recipient)) {
                errors.push(`支付项 ${index + 1} 的收款地址无效`);
                isValid = false;
                return;
            }
            
            if (parseFloat(amount) <= 0) {
                errors.push(`支付项 ${index + 1} 的金额必须大于0`);
                isValid = false;
                return;
            }
            
            const decimals = parseInt(tokenSelect.selectedOptions[0].getAttribute('data-decimals') || 18);
            const amountInWei = CommonUtils.toWei(amount, decimals);
            
            tokens.push(token);
            recipients.push(recipient);
            amounts.push(amountInWei);
        });

        if (!isValid) {
            CommonUtils.showNotification('请修正以下错误: ' + errors.join('; '), 'danger');
            return;
        }

        if (tokens.length === 0) {
            CommonUtils.showNotification('请添加有效的支付项', 'warning');
            return;
        }

        const submitButton = event.target.querySelector('button[type="submit"]');
        const resetButton = CommonUtils.showLoading(submitButton, '多代币支付中...');

        try {
            await APP_STATE.contract.methods.makeMultiTokenPayment(
                tokens,
                recipients,
                amounts
            ).send({ from: APP_STATE.account });

            CommonUtils.showNotification(`多代币支付成功，共处理 ${tokens.length} 个支付项`, 'success');
            
            // 清空表单
            this.paymentItems = [];
            document.getElementById('paymentItemsContainer').innerHTML = '';
            this.addPaymentItem();
            
            // 记录交易
            this.recordMultiTokenTransaction(tokens.length);
        } catch (error) {
            console.error("多代币支付失败:", error);
            CommonUtils.showNotification('多代币支付失败: ' + error.message, 'danger');
        } finally {
            resetButton();
        }
    }

    static async approveSingleItem(item) {
        const tokenSelect = item.querySelector('.token-select');
        const amountInput = item.querySelector('.payment-amount');
        
        if (!tokenSelect.value) {
            CommonUtils.showNotification('请先选择代币', 'warning');
            return;
        }

        if (!amountInput.value || parseFloat(amountInput.value) <= 0) {
            CommonUtils.showNotification('请输入有效的授权金额', 'warning');
            return;
        }

        const tokenAddress = tokenSelect.value;
        const amount = amountInput.value;
        const decimals = parseInt(tokenSelect.selectedOptions[0].getAttribute('data-decimals') || 18);
        const symbol = tokenSelect.selectedOptions[0].getAttribute('data-symbol');
        const amountInWei = CommonUtils.toWei(amount, decimals);

        const button = item.querySelector('.approve-single-item');
        const resetButton = CommonUtils.showLoading(button, '授权中...');

        try {
            const tokenContract = new APP_STATE.web3.eth.Contract(CONTRACT_CONFIG.erc20Abi, tokenAddress);
            
            await tokenContract.methods.approve(CONTRACT_CONFIG.address, amountInWei)
                .send({ from: APP_STATE.account });

            CommonUtils.showNotification(`已授权 ${amount} ${symbol}`, 'success');
            
            // 更新授权显示
            await this.updateItemBalanceAndAllowance(item);
        } catch (error) {
            console.error("授权失败:", error);
            CommonUtils.showNotification('授权失败: ' + error.message, 'danger');
        } finally {
            resetButton();
        }
    }

    static async approveAllTokens() {
        if (!APP_STATE.account) {
            CommonUtils.showNotification('请先连接钱包', 'warning');
            return;
        }

        const button = document.getElementById('multiTokenApproveAll');
        const resetButton = CommonUtils.showLoading(button, '授权所有代币中...');

        try {
            // 获取所有需要的代币
            const tokensToApprove = new Set();
            
            document.querySelectorAll('.payment-item').forEach(item => {
                const tokenSelect = item.querySelector('.token-select');
                const amountInput = item.querySelector('.payment-amount');
                
                if (tokenSelect.value && amountInput.value) {
                    tokensToApprove.add(tokenSelect.value);
                }
            });

            if (tokensToApprove.size === 0) {
                CommonUtils.showNotification('没有需要授权的代币', 'info');
                return;
            }

            let approvedCount = 0;
            
            for (const tokenAddress of tokensToApprove) {
                try {
                    const tokenContract = new APP_STATE.web3.eth.Contract(CONTRACT_CONFIG.erc20Abi, tokenAddress);
                    const unlimitedAmount = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
                    
                    await tokenContract.methods.approve(CONTRACT_CONFIG.address, unlimitedAmount)
                        .send({ from: APP_STATE.account });
                    
                    approvedCount++;
                } catch (error) {
                    console.error(`授权代币 ${tokenAddress} 失败:`, error);
                }
            }

            CommonUtils.showNotification(`成功授权 ${approvedCount} 个代币`, 'success');
            
            // 更新所有支付项的授权显示
            document.querySelectorAll('.payment-item').forEach(item => {
                this.updateItemBalanceAndAllowance(item);
            });
        } catch (error) {
            console.error("授权所有代币失败:", error);
            CommonUtils.showNotification('授权所有代币失败', 'danger');
        } finally {
            resetButton();
        }
    }

    static recordMultiTokenTransaction(itemCount) {
        const historyContainer = document.getElementById('multiTokenTransactionHistory');
        const transactionItem = document.createElement('div');
        transactionItem.className = 'alert alert-light border';
        
        const timestamp = new Date().toLocaleString();
        
        transactionItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>多代币支付 ${itemCount} 个支付项</strong>
                    <br><small class="text-muted">${timestamp}</small>
                </div>
                <span class="badge bg-success">成功</span>
            </div>
        `;
        
        if (historyContainer.firstChild) {
            historyContainer.insertBefore(transactionItem, historyContainer.firstChild);
        } else {
            historyContainer.innerHTML = '';
            historyContainer.appendChild(transactionItem);
        }
    }
}

// 初始化多代币支付页面
document.addEventListener('DOMContentLoaded', function() {
    MultiTokenPayment.init();
});