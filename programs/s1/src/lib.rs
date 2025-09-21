// 引入Anchor功能
use anchor_lang::prelude::*;

// 本合约地址
declare_id!("CvpHN1JUdyJ9RPMvtUBHZPthsCUnDfVTcj7Gy16J7tcY");

// 程序宏
#[program]
// 模块
pub mod counter {
    // 将当前模块的父模块中，所有公共项（pub）引入当前作用域
    use super::*;

    // 创建新计数器
    pub fn create_counter(ctx: Context<CreateCounter>) -> Result<()> {
        msg!("Creating a Counter!!");

        // 获取参数包含的 counter 账户
        let counter = &mut ctx.accounts.counter;
        
        // 获取参数包含的  authority 账户的私钥
        counter.authority = ctx.accounts.authority.key();

        // 将 counter 的 数字 设置为 0
        counter.count = 0;
        
        msg!("Current count is {}", counter.count);
        msg!("The Admin PubKey is: {} ", counter.authority);

        // 结束
        Ok(())
    }

    // 将计数器 +1
    pub fn update_counter(ctx: Context<UpdateCounter>) -> Result<()> {
        msg!("Adding 1 to the counter!!");

        // 获取 counter 
        let counter = &mut ctx.accounts.counter;

        // 将其 数字 + 1
        counter.count += 1 ;

        msg!("Current count is {}", counter.count);
        msg!("{} remaining to reach 1000 ", 1000 - counter.count);

        // 结束
        Ok(())
    }
}

// 账户宏，处理多个账户的验证、访问逻辑
#[derive(Accounts)]
// CreateCounter 账户结构体，创建计数器时传入
pub struct CreateCounter<'info> {

    // #[account(mut)]表示账户可变
    #[account(mut)]
    // 签名者
    pub authority: Signer<'info>,

    // 账户宏，此处用于定义PDA账户, 修饰 counter
    // init:将会被创建
    // seeds:生成PDA账户的种子,此处为签名者的地址
    // bump:需要找到有效的PDA
    // payer = authority :指定由谁来支付费用
    // space = 100 :指定账户分配存储的字节空间
    #[account(
        init,
        seeds = [authority.key().as_ref()],
        bump,
        payer = authority,
        space = 100
    )]
    pub counter: Account<'info, Counter>,

    // solana系统程序,调用系统功能(创建账户、分配租金等)
    pub system_program: Program<'info, System>,
}

// 账户宏，处理多个账户的验证、访问逻辑
#[derive(Accounts)]
// UpdateCounter 账户结构体，将计数器+1时使用
pub struct UpdateCounter<'info> {
    // 签名者
    pub authority: Signer<'info>,

    // 可变，且保证签名者authority与对应计数器账户的地址 保持一致
    #[account(mut, has_one = authority)]
    pub counter: Account<'info, Counter>,
}

// 账户宏，定义单个账户的结构体
#[account]
pub struct Counter {
    // 地址
    pub authority: Pubkey,
    // 计数器数字
    pub count: u64,
}
