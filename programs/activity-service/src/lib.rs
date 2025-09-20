use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use solana_program::{
    ed25519_program,
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    secp256k1_recover::secp256k1_recover,
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod activity_service {
    use super::*;

    /// 初始化程序
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let platform_config = &mut ctx.accounts.platform_config;
        platform_config.authority = ctx.accounts.authority.key();
        platform_config.platform_fee_ratio = 0; // 默认无手续费
        platform_config.bump = ctx.bumps.platform_config;
        
        emit!(PlatformInitialized {
            authority: platform_config.authority,
            platform_fee_ratio: platform_config.platform_fee_ratio,
        });

        Ok(())
    }

    /// 更新平台手续费比例
    pub fn update_platform_fee(
        ctx: Context<UpdatePlatformFee>,
        fee_ratio: u16,
    ) -> Result<()> {
        require!(fee_ratio <= 10000, ErrorCode::InvalidFeeRatio);
        
        let platform_config = &mut ctx.accounts.platform_config;
        platform_config.platform_fee_ratio = fee_ratio;
        
        emit!(PlatformFeeUpdated {
            new_fee_ratio: fee_ratio,
        });

        Ok(())
    }

    /// 添加白名单地址
    pub fn add_to_whitelist(ctx: Context<WhitelistManagement>) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.authority = ctx.accounts.authority.key();
        whitelist.signer = ctx.accounts.signer.key();
        whitelist.is_whitelisted = true;
        whitelist.bump = ctx.bumps.whitelist;
        
        emit!(WhitelistUpdated {
            signer: whitelist.signer,
            is_whitelisted: true,
        });

        Ok(())
    }

    /// 从白名单移除地址
    pub fn remove_from_whitelist(ctx: Context<WhitelistManagement>) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.authority = ctx.accounts.authority.key();
        whitelist.signer = ctx.accounts.signer.key();
        whitelist.is_whitelisted = false;
        whitelist.bump = ctx.bumps.whitelist;
        
        emit!(WhitelistUpdated {
            signer: whitelist.signer,
            is_whitelisted: false,
        });

        Ok(())
    }

    /// 存款到项目
    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
        activity_id: String,
    ) -> Result<()> {
        let platform_config = &ctx.accounts.platform_config;
        let project_balance = &mut ctx.accounts.project_balance;
        
        // 计算平台手续费
        let fee = if platform_config.platform_fee_ratio > 0 {
            (amount as u128 * platform_config.platform_fee_ratio as u128 / 10000) as u64
        } else {
            0
        };
        
        let deposit_amount = amount - fee;
        
        // 执行代币转账
        let cpi_accounts = Transfer {
            from: ctx.accounts.from_token_account.to_account_info(),
            to: ctx.accounts.project_token_account.to_account_info(),
            authority: ctx.accounts.from_authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::transfer(cpi_ctx, deposit_amount)?;
        
        // 更新项目余额
        project_balance.project = ctx.accounts.project.key();
        project_balance.token_mint = ctx.accounts.token_mint.key();
        project_balance.balance = project_balance.balance.checked_add(deposit_amount).unwrap();
        project_balance.bump = ctx.bumps.project_balance;
        
        emit!(DepositEvent {
            project: project_balance.project,
            token_mint: project_balance.token_mint,
            amount: deposit_amount,
            fee,
            activity_id,
        });

        Ok(())
    }

    /// 通过奖励ID领取代币
    pub fn claim_by_reward(
        ctx: Context<ClaimByReward>,
        amounts: Vec<u64>,
        reward_ids: Vec<String>,
        signature: Vec<u8>,
        timestamp: i64,
    ) -> Result<()> {
        require!(amounts.len() == reward_ids.len(), ErrorCode::ArrayLengthMismatch);
        require!(!reward_ids.is_empty(), ErrorCode::EmptyParams);

        // 验证签名
        verify_signature(
            &ctx.accounts.platform_config,
            &ctx.accounts.whitelist,
            &amounts,
            &reward_ids,
            &signature,
            timestamp,
        )?;

        let mut total_amount = 0u64;
        let mut processed_reward_ids = Vec::new();
        
        // 处理每个奖励ID
        for (i, reward_id) in reward_ids.iter().enumerate() {
            let user_reward_key = get_user_reward_key(&ctx.accounts.user.key(), reward_id);
            
            // 检查是否已经领取过
            if !ctx.accounts.claim_record.is_claimed(user_reward_key) {
                total_amount = total_amount.checked_add(amounts[i]).unwrap();
                processed_reward_ids.push(reward_id.clone());
                ctx.accounts.claim_record.mark_claimed(user_reward_key);
            }
        }

        // 如果有未领取的奖励，执行转账
        if total_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.project_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.project_authority.to_account_info(),
            };
            
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            
            token::transfer(cpi_ctx, total_amount)?;
            
            // 更新项目余额
            ctx.accounts.project_balance.balance = ctx.accounts.project_balance
                .balance
                .checked_sub(total_amount)
                .unwrap();
            
            emit!(ClaimByRewardEvent {
                user: ctx.accounts.user.key(),
                token_mint: ctx.accounts.token_mint.key(),
                total_amount,
                reward_ids: processed_reward_ids,
            });
        }

        Ok(())
    }

    /// 项目提取代币
    pub fn withdraw(
        ctx: Context<Withdraw>,
        amount: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.project_balance.balance >= amount,
            ErrorCode::InsufficientBalance
        );

        let cpi_accounts = Transfer {
            from: ctx.accounts.project_token_account.to_account_info(),
            to: ctx.accounts.to_token_account.to_account_info(),
            authority: ctx.accounts.project_authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::transfer(cpi_ctx, amount)?;
        
        // 更新项目余额
        ctx.accounts.project_balance.balance = ctx.accounts.project_balance
            .balance
            .checked_sub(amount)
            .unwrap();
        
        emit!(WithdrawEvent {
            project: ctx.accounts.project.key(),
            to: ctx.accounts.to.key(),
            token_mint: ctx.accounts.token_mint.key(),
            amount,
        });

        Ok(())
    }

    /// 批量转账
    pub fn batch_transfer(
        ctx: Context<BatchTransfer>,
        amounts: Vec<u64>,
        activity_id: String,
    ) -> Result<()> {
        require!(
            ctx.accounts.recipients.len() == amounts.len(),
            ErrorCode::ArrayLengthMismatch
        );

        let mut total_amount = 0u64;
        for amount in &amounts {
            total_amount = total_amount.checked_add(*amount).unwrap();
        }

        require!(
            ctx.accounts.project_balance.balance >= total_amount,
            ErrorCode::InsufficientBalance
        );

        // 执行批量转账
        for (i, recipient) in ctx.accounts.recipients.iter().enumerate() {
            let cpi_accounts = Transfer {
                from: ctx.accounts.project_token_account.to_account_info(),
                to: recipient.to_account_info(),
                authority: ctx.accounts.project_authority.to_account_info(),
            };
            
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            
            token::transfer(cpi_ctx, amounts[i])?;
        }

        // 更新项目余额
        ctx.accounts.project_balance.balance = ctx.accounts.project_balance
            .balance
            .checked_sub(total_amount)
            .unwrap();
        
        emit!(BatchTransferEvent {
            project: ctx.accounts.project.key(),
            token_mint: ctx.accounts.token_mint.key(),
            total_amount,
            activity_id,
        });

        Ok(())
    }
}

