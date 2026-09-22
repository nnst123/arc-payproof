# MetaMask 测试网部署页实施计划

日期：2026-09-20

依据：[已确认的设计规格](../specs/2026-09-20-arc-payproof-browser-deploy-design.md)

## 完成定义

在 `D:\ArcPayProof\web` 启动 Vite 后，用户可通过本地 `/deploy.html` 连接 MetaMask，在 Arc Testnet 签署部署交易；页面验证部署结果并可从已发送交易恢复。公开生产构建不得包含部署页或字节码。真实测试网部署由钱包持有人亲自确认。

## 1. 构建产物同步

扩展 `scripts/sync-abi.mjs`，从同一 Arc Foundry artifact 生成独立的 `web/src/contract/deployment.ts`，包含部署字节码。验证字节码非空且以 `0x` 开头；ABI 生成仍保持不变。构建后重新生成并检查差异。

## 2. 独立本地入口

新增 `web/deploy.html`、`web/src/deploy-main.tsx` 与部署组件。入口只服务开发服务器；Vite 生产构建仍以 `index.html` 为唯一入口。测试 `web/dist` 没有 `deploy.html`，且不包含部署字节码。

## 3. 钱包与部署状态

使用浏览器注入的 EIP-1193 提供者连接 MetaMask，读取账户和链 ID，并提供 Arc Testnet 切换/添加操作。用 Arc Testnet RPC 读取余额、估算创建交易 Gas 与最大费用。仅在网络匹配且余额足够时开放部署按钮；点击后再校验链 ID 与账户，发送 `value=0` 的合约创建交易。钱包拒签、链错误、RPC 错误均给出可恢复提示，不自动广播。

## 4. 收据核验与恢复

按钱包地址在浏览器本地保存公开交易哈希，刷新后先查询收据，不重复发交易。成功时检查收据状态、合约地址、代码非空和 `nextInvoiceId()==1`，展示浏览器链接与可复制地址。失败或查询超时保留哈希并提示核对链上结果。

## 5. 文档与验证

更新 README 和 `DEPLOYMENT.md`，将本地 MetaMask 流程列为新手首选，命令行脚本列为备用。运行 Arc Foundry 合约测试、网页测试和 TypeScript/生产构建；检查敏感文件排除、生产包排除部署内容。最后提交并推送到公开仓库。测试网真实部署需要用户在 MetaMask 中操作，不能由自动化代签。
