const anchor = require("@coral-xyz/anchor");
const { 
    Connection, 
    PublicKey, 
    Keypair, 
    SystemProgram,
    LAMPORTS_PER_SOL 
} = require("@solana/web3.js");
const { 
    TOKEN_PROGRAM_ID, 
    createMint, 
    createAccount, 
    mintTo,
    getAccount,
    transfer
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// 配置
const NETWORK = "devnet";
const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const IDL_PATH = path.join(__dirname, "../target/idl/activity_service.json");
const DEPLOY_INFO_PATH = path.join(__dirname, "../deploy-info.json");

class ActivityServiceTester {
    constructor() {
        this.connection = new Connection(RPC_URL, "confirmed");
        this.provider = null;
        this.program = null;
        this.wallet = null;
        this.deployInfo = null;
        this.testAccounts = {};
    }

    async initialize() {
        console.log("🧪 初始化测试器...");
        
        // 加载部署信息
        if (!fs.existsSync(DEPLOY_INFO_PATH)) {
            throw new Error("部署信息文件不存在，请先运行部署脚本");
        }
        
        this.deployInfo = JSON.parse(fs.readFileSync(DEPLOY_INFO_PATH, "utf8"));
        console.log("📄 已加载部署信息");

        // 加载钱包
        const walletPath = path.join(process.env.HOME, ".config/solana/id.json");
        if (!fs.existsSync(walletPath)) {
            throw new Error(`钱包文件不存在: ${walletPath}`);
        }

        const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
        this.wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
        
        // 创建 provider 和 program
        this.provider = new anchor.AnchorProvider(
            this.connection,
            new anchor.Wallet(this.wallet),
            { commitment: "confirmed" }
        );
        
        anchor.setProvider(this.provider);
        
        const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
        this.program = new anchor.Program(idl, PROGRAM_ID, this.provider);

        console.log("✅ 测试器初始化完成");
    }

    async setupTestAccounts() {
        console.log("👥 设置测试账户...");
        
        // 创建项目方账户
        this.testAccounts.project = Keypair.generate();
        
        // 创建用户账户
        this.testAccounts.user = Keypair.generate();
        
        // 为项目方和用户请求空投
        console.log("💰 请求测试账户空投...");
        await this.requestAirdrop(this.testAccounts.project.publicKey);
        await this.requestAirdrop(this.testAccounts.user.publicKey);
        
        // 创建项目代币账户
        const tokenMint = new PublicKey(this.deployInfo.testToken.mint);
        this.testAccounts.projectTokenAccount = await createAccount(
            this.connection,
            this.testAccounts.project,
            tokenMint,
            this.testAccounts.project.publicKey
        );
        
        // 创建用户代币账户
        this.testAccounts.userTokenAccount = await createAccount(
            this.connection,
            this.testAccounts.user,
            tokenMint,
            this.testAccounts.user.publicKey
        );
        
        console.log("✅ 测试账户设置完成");
    }

    async requestAirdrop(publicKey) {
        try {
            const signature = await this.connection.requestAirdrop(
                publicKey,
                1 * LAMPORTS_PER_SOL
            );
            await this.connection.confirmTransaction(signature);
        } catch (error) {
            console.warn(`空投失败 ${publicKey.toString()}:`, error.message);
        }
    }

    async testInitialize() {
        console.log("\n🔧 测试: 程序初始化");
        
        try {
            const platformConfigPda = new PublicKey(this.deployInfo.platformConfigPda);
            const accountInfo = await this.connection.getAccountInfo(platformConfigPda);
            
            if (accountInfo) {
                console.log("✅ 程序已初始化");
                const accountData = await this.program.account.platformConfig.fetch(platformConfigPda);
                console.log(`   权限: ${accountData.authority.toString()}`);
                console.log(`   手续费比例: ${accountData.platformFeeRatio}`);
            } else {
                console.log("❌ 程序未初始化");
            }
        } catch (error) {
            console.error("❌ 初始化测试失败:", error.message);
        }
    }

    async testPlatformFeeUpdate() {
        console.log("\n💰 测试: 更新平台手续费");
        
        try {
            const platformConfigPda = new PublicKey(this.deployInfo.platformConfigPda);
            const newFeeRatio = 500; // 5%
            
            const tx = await this.program.methods
                .updatePlatformFee(newFeeRatio)
                .accounts({
                    platformConfig: platformConfigPda,
                    authority: this.wallet.publicKey,
                })
                .rpc();
            
            console.log(`✅ 手续费更新成功，交易哈希: ${tx}`);
            
            // 验证更新
            const accountData = await this.program.account.platformConfig.fetch(platformConfigPda);
            console.log(`   新手续费比例: ${accountData.platformFeeRatio}`);
            
        } catch (error) {
            console.error("❌ 手续费更新测试失败:", error.message);
        }
    }

    async testWhitelistManagement() {
        console.log("\n📝 测试: 白名单管理");
        
        try {
            const testSigner = Keypair.generate();
            const [whitelistPda] = await PublicKey.findProgramAddress(
                [Buffer.from("whitelist"), testSigner.publicKey.toBuffer()],
                this.program.programId
            );
            
            // 添加到白名单
            const addTx = await this.program.methods
                .addToWhitelist()
                .accounts({
                    whitelist: whitelistPda,
                    platformConfig: new PublicKey(this.deployInfo.platformConfigPda),
                    authority: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .remainingAccounts([
                    { pubkey: testSigner.publicKey, isSigner: false, isWritable: false }
                ])
                .rpc();
            
            console.log(`✅ 添加到白名单成功，交易哈希: ${addTx}`);
            
            // 验证白名单状态
            const whitelistData = await this.program.account.whitelist.fetch(whitelistPda);
            console.log(`   白名单状态: ${whitelistData.isWhitelisted}`);
            
        } catch (error) {
            console.error("❌ 白名单管理测试失败:", error.message);
        }
    }

    async testDeposit() {
        console.log("\n💳 测试: 存款功能");
        
        try {
            // 先给项目方转一些测试代币
            const tokenMint = new PublicKey(this.deployInfo.testToken.mint);
            const sourceTokenAccount = new PublicKey(this.deployInfo.testToken.tokenAccount);
            
            await transfer(
                this.connection,
                this.wallet,
                sourceTokenAccount,
                this.testAccounts.projectTokenAccount,
                this.wallet.publicKey,
                100000 * 10**6 // 100,000 代币
            );
            
            console.log("✅ 测试代币转账完成");
            
            // 计算项目余额 PDA
            const [projectBalancePda] = await PublicKey.findProgramAddress(
                [
                    Buffer.from("project_balance"),
                    this.testAccounts.project.publicKey.toBuffer(),
                    tokenMint.toBuffer()
                ],
                this.program.programId
            );
            
            // 执行存款
            const depositAmount = 10000 * 10**6; // 10,000 代币
            const activityId = "test-activity-001";
            
            const tx = await this.program.methods
                .deposit(
                    new anchor.BN(depositAmount),
                    activityId
                )
                .accounts({
                    platformConfig: new PublicKey(this.deployInfo.platformConfigPda),
                    projectBalance: projectBalancePda,
                    fromTokenAccount: this.testAccounts.projectTokenAccount,
                    projectTokenAccount: this.testAccounts.projectTokenAccount,
                    project: this.testAccounts.project.publicKey,
                    fromAuthority: this.testAccounts.project,
                    tokenMint: tokenMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([this.testAccounts.project])
                .rpc();
            
            console.log(`✅ 存款成功，交易哈希: ${tx}`);
            
            // 验证项目余额
            const projectBalanceData = await this.program.account.projectBalance.fetch(projectBalancePda);
            console.log(`   项目余额: ${projectBalanceData.balance.toString()}`);
            
        } catch (error) {
            console.error("❌ 存款测试失败:", error.message);
        }
    }

    async testWithdraw() {
        console.log("\n💸 测试: 提取功能");
        
        try {
            const tokenMint = new PublicKey(this.deployInfo.testToken.mint);
            
            // 计算项目余额 PDA
            const [projectBalancePda] = await PublicKey.findProgramAddress(
                [
                    Buffer.from("project_balance"),
                    this.testAccounts.project.publicKey.toBuffer(),
                    tokenMint.toBuffer()
                ],
                this.program.programId
            );
            
            // 执行提取
            const withdrawAmount = 5000 * 10**6; // 5,000 代币
            
            const tx = await this.program.methods
                .withdraw(new anchor.BN(withdrawAmount))
                .accounts({
                    projectBalance: projectBalancePda,
                    projectTokenAccount: this.testAccounts.projectTokenAccount,
                    toTokenAccount: this.testAccounts.userTokenAccount,
                    projectAuthority: this.testAccounts.project,
                    project: this.testAccounts.project.publicKey,
                    to: this.testAccounts.user.publicKey,
                    tokenMint: tokenMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([this.testAccounts.project])
                .rpc();
            
            console.log(`✅ 提取成功，交易哈希: ${tx}`);
            
            // 验证余额变化
            const projectBalanceData = await this.program.account.projectBalance.fetch(projectBalancePda);
            console.log(`   项目余额: ${projectBalanceData.balance.toString()}`);
            
            const userTokenAccount = await getAccount(this.connection, this.testAccounts.userTokenAccount);
            console.log(`   用户代币余额: ${userTokenAccount.amount.toString()}`);
            
        } catch (error) {
            console.error("❌ 提取测试失败:", error.message);
        }
    }

    async testBatchTransfer() {
        console.log("\n📦 测试: 批量转账");
        
        try {
            const tokenMint = new PublicKey(this.deployInfo.testToken.mint);
            
            // 创建多个接收者账户
            const recipients = [];
            const amounts = [];
            
            for (let i = 0; i < 3; i++) {
                const recipient = Keypair.generate();
                const recipientTokenAccount = await createAccount(
                    this.connection,
                    recipient,
                    tokenMint,
                    recipient.publicKey
                );
                recipients.push(recipientTokenAccount);
                amounts.push(1000 * 10**6); // 每个接收 1,000 代币
            }
            
            // 计算项目余额 PDA
            const [projectBalancePda] = await PublicKey.findProgramAddress(
                [
                    Buffer.from("project_balance"),
                    this.testAccounts.project.publicKey.toBuffer(),
                    tokenMint.toBuffer()
                ],
                this.program.programId
            );
            
            // 执行批量转账
            const activityId = "batch-transfer-test";
            
            const tx = await this.program.methods
                .batchTransfer(
                    amounts.map(amount => new anchor.BN(amount)),
                    activityId
                )
                .accounts({
                    projectBalance: projectBalancePda,
                    projectTokenAccount: this.testAccounts.projectTokenAccount,
                    projectAuthority: this.testAccounts.project,
                    project: this.testAccounts.project.publicKey,
                    tokenMint: tokenMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .remainingAccounts(
                    recipients.map(account => ({
                        pubkey: account,
                        isSigner: false,
                        isWritable: true
                    }))
                )
                .signers([this.testAccounts.project])
                .rpc();
            
            console.log(`✅ 批量转账成功，交易哈希: ${tx}`);
            
            // 验证接收者余额
            for (let i = 0; i < recipients.length; i++) {
                const account = await getAccount(this.connection, recipients[i]);
                console.log(`   接收者 ${i + 1} 余额: ${account.amount.toString()}`);
            }
            
        } catch (error) {
            console.error("❌ 批量转账测试失败:", error.message);
        }
    }

    async testClaimByReward() {
        console.log("\n🎁 测试: 奖励领取功能");
        
        try {
            const tokenMint = new PublicKey(this.deployInfo.testToken.mint);
            const testSigner = new PublicKey(this.deployInfo.testSigner);
            
            // 计算相关 PDA
            const [projectBalancePda] = await PublicKey.findProgramAddress(
                [
                    Buffer.from("project_balance"),
                    this.testAccounts.project.publicKey.toBuffer(),
                    tokenMint.toBuffer()
                ],
                this.program.programId
            );
            
            const [whitelistPda] = await PublicKey.findProgramAddress(
                [Buffer.from("whitelist"), testSigner.toBuffer()],
                this.program.programId
            );
            
            const [claimRecordPda] = await PublicKey.findProgramAddress(
                [Buffer.from("claim_record"), this.testAccounts.user.publicKey.toBuffer()],
                this.program.programId
            );
            
            // 测试数据
            const amounts = [new anchor.BN(1000 * 10**6), new anchor.BN(2000 * 10**6)];
            const rewardIds = ["reward-001", "reward-002"];
            const signature = Buffer.from("test-signature"); // 简化签名
            const timestamp = Math.floor(Date.now() / 1000);
            
            const tx = await this.program.methods
                .claimByReward(
                    amounts,
                    rewardIds,
                    signature,
                    new anchor.BN(timestamp)
                )
                .accounts({
                    platformConfig: new PublicKey(this.deployInfo.platformConfigPda),
                    whitelist: whitelistPda,
                    projectBalance: projectBalancePda,
                    claimRecord: claimRecordPda,
                    projectTokenAccount: this.testAccounts.projectTokenAccount,
                    userTokenAccount: this.testAccounts.userTokenAccount,
                    user: this.testAccounts.user.publicKey,
                    projectAuthority: this.testAccounts.project,
                    project: this.testAccounts.project.publicKey,
                    tokenMint: tokenMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    signer: testSigner,
                })
                .signers([this.testAccounts.user, this.testAccounts.project])
                .rpc();
            
            console.log(`✅ 奖励领取成功，交易哈希: ${tx}`);
            
            // 验证领取记录
            try {
                const claimRecordData = await this.program.account.claimRecord.fetch(claimRecordPda);
                console.log(`   已领取奖励数量: ${claimRecordData.claimedRewards.length}`);
            } catch (error) {
                console.log("   领取记录账户尚未创建");
            }
            
        } catch (error) {
            console.error("❌ 奖励领取测试失败:", error.message);
        }
    }

    async runAllTests() {
        try {
            console.log("🧪 开始运行 Activity Service 测试套件...");
            console.log(`网络: ${NETWORK}`);
            console.log(`程序ID: ${PROGRAM_ID.toString()}`);
            console.log("=" * 50);

            await this.initialize();
            await this.setupTestAccounts();

            // 运行所有测试
            await this.testInitialize();
            await this.testPlatformFeeUpdate();
            await this.testWhitelistManagement();
            await this.testDeposit();
            await this.testWithdraw();
            await this.testBatchTransfer();
            await this.testClaimByReward();

            console.log("=" * 50);
            console.log("🎉 所有测试完成！");

        } catch (error) {
            console.error("💥 测试失败:", error);
            process.exit(1);
        }
    }
}

// 运行测试
if (require.main === module) {
    const tester = new ActivityServiceTester();
    tester.runAllTests();
}

module.exports = ActivityServiceTester;
