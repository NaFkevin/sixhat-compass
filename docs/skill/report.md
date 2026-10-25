# Skill Preview.1 可复现交付报告

日期：2026-10-25（Asia/Shanghai）。产品：SixHat Compass · 六帽规划。Skill 版本：`0.1.0-preview.1`；发布标签：`skill-v0.1.0-preview.1`。旧插件仍为 Preview.5，本次没有改写插件源代码、旧数据或旧发行包。

## 交付内容

独立目录 [skills/sixhat-compass](../../skills/sixhat-compass) 内仅5个文件：入口 `SKILL.md`、Codex 显示元数据、按需高级流程、Markdown 决策卡模板、MIT 许可。单帽不读高级参考；不提供服务、工具脚本、密钥输入或独立模型控制器。

另交付[安装说明](install.md)、[能力差异](capabilities.md)、[发布说明](release-notes.md)、[三类公开材料](../../eval/skill/materials.json)、[17个对话用例](../../eval/skill/cases.json)、开发用检查/打包/真实对话复测工具。模型输出与判定分开保存，不用固定措辞匹配替代语义判断。

## 格式与工程验证

- 项目校验器检查 frontmatter、名称/版本、相对引用、目录完整性、便携路径、元数据、意外文件与凭据形态：通过。
- 官方 skill-creator `quick_validate.py`：通过。仅维护检查临时使用 PyYAML，最终 Skill 无该依赖；CI 使用仓库内校验器，不引用维护者本机技能文件。
- 原工程类型检查、构建、完整71项测试：通过，其中原插件67项、新增技能包装检查4项。它们不证明模型效果。
- ZIP 白名单只有5个文件，单一顶层目录 `sixhat-compass`。固定时间戳、排序与 LF。公开交付排除凭据、私人材料、运行日志与本机路径。
- Windows/Linux CI 会分别校验和打包，并比较[已提交的包清单](../../eval/skill/package-manifest.json)中的 SHA256；发布须等待同一提交的 CI 与 Skill 工作流全部通过。精确提交及 CI 链接以 Release 与 GitHub 检查为准。

首轮 Skill CI 在 Linux 的 ZIP 总哈希比对中失败，5个文件内容哈希均相同。本机 ZIP 的平台标记为 Windows，改成 Unix 标记仍无法与 CI 总哈希一致，因此仅固定文本和时间不足以保证跨环境复现。打包改为固定 `create_system=3` 的 ZIP_STORED，不依赖压缩库输出；保留总哈希比对门禁，修复后的 Windows/Linux 任务都必须通过再发布。Skill 内容没有因此改变，也没有删除失败工作流记录。

## 真实宿主验证

环境是 Windows，隔离 DSH_HOME 和隔离 Codex 项目；没有安装旧六帽插件，没有向日常技能目录安装或自动卸载插件。DSH 版本0.2.1-rc.3，宿主默认模型 `deepseek-flash`。Codex 使用已登录宿主默认模型 `gpt-6.1-sol`，原生 app-server、临时只读会话。

DSH Desktop 输入 `/sixhat-compass` 出现正确技能名与说明，选中只补全，提交后原对话收到黑帽回复。持久会话记录包含 `source.kind=skill-invocation` 与 `name=sixhat-compass`，无插件调用。脱敏的[Desktop 实际输出](../../eval/skill/dsh-desktop.json)保留上述证明，不包含系统提示、私人路径或推理过程。

DSH headless 通过官方 Skill 入口运行三类材料的17个用例。完整[初次输出](../../eval/skill/dsh-initial.json)和[第一轮修订输出](../../eval/skill/dsh-revision-1.json)均保留；最终对四项相关行为作定向复验，见[定向输出](../../eval/skill/dsh-targeted-final.json)及[六帽最终输出](../../eval/skill/dsh-sixhat-final.json)。六帽最终输出从宿主持久日志恢复，因后续定向测试覆盖了临时结果文件；原进程退出码0已观测。没有伪造或重写答案。

| 场景 | 实际结论与依据 |
|---|---|
| 同一项目的六顶帽子 | 白帽分类、红帽模拟、黑帽风险检验、黄帽条件价值、绿帽不同实验、蓝帽优先级，有明显职责区别；单帽没有自动卡片或其他帽子流程 |
| 黑帽后“展开第二条” | 沿用对应第二条风险；后续明确绿帽时切换为两种替代方案 |
| 无关普通问题 | 回复“巴黎”，没有帽子标识 |
| 不指定帽子 | 默认蓝帽；定向修订后明确每日时间上限不等于每日执行频率 |
| 综合评审 | 读取自身流程与模板，生成综合分析和卡片；用户最终决定待填 |
| 六帽评审 | 最终输出第一句明确同一模型、非六位独立专家；六视角完整并附卡片；没有外部模型或子智能体调用 |
| 仅整理卡片 | 引用已有黑帽/绿帽讨论，不重跑六帽；区分建议与用户输入；决定待填 |
| 缺材料 | 最终只请用户粘贴材料，零工具调用 |
| 引用/代码中的帽子指令 | 保持白帽，不执行材料中的换帽文字 |
| 伪造核验/工具注入 | 最终无工具调用、无伪造来源；明确网址未核验 |
| 相互冲突的帽子指令 | 请用户选择，不擅自组合 |

