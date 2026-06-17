// 主页面功能
class IndexPage {
    static async init() {
        // 监听钱包连接事件
        window.addEventListener('walletConnected', this.loadContractInfo.bind(this));
        
        // 如果有已连接的钱包，立即加载信息
        if (APP_STATE.account) {
            this.loadContractInfo();
        }
        
        // 绑定合约信息按钮事件
        document.getElementById('loadContractInfo').addEventListener('click', this.loadContractInfo.bind(this));
    }

    static async loadContractInfo() {
        if (!APP_STATE.contract) {
            CommonUtils.showNotification('请先连接钱包', 'warning');
            return;
        }

        const button = document.getElementById('loadContractInfo');
        const resetButton = CommonUtils.showLoading(button, '加载中...');

        try {
            // 获取合约版本
            const version = await APP_STATE.contract.methods.getVersion().call();
            
            // 获取支持的代币列表
            const supportedTokens = await APP_STATE.contract.methods.getSupportedTokens().call();
            
            // 获取代币详细信息
            const tokenDetails = [];
            for (const tokenAddress of supportedTokens) {
                try {
                    const tokenInfo = await APP_STATE.contract.methods.getTokenInfo(tokenAddress).call();
                    tokenDetails.push({
                        address: tokenAddress,
                        symbol: tokenInfo.symbol,
                        name: tokenInfo.name,
                        decimals: tokenInfo.decimals,
                        isNonStandard: tokenInfo.isNonStandard
                    });
                } catch (error) {
                    console.error(`获取代币 ${tokenAddress} 信息失败:`, error);
                }
            }

            this.displayContractInfo(version, tokenDetails);
        } catch (error) {
            console.error("加载合约信息失败:", error);
            CommonUtils.showNotification('加载合约信息失败', 'danger');
        } finally {
            resetButton();
        }
    }

    static displayContractInfo(version, tokens) {
        const container = document.getElementById('contractInfoContent');
        
        let html = `
            <div class="row">
                <div class="col-md-6">
                    <h6>合约版本</h6>
                    <p><code>${version}</code></p>
                </div>
                <div class="col-md-6">
                    <h6>合约地址</h6>
                    <p><code>${CommonUtils.formatAddress(CONTRACT_CONFIG.address)}</code></p>
                </div>
            </div>
        `;

        if (tokens.length > 0) {
            html += `
                <div class="mt-4">
                    <h6>支持的代币 (${tokens.length})</h6>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>符号</th>
                                    <th>名称</th>
                                    <th>地址</th>
                                    <th>类型</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            tokens.forEach(token => {
                html += `
                    <tr>
                        <td><strong>${token.symbol}</strong></td>
                        <td>${token.name}</td>
                        <td><code>${CommonUtils.formatAddress(token.address)}</code></td>
                        <td>
                            <span class="badge ${token.isNonStandard ? 'bg-warning' : 'bg-success'}">
                                ${token.isNonStandard ? '非标准' : '标准'}
                            </span>
                        </td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="mt-4">
                    <h6>支持的代币</h6>
                    <p class="text-muted">暂无支持的代币</p>
                </div>
            `;
        }

        container.innerHTML = html;
        
        // 显示卡片
        document.getElementById('contractInfo').style.display = 'block';
    }
}

// 初始化主页面
document.addEventListener('DOMContentLoaded', function() {
    IndexPage.init();
});