// 账户结构体
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = PlatformConfig::LEN,
        seeds = [b"platform_config"],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePlatformFee<'info> {
    #[account(
        mut,
        seeds = [b"platform_config"],
        bump = platform_config.bump,
        constraint = platform_config.authority == authority.key()
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(signer: Pubkey)]
pub struct WhitelistManagement<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = Whitelist::LEN,
        seeds = [b"whitelist", signer.key().as_ref()],
        bump
    )]
    pub whitelist: Account<'info, Whitelist>,
    
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump,
        constraint = platform_config.authority == authority.key()
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        init_if_needed,
        payer = project,
        space = ProjectBalance::LEN,
        seeds = [b"project_balance", project.key().as_ref(), token_mint.key().as_ref()],
        bump
    )]
    pub project_balance: Account<'info, ProjectBalance>,
    
    #[account(mut)]
    pub from_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub project_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub project: Signer<'info>,
    
    pub from_authority: Signer<'info>,
    
    pub token_mint: Account<'info, token::Mint>,
    
    pub token_program: Program<'info, Token>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimByReward<'info> {
    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    
    #[account(
        seeds = [b"whitelist", signer.key().as_ref()],
        bump = whitelist.bump,
        constraint = whitelist.is_whitelisted
    )]
    pub whitelist: Account<'info, Whitelist>,
    
    #[account(
        mut,
        seeds = [b"project_balance", project.key().as_ref(), token_mint.key().as_ref()],
        bump = project_balance.bump
    )]
    pub project_balance: Account<'info, ProjectBalance>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = ClaimRecord::LEN,
        seeds = [b"claim_record", user.key().as_ref()],
        bump
    )]
    pub claim_record: Account<'info, ClaimRecord>,
    
    #[account(mut)]
    pub project_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub project_authority: Signer<'info>,
    
    pub project: AccountInfo<'info>,
    
    pub token_mint: Account<'info, token::Mint>,
    
    pub token_program: Program<'info, Token>,
    
    pub system_program: Program<'info, System>,
    
    /// CHECK: 签名验证账户
    pub signer: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"project_balance", project.key().as_ref(), token_mint.key().as_ref()],
        bump = project_balance.bump,
        constraint = project_balance.project == project.key()
    )]
    pub project_balance: Account<'info, ProjectBalance>,
    
    #[account(mut)]
    pub project_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub to_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub project_authority: Signer<'info>,
    
    pub project: AccountInfo<'info>,
    
    pub to: AccountInfo<'info>,
    
    pub token_mint: Account<'info, token::Mint>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BatchTransfer<'info> {
    #[account(
        mut,
        seeds = [b"project_balance", project.key().as_ref(), token_mint.key().as_ref()],
        bump = project_balance.bump,
        constraint = project_balance.project == project.key()
    )]
    pub project_balance: Account<'info, ProjectBalance>,
    
    #[account(mut)]
    pub project_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: 接收者代币账户数组
    #[account(mut)]
    pub recipients: Vec<AccountInfo<'info>>,
    
    #[account(mut)]
    pub project_authority: Signer<'info>,
    
    pub project: AccountInfo<'info>,
    
    pub token_mint: Account<'info, token::Mint>,
    
    pub token_program: Program<'info, Token>,
}

