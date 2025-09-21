const anchor = require("@coral-xyz/anchor");
const { SystemProgram, PublicKey } = require("@solana/web3.js");
const fs = require("fs");

async function main() {
    console.log("🚀 Testing S1 Counter Program");
    console.log("=============================");

    // 程序配置
    const programId = new PublicKey("CvpHN1JUdyJ9RPMvtUBHZPthsCUnDfVTcj7Gy16J7tcY");
    
    console.log("📋 Program Information:");
    console.log(`Program ID: ${programId.toString()}`);
    console.log(`Network: Devnet`);
    console.log();

    // 检查程序是否已部署
    try {
        const connection = new anchor.web3.Connection("https://devnet.rpcpool.com");
        const programInfo = await connection.getAccountInfo(programId);
        
        if (programInfo) {
            console.log("✅ Program is deployed!");
            console.log(`Program Owner: ${programInfo.owner.toString()}`);
            console.log(`Program Data Length: ${programInfo.data.length} bytes`);
            console.log(`Program Executable: ${programInfo.executable}`);
        } else {
            console.log("❌ Program is not deployed yet.");
            console.log("To deploy the program, run:");
            console.log(`solana program deploy target/deploy/s1.so --program-id ${programId.toString()}`);
        }
    } catch (error) {
        console.log("❌ Error checking program status:", error.message);
    }

    console.log();
    console.log("📖 Program Functions:");
    console.log("1. create_counter() - Create a new counter");
    console.log("2. update_counter() - Increment counter by 1");
    console.log();
    
    console.log("📁 File Structure:");
    console.log("programs/s1/");
    console.log("├── Cargo.toml");
    console.log("└── src/");
    console.log("    └── lib.rs");
    console.log();
    
    console.log("🔧 Build Commands:");
    console.log("cd programs/s1");
    console.log("cargo check");
    console.log("cargo build-sbf");
    console.log();
    
    console.log("🚀 Deploy Commands:");
    console.log(`solana program deploy target/deploy/s1.so --program-id ${programId.toString()}`);
}

main().catch(console.error);
