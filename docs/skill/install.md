# Skill 安装与调用

本页适用于纯 Skill `0.1.0-preview.1`。它是指令和参考文档，不需要插件后端、API Key 输入框或运行时构建。

## 下载

在 [Skill Preview.1 Release](https://github.com/NaFkevin/sixhat-compass/releases/tag/skill-v0.1.0-preview.1) 下载 `sixhat-compass-skill-0.1.0-preview.1.zip` 与 `SHA256SUMS.txt`。校验 ZIP 的 SHA256 后解压，得到一个完整的 `sixhat-compass` 目录，里面直接有 `SKILL.md`、`LICENSE`、`agents`、`references`、`assets`。

Windows 可用 `Get-FileHash -Algorithm SHA256 <ZIP路径>`，Linux 可用 `sha256sum -c SHA256SUMS.txt`。这些是可选的下载校验操作，Skill 本身不执行它们。

不要把 ZIP 当作 DSH 插件安装，也不要在“添加插件”框中填 Skill 的目录链接。若已有同名目录，先在技能扫描目录之外备份，再替换；不要把备份继续放在可扫描的技能目录内。

## DSH

首轮验证版本：DSH 0.2.1-rc.3，Windows，官方 Desktop 与 headless，未安装旧六帽插件。详细通过范围与限制见[测试报告](report.md)。

1. 把完整的 `sixhat-compass` 目录复制到当前 DSH_HOME 的 `skills` 目录。未设置 DSH_HOME 时为用户主目录下 `.dsh/skills/sixhat-compass`。使用自定义或隔离 DSH_HOME 的用户，以实际启动环境为准。
2. 新建会话，输入 `/sixhat-compass`，从宿主技能候选中选择，再补充帽子与问题；候选只补全，发送才分析。
3. 若候选没有更新，重启 DSH 后新建会话。日常配置中的刷新与新会话发现还需用户验收，本轮没有改写你的日常技能目录。

```text
/sixhat-compass 黑帽：指出上面计划最需要验证的两个风险。
展开第二条，怎么检验？
换成绿帽，给两个成本更低的方案。
/sixhat-compass 白帽：区分已知信息、假设和缺口。
```

`@黑帽` 是技能加载后的文本别名，不会注册插件版的六帽候选；DSH 还可能把 `@` 视为文件引用，因此首选 `/sixhat-compass 黑帽：…`。不需要卸载旧插件，但避免同时用旧插件的 `@` 路由和 Skill 入口测试同一任务。

## Codex

1. 项目内使用：把完整目录复制到目标项目的 `.agents/skills/sixhat-compass`。也可按 Codex 官方说明放到用户主目录下 `.agents/skills`。
2. 在该项目新建会话，用技能选择器或 `$sixhat-compass` 显式调用。
3. 若发现列表未更新，重启应用并新建会话。也可以让 Codex 的 skill-installer 从 `NaFkevin/sixhat-compass` 仓库的 `skills/sixhat-compass` 路径安装，避免把整个仓库当成一个 Skill。

```text
$sixhat-compass 黑帽：指出上面计划最需要验证的风险。
展开第二条。
换成绿帽，给两个不同方案。
```

本轮 Codex app-server 已验证隔离项目发现、显式 Skill 输入、追问、换帽和普通新问题。补充文件读取遇到本机 Windows 执行环境权限错误，因此**不宣称 Codex 全流程已经验证**；高级评审、修复权限后的文件读取及桌面新会话刷新仍待验收。不要通过关闭安全保护来绕过此问题。

## 通用表达与高级模式

```text
使用六帽规划，黑帽：评审这份计划的风险。
使用六帽规划，评审：分析这份计划并附简洁决策卡。
使用六帽规划，六帽评审：按六种视角分析这份计划。
使用六帽规划，生成决策卡：只整理已有讨论。
```

没指定帽子时默认蓝帽。单帽不会自动生成卡片。六帽评审是同一模型的多视角分析；不保证调用次数、费用或固定历史窗口。普通新问题恢复常规回答。缺少引用材料时应补充材料。默认不联网、不执行命令、不写文件；外部操作须另有明确授权，并受宿主限制。

其他支持 SKILL.md 的宿主仅有格式兼容预期，尚未加入实测支持名单。宿主自身的模型、上下文容量、工具权限、历史保存与停止方式仍由宿主决定。

## 升级与移除

Skill 升级只替换该技能目录，旧插件源码、发行包、记录不变。移除该目录并刷新宿主即可移除 Skill，不删除聊天记录；既有会话可能仍保留已加载指令，需新建会话确认移除。没有跨会话偏好库或独立恢复机制。

格式与宿主依据：[OpenAI Skill 格式](https://developers.openai.com/plugins/build/skills)、[Codex skills](https://learn.chatgpt.com/docs/build-skills)、[DSH 官方仓库](https://github.com/deepseek-ai/deepseek-harness)。DSH 扫描路径与命令行为还核对了锁定版本的 `@deepseek-ai/dsh-skill-filesystem`、`@deepseek-ai/dsh-tool-skill` 实现。
