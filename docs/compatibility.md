# SixHat Compass Preview.3 兼容性

锁定 DSH CLI/Web 0.2.0-rc.2、Node.js ≥24；本地真实宿主验证使用Windows和deepseek-official/deepseek-flash。使用公开inputTriggers、conversation、commands、settings、sessions、agents和llm服务。

当前品牌与包名已更改；旧structured/review/single/hat-chat语义、信封4、配置ID、内部命令、API路径与storages/hexamind目录保持兼容。更名不会改写旧评审。请移除旧包再安装新包，避免重复加载。

宿主提供Cordis、React、Markdown、设置和命令运行时；插件不捆绑第二份React或独立模型客户端。依赖及package-lock锁定，现有Cordis peer警告保留，不通过修改版本豁免宣称兼容。

本轮真实验证范围和机器记录见 docs/reports/compass-preview-report.md。历史数据迁移、六帽和恢复的自动回归持续保留；历史验证不能冒充新版重新实测。GitHub跨平台CI与DSH宿主实测是不同检查。

正式真人产品价值验证、原生Desktop、其他系统/供应商、全部中文输入法和真实附件交叉验证尚未完成。
