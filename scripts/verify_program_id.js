const fs = require('fs');
const { Keypair } = require('@solana/web3.js');

function verifyProgramId() {
    console.log("🔍 验证程序 ID 关系");
    console.log("====================");
    console.log();

    try {
        // 读取密钥对文件
        const keypairData = JSON.parse(fs.readFileSync('target/deploy/s1-keypair.json', 'utf8'));
        const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
        const publicKey = keypair.publicKey.toString();

        // 读取代码中的程序 ID
        const libContent = fs.readFileSync('programs/s1/src/lib.rs', 'utf8');
        const declareIdMatch = libContent.match(/declare_id!\("([^"]+)"\)/);
        const declaredId = declareIdMatch ? declareIdMatch[1] : '未找到';

        console.log("📋 对比结果：");
        console.log("┌─────────────────────────────────────────────────────────────┐");
        console.log("│ 来源                    │ 程序 ID                            │");
        console.log("├─────────────────────────────────────────────────────────────┤");
        console.log(`│ 密钥对文件公钥          │ ${publicKey} │`);
        console.log(`│ 代码中 declare_id!      │ ${declaredId} │`);
        console.log("└─────────────────────────────────────────────────────────────┘");
        console.log();

        if (publicKey === declaredId) {
            console.log("✅ 完美匹配！");
            console.log("   declare_id! 中的程序 ID 就是密钥对文件的公钥");
        } else {
            console.log("❌ 不匹配！");
            console.log("   需要更新代码中的程序 ID");
        }

        console.log();
        console.log("🔑 关系说明：");
        console.log("1. 密钥对文件包含私钥（64字节）");
        console.log("2. 从私钥计算出公钥（32字节）");
        console.log("3. 公钥就是程序 ID");
        console.log("4. declare_id! 声明这个程序 ID");
        console.log("5. 部署时使用密钥对文件");

    } catch (error) {
        console.error("❌ 错误:", error.message);
    }
}

verifyProgramId();
