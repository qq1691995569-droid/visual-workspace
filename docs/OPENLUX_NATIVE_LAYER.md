# OpenLux 原生图层拆分接入

画布的“多图层”可在本机 `/admin` →「API 管理」中单独切换 OpenLux / DREO。后台按功能列出兼容接口；后续功能登记适配器后会出现在同一页，无需再做后台栏目。未手动选择时，有 OpenLux 配置则默认走 OpenLux，否则默认走 DREO。后台只允许选择已配置凭据且兼容该功能的接口；DREO 凭据存在不代表服务端已支持原生拆层参数，提交时仍检查能力。选择保存在本机忽略版本控制的 `.canvas-data/api-routing.json` 中；旧 `.canvas-data/separation-provider.json` 会被读取以保留原选择。切换仅影响此服务器之后新建的任务；已有任务继续使用提交时的接口。其他生图任务不受影响。OpenLux 配置文件格式：

```json
{"origin":"https://api.openlux.ai/v1","token":"<个人 API Key>"}
```

也可用 `CANVAS_OPENLUX_CONFIG` 指向本机配置文件。不要把真实密钥、结果签名 URL 或画布数据提交到仓库。

OpenLux 使用 `POST /v1/images/generations`，传一张 PNG/JPEG 原图、`doubao-seedream-5-0-pro-260628`、`layer_decomposition: true`、`size: "auto"`、`output_format: "png"`。原图若为 WebP，由本机转换为 PNG 上传副本，画布原像素保留。返回 `data` 中的底图和对象图层按 `z_index` 与 `bounding_box.normalized` 导入；每张结果先下载到本机任务记录，再验证对象层真实 Alpha，并映射回原图画幅。签名 URL 不显示在任务提示中。

提交可能已经发生而响应未确认时，任务暂停，不能自动重提；明确 4xx 拒绝显示安全摘录。成功响应在本地保存后，下载中断可继续使用同一结果 URL，不再生成。输出图层的分组和视觉质量仍需使用者复核。

已做一次真实 1K 定向接口测试，返回底图加一张对象 PNG，并带层级和坐标。该探测没有通过画布导入，也未检查返回文件的实际 Alpha。下一次用户在画布发起拆层时，需核对下载、透明度、原图位置、对象数量与费用；不得把模拟测试视为真实视觉验收。

参考：[OpenLux 接入说明](https://doc.openlux.ai/)、[火山方舟原生图层拆分](https://docs.volcengine.com/docs/ark/seedream-5-0-pro?lang=zh)。
