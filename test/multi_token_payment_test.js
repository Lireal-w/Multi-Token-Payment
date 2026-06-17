const MultiTokenPayment = artifacts.require("MultiTokenPaymentIntegrated");
const MockUSDT = artifacts.require("MockUSDT");
const MockUSDC = artifacts.require("MockUSDC");

contract("MultiTokenPayment", (accounts) => {
    let payment;
    let usdt;
    let usdc;

    const owner = accounts[0];
    const user1 = accounts[1];
    const user2 = accounts[2];
    const recipient1 = accounts[3];
    const recipient2 = accounts[4];

    // 使用6位小数的金额
    const initialSupply = "10000000000"; // 10000 * 10^6 = 10000 USDT/USDC
    const paymentAmount = "100000000";   // 100 * 10^6 = 100 USDT/USDC

    before(async () => {
        // 部署合约
        usdt = await MockUSDT.new();
        usdc = await MockUSDC.new();
        payment = await MultiTokenPayment.new();

        // 添加支持的代币
        // await payment.addSupportedToken(usdt.address, { from: owner });
        // await payment.addSupportedToken(usdc.address, { from: owner });
        await payment.addSupportedToken(usdt.address, "mUSDT", "Mock USDT", 6, { from: owner });
        await payment.addSupportedToken(usdc.address, "mUSDC", "Mock USDC", 6, { from: owner });

        // 给用户分配代币
        await usdt.mint(user1, initialSupply, { from: owner });
        await usdc.mint(user1, initialSupply, { from: owner });
        await usdt.mint(user2, initialSupply, { from: owner });
        await usdc.mint(user2, initialSupply, { from: owner });
    });

    describe("合约部署和代币管理", () => {
        it("应该正确部署所有合约", async () => {
            assert.ok(usdt.address);
            assert.ok(usdc.address);
            assert.ok(payment.address);
        });

        it("应该正确添加支持的代币", async () => {
            const supportedTokens = await payment.getSupportedTokens();
            assert.equal(supportedTokens.length, 2);
            assert.include(supportedTokens, usdt.address);
            assert.include(supportedTokens, usdc.address);
        });

        it("应该检查代币是否支持", async () => {
            const isUSDTSupported = await payment.isTokenSupported(usdt.address);
            const isUSDCSupported = await payment.isTokenSupported(usdc.address);

            assert.isTrue(isUSDTSupported);
            assert.isTrue(isUSDCSupported);
        });

        it("应该获取代币信息", async () => {
            // 在 Truffle 测试环境中，返回值可能是一个对象，我们需要检查其结构
            const result = await payment.getTokenInfo(usdt.address);
            if (result.symbol !== undefined) {
                // 如果返回的是对象
                assert.equal(result.symbol, "mUSDT");
                assert.equal(result.name, "Mock USDT");
                assert.equal(result.decimals.toString(), "6");
            } else if (Array.isArray(result)) {
                // 如果返回的是数组
                const [symbol, name, decimals] = result;
                assert.equal(symbol, "mUSDT");
                assert.equal(name, "Mock USDT");
                assert.equal(decimals.toString(), "6");
            } else {
                // 如果返回的是其他结构，尝试解构
                const { 0: symbol, 1: name, 2: decimals } = result;
                assert.equal(symbol, "mUSDT");
                assert.equal(name, "Mock USDT");
                assert.equal(decimals.toString(), "6");
            }
        });
    });

    describe("多代币授权测试", () => {
        it("用户应该能够同时授权USDT和USDC", async () => {
            // 用户1同时授权USDT和USDC
            await usdt.approve(payment.address, paymentAmount, { from: user1 });
            await usdc.approve(payment.address, paymentAmount, { from: user1 });

            // 检查授权额度
            const usdtAllowance = await payment.checkAllowance(usdt.address, user1);
            const usdcAllowance = await payment.checkAllowance(usdc.address, user1);

            assert.equal(usdtAllowance.toString(), paymentAmount.toString());
            assert.equal(usdcAllowance.toString(), paymentAmount.toString());
        });

        it("应该检查所有代币的授权额度", async () => {
            const result = await payment.checkAllAllowances(user1);
            const tokens = result[0];
            const allowances = result[1];

            assert.equal(tokens.length, 2);
            assert.equal(allowances.length, 2);

            // 找到对应的代币授权额度
            let usdtAllowance, usdcAllowance;
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i] === usdt.address) {
                    usdtAllowance = allowances[i];
                } else if (tokens[i] === usdc.address) {
                    usdcAllowance = allowances[i];
                }
            }

            assert.equal(usdtAllowance.toString(), paymentAmount.toString());
            assert.equal(usdcAllowance.toString(), paymentAmount.toString());
        });
    });

    describe("单代币支付测试", () => {
        it("应该能够使用USDT进行支付", async () => {
            const recipientInitialBalance = await usdt.balanceOf(recipient1);

            // 用户1使用USDT进行支付
            const result = await payment.makePayment(
                usdt.address,
                recipient1,
                paymentAmount,
                { from: user1 }
            );

            // 检查事件
            const events = result.logs.filter(l => l.event === "PaymentProcessed");
            assert.equal(events.length, 1);
            assert.equal(events[0].args.token, usdt.address);
            assert.equal(events[0].args.amount.toString(), paymentAmount.toString());

            // 检查余额变化
            const recipientFinalBalance = await usdt.balanceOf(recipient1);
            assert.equal(
                recipientFinalBalance.toString(),
                web3.utils.toBN(recipientInitialBalance).add(web3.utils.toBN(paymentAmount)).toString()
            );
        });

        it("应该能够使用USDC进行支付", async () => {
            const recipientInitialBalance = await usdc.balanceOf(recipient1);

            // 用户1使用USDC进行支付
            await payment.makePayment(
                usdc.address,
                recipient1,
                paymentAmount,
                { from: user1 }
            );

            // 检查余额变化
            const recipientFinalBalance = await usdc.balanceOf(recipient1);
            assert.equal(
                recipientFinalBalance.toString(),
                web3.utils.toBN(recipientInitialBalance).add(web3.utils.toBN(paymentAmount)).toString()
            );
        });
    });

    describe("批量支付测试", () => {
        it("应该能够使用同一种代币进行批量支付", async () => {
            // 用户2授权USDT
            const doubleAmount = web3.utils.toBN(paymentAmount).mul(web3.utils.toBN(2)).toString();
            await usdt.approve(payment.address, doubleAmount, { from: user2 });

            const recipients = [recipient1, recipient2];
            const amounts = [paymentAmount, paymentAmount];

            const recipient1InitialBalance = await usdt.balanceOf(recipient1);
            const recipient2InitialBalance = await usdt.balanceOf(recipient2);

            // 执行批量支付
            const result = await payment.batchPayments(
                usdt.address,
                recipients,
                amounts,
                { from: user2 }
            );

            // 检查余额变化
            const recipient1FinalBalance = await usdt.balanceOf(recipient1);
            const recipient2FinalBalance = await usdt.balanceOf(recipient2);

            assert.equal(
                recipient1FinalBalance.toString(),
                web3.utils.toBN(recipient1InitialBalance).add(web3.utils.toBN(paymentAmount)).toString()
            );
            assert.equal(
                recipient2FinalBalance.toString(),
                web3.utils.toBN(recipient2InitialBalance).add(web3.utils.toBN(paymentAmount)).toString()
            );
        });
    });

    describe("多代币同时支付测试", () => {
        it("应该能够同时使用USDT和USDC进行支付", async () => {
            // 用户1授权足够的额度
            await usdt.approve(payment.address, paymentAmount, { from: user1 });
            await usdc.approve(payment.address, paymentAmount, { from: user1 });

            const recipient1USDTInitial = await usdt.balanceOf(recipient1);
            const recipient1USDCInitial = await usdc.balanceOf(recipient1);

            // 同时使用USDT和USDC支付
            const tokens = [usdt.address, usdc.address];
            const recipients = [recipient1, recipient1];
            const amounts = [paymentAmount, paymentAmount];

            const result = await payment.makeMultiTokenPayment(
                tokens,
                recipients,
                amounts,
                { from: user1 }
            );

            // 检查余额变化
            const recipient1USDTFinal = await usdt.balanceOf(recipient1);
            const recipient1USDCFinal = await usdc.balanceOf(recipient1);

            assert.equal(
                recipient1USDTFinal.toString(),
                web3.utils.toBN(recipient1USDTInitial).add(web3.utils.toBN(paymentAmount)).toString()
            );
            assert.equal(
                recipient1USDCFinal.toString(),
                web3.utils.toBN(recipient1USDCInitial).add(web3.utils.toBN(paymentAmount)).toString()
            );
        });
    });

    describe("错误处理测试", () => {
        it("应该拒绝不支持的代币支付", async () => {
            const randomToken = accounts[9]; // 一个随机地址作为不支持的代币

            try {
                await payment.makePayment(randomToken, recipient1, paymentAmount, { from: user1 });
                assert.fail("应该抛出错误");
            } catch (error) {
                assert.include(error.message, "Token not supported");
            }
        });

        it("应该拒绝授权不足的支付", async () => {
            // 用户2撤销USDT授权
            await usdt.approve(payment.address, 0, { from: user2 });

            try {
                await payment.makePayment(usdt.address, recipient1, paymentAmount, { from: user2 });
                assert.fail("应该抛出错误");
            } catch (error) {
                assert.include(error.message, "Insufficient allowance");
            }
        });
    });
});