// 批量支付功能
class BatchPayment {
    static recipients = [];

    static async init() {
        // 监听钱包连接事件
        window.addEventListener('walletConnected', this.initBatchPayment.bind(this));
        window.addEventListener('accountChanged', this.initBatchPayment.bind(this));
        
        // 绑定事件
        document.getElementById('batchPaymentForm').addEventListener('submit', this.processBatchPayment.bind(this));
        document.getElementById('batchTokenSelect').addEventListener('change', this.updateBatchTokenInfo.bind(this));
        document.getElementById('addRecipient').addEventListener('click', this.addRecipient.bind(this));
        document.getElementById('importRecipients').addEventListener('click', this.showCSVModal.bind(this));
        document.getElementById('checkBatchAllowance').addEventListener('click', this.checkBatchAllowance.bind(this));
        document.getElementById('batchApproveToken').addEventListener('click', this.showApproveModal.bind(this));
        document.getElementById('confirmApprove').addEventListener('click', this.approveToken.bind(this));
        document.getElementById('confirmCSVImport').addEventListener('click', this.importCSV.bind(this));
        
        // 初始化
        if (APP_STATE.account) {
            this.initBatchPayment();
        }
        
        // 添加第一个收款人
        this.addRecipient();
    }

    static async initBatchPayment() {
        if (!APP_STATE.contract) return;

        try {
            const supportedTokens = await APP_STATE.contract.methods.getSupportedTokens().call();
            await this.populateTokenSelect(supportedTokens);
        } catch (error) {
            console.error("初始化批量支付失败:", error);
            CommonUtils.showNotification('加载代币列表失败', 'danger');
        }
    }

