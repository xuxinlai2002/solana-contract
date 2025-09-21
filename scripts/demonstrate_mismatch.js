const { PublicKey } = require('@solana/web3.js');

function demonstrateMismatch() {
    console.log("⚠️ 程序 ID 不一致的后果演示");
    console.log("================================");
    console.log();

    // 模拟不一致的情况
    const correctProgramId = "CvpHN1JUdyJ9RPMvtUBHZPthsCUnDfVTcj7Gy16J7tcY";
    const wrongProgramId = "FjdoH37XGjZHeY4x3GXBgZfvVx5bEhrKtxushCmxXyWN";

    console.log("📋 场景说明：");
    console.log("假设代码中声明了程序 ID A，但客户端调用程序 ID B");
    console.log();

    console.log("🔍 问题分析：");
    console.log("┌─────────────────────────────────────────────────────────────┐");
    console.log("│ 场景                    │ 后果                            │");
    console.log("├─────────────────────────────────────────────────────────────┤");
    console.log("│ 代码 declare_id = A     │ 程序在区块链上使用 ID A         │");
    console.log("│ 客户端调用 ID B         │ 找不到程序，调用失败             │");
    console.log("│ 代码 declare_id = A     │ 程序在区块链上使用 ID A         │");
    console.log("│ 客户端调用 ID A         │ 成功调用程序                    │");
    console.log("└─────────────────────────────────────────────────────────────┘");
    console.log();

    console.log("💥 不一致的后果：");
    console.log("1. 客户端调用失败 - 找不到程序");
    console.log("2. PDA 计算错误 - 生成错误的账户地址");
    console.log("3. 程序间通信失败 - 无法调用其他程序");
    console.log("4. 账户验证失败 - 无法验证账户所有权");
    console.log();

    console.log("✅ 一致的原理：");
    console.log("1. 程序 ID 是程序的'身份证号码'");
    console.log("2. 所有地方必须使用同一个'身份证号码'");
    console.log("3. 就像你的身份证，不能在不同地方写不同的号码");
    console.log();

    console.log("🔑 实际例子：");
    console.log("```javascript");
    console.log("// 客户端调用");
    console.log("const programId = new PublicKey('CvpHN1JUdyJ9RPMvtUBHZPthsCUnDfVTcj7Gy16J7tcY');");
    console.log("await program.methods.createCounter().rpc();");
    console.log();
    console.log("// 如果程序 ID 不匹配：");
    console.log("// ❌ Error: Program not found");
    console.log("```");
    console.log();

    console.log("🎯 总结：");
    console.log("程序 ID 必须完全一致，因为它是程序在区块链上的唯一标识符！");
}

demonstrateMismatch();
