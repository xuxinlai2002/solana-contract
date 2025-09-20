# Activity Service - Solana 智能合约

## 📖 项目简介

Activity Service 是一个基于 Solana 区块链的活动服务智能合约，用于管理活动支付、平台费用和奖励分发。该合约是原始以太坊版本 `ActivityService.sol` 的 Solana 移植版本，使用 Anchor 框架开发。

### 🚀 主要功能

- **平台费用管理**: 支持可配置的平台手续费比例
- **白名单管理**: 实现基于签名的白名单验证机制
- **代币存款**: 支持 SPL Token 存款到项目账户
- **奖励领取**: 通过签名验证的奖励领取机制，防止重复领取
- **批量转账**: 支持向多个地址批量分发代币
- **余额管理**: 实时跟踪项目代币余额

### 🏗️ 技术架构

- **区块链**: Solana Devnet
- **开发框架**: Anchor
- **编程语言**: Rust
- **前端接口**: JavaScript/TypeScript
- **代币标准**: SPL Token

## 📋 前置要求

### 环境依赖

- [Node.js](https://nodejs.org/) (v16 或更高版本)
- [Rust](https://rustup.rs/) (最新稳定版)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v1.16 或更高版本)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation)

### 安装步骤

1. **安装 Rust**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

2. **安装 Solana CLI**
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
   export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
   ```

3. **安装 Anchor CLI**
   ```bash
   npm install -g @coral-xyz/anchor-cli
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

### 自动部署（推荐）

使用提供的部署脚本进行一键部署：

```bash
# 构建项目
anchor build

# 运行部署脚本
node scripts/deploy.js
```

部署脚本将自动完成以下操作：
- 检查并构建程序
- 部署到 Solana Devnet
- 初始化程序状态
- 创建测试代币
- 设置白名单
- 保存部署信息到 `deploy-info.json`

### 手动部署

如果需要手动部署，请按照以下步骤：

1. **构建程序**
   ```bash
   anchor build
   ```

2. **部署程序**
   ```bash
   anchor deploy --provider.cluster devnet
   ```

3. **获取程序 ID**
   ```bash
   anchor keys list
   ```

## 🧪 测试指南

### 运行完整测试套件

```bash
# 运行所有测试
node scripts/test.js
```

### 测试覆盖范围

测试脚本包含以下测试用例：

1. **程序初始化测试**: 验证程序是否正确初始化
2. **平台费用更新测试**: 测试手续费比例更新功能
3. **白名单管理测试**: 验证白名单添加和移除功能
4. **存款功能测试**: 测试代币存款到项目账户
5. **提取功能测试**: 测试从项目账户提取代币
6. **批量转账测试**: 测试向多个地址批量分发代币
7. **奖励领取测试**: 测试基于签名的奖励领取机制

### 查看测试结果

测试完成后，您将看到：
- 每个测试用例的执行状态
- 交易哈希（用于区块链验证）
- 账户余额变化
- 错误信息（如果有）

## 📚 API 文档

### 程序指令

#### `initialize()`
初始化程序，设置平台配置。

**账户**:
- `platform_config`: 平台配置 PDA
- `authority`: 程序权限账户
- `system_program`: 系统程序

#### `update_platform_fee(fee_ratio: u16)`
更新平台手续费比例（0-10000，即 0%-100%）。

**参数**:
- `fee_ratio`: 手续费比例（以基点为单位）

#### `add_to_whitelist()`
将签名者添加到白名单。

**账户**:
- `whitelist`: 白名单 PDA
- `platform_config`: 平台配置 PDA
- `authority`: 程序权限账户

#### `deposit(amount: u64, activity_id: String)`
向项目账户存款。

**参数**:
- `amount`: 存款金额
- `activity_id`: 活动 ID

#### `withdraw(amount: u64)`
从项目账户提取代币。

**参数**:
- `amount`: 提取金额

#### `batch_transfer(amounts: Vec<u64>, activity_id: String)`
批量转账给多个接收者。

**参数**:
- `amounts`: 转账金额数组
- `activity_id`: 活动 ID

#### `claim_by_reward(amounts: Vec<u64>, reward_ids: Vec<String>, signature: Vec<u8>, timestamp: i64)`
通过奖励 ID 领取代币。

**参数**:
- `amounts`: 奖励金额数组
- `reward_ids`: 奖励 ID 数组
- `signature`: 签名数据
- `timestamp`: 时间戳

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

1. **部署失败**
   - 检查 Solana CLI 配置是否正确
   - 确保有足够的 SOL 余额
   - 验证网络连接

2. **测试失败**
   - 确保程序已正确部署
   - 检查 `deploy-info.json` 文件是否存在
   - 验证测试账户有足够的代币余额

3. **交易失败**
   - 检查账户签名是否正确
   - 验证 PDA 计算是否正确
   - 确保有足够的租金豁免

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
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs          # 主程序代码
├── scripts/
│   ├── deploy.js               # 部署脚本
│   └── test.js                 # 测试脚本
├── target/                     # 构建输出
├── Anchor.toml                 # Anchor 配置
├── Cargo.toml                  # 工作空间配置
├── package.json                # Node.js 依赖
├── tsconfig.json               # TypeScript 配置
├── deploy-info.json            # 部署信息（部署后生成）
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

---

**注意**: 这是一个开发版本，仅用于测试和学习目的。在生产环境中使用前，请进行充分的安全审计和测试。
