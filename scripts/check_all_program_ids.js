const fs = require('fs');
const { Keypair } = require('@solana/web3.js');

function checkAllProgramIds() {
    console.log("🔍 检查所有程序 ID 的一致性");
    console.log("================================");
    console.log();

    try {
        // 1. 从密钥对文件获取程序 ID
        const keypairData = JSON.parse(fs.readFileSync('target/deploy/s1-keypair.json', 'utf8'));
        const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
        const keypairProgramId = keypair.publicKey.toString();

        // 2. 从代码文件获取程序 ID
        const libContent = fs.readFileSync('programs/s1/src/lib.rs', 'utf8');
        const declareIdMatch = libContent.match(/declare_id!\("([^"]+)"\)/);
        const codeProgramId = declareIdMatch ? declareIdMatch[1] : '未找到';

        // 3. 从测试脚本获取程序 ID
        const testContent = fs.readFileSync('scripts/test_s1.js', 'utf8');
        const testIdMatch = testContent.match(/new PublicKey\("([^"]+)"\)/);
        const testProgramId = testIdMatch ? testIdMatch[1] : '未找到';

        console.log("📋 程序 ID 对比表：");
        console.log("┌─────────────────────────────────────────────────────────────┐");
        console.log("│ 来源                    │ 程序 ID                            │");
        console.log("├─────────────────────────────────────────────────────────────┤");
        console.log(`│ 密钥对文件公钥          │ ${keypairProgramId} │`);
        console.log(`│ 代码中 declare_id!      │ ${codeProgramId} │`);
        console.log(`│ 测试脚本 programId      │ ${testProgramId} │`);
        console.log("└─────────────────────────────────────────────────────────────┘");
        console.log();

        // 检查一致性
        const allIds = [keypairProgramId, codeProgramId, testProgramId];
        const isConsistent = allIds.every(id => id === keypairProgramId);

        if (isConsistent) {
            console.log("✅ 所有程序 ID 完全一致！");
            console.log();
            console.log("🎯 总结：");
            console.log("1. 密钥对文件生成程序 ID");
            console.log("2. 代码中声明相同的程序 ID");
            console.log("3. 测试脚本使用相同的程序 ID");
            console.log("4. 部署时使用密钥对文件");
        } else {
            console.log("❌ 程序 ID 不一致！");
            console.log("需要更新以下文件：");
            if (codeProgramId !== keypairProgramId) {
                console.log("- programs/s1/src/lib.rs 中的 declare_id!");
            }
            if (testProgramId !== keypairProgramId) {
                console.log("- scripts/test_s1.js 中的 programId");
            }
        }

        console.log();
        console.log("🔑 程序 ID 生成流程：");
        console.log("1. solana-keygen new → 生成密钥对");
        console.log("2. 密钥对包含私钥和公钥");
        console.log("3. 公钥就是程序 ID");
        console.log("4. 所有地方都使用这个程序 ID");

    } catch (error) {
        console.error("❌ 错误:", error.message);
    }
}

checkAllProgramIds();