    static async populateTokenSelect(tokenAddresses) {
        const select = document.getElementById('batchTokenSelect');
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

    static addRecipient() {
        const container = document.getElementById('recipientsContainer');
        const index = this.recipients.length + 1;
        
        const recipientRow = document.createElement('div');
        recipientRow.className = 'recipient-row';
        recipientRow.innerHTML = `
            <div class="row g-2 align-items-center">
                <div class="col-md-7">
                    <input type="text" class="form-control recipient-address" placeholder="收款地址" data-index="${index}">
                </div>
                <div class="col-md-4">
                    <div class="input-group">
                        <input type="number" class="form-control recipient-amount" placeholder="金额" min="0" step="0.000001" data-index="${index}">
                        <span class="input-group-text batch-token-symbol">-</span>
                    </div>
                </div>
                <div class="col-md-1">
                    <button type="button" class="btn btn-sm btn-outline-danger remove-recipient" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(recipientRow);
        this.recipients.push({ address: '', amount: '' });
        
        // 绑定移除事件
        recipientRow.querySelector('.remove-recipient').addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('.remove-recipient').getAttribute('data-index'));
            this.removeRecipient(index);
        });
        
        // 绑定输入事件
        recipientRow.querySelector('.recipient-address').addEventListener('input', this.updateRecipient.bind(this));
        recipientRow.querySelector('.recipient-amount').addEventListener('input', this.updateRecipient.bind(this));
        
        this.updateSummary();
    }

    static removeRecipient(index) {
        if (this.recipients.length <= 1) {
            CommonUtils.showNotification('至少需要一个收款人', 'warning');
            return;
        }
        
        const element = document.querySelector(`[data-index="${index}"]`).closest('.recipient-row');
        element.remove();
        
        this.recipients = this.recipients.filter((_, i) => i !== index - 1);
        
        // 重新索引
        document.querySelectorAll('.recipient-row').forEach((row, i) => {
            const newIndex = i + 1;
            row.querySelectorAll('[data-index]').forEach(el => {
                el.setAttribute('data-index', newIndex);
            });
        });
        
        this.updateSummary();
    }

    static updateRecipient(event) {
        const index = parseInt(event.target.getAttribute('data-index')) - 1;
        const field = event.target.classList.contains('recipient-address') ? 'address' : 'amount';
        this.recipients[index][field] = event.target.value;
        this.updateSummary();
    }

    static updateSummary() {
        const totalAmount = this.recipients.reduce((sum, recipient) => {
            return sum + (parseFloat(recipient.amount) || 0);
        }, 0);
        
        const recipientCount = this.recipients.filter(r => r.address && r.amount).length;
        
        document.getElementById('totalAmount').textContent = totalAmount.toFixed(6);
        document.getElementById('recipientCount').textContent = recipientCount;
        document.getElementById('totalAmountDisplay').textContent = totalAmount.toFixed(6);
    }

    static async updateBatchTokenInfo() {
        const tokenSelect = document.getElementById('batchTokenSelect');
        const selectedOption = tokenSelect.options[tokenSelect.selectedIndex];
        
        if (!selectedOption.value) return;

        const tokenAddress = selectedOption.value;
        const symbol = selectedOption.getAttribute('data-symbol');
        
        // 更新所有收款人行的代币符号
        document.querySelectorAll('.batch-token-symbol').forEach(span => {
            span.textContent = symbol;
        });
        
        document.getElementById('batchTokenSymbol').textContent = symbol;
        
        // 更新代币信息显示
        await this.updateBatchTokenDisplay(tokenAddress);
    }

    static async updateBatchTokenDisplay(tokenAddress) {
        if (!APP_STATE.account) return;

        try {
            const [tokenInfo, balance] = await Promise.all([
                APP_STATE.contract.methods.getTokenInfo(tokenAddress).call(),
                APP_STATE.contract.methods.checkBalance(tokenAddress, APP_STATE.account).call()
            ]);

            const decimals = parseInt(tokenInfo.decimals);
            
            document.getElementById('batchTokenInfo').textContent = 
                `${tokenInfo.symbol} - ${tokenInfo.name}`;
            document.getElementById('batchBalanceInfo').textContent = 
                `余额: ${CommonUtils.formatAmount(balance, decimals)} ${tokenInfo.symbol}`;
        } catch (error) {
            console.error("更新代币信息失败:", error);
        }
    }

    static async checkBatchAllowance() {
        const tokenSelect = document.getElementById('batchTokenSelect');
        if (!tokenSelect.value) {
            CommonUtils.showNotification('请先选择代币', 'warning');
            return;
        }

        const button = document.getElementById('checkBatchAllowance');
        const resetButton = CommonUtils.showLoading(button, '检查中...');

        try {
            const allowance = await APP_STATE.contract.methods.checkAllowance(
                tokenSelect.value, 
                APP_STATE.account
            ).call();

            const selectedOption = tokenSelect.selectedOptions[0];
            const decimals = parseInt(selectedOption.getAttribute('data-decimals') || 18);
            const symbol = selectedOption.getAttribute('data-symbol');
            
            const totalAmount = this.recipients.reduce((sum, recipient) => {
                return sum + (parseFloat(recipient.amount) || 0);
            }, 0);
            
            const totalAmountInWei = CommonUtils.toWei(totalAmount.toString(), decimals);
            const hasSufficientAllowance = parseFloat(allowance) >= parseFloat(totalAmountInWei);
            
            CommonUtils.showNotification(
                hasSufficientAllowance ? 
                `授权额度充足 (${CommonUtils.formatAmount(allowance, decimals)} ${symbol})` :
                `授权额度不足，需要授权 ${totalAmount} ${symbol}`,
                hasSufficientAllowance ? 'success' : 'warning'
            );
        } catch (error) {
            console.error("检查授权失败:", error);
            CommonUtils.showNotification('检查授权失败', 'danger');
        } finally {
            resetButton();
        }
    }

    static showCSVModal() {
        const csvModal = new bootstrap.Modal(document.getElementById('csvModal'));
        csvModal.show();
    }

    static importCSV() {
        const fileInput = document.getElementById('csvFile');
        const csvContent = document.getElementById('csvContent').value;
        
        let csvData = '';
        
        if (fileInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (e) => {
                csvData = e.target.result;
                this.parseCSVData(csvData);
            };
            reader.readAsText(fileInput.files[0]);
        } else if (csvContent) {
            this.parseCSVData(csvContent);
        } else {
            CommonUtils.showNotification('请选择CSV文件或输入CSV内容', 'warning');
            return;
        }
        
        bootstrap.Modal.getInstance(document.getElementById('csvModal')).hide();
    }

    static parseCSVData(csvData) {
        // 清空现有收款人
        this.recipients = [];
        document.getElementById('recipientsContainer').innerHTML = '';
        
        const lines = csvData.split('\n').filter(line => line.trim());
        
        lines.forEach((line, index) => {
            // 跳过标题行
            if (index === 0 && (line.includes('address') || line.includes('地址'))) {
                return;
            }
            
            const [address, amount] = line.split(',').map(item => item.trim());
            
            if (address && amount && !isNaN(parseFloat(amount))) {
                this.addRecipient();
                const lastIndex = this.recipients.length - 1;
                this.recipients[lastIndex] = { address, amount: parseFloat(amount) };
                
                // 更新UI
                const recipientRow = document.querySelector('.recipient-row:last-child');
                recipientRow.querySelector('.recipient-address').value = address;
                recipientRow.querySelector('.recipient-amount').value = amount;
            }
        });
        
        this.updateSummary();
        CommonUtils.showNotification(`成功导入 ${this.recipients.length} 个收款人`, 'success');
    }

    static async processBatchPayment(event) {
        event.preventDefault();

        if (!APP_STATE.account) {
            CommonUtils.showNotification('请先连接钱包', 'warning');
            return;
        }

        const tokenAddress = document.getElementById('batchTokenSelect').value;
        
        if (!tokenAddress) {
            CommonUtils.showNotification('请选择代币', 'warning');
            return;
        }

        // 验证收款人数据
        const validRecipients = this.recipients.filter(r => 
            r.address && r.amount && CommonUtils.isValidAddress(r.address) && parseFloat(r.amount) > 0
        );

        if (validRecipients.length === 0) {
            CommonUtils.showNotification('请添加有效的收款人信息', 'warning');
            return;
        }

        const selectedOption = document.getElementById('batchTokenSelect').selectedOptions[0];
        const decimals = parseInt(selectedOption.getAttribute('data-decimals') || 18);
        const symbol = selectedOption.getAttribute('data-symbol');

        // 准备批量支付数据
        const recipients = validRecipients.map(r => r.address);
        const amounts = validRecipients.map(r => CommonUtils.toWei(r.amount.toString(), decimals));

        const submitButton = event.target.querySelector('button[type="submit"]');
        const resetButton = CommonUtils.showLoading(submitButton, '批量支付中...');

        try {
            await APP_STATE.contract.methods.batchPayments(
                tokenAddress,
                recipients,
                amounts
            ).send({ from: APP_STATE.account });

            CommonUtils.showNotification(`批量支付成功，共支付 ${validRecipients.length} 个收款人`, 'success');
            
            // 清空表单
            this.recipients = [];
            document.getElementById('recipientsContainer').innerHTML = '';
            this.addRecipient();
            
            // 记录交易
            this.recordBatchTransaction(tokenAddress, validRecipients.length, symbol);
        } catch (error) {
            console.error("批量支付失败:", error);
            CommonUtils.showNotification('批量支付失败: ' + error.message, 'danger');
        } finally {
            resetButton();
        }
    }

    static showApproveModal() {
        const tokenSelect = document.getElementById('batchTokenSelect');
        if (!tokenSelect.value) {
            CommonUtils.showNotification('请先选择代币', 'warning');
            return;
        }

        const approveModal = new bootstrap.Modal(document.getElementById('approveModal'));
        approveModal.show();
    }

    static async approveToken() {
        // 重用单笔支付中的授权逻辑
        await SinglePayment.approveToken.call(this);
        
        // 批量支付特定的后续处理
        await this.checkBatchAllowance();
    }

    static recordBatchTransaction(tokenAddress, recipientCount, symbol) {
        const historyContainer = document.getElementById('batchTransactionHistory');
        const transactionItem = document.createElement('div');
        transactionItem.className = 'alert alert-light border';
        
        const timestamp = new Date().toLocaleString();
        
        transactionItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>批量支付 ${recipientCount} 个收款人</strong>
                    <br><small class="text-muted">代币: ${symbol} | ${timestamp}</small>
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

// 初始化批量支付页面
document.addEventListener('DOMContentLoaded', function() {
    BatchPayment.init();
});