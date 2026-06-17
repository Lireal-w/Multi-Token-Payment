// 用户信息功能
class UserInfo {
    static async init() {
        // 监听钱包连接事件
        window.addEventListener('walletConnected', this.loadUserInfo.bind(this));
        window.addEventListener('accountChanged', this.loadUserInfo.bind(this));
        
        // 绑定事件
        document.getElementById('refreshBalances').addEventListener('click', this.loadUserInfo.bind(this));
        document.getElementById('approveAllTokens').addEventListener('click', this.approveAllTokens.bind(this));
        document.querySelectorAll('.btn-group .btn').forEach(btn => {
            btn.addEventListener('click', this.filterTransactions.bind(this));
        });
        
        // 初始化
        if (APP_STATE.account) {
            this.loadUserInfo();
        }
    }

    static async loadUserInfo() {
        if (!APP_STATE.account || !APP_STATE.contract) {
            return;
        }

        await this.loadWalletInfo();
        await this.loadTokenOverview();
        await this.loadAllowanceInfo();
    }

    static async loadWalletInfo() {
        try {
            // 获取ETH余额
            const ethBalance = await APP_STATE.web3.eth.getBalance(APP_STATE.account);
            
            document.getElementById('userAddress').textContent = APP_STATE.account;
            document.getElementById('ethBalance').textContent = 
                `${CommonUtils.formatAmount(ethBalance)} ETH`;
            document.getElementById('networkInfo').textContent = 
                CommonUtils.getNetworkName(APP_STATE.networkId);
        } catch (error) {
            console.error("加载钱包信息失败:", error);
        }
    }

    static async loadTokenOverview() {
        try {
            const supportedTokens = await APP_STATE.contract.methods.getSupportedTokens().call();
            const container = document.getElementById('tokensOverview');
            container.innerHTML = '';

            for (const tokenAddress of supportedTokens) {
                try {
                    const [tokenInfo, balance, allowance] = await Promise.all([
                        APP_STATE.contract.methods.getTokenInfo(tokenAddress).call(),
                        APP_STATE.contract.methods.checkBalance(tokenAddress, APP_STATE.account).call(),
                        APP_STATE.contract.methods.checkAllowance(tokenAddress, APP_STATE.account).call()
                    ]);

                    const balanceFormatted = CommonUtils.formatAmount(balance, tokenInfo.decimals);
                    const allowanceFormatted = CommonUtils.formatAmount(allowance, tokenInfo.decimals);
                    
                    // 计算授权百分比
                    const balanceNum = parseFloat(APP_STATE.web3.utils.fromWei(balance, 'ether'));
                    const allowanceNum = parseFloat(APP_STATE.web3.utils.fromWei(allowance, 'ether'));
                    const allowancePercent = balanceNum > 0 ? (allowanceNum / balanceNum) * 100 : 0;

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
                                <p class="card-text">
                                    <strong>余额:</strong> ${balanceFormatted}<br>
                                    <strong>授权:</strong> ${allowanceFormatted}
                                </p>
                                <div class="mt-2">
                                    <div class="d-flex justify-content-between small text-muted mb-1">
                                        <span>授权比例</span>
                                        <span>${allowancePercent.toFixed(1)}%</span>
                                    </div>
                                    <div class="progress">
                                        <div class="progress-bar ${allowancePercent > 50 ? 'bg-success' : 'bg-warning'}" 
                                             role="progressbar" 
                                             style="width: ${Math.min(allowancePercent, 100)}%">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="card-footer bg-transparent">
                                <small class="text-muted">
                                    地址: ${CommonUtils.formatAddress(tokenAddress)}
                                </small>
                            </div>
                        </div>
                    `;
                    
                    container.appendChild(tokenCard);
                } catch (error) {
                    console.error(`加载代币 ${tokenAddress} 概览失败:`, error);
                }
            }
        } catch (error) {
            console.error("加载代币概览失败:", error);
        }
    }

    static async loadAllowanceInfo() {
        try {
            const res = await APP_STATE.contract.methods.checkAllAllowances(APP_STATE.account).call();
            // console.log(res)
            // const [tokens, allowances] = res
            const tokens = res[0]
            const allowances = res[1]
            const container = document.getElementById('allowanceTableBody');
            container.innerHTML = '';

            for (let i = 0; i < tokens.length; i++) {
                const tokenAddress = tokens[i];
                const allowance = allowances[i];
                
                try {
                    const [tokenInfo, balance] = await Promise.all([
                        APP_STATE.contract.methods.getTokenInfo(tokenAddress).call(),
                        APP_STATE.contract.methods.checkBalance(tokenAddress, APP_STATE.account).call()
                    ]);

                    const balanceFormatted = CommonUtils.formatAmount(balance, tokenInfo.decimals);
                    const allowanceFormatted = CommonUtils.formatAmount(allowance, tokenInfo.decimals);
                    
                    // 检查授权状态
                    const hasAllowance = parseFloat(allowance) > 0;
                    const isSufficient = parseFloat(allowance) >= parseFloat(balance);

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>
                            <strong>${tokenInfo.symbol}</strong><br>
                            <small class="text-muted">${tokenInfo.name}</small>
                        </td>
                        <td>${balanceFormatted}</td>
                        <td>${allowanceFormatted}</td>
                        <td>
                            <span class="badge ${isSufficient ? 'bg-success' : hasAllowance ? 'bg-warning' : 'bg-danger'}">
                                ${isSufficient ? '充足' : hasAllowance ? '部分' : '无授权'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary approve-token" data-address="${tokenAddress}">
                                <i class="fas fa-unlock me-1"></i>授权
                            </button>
                        </td>
                    `;
                    
                    container.appendChild(row);
                } catch (error) {
                    console.error(`加载代币 ${tokenAddress} 授权信息失败:`, error);
                }
            }

            // 绑定授权按钮事件
            document.querySelectorAll('.approve-token').forEach(button => {
                button.addEventListener('click', this.showApproveModal.bind(this));
            });
        } catch (error) {
            console.error("加载授权信息失败:", error);
        }
    }

