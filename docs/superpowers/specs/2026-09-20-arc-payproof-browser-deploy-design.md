# Arc PayProof：MetaMask 测试网部署页设计

日期：2026-09-20

状态：方案已获参赛者确认；本文件待书面复核。

## 目标与边界

让首次参赛者从已安装的 MetaMask，直接在 Arc Testnet 部署现有 `ArcPayProof` 合约，不导出或输入私钥。部署动作必须由用户点击按钮并在钱包中确认。页面不负责创建钱包、领取测试币、创建发票、支付发票或执行主网交易。

部署页只在本机 Vite 开发服务器提供，地址为 `http://127.0.0.1:5173/deploy.html`。GitHub Pages 的生产构建仅包含公开应用，不包含部署入口或部署字节码。现有 Arc Foundry 命令行脚本保留为开发者备用路径，但面向新手的文档优先推荐 MetaMask 页面。

## 方案选择

1. **推荐：本地 MetaMask 部署页。** 直接使用 Arc Foundry 编译产物，钱包在浏览器内签署，用户无须导出私钥；代价是增加一个小型本地页面和验证代码。
2. Arc Foundry `--interactive`。现有脚本最快，但需要参赛者从钱包导出私钥并输入终端，不适合当前新手流程。
3. 第三方在线 IDE。也能连接 MetaMask，但编译配置、字节码来源与 Arc 兼容性更难复核，且增加外部依赖。

## 组成与数据流

- `scripts/sync-abi.mjs` 从同一个 Arc Foundry artifact 继续生成公开应用使用的 ABI，并额外生成仅供本地部署页引用的字节码模块。两者由同一次编译产生，避免部署和网页 ABI 不一致。
- `web/deploy.html` 与独立 React 入口承载部署 UI；不修改公开发票应用的主流程。页面固定目标为 Arc Testnet，链 ID `5042002`，RPC `https://rpc.testnet.arc.io`。
- 页面显示目标网络、当前钱包地址和从 RPC 读取的原生测试 USDC 余额（即使 MetaMask 将其显示为 ETH，页面仍按 USDC 标注）。连接或切换网络需要用户在 MetaMask 中确认；网络不是 Arc Testnet、钱包未连接或余额不足以覆盖估算手续费时禁用部署。
- 页面在开放部署按钮前，对同一份字节码请求 Arc Testnet RPC 估算创建交易 Gas 与费用；估算失败时不允许盲目发送，钱包弹窗中的最终费用仍以 MetaMask 显示为准。
- 用户点击“Deploy to Arc Testnet”后，页面再次读取钱包链 ID，再通过 MetaMask 发送合约创建交易，`value` 固定为零。页面绝不读取、输入、存储或上传助记词与私钥。
- 交易返回哈希后，页面把公开交易哈希按钱包地址保存在浏览器 `localStorage`，用于刷新恢复，并等待收据。成功后核对收据状态、合约地址、该地址的非空代码，以及 `nextInvoiceId() == 1`。展示合约地址、部署交易和 Arc Testnet Explorer 链接，供后续写入 `web/.env.local` 和部署记录。

## 错误与安全处理

- 用户拒签：明确提示已取消；不自动重试。
- 钱包链 ID 错误、余额不足、RPC/估算失败：阻止或停止部署，提示检查网络和测试 USDC。
- 交易已发出但页面超时：保留哈希，让用户刷新后继续查询；绝不自动再次广播，以免重复部署。
- 收据失败、无合约地址、无字节码或读取函数不符：不标记成功，展示交易哈希供排查。
- 主网部署按钮和主网 RPC 不在此页面出现。任何真实资金部署仍需单独人工确认。

## 验证与完成标准

1. 合约测试、网页 TypeScript 检查和生产构建继续通过。
2. 本地页面能连接 MetaMask、识别错误网络与余额，并在钱包拒签后安全恢复。
3. 通过 Arc Testnet Faucet 资助的用户钱包完成一次部署；RPC 与 Explorer 均显示合约代码，`nextInvoiceId()` 返回 1，刷新页面仍可恢复部署交易。
4. `web/dist` 不含 `deploy.html` 和部署字节码；公开应用的发票功能不变。
5. README 与 `DEPLOYMENT.md` 改为推荐本地 MetaMask 部署页，并继续明确不分享任何钱包秘密。

## 依据

- 原项目规格：`2026-09-20-arc-payproof-design.md`
- Arc 测试网配置：https://docs.arc.io/arc/references/connect-to-arc
- Arc Foundry 编译与部署：https://docs.arc.io/arc/tutorials/deploy-on-arc
