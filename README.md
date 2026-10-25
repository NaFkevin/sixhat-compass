# SixHat Compass · 六帽规划

用白、红、黑、黄、绿、蓝六种思考视角审视计划，在当前 AI 聊天里得到可行动的建议。

**纯 Skill：0.1.0-preview.1 · MIT**。使用宿主当前模型，不需要额外 API Key、服务、Node.js 或构建。旧 DSH 插件及历史发行版继续保留。

[下载 Skill ZIP 与校验文件](https://github.com/NaFkevin/sixhat-compass/releases/tag/skill-v0.1.0-preview.1) · [技能目录](skills/sixhat-compass) · [安装说明](docs/skill/install.md) · [实际测试报告](docs/skill/report.md)

## 怎么用

解压完整的 `sixhat-compass` 目录，放到宿主技能目录。**Skill ZIP 不走 DSH“添加插件”流程**。

- DSH：当前 DSH_HOME 的 `skills/sixhat-compass`，原生入口 `/sixhat-compass`。
- Codex：项目内 `.agents/skills/sixhat-compass`，原生入口 `$sixhat-compass`。

```text
/sixhat-compass 黑帽：指出上面计划最需要先验证的风险。
展开第二条，怎么验证？
换成绿帽，给两个成本更低的方案。
```

Codex 将第一行换为 `$sixhat-compass 黑帽：…`。也可明确说“使用六帽规划，白帽：区分信息、假设和缺口”。`@黑帽` 仅是技能加载后的文本别名，不注册六帽输入候选；首选宿主原生 Skill 入口。

| 视角 | 用途 |
|---|---|
| 白帽 | 用户信息、待验证假设与信息缺口 |
| 红帽 | 可能的直觉与情绪，明确为模拟分析 |
| 黑帽 | 风险、触发条件与验证行动 |
| 黄帽 | 价值、收益成立条件与验证方式 |
| 绿帽 | 不同的替代方案与小实验 |
| 蓝帽 | 目标、分歧、优先级与下一步 |

默认单帽，不自动生成卡片；未指定帽子时默认蓝帽。明确追问沿用上一顶帽子，明确换帽立即切换，无关的新问题恢复普通回答。用户可直接要求简短或详细。

主动要求“评审”可获得综合分析及简洁决策卡；“六帽评审”按六种视角组织并汇总卡片；“生成决策卡”只整理已有讨论。卡片区分信息来源与假设，用户最终决定留待填写，默认直接回复可复制的 Markdown。

## 验证与边界

Windows DSH 0.2.1-rc.3 的隔离 Desktop 已发现技能并接受显式调用，headless 执行三类公开材料的行为测试。Codex app-server 已验证隔离发现及基础连续对话；本机权限错误影响补充文件读取，高级流程与桌面新会话刷新仍待验收。完整输出、失败和待验收项见[报告](docs/skill/report.md)。其他宿主尚未实测。

六帽是同一模型的思考程序，不是六位独立专家。Skill 不控制精确调用次数、费用、固定历史截取或独立检查点。默认不联网、不执行命令、不读无关文件、不写文件；权限与会话管理仍由宿主负责。没有真实核验就标记尚未外部核验，缺材料时要求补充。

**正式真人产品价值验证未完成。** 格式检查和模型行为测试不证明六帽优于普通 AI。

## 旧 DSH 插件

需要原生 `@` 六帽候选、设置页、独立评审记录与恢复功能，可继续使用 [DSH 插件 Preview.5](https://github.com/NaFkevin/sixhat-compass/releases/tag/v0.1.0-preview.5)。插件与 Skill 是两种分发方式，安装方法和能力不同，见[差异表](docs/skill/capabilities.md)、[旧插件说明](docs/preview/plugin-readme.md)。本次不改写旧数据，不自动卸载插件。

## 维护与复现

以下工具仅用于维护检查，最终 Skill 用户无需安装：

```text
node scripts/validate-skill.mjs
node --test tests/skill-package.test.mjs
python scripts/package-skill.py
```

ZIP 使用固定时间、排序与 LF 文本。真实对话复测需要宿主及其已配置模型，见[报告与复测步骤](docs/skill/report.md)。插件仍可按原有 npm 流程构建测试。

[Skill 发布说明](docs/skill/release-notes.md) · [开源许可](LICENSE) · [贡献指南](CONTRIBUTING.md)
