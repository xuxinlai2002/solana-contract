const anchor = require("@coral-xyz/anchor");
const { 
    Connection, 
    PublicKey, 
    Keypair, 
    SystemProgram 
} = require("@solana/web3.js");
const { 
    TOKEN_PROGRAM_ID, 
    createMint, 
    createAccount, 
    mintTo 
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

/**
 * Activity Service 使用示例
 * 演示如何使用已部署的合约进行基本操作
 */

class ActivityServiceExample {
    constructor() {
        this.connection = new Connection("https://api.devnet.solana.com", "confirmed");
        this.program = null;
        this.wallet = null;
        this.deployInfo = null;
    }

    async initialize() {
        console.log("📚 Activity Service 使用示例");
        console.log("=" * 40);

        // 加载部署信息
        const deployInfoPath = path.join(__dirname, "../deploy-info.json");
        if (!fs.existsSync(deployInfoPath)) {
            throw new Error("请先运行部署脚本: node scripts/deploy.js");
        }

        this.deployInfo = JSON.parse(fs.readFileSync(deployInfoPath, "utf8"));

        // 加载钱包和程序
        const walletPath = path.join(process.env.HOME, ".config/solana/id.json");
        const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
        this.wallet = Keypair.fromSecretKey(new Uint8Array(walletData));

        const provider = new anchor.AnchorProvider(
            this.connection,
            new anchor.Wallet(this.wallet),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);

        const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/activity_service.json"), "utf8"));
        this.program = new anchor.Program(idl, new PublicKey(this.deployInfo.programId), provider);

        console.log(`✅ 连接到程序: ${this.deployInfo.programId}`);
        console.log(`✅ 钱包地址: ${this.wallet.publicKey.toString()}`);
    }

    async example1_checkPlatformConfig() {
        console.log("\n📋 示例 1: 查看平台配置");
        
        const platformConfigPda = new PublicKey(this.deployInfo.platformConfigPda);
        const config = await this.program.account.platformConfig.fetch(platformConfigPda);
        
        console.log(`   权限地址: ${config.authority.toString()}`);
        console.log(`   手续费比例: ${config.platformFeeRatio} (${config.platformFeeRatio / 100}%)`);
    }

    async example2_updatePlatformFee() {
        console.log("\n💰 示例 2: 更新平台手续费");
        
        const newFeeRatio = 250; // 2.5%
        const platformConfigPda = new PublicKey(this.deployInfo.platformConfigPda);
        
        const tx = await this.program.methods
            .updatePlatformFee(newFeeRatio)
            .accounts({
                platformConfig: platformConfigPda,
                authority: this.wallet.publicKey,
            })
            .rpc();

        console.log(`   ✅ 手续费更新成功`);
        console.log(`   新手续费比例: ${newFeeRatio / 100}%`);
        console.log(`   交易哈希: ${tx}`);
    }

    async example3_createProjectAndDeposit() {
        console.log("\n🏗️ 示例 3: 创建项目并存款");
        
        // 创建项目账户
        const project = Keypair.generate();
        console.log(`   项目地址: ${project.publicKey.toString()}`);
        
        // 请求空投
        try {
            const signature = await this.connection.requestAirdrop(project.publicKey, 1e9);
            await this.connection.confirmTransaction(signature);
            console.log("   ✅ 项目账户空投成功");
        } catch (error) {
            console.log("   ⚠️ 空投失败，使用现有余额");
        }

        // 创建项目代币账户
        const tokenMint = new PublicKey(this.deployInfo.testToken.mint);
        const projectTokenAccount = await createAccount(
            this.connection,
            project,
            tokenMint,
            project.publicKey
        );

        // 从主账户转一些代币给项目
        const sourceTokenAccount = new PublicKey(this.deployInfo.testToken.tokenAccount);
        await this.transferTokens(sourceTokenAccount, projectTokenAccount, 10000 * 1e6);
        
        console.log("   ✅ 测试代币转账完成");

        // 计算项目余额 PDA
        const [projectBalancePda] = await PublicKey.findProgramAddress(
            [
                Buffer.from("project_balance"),
                project.publicKey.toBuffer(),
                tokenMint.toBuffer()
            ],
            this.program.programId
        );

        // 执行存款
        const depositAmount = 5000 * 1e6;
        const activityId = "example-activity-001";
        
        const tx = await this.program.methods
            .deposit(
                new anchor.BN(depositAmount),
                activityId
            )
            .accounts({
                platformConfig: new PublicKey(this.deployInfo.platformConfigPda),
                projectBalance: projectBalancePda,
                fromTokenAccount: projectTokenAccount,
                projectTokenAccount: projectTokenAccount,
                project: project.publicKey,
                fromAuthority: project,
                tokenMint: tokenMint,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([project])
            .rpc();

        console.log(`   ✅ 存款成功`);
        console.log(`   存款金额: ${depositAmount / 1e6} 代币`);
        console.log(`   交易哈希: ${tx}`);

        return { project, projectTokenAccount, projectBalancePda };
    }

    async example4_batchTransfer(projectInfo) {
        console.log("\n📦 示例 4: 批量转账");
        
        const { project, projectTokenAccount, projectBalancePda } = projectInfo;
        const tokenMint = new PublicKey(this.deployInfo.testToken.mint);
        
        // 创建接收者
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
            amounts.push(500 * 1e6); // 每个接收 500 代币
            console.log(`   接收者 ${i + 1}: ${recipient.publicKey.toString()}`);
        }

        // 执行批量转账
        const activityId = "batch-transfer-example";
        
        const tx = await this.program.methods
            .batchTransfer(
                amounts.map(amount => new anchor.BN(amount)),
                activityId
            )
            .accounts({
                projectBalance: projectBalancePda,
                projectTokenAccount: projectTokenAccount,
                projectAuthority: project,
                project: project.publicKey,
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
            .signers([project])
            .rpc();

        console.log(`   ✅ 批量转账成功`);
        console.log(`   转账金额: ${amounts.map(a => a / 1e6).join(', ')} 代币`);
        console.log(`   交易哈希: ${tx}`);
    }

    async transferTokens(fromAccount, toAccount, amount) {
        const { transfer } = require("@solana/spl-token");
        await transfer(
            this.connection,
            this.wallet,
            fromAccount,
            toAccount,
            this.wallet.publicKey,
            amount
        );
    }

    async run() {
        try {
            await this.initialize();
            
            await this.example1_checkPlatformConfig();
            await this.example2_updatePlatformFee();
            
            const projectInfo = await this.example3_createProjectAndDeposit();
            await this.example4_batchTransfer(projectInfo);

            console.log("\n🎉 所有示例运行完成！");
            console.log("\n💡 提示:");
            console.log("   - 查看 deploy-info.json 了解部署详情");
            console.log("   - 运行 'node scripts/test.js' 执行完整测试");
            console.log("   - 查看 README.md 了解更多功能");

        } catch (error) {
            console.error("❌ 示例运行失败:", error.message);
            process.exit(1);
        }
    }
}

// 运行示例
if (require.main === module) {
    const example = new ActivityServiceExample();
    example.run();
}

module.exports = ActivityServiceExample;
