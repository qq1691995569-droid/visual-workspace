# Liblib 独立放大

本地服务读取 `.canvas-data/liblib.json`；此文件被 Git 忽略。空白示例为仓库根目录 `liblib.example.json`。实际凭据和 API 模板只填写在本机文件中，不提交仓库。

仓库中的示例默认禁用，不包含本机已配置的凭据和工作流参数。其他电脑更新代码后，仍需单独配置。网页地址中的 versionUuid、comfyOrid 和 workflowData 编号不能代替 API 示例。

启用前需取得对应版本的 templateUuid、workflowUuid、LoadImage 节点 ID 和 generateParams 模板，填写对应字段；可编辑参数须与模板节点一致。凭据可通过 credentialsFile 引用本机私有 JSON 文件，或填写到本地配置中。真实试运行前需确认工作流与预算，再设 enabled=true；自动化测试仅使用模拟数据。

存在本地 Liblib 配置时，图像放大目录仅使用该配置，不查询 DREO 放大目录。原有 DREO 生图和变清晰保持原链路。Liblib 使用自身账号额度。

记录保存于 `.canvas-data/<本地任务ID>.json`，包含工作流快照、参数、generateUuid 和已下载图片。恢复查询只查询原任务，不重新提交；画板查询任务时会继续获取状态。结果逐张校验并保存，不长期依赖临时链接。提交超时但没有 generateUuid 时需在 Liblib 人工核对，程序不会自动重提。

目前上传仅接受 HTTPS 阿里云 OSS 地址；结果允许阿里云 OSS、Liblib 域名。若实际 API 返回其他域名，需核验官方来源后补充允许范围。直连任务与结果由画布本地服务保存，不写入 DREO 历史；同一 Liblib 账号仍共享额度。