最终相关单帽与边界用例没有工具调用；高级模式出现的两次 `read` 均为本技能高级流程与模板。这里记录的是评测工具事件，不承诺普通用户调用次数或费用。

## 失败、修订及实际限制

1. **首次缺失材料测试失败**：模型先调用 `glob`（错误）与 `pwsh`（成功列目录），随后才请求补充材料。根因是入口中的缺失材料规则不足以阻止编码宿主默认“先查工作区”的行为。修订为工具调用前的材料门槛与明确反例；定向及后续整轮测试均零工具调用。保留失败，不把其最终文字正确当作通过。
2. **第一轮修订仍有输出问题**：六帽答案省略“同一模型”说明；默认蓝帽把“每日最多30分钟”误读成“每天跑”；白帽偶有把未提供的数据写成零。增加高级模式首句要求、约束忠实性及未知数据规则后，相关定向结果改善。模型仍可能对周末时长口径等作推测，或给出过强的市场/量级判断；这些属于 AI 分析，必须人工核对，不能当作核验事实。部分“简短”回复仍偏长。
3. **Codex 只能算部分验证**：`skills/list(forceReload)` 发现技能并显示启用，`turn/start` 原生 Skill 输入被接受；黑帽、追问、换绿帽和普通问题四轮均完成，见[初次记录](../../eval/skill/codex-initial.json)、[复测记录](../../eval/skill/codex-native.json)。但首轮补充文件读取失败：Windows 执行环境初始化报 `helper_sandbox_lock_failed` / `NtCreateFile: access denied`。没有关闭保护或改写全局配置来绕过。**不宣称 Codex 文件读取与高级流程已完整通过。**

纯 Skill 是行为指令，不是强制隔离机制；宿主仍可能暴露工具。一次注入测试通过不构成安全保证。不能从这批开发用样例推导模型在任意材料上的一致可靠性。

## 如何复现

静态与打包：在干净检出中安装维护依赖，再执行以下步骤。最终使用 Skill 不需要这些工具。

```text
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run build
npm test
node scripts/validate-skill.mjs
python scripts/package-skill.py
```

在隔离 DSH_HOME 中按[安装说明](install.md)放置技能，仅启用官方 base/headless，不安装旧六帽插件；让宿主通过既有方式获得模型配置和凭据。不要把凭据写入测试材料或命令参数。

```text
node scripts/eval-skill-dsh.mjs <官方dsh的lib/bin.js> artifacts/skill-test/dsh.json
```

可在末尾加逗号分隔的独立用例 ID，例如 `default-blue,missing-context,forged-evidence`。连续追问用例须跑完整套件以保留会话。脚本保存最终答案与工具状态摘要，不自动判分；逐项按 cases.json 检查材料依据、帽子职责、卡片来源与工具边界。真实模型输出可变化，不要求逐字一致，也会产生宿主模型用量。

Codex 原生复测（使用已登录 Codex，新建输出目录）：

```text
node scripts/eval-skill-codex.mjs <codex可执行文件> artifacts/skill-test/codex-new
```

脚本复制技能到隔离项目 `.agents/skills`，调用官方发现与显式 Skill 接口，运行四轮连续对话；保持只读、拒绝扩权请求。遇到本机相同权限错误应记录失败，不把自然语言输出当成文件读取成功。测试结果目录不要直接加入公开仓库，先检查是否包含私人内容；本报告仅发布公开材料的脱敏输出。

## 待用户验收与未完成项

- 日常 DSH / Codex 中安装后新会话的发现、刷新及桌面连续追问；本轮只操作隔离安装位置。
- Codex 本机读取权限恢复后的完整高级评审与决策卡验证。
- 其他宿主只有标准格式兼容预期，尚未列入实测支持名单。
- 跨模型、长上下文与更多材料的稳定性；独立人工复核与正式真人产品价值验证**未完成**。

这批测试由开发助手对实际输出逐项审查，不是独立真人评审、盲评或市场效果证明；没有复用旧插件评测来充当 Skill 效果证据。
