# 六帽规划：安装与升级

包名 `dsh-sixhat-compass`，版本 `0.1.0-preview.5`。精确支持 DSH `0.2.0-rc.2` 或 `0.2.1-rc.2`，Node.js ≥24。密钥只在宿主配置，不放入 GitHub 或问题反馈。

## Desktop 0.2.1-rc.2 / rc.3 安装

下载 Preview.5 的 `.tgz`，核对 SHA256 后，在“插件 → 添加插件”中填入安装包完整路径。Preview.3 要求旧宿主，Preview.4 未声明支持 rc.3；rc.3 用户请安装 Preview.5，不要跳过版本检查。若已安装同名旧包，先备份并停止任务，再按宿主提示卸载旧包后安装新版。不要删除 `storages/hexamind` 或会话目录。

若出现 `database disk image is malformed`，这是 pnpm 安装缓存错误，与插件兼容声明不同；保留完整错误，勿通过版本豁免或删除会话解决。另一个插件的版本错误也需分别处理。

## CLI/Web 首次安装

在将要启动的同一 DSH_HOME / web profile 操作。首次试用可以先指定隔离目录：

```powershell
$env:DSH_HOME=Join-Path (Get-Location) '.runtime/sixhat-compass-user'
dsh plugin --profile web add 'C:\下载目录\dsh-sixhat-compass-0.1.0-preview.5.tgz'
dsh web --no-open --host 127.0.0.1 --port 3088
```

打开终端给出的登录链接，不要分享 token。配置宿主全局默认模型后，在原生聊天中发送 `@黑帽 你的计划`。帽子名与问题间加空格；选候选只补全。

设置：左下角齿轮 → 六帽规划。记录：侧栏 → 六帽规划。

## 从 HexaMind 或 Liumao Planner 升级

1. 在旧设置页备份全部记录；停止任务并关闭目标宿主。
2. 在 DSH_HOME 外另存 `storages/hexamind`、`sessions`、`storages/workspace.json` 及 `profiles/web/cordis.patch.yml`。保留旧包。
3. 在同一 DSH_HOME 执行：

```powershell
# 只执行与你实际已安装的旧包对应的remove命令：
dsh plugin --profile web remove dsh-hexamind
# 或：dsh plugin --profile web remove dsh-liumao-planner
dsh plugin --profile web add 'C:\下载目录\dsh-sixhat-compass-0.1.0-preview.5.tgz'
```

4. 检查 `profiles/web/cordis.patch.yml`。旧 `id: hexamind` 保留，若该条目明确写了 `name: dsh-hexamind` 或 `name: dsh-liumao-planner`，仅把这一行改为 `name: dsh-sixhat-compass`，保留其 config 和其他条目。不要同时安装两个包，它们共享兼容性标识和单写者存储。
5. 重启 DSH，核对设置、旧记录、旧会话，再发送一次新的帽子问题。

存储目录、配置 ID、内部命令及 `/api/hexamind` 保持兼容，不因更名搬动数据。preview.2 的信封4不改版本；preview.1等信封1/2/3迁移前原样保存不可覆盖的 `.vN-backup`。

## 停止、失败与恢复

请求受理后输入框清空，可写下一条草稿；生成任务仍在当前聊天展示进度和停止按钮。受理前的禁用、忙碌、保存失败保留原草稿。受理后失败或停止保留问题和已收回复，在记录页手动恢复，不自动再发。响应丢失时用相同操作标识重试不会新增调用。

独立讨论请单独发送 `@新讨论`；返回旧讨论可用记录页“在原生聊天中继续”。普通 Agent 不自动把帽子命令当成自己的对话历史，连续 `@帽子` 会显式读取此前帽子建议。

## 卸载与回退

备份并关闭目标宿主后：

```powershell
dsh plugin --profile web remove dsh-sixhat-compass
```

卸载不删除专属记录和标准命令日志。混合会话的通用命令结果仍可读；纯命令聊天视图可能被宿主隐藏，重装恢复。记录页后续恢复的最新文本以插件库为准，旧 command/done 不回写。

回退必须在关闭宿主后的独立 DSH_HOME 中，用旧包和相应升级前备份；preview.1拒绝信封4，不要让旧程序覆盖新库。不要删除活进程锁，也不要用空数据覆盖保存失败的库。
