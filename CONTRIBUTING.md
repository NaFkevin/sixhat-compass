# 贡献指南

使用 Node.js 24。先运行 `npm ci --ignore-scripts --no-audit --no-fund`，然后 `npm run typecheck`、`npm run build`、`npm test`。

客户端是复用 DSH React 的小型 CommonJS 模块，由 `scripts/build-client.mjs` 组合。不要引入第二份 React、全局按键监听或宿主 DOM 补丁。公开接口以锁定宿主源码为准，不猜接口。

修复应附带能复现原症状的回归检查。涉及帽子调用时验证普通 Agent 没有被启动、tools为空、实际调用次数可追踪；涉及存储时保留旧记录及备份。测试只使用公开或合成材料。

提交问题请说明系统、Node、DSH、插件版本、最小步骤、预期与实际行为。截图先去除私人计划、路径、登录 token 和密钥，不要上传完整 DSH_HOME、会话库、凭据或运行日志。

修改默认行为、数据结构或调用预算前先说明动机和兼容策略。模型建议不是事实核验结果，不把合成测试或维护者试用写成真人效果验证。
