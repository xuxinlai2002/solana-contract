# Activity Service - Solana 智能合约

## 📖 项目简介

Activity Service 是一个基于 Solana 区块链的活动服务智能合约，专注于安全的奖励分发功能。该合约使用 Anchor 框架开发，实现了基于签名验证的奖励领取机制，确保只有授权用户才能领取代币奖励。

### 🎯 部署状态
- ✅ **已成功部署到 Solana Devnet**
- **程序 ID**: `DMKWzYe9vsSqXUD81o5UyA3sfkPa789Qg8iJPBdH3bZA`
- **状态**: 正常运行，可接受调用

### 🚀 核心功能

- **奖励领取**: 通过签名验证的奖励领取机制，防止重复领取
- **白名单验证**: 基于 Ed25519 签名的白名单验证系统
- **防重复机制**: 使用用户奖励键值对防止同一奖励被重复领取
- **时间戳验证**: 签名有效期控制，防止重放攻击
- **批量处理**: 支持一次性领取多个奖励
- **安全转账**: 使用 CPI 安全地执行代币转账

### 🏗️ 技术架构

- **区块链**: Solana Devnet
- **开发框架**: Anchor
- **编程语言**: Rust
- **前端接口**: JavaScript/TypeScript
- **代币标准**: SPL Token

## 📋 前置要求

### 环境依赖

