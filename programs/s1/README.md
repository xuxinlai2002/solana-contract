# S1 - Simple Counter Program

## 📖 程序简介

S1 是一个简单的 Solana 智能合约，实现了一个基本的计数器功能。用户可以创建计数器并对其进行递增操作。

## 🚀 功能特性

- **创建计数器**: 用户可以创建属于自己的计数器
- **递增计数**: 用户可以对自己的计数器进行 +1 操作
- **PDA 账户**: 使用 Program Derived Address (PDA) 确保账户唯一性
- **权限控制**: 只有计数器创建者才能对其进行操作

## 🏗️ 程序结构

### 指令 (Instructions)

1. **`create_counter`**: 创建新的计数器
   - 初始化计数器值为 0
   - 设置创建者为权限账户
   - 使用 PDA 确保账户唯一性

2. **`update_counter`**: 递增计数器
   - 将计数器值 +1
   - 验证操作权限
   - 记录日志信息

### 账户结构

#### `Counter`
```rust
pub struct Counter {
    pub authority: Pubkey,  // 权限账户
    pub count: u64,         // 计数值
}
```

#### `CreateCounter`
```rust
pub struct CreateCounter<'info> {
    pub authority: Signer<'info>,                    // 签名者
    pub counter: Account<'info, Counter>,           // 计数器账户 (PDA)
    pub system_program: Program<'info, System>,     // 系统程序
}
```

#### `UpdateCounter`
```rust
pub struct UpdateCounter<'info> {
    pub authority: Signer<'info>,        // 签名者
    pub counter: Account<'info, Counter>, // 计数器账户
}
```

## 🔧 构建和部署

### 1. 构建程序

```bash
# 进入程序目录
cd programs/s1

# 检查代码
cargo check

# 构建 SBF 程序
cargo build-sbf
```

### 2. 部署程序

```bash
# 部署到 Solana Devnet
solana program deploy target/deploy/s1.so --program-id FjdoH37XGjZHeY4x3GXBgZfvVx5bEhrKtxushCmxXyWN
```

### 3. 验证部署

```bash
# 检查程序状态
solana program show FjdoH37XGjZHeY4x3GXBgZfvVx5bEhrKtxushCmxXyWN
```

## 📋 程序信息

- **程序 ID**: `FjdoH37XGjZHeY4x3GXBgZfvVx5bEhrKtxushCmxXyWN`
- **网络**: Solana Devnet
- **框架**: Anchor
- **语言**: Rust

## 🧪 测试

运行测试脚本：

```bash
node scripts/test_s1.js
```

## 📝 使用示例

### 创建计数器

```javascript
// 调用 create_counter 指令
await program.methods
    .createCounter()
    .accounts({
        authority: user.publicKey,
        counter: counterPda,
        systemProgram: SystemProgram.programId,
    })
    .signers([user])
    .rpc();
```

### 递增计数器

```javascript
// 调用 update_counter 指令
await program.methods
    .updateCounter()
    .accounts({
        authority: user.publicKey,
        counter: counterPda,
    })
    .signers([user])
    .rpc();
```

## 🔍 PDA 计算

计数器账户使用以下种子生成 PDA：

```rust
seeds = [authority.key().as_ref()]
```

这确保了每个用户只能有一个唯一的计数器账户。

## 📊 账户空间

计数器账户的空间分配：

```rust
impl Counter {
    pub const LEN: usize = 8 +    // discriminator
                          32 +    // authority (Pubkey)
                          8;      // count (u64)
}
```

总计：48 字节

## ⚠️ 注意事项

1. **权限验证**: 只有计数器的创建者才能对其进行操作
2. **PDA 唯一性**: 每个用户只能创建一个计数器
3. **空间限制**: 计数器账户大小固定为 48 字节
4. **网络费用**: 创建账户需要支付租金

## 🔗 相关链接

- [Solana 官方文档](https://docs.solana.com/)
- [Anchor 框架文档](https://www.anchor-lang.com/)
- [PDA 概念解释](https://docs.solana.com/developing/programming-model/accounts#program-derived-addresses)
