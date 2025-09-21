const fs = require('fs');
const { PublicKey } = require('@solana/web3.js');

function explainProgramId() {
    console.log("🔑 Solana 程序 ID 详解");
    console.log("========================");
    console.log();

    // 读取密钥对文件
    try {
        const keypairPath = 'target/deploy/s1-keypair.json';
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        
        console.log("📁 密钥对文件内容:");
        console.log(`文件路径: ${keypairPath}`);
        console.log(`私钥长度: ${keypairData.length} 字节`);
        console.log(`私钥数据: [${keypairData.slice(0, 8).join(', ')}...] (前8字节)`);
        console.log();

        // 从私钥计算公钥
        const { Keypair } = require('@solana/web3.js');
        const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
        const publicKey = keypair.publicKey;
        
        console.log("🔐 密钥对信息:");
        console.log(`私钥: [${keypairData.length}字节的数组]`);
        console.log(`公钥: ${publicKey.toString()}`);
        console.log(`公钥长度: ${publicKey.toBuffer().length} 字节`);
        console.log();

        console.log("📋 程序 ID 的作用:");
        console.log("1. 唯一标识符 - 在区块链上唯一标识你的程序");
        console.log("2. PDA 种子 - 用于生成 Program Derived Address");
        console.log("3. 程序调用 - 客户端通过程序 ID 调用程序");
        console.log("4. 程序间通信 - 程序可以通过程序 ID 相互调用");
        console.log();

        console.log("🔗 程序 ID 与代码的关系:");
        console.log("1. declare_id! 宏声明程序 ID");
        console.log("2. 必须与实际部署的程序 ID 匹配");
        console.log("3. 不匹配会导致调用失败");
        console.log("4. 用于生成 PDA 和验证账户");
        console.log();

        console.log("📝 代码示例:");
        console.log("```rust");
        console.log("// 声明程序 ID");
        console.log(`declare_id!("${publicKey.toString()}");`);
        console.log();
        console.log("// 生成 PDA");
        console.log("let (pda, bump) = Pubkey::find_program_address(");
        console.log("    &[b\"counter\", user.key().as_ref()],");
        console.log(`    &program_id() // 这里使用程序 ID`);
        console.log(");");
        console.log("```");
        console.log();

        console.log("🚀 部署流程:");
        console.log("1. 生成密钥对 → 获得程序 ID");
        console.log("2. 在代码中声明程序 ID");
        console.log("3. 编译程序");
        console.log("4. 使用密钥对部署程序");
        console.log("5. 程序 ID 成为程序的永久标识符");

    } catch (error) {
        console.error("❌ 错误:", error.message);
    }
}

explainProgramId();
