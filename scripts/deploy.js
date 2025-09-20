const anchor = require("@coral-xyz/anchor");
const { Connection, PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// 配置
const NETWORK = "devnet";
const RPC_URL = "https://api.devnet.solana.com";

// 程序配置
const PROGRAM_ID = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const IDL_PATH = path.join(__dirname, "../target/idl/activity_service.json");

class ActivityServiceDeployer {
    constructor() {
        this.connection = new Connection(RPC_URL, "confirmed");
        this.provider = null;
        this.program = null;
        this.wallet = null;
    }

    async initialize() {
        console.log("🚀 初始化部署器...");
        
        // 检查是否存在钱包文件
        const walletPath = path.join(process.env.HOME, ".config/solana/id.json");
        if (!fs.existsSync(walletPath)) {
            throw new Error(`钱包文件不存在: ${walletPath}`);
        }

        // 加载钱包
        const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
        this.wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
        
        console.log(`钱包地址: ${this.wallet.publicKey.toString()}`);

        // 检查 IDL 文件
        if (!fs.existsSync(IDL_PATH)) {
            throw new Error(`IDL 文件不存在: ${IDL_PATH}。请先运行 'anchor build'`);
        }

        // 创建 provider 和 program
        this.provider = new anchor.AnchorProvider(
            this.connection,
            new anchor.Wallet(this.wallet),
            { commitment: "confirmed" }
        );
        
        anchor.setProvider(this.provider);
        
        const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
        this.program = new anchor.Program(idl, PROGRAM_ID, this.provider);

        console.log("✅ 部署器初始化完成");
    }

    async checkBalance() {
        const balance = await this.connection.getBalance(this.wallet.publicKey);
        const solBalance = balance / anchor.web3.LAMPORTS_PER_SOL;
        
        console.log(`💰 当前余额: ${solBalance.toFixed(4)} SOL`);
        
        if (solBalance < 1) {
            console.log("⚠️  余额不足，正在请求空投...");
            await this.requestAirdrop();
        }
    }

    async requestAirdrop() {
        try {
            const signature = await this.connection.requestAirdrop(
                this.wallet.publicKey,
                2 * anchor.web3.LAMPORTS_PER_SOL
            );
            
            await this.connection.confirmTransaction(signature);
            console.log("✅ 空投成功");
        } catch (error) {
            console.error("❌ 空投失败:", error.message);
            throw error;
        }
    }

    async deploy() {
        console.log("📦 开始部署程序...");
        
        try {
            // 检查程序是否已部署
            const programInfo = await this.connection.getAccountInfo(PROGRAM_ID);
            if (programInfo) {
                console.log("⚠️  程序已存在，跳过部署");
                return;
            }

            // 构建程序
            console.log("🔨 构建程序...");
            const { execSync } = require("child_process");
            execSync("anchor build", { stdio: "inherit" });

            // 部署程序
            console.log("🚀 部署程序...");
            execSync("anchor deploy --provider.cluster devnet", { stdio: "inherit" });

            console.log("✅ 程序部署成功");
        } catch (error) {
            console.error("❌ 部署失败:", error.message);
            throw error;
        }
    }

    async initializeProgram() {
        console.log("🔧 初始化程序...");
        
        try {
            // 计算 PlatformConfig PDA
            const [platformConfigPda] = await PublicKey.findProgramAddress(
                [Buffer.from("platform_config")],
                this.program.programId
            );

            // 检查是否已初始化
            const platformConfigAccount = await this.connection.getAccountInfo(platformConfigPda);
            if (platformConfigAccount) {
                console.log("⚠️  程序已初始化，跳过初始化");
                return platformConfigPda;
            }

            // 初始化程序
            const tx = await this.program.methods
                .initialize()
                .accounts({
                    platformConfig: platformConfigPda,
                    authority: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log(`✅ 程序初始化成功，交易哈希: ${tx}`);
            return platformConfigPda;
        } catch (error) {
            console.error("❌ 初始化失败:", error.message);
            throw error;
        }
    }

    async createTestToken() {
        console.log("🪙 创建测试代币...");
        
        try {
            // 创建代币
            const mint = await createMint(
                this.connection,
                this.wallet,
                this.wallet.publicKey,
                null,
                6 // 小数位数
            );

            console.log(`✅ 测试代币创建成功: ${mint.toString()}`);

            // 创建代币账户
            const tokenAccount = await createAccount(
                this.connection,
                this.wallet,
                mint,
                this.wallet.publicKey
            );

            // 铸造代币
            await mintTo(
                this.connection,
                this.wallet,
                mint,
                tokenAccount,
                this.wallet.publicKey,
                1000000 * 10**6 // 1,000,000 代币
            );

            console.log(`✅ 代币账户创建并铸造成功: ${tokenAccount.toString()}`);
            
            return { mint, tokenAccount };
        } catch (error) {
            console.error("❌ 创建测试代币失败:", error.message);
            throw error;
        }
    }

    async setupWhitelist() {
        console.log("📝 设置白名单...");
        
        try {
            // 创建一个测试签名者
            const testSigner = Keypair.generate();
            
            // 计算 Whitelist PDA
            const [whitelistPda] = await PublicKey.findProgramAddress(
                [Buffer.from("whitelist"), testSigner.publicKey.toBuffer()],
                this.program.programId
            );

            // 添加到白名单
            const tx = await this.program.methods
                .addToWhitelist()
                .accounts({
                    whitelist: whitelistPda,
                    platformConfig: await this.getPlatformConfigPda(),
                    authority: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .remainingAccounts([
                    { pubkey: testSigner.publicKey, isSigner: false, isWritable: false }
                ])
                .rpc();

            console.log(`✅ 白名单设置成功，交易哈希: ${tx}`);
            return { testSigner, whitelistPda };
        } catch (error) {
            console.error("❌ 设置白名单失败:", error.message);
            throw error;
        }
    }

    async getPlatformConfigPda() {
        const [platformConfigPda] = await PublicKey.findProgramAddress(
            [Buffer.from("platform_config")],
            this.program.programId
        );
        return platformConfigPda;
    }

    async run() {
        try {
            console.log("🎯 开始部署 Activity Service 到 Devnet...");
            console.log(`网络: ${NETWORK}`);
            console.log(`RPC: ${RPC_URL}`);
            console.log(`程序ID: ${PROGRAM_ID.toString()}`);
            console.log("=" * 50);

            await this.initialize();
            await this.checkBalance();
            await this.deploy();
            
            const platformConfigPda = await this.initializeProgram();
            const testToken = await this.createTestToken();
            const whitelist = await this.setupWhitelist();

            console.log("=" * 50);
            console.log("🎉 部署完成！");
            console.log(`平台配置 PDA: ${platformConfigPda.toString()}`);
            console.log(`测试代币: ${testToken.mint.toString()}`);
            console.log(`测试代币账户: ${testToken.tokenAccount.toString()}`);
            console.log(`测试签名者: ${whitelist.testSigner.publicKey.toString()}`);
            console.log(`白名单 PDA: ${whitelist.whitelistPda.toString()}`);

            // 保存部署信息
            const deployInfo = {
                network: NETWORK,
                programId: PROGRAM_ID.toString(),
                platformConfigPda: platformConfigPda.toString(),
                testToken: {
                    mint: testToken.mint.toString(),
                    tokenAccount: testToken.tokenAccount.toString(),
                },
                testSigner: whitelist.testSigner.publicKey.toString(),
                whitelistPda: whitelist.whitelistPda.toString(),
                timestamp: new Date().toISOString(),
            };

            fs.writeFileSync(
                path.join(__dirname, "../deploy-info.json"),
                JSON.stringify(deployInfo, null, 2)
            );

            console.log("📄 部署信息已保存到 deploy-info.json");

        } catch (error) {
            console.error("💥 部署失败:", error);
            process.exit(1);
        }
    }
}

// 运行部署
if (require.main === module) {
    const deployer = new ActivityServiceDeployer();
    deployer.run();
}

module.exports = ActivityServiceDeployer;