    static showApproveModal(event) {
        const tokenAddress = event.target.getAttribute('data-address');
        
        // 填充代币选择
        const tokenSelect = document.getElementById('approveTokenSelect');
        tokenSelect.innerHTML = '';
        
        // 查找代币信息
        document.querySelectorAll('.approve-token').forEach(btn => {
            if (btn.getAttribute('data-address') === tokenAddress) {
                const symbol = btn.closest('tr').querySelector('strong').textContent;
                const option = document.createElement('option');
                option.value = tokenAddress;
                option.textContent = symbol;
                option.selected = true;
                tokenSelect.appendChild(option);
            }
        });

        const approveModal = new bootstrap.Modal(document.getElementById('approveModal'));
        approveModal.show();
    }

    static async approveAllTokens() {
        if (!APP_STATE.account) {
            CommonUtils.showNotification('请先连接钱包', 'warning');
            return;
        }

        const button = document.getElementById('approveAllTokens');
        const resetButton = CommonUtils.showLoading(button, '授权所有代币中...');

        try {
            const tokens_allowances = await APP_STATE.contract.methods.checkAllAllowances(APP_STATE.account).call();
            const tokens = tokens_allowances[0]
            const allowances = tokens_allowances[1]
            let approvedCount = 0;

            for (let i = 0; i < tokens.length; i++) {
                const tokenAddress = tokens[i];
                const allowance = allowances[i];
                
                // 如果已经有充足授权，跳过
                if (parseFloat(allowance) > 0) continue;

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
            
            // 重新加载授权信息
            await this.loadAllowanceInfo();
            await this.loadTokenOverview();
        } catch (error) {
            console.error("授权所有代币失败:", error);
            CommonUtils.showNotification('授权所有代币失败', 'danger');
        } finally {
            resetButton();
        }
    }

    static async approveToken() {
        const tokenSelect = document.getElementById('approveTokenSelect');
        const amount = document.getElementById('approveAmount').value;
        const unlimited = document.getElementById('unlimitedApprove').checked;

        if (!tokenSelect.value) {
            CommonUtils.showNotification('请选择代币', 'warning');
            return;
        }

        const tokenAddress = tokenSelect.value;
        let amountInWei;

        if (unlimited) {
            amountInWei = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
        } else {
            if (!amount || parseFloat(amount) <= 0) {
                CommonUtils.showNotification('请输入有效的授权金额', 'warning');
                return;
            }
            
            // 获取代币小数位
            try {
                const tokenInfo = await APP_STATE.contract.methods.getTokenInfo(tokenAddress).call();
                amountInWei = CommonUtils.toWei(amount, tokenInfo.decimals);
            } catch (error) {
                console.error("获取代币信息失败:", error);
                amountInWei = CommonUtils.toWei(amount, 18);
            }
        }

        const button = document.getElementById('confirmApprove');
        const resetButton = CommonUtils.showLoading(button, '授权中...');

        try {
            const tokenContract = new APP_STATE.web3.eth.Contract(CONTRACT_CONFIG.erc20Abi, tokenAddress);
            
            await tokenContract.methods.approve(CONTRACT_CONFIG.address, amountInWei)
                .send({ from: APP_STATE.account });

            CommonUtils.showNotification('授权成功', 'success');

            // 关闭模态框
            bootstrap.Modal.getInstance(document.getElementById('approveModal')).hide();
            
            // 重新加载授权信息
            await this.loadAllowanceInfo();
            await this.loadTokenOverview();
        } catch (error) {
            console.error("授权失败:", error);
            CommonUtils.showNotification('授权失败: ' + error.message, 'danger');
        } finally {
            resetButton();
        }
    }

    static filterTransactions(event) {
        // 激活按钮
        document.querySelectorAll('.btn-group .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        const filterType = event.target.getAttribute('data-type');
        this.displayTransactions(filterType);
    }

    static displayTransactions(filterType = 'all') {
        // 这里可以添加从区块链事件中获取交易历史的逻辑
        // 目前显示静态提示
        const container = document.getElementById('transactionHistory');
        
        if (filterType === 'all') {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-history fa-3x text-muted mb-3"></i>
                    <p class="text-muted">交易历史功能需要从区块链事件中获取数据</p>
                    <small class="text-muted">您可以在对应的支付页面查看最近的交易记录</small>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-muted">暂无${this.getFilterName(filterType)}交易记录</p>
                </div>
            `;
        }
    }

    static getFilterName(type) {
        const names = {
            'single': '单笔支付',
            'batch': '批量支付',
            'multi': '多代币支付'
        };
        return names[type] || type;
    }
}

// 绑定授权确认事件
document.addEventListener('DOMContentLoaded', function() {
    WalletManager.connectWallet()
    UserInfo.init();
    document.getElementById('confirmApprove').addEventListener('click', UserInfo.approveToken.bind(UserInfo));
});