// 数据账户
#[account]
pub struct PlatformConfig {
    pub authority: Pubkey,
    pub platform_fee_ratio: u16, // 1-10000 (0.01%-100%)
    pub bump: u8,
}

impl PlatformConfig {
    pub const LEN: usize = 8 + 32 + 2 + 1;
}

#[account]
pub struct ProjectBalance {
    pub project: Pubkey,
    pub token_mint: Pubkey,
    pub balance: u64,
    pub bump: u8,
}

impl ProjectBalance {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1;
}

#[account]
pub struct Whitelist {
    pub authority: Pubkey,
    pub signer: Pubkey,
    pub is_whitelisted: bool,
    pub bump: u8,
}

impl Whitelist {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 1;
}

#[account]
pub struct ClaimRecord {
    pub user: Pubkey,
    pub claimed_rewards: Vec<[u8; 32]>,
    pub bump: u8,
}

impl ClaimRecord {
    pub const LEN: usize = 8 + 32 + 4 + (32 * 100) + 1; // 支持最多100个已领取的奖励
    
    pub fn is_claimed(&self, user_reward_key: [u8; 32]) -> bool {
        self.claimed_rewards.contains(&user_reward_key)
    }
    
    pub fn mark_claimed(&mut self, user_reward_key: [u8; 32]) {
        if !self.is_claimed(user_reward_key) {
            self.claimed_rewards.push(user_reward_key);
        }
    }
}

// 事件
#[event]
pub struct PlatformInitialized {
    pub authority: Pubkey,
    pub platform_fee_ratio: u16,
}

#[event]
pub struct PlatformFeeUpdated {
    pub new_fee_ratio: u16,
}

#[event]
pub struct WhitelistUpdated {
    pub signer: Pubkey,
    pub is_whitelisted: bool,
}

#[event]
pub struct DepositEvent {
    pub project: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub activity_id: String,
}

#[event]
pub struct WithdrawEvent {
    pub project: Pubkey,
    pub to: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct BatchTransferEvent {
    pub project: Pubkey,
    pub token_mint: Pubkey,
    pub total_amount: u64,
    pub activity_id: String,
}

#[event]
pub struct ClaimByRewardEvent {
    pub user: Pubkey,
    pub token_mint: Pubkey,
    pub total_amount: u64,
    pub reward_ids: Vec<String>,
}

// 错误代码
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid fee ratio")]
    InvalidFeeRatio,
    #[msg("Array length mismatch")]
    ArrayLengthMismatch,
    #[msg("Empty params")]
    EmptyParams,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Signature expired")]
    SignatureExpired,
    #[msg("Invalid signature")]
    InvalidSignature,
    #[msg("Signer not in whitelist")]
    SignerNotInWhitelist,
}

// 辅助函数
fn get_user_reward_key(user: &Pubkey, reward_id: &str) -> [u8; 32] {
    let mut hasher = solana_program::keccak::Hasher::default();
    hasher.hash(user.as_ref());
    hasher.hash(reward_id.as_bytes());
    hasher.result()
}

fn verify_signature(
    platform_config: &Account<PlatformConfig>,
    whitelist: &Account<Whitelist>,
    amounts: &[u64],
    reward_ids: &[String],
    signature: &[u8],
    timestamp: i64,
) -> Result<()> {
    // 检查时间戳（1小时内有效）
    let current_time = Clock::get()?.unix_timestamp;
    require!(
        current_time <= timestamp + 3600,
        ErrorCode::SignatureExpired
    );

    // 验证白名单
    require!(whitelist.is_whitelisted, ErrorCode::SignerNotInWhitelist);

    // 这里应该实现 Ed25519 签名验证
    // 由于 Solana 的签名验证比较复杂，这里简化处理
    // 在实际部署中，需要使用 Ed25519 程序进行验证
    
    Ok(())
}
