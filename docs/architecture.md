# Native Preview 架构

保留 Host Adapter、Hat Strategies、Review Controller、Conversation & Decision Card Store、UI 五层。native bridge 连接宿主公开命令和会话服务，没有第二套模型客户端或自主群聊调度器。

原生输入使用 inputTriggers.registerSource，选中候选进入 CommandClaim。锁定宿主仅对斜杠前缀执行最后提交仲裁，因此通过公开会话输入状态订阅和带版本校验的 slash/input-begin-command 事件处理整段粘贴；不监听全局键盘、不修改宿主 DOM。

native action 携带 sessionId、hat、text、operationId。服务端解析当前 profile 已存在 Agent，只读该 Session 普通文本与对应帽子记录，不接受浏览器提供的历史。最多20条、24000字符完整历史，加完整本次问题。operationId 与请求哈希阻止重复调用和不同内容复用。

ctx.commands 注册内部 hexamind 命令，由 commands.execute 产生标准 command/run、command/done；模型由 ReviewController 以 tools=[] 调用。nativeStart 在控制器保存检查点且 Session flush 后返回202 accepted，CommandClaim随即成功结算并由宿主清空草稿；真实命令继续后台运行，完成后再保存 command/done。旧 native API继续等待完整结果。受理前失败保留草稿；受理后失败在消息和记录页呈现。不同操作在受理窗口也互斥，同操作复用受理及完成promise。hat-chat 输出自然语言，不走 JSON 卡片验证，蓝帽也只回复一次。structured/review/single 历史语义不变。

客户端将内部命令映射为独立 Chat Node，替代通用命令展示。因此只有帽子消息的新会话也能激活原生聊天视图。卸载后宿主仍能读标准命令结果；不写未知持久化事件，不伪造 assistant/message、turn/start 或工具调用。

设置经官方 volatile Config + configForms 保存到 profile cordis.patch.yml，使用 settings.section。全部帽子启用、标准长度、详情折叠为默认。显示偏好不能清除存储错误保护；明确启用才重新启用控制器。记录页只浏览、恢复、编辑和导出。

信封4包含新增模式和 native 会话/命令/来源关联；升级前原样保存 .v3-backup。沿用 reviews-v1.json 文件名、单写者锁、校验和、原子提交、上一代备份和损坏隔离。旧程序拒绝4。

失败和中断的部分输出保留，显式恢复复用模式与预算；宿主命令结束记录保持原始结果，后来从记录页恢复的最新内容以插件记录为准。普通 Agent 不自动将这些 log-only 命令加入其模型历史，帽子之间通过 bridge 明确合并上下文。

Phase D 的冻结源和lib位于 eval/phase-d/product-snapshot，用于旧版本兼容性回归；完整合成评测原始结果留在开发工作区的历史交付物，不混入本轮公开目录。