- [Node.js](https://nodejs.org/) (v20.0.0 或更高版本)
- [Rust](https://rustup.rs/) (最新稳定版，v1.90.0+)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v1.18+)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (v0.29.0)

### 安装步骤

1. **安装 Rust**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

2. **安装 Solana CLI**
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"
   export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
   ```

3. **安装 Anchor CLI**
   ```bash
   npm install -g @coral-xyz/anchor-cli@0.29.0
   ```

4. **安装项目依赖**
   ```bash
   npm install
   ```

## 🔧 配置设置

### 1. 配置 Solana CLI

```bash
# 设置网络为 devnet
solana config set --url devnet

# 创建新钱包（如果还没有）
solana-keygen new --outfile ~/.config/solana/id.json

# 获取钱包地址
solana address
```

### 2. 获取测试 SOL

```bash
# 请求空投（每次最多 2 SOL）
solana airdrop 2
```

### 3. 验证配置

```bash
# 检查 Solana 配置
solana config get

# 检查余额
solana balance
```

## 🚀 部署指南

### 当前部署状态

✅ **程序已成功部署到 Solana Devnet**

- **程序 ID**: `DMKWzYe9vsSqXUD81o5UyA3sfkPa789Qg8iJPBdH3bZA`
- **网络**: Solana Devnet
- **部署槽位**: 409258762
- **程序大小**: 261,904 字节
- **状态**: 正常运行

### 推荐的构建和部署方法

由于 Anchor CLI 版本兼容性问题，推荐使用以下方法：

1. **使用 Cargo 构建 SBF 程序**
   ```bash
   # 构建 Solana 程序
   cargo build-sbf
   ```

2. **使用 Solana CLI 部署**
   ```bash
   # 设置环境变量
   export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
   
   # 部署程序
   solana program deploy target/deploy/activity_service.so
   ```

3. **验证部署**
   ```bash
   # 查看程序信息
   solana program show DMKWzYe9vsSqXUD81o5UyA3sfkPa789Qg8iJPBdH3bZA
   ```

### 网络配置

如果遇到连接问题，可以切换到更稳定的 RPC 端点：

```bash
# 切换到更稳定的 RPC 端点
solana config set --url https://devnet.rpcpool.com

# 验证连接
solana balance
```

### 部署后配置

部署完成后，需要手动配置以下内容：
- 初始化平台配置账户
- 设置白名单账户
- 创建项目余额账户
- 配置必要的权限

## 🧪 测试指南

### 运行完整测试套件

```bash
# 运行所有测试
node scripts/test.js
```

### 测试覆盖范围

当前测试包含以下功能：

1. **程序 ID 验证**: 验证程序 ID 是否正确设置
2. **奖励领取功能**: 测试基于签名的奖励领取机制
3. **白名单验证**: 验证白名单账户状态
4. **防重复领取**: 测试同一奖励不能被重复领取
5. **时间戳验证**: 验证签名的时效性

### 查看测试结果

测试完成后，您将看到：
- 每个测试用例的执行状态
- 交易哈希（用于区块链验证）
- 账户余额变化
- 错误信息（如果有）

## 📚 API 文档

### 程序指令

#### `claim_by_reward(amounts: Vec<u64>, reward_ids: Vec<String>, signature: Vec<u8>, timestamp: i64)`
通过奖励 ID 领取代币。这是当前版本中唯一可用的指令。

**参数**:
- `amounts`: 奖励金额数组
- `reward_ids`: 奖励 ID 数组
- `signature`: Ed25519 签名数据
- `timestamp`: 签名时间戳

**账户**:
- `platform_config`: 平台配置 PDA
- `whitelist`: 白名单验证 PDA
- `project_balance`: 项目代币余额 PDA
- `claim_record`: 用户领取记录 PDA
- `project_token_account`: 项目代币账户
- `user_token_account`: 用户代币账户
- `user`: 用户签名账户
- `project_authority`: 项目权限签名账户
- `project`: 项目账户信息
- `token_mint`: 代币铸造地址
- `token_program`: SPL Token 程序
- `system_program`: 系统程序
- `signer`: 签名验证账户

**验证逻辑**:
1. 验证数组长度匹配
2. 检查签名时间戳有效性（1小时内）
3. 验证白名单状态
4. 检查奖励是否已被领取
5. 执行代币转账
6. 更新领取记录

### 数据结构

#### `PlatformConfig`
```rust
pub struct PlatformConfig {
    pub authority: Pubkey,        // 权限账户
    pub platform_fee_ratio: u16, // 手续费比例
    pub bump: u8,                // PDA bump
}
```

#### `ProjectBalance`
```rust
pub struct ProjectBalance {
    pub project: Pubkey,     // 项目账户
    pub token_mint: Pubkey,  // 代币铸造地址
    pub balance: u64,        // 余额
    pub bump: u8,           // PDA bump
}
```

#### `Whitelist`
```rust
pub struct Whitelist {
    pub authority: Pubkey,      // 权限账户
    pub signer: Pubkey,         // 签名者
    pub is_whitelisted: bool,   // 是否在白名单中
    pub bump: u8,              // PDA bump
}
```

#### `ClaimRecord`
```rust
pub struct ClaimRecord {
    pub user: Pubkey,                    // 用户账户
    pub claimed_rewards: Vec<[u8; 32]>, // 已领取的奖励
    pub bump: u8,                       // PDA bump
}
```

## 🔍 故障排除

### 常见问题

1. **构建失败**
   - 确保 Rust 工具链是最新版本 (`rustup update`)
   - 使用 `cargo build-sbf` 而不是 `anchor build`
   - 验证所有依赖是否正确安装

2. **网络连接超时**
   - 切换到更稳定的 RPC 端点: `solana config set --url https://devnet.rpcpool.com`
   - 检查网络连接和代理设置
   - 确保有足够的 SOL 余额用于部署

3. **Anchor CLI 版本问题**
   - 推荐使用 `cargo build-sbf` + `solana program deploy` 组合
   - 避免使用 `anchor deploy` 命令（存在版本兼容性问题）

4. **IDL 文件缺失**
   - IDL 文件已手动创建在 `target/idl/activity_service.json`
   - 包含必要的 `discriminator` 字段

5. **交易失败**
   - 检查所有账户是否正确传递
   - 验证 PDA 计算是否正确
   - 确保签名账户有足够权限
   - 检查白名单状态是否正确设置

### 调试技巧

1. **查看交易详情**
   ```bash
   solana confirm <transaction-hash>
   ```

2. **查看账户信息**
   ```bash
   solana account <account-address>
   ```

3. **查看程序日志**
   ```bash
   solana logs <program-id>
   ```

## 📁 项目结构

```
solana-contract/
├── programs/
│   └── activity-service/
│       ├── Cargo.toml          # 程序依赖配置
│       └── src/
│           └── lib.rs          # ClaimByReward 程序代码
├── scripts/
│   ├── deploy.js               # 部署脚本
│   ├── example.js              # 使用示例
│   └── test.js                 # 测试脚本
├── target/
│   ├── idl/
│   │   └── activity_service.json  # IDL 接口定义
│   └── release/                # 构建输出
├── Anchor.toml                 # Anchor 配置
├── Cargo.toml                  # 工作空间配置
├── package.json                # Node.js 依赖
├── tsconfig.json               # TypeScript 配置
├── PROJECT_SUMMARY.md          # 项目总结
└── README.md                   # 项目文档
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如果您遇到问题或有任何疑问，请：

1. 查看本文档的故障排除部分
2. 检查 [Issues](../../issues) 页面
3. 创建新的 Issue 描述您的问题

## 🔗 相关链接

- [Solana 官方文档](https://docs.solana.com/)
- [Anchor 框架文档](https://www.anchor-lang.com/)
- [SPL Token 文档](https://spl.solana.com/token)
- [Solana Web3.js 文档](https://solana-labs.github.io/solana-web3.js/)

## ⚠️ 重要说明

### 当前版本状态
- **功能范围**: 仅包含 `claim_by_reward` 功能
- **部署状态**: ✅ 已成功部署到 Solana Devnet
- **程序 ID**: `DMKWzYe9vsSqXUD81o5UyA3sfkPa789Qg8iJPBdH3bZA`
- **开发阶段**: 基础功能已完成，签名验证部分需要进一步完善
- **安全级别**: 开发版本，需要安全审计

### 部署成功信息
- **网络**: Solana Devnet
- **部署槽位**: 409258762
- **程序大小**: 261,904 字节
- **部署方法**: `cargo build-sbf` + `solana program deploy`
- **RPC 端点**: `https://devnet.rpcpool.com`

### 生产部署前检查清单
- [ ] 完善 Ed25519 签名验证逻辑
- [ ] 进行安全审计
- [ ] 压力测试和边界测试
- [ ] 完整的错误处理
- [ ] 文档和示例代码完善

### 推荐使用方式
- 使用 `cargo build-sbf` 构建程序
- 使用 `solana program deploy` 部署程序
- 避免使用 `anchor deploy` 命令（版本兼容性问题）

---

**注意**: 这是一个开发版本，专注于奖励领取功能。程序已成功部署到 Devnet，在生产环境中使用前，请进行充分的安全审计和测试。
