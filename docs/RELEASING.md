# SixHat Compass Preview 发布流程

产品名 SixHat Compass · 六帽规划；仓库 sixhat-compass；包 dsh-sixhat-compass；版本0.1.0-preview.5。

## 构建与公开源码

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run build
npm test
npm pack --pack-destination artifacts
python scripts/prepare-github.py
```

公开目录只复制明确清单，不包含运行数据、node_modules、凭据、私人会话或旧交付包。PUBLIC_FILES.json校验输出文件；普通文本统一LF，冻结兼容性快照保留原字节。脚本拒绝覆盖已有发布目录。

## 账户与提交

使用官方GitHub CLI网页登录，提交署名采用实际账号昵称及GitHub提供的隐私邮箱，仅在本仓库配置。创建公开仓库前检查该账号下的目标名称；已有仓库不覆盖，不强制推送，不回写旧测试历史。

## 发布顺序

1. 在干净Git检出中验证类型检查、构建、测试及包内容，核对公开文件清单。
2. 正常推送main，等待同一提交的Windows/Linux CI通过。
3. 在通过CI的确切提交创建并推送v0.1.0-preview.5标签。
4. 先创建草稿Release，上传dsh-sixhat-compass-0.1.0-preview.5.tgz及SHA256SUMS.txt。
5. 下载草稿附件核对字节和SHA256，发布为Prerelease且不标记Latest，再验证匿名下载。

实际仓库、CI、提交、标签、Release和附件哈希记录在发布交付报告中。CI通过不等于其他平台DSH已经实测；不把未执行的验证写成通过。本流程不包含npm发布或DSH上架。


发布目标：https://github.com/NaFkevin/sixhat-compass 。提交使用账号NaFkevin和GitHub隐私邮箱，仅在发布仓库配置。
