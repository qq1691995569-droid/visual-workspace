# DREO 原生图层拆分代理接入

当前画布只使用个人 DREO Token 调用 `/api/agent/tasks`，不直接持有火山方舟密钥。普通 `conversation-image` 已接入；原生拆层请求收到 HTTP 422 且无任务号。旧响应正文未保存，具体拒绝字段未知。不要通过删掉拆层参数并成功生成普通图片来宣称问题已解决。

## DREO 入站请求

```json
{
  "tool_type": "conversation-image",
  "params": {
    "prompt": "需要拆分的对象描述",
    "image_paths": ["<已上传原图的 storage_key>"],
    "ratio": "auto",
    "resolution": "2K",
    "count": 1,
    "interactive": false,
    "route_override": {
      "provider": "seedream",
      "model": "doubao-seedream-5-0-pro-260628"
    },
    "layer_decomposition": true,
    "output_format": "png"
  }
}
```

画布发送给 DREO 的 `ratio` / `resolution` 是代理字段，不是火山方舟原生拆层 API 的 `size` 字段。代理需先明确拆层模式的校验合同，再映射到火山方舟 `/api/v3/images/generations` 的 `image`（单张可访问图片或 data URL）、`layer_decomposition: true` 和 `size: "auto"`。官方拆层模式的 `size: "auto"` 是合法值，适合尽量保持输入尺寸；普通 DREO 客户端不发送 `size` 不能证明该字段在火山方舟无效。`output_format` 对底图的影响也应按实际服务端合同确认；官方示例底图为 JPEG，而对象图层仍为透明 PNG。

## 必须保留的结果

DREO 任务查询需返回一张 `z_index: 0` 底图，以及最多 16 张对象图层。每层需保留 `url`、`z_index`、`bounding_box.normalized`、`name`、`description`，不要把多层结果压成普通图片数组或只返回第一张。下载 URL 有时效，任务完成后应立即供画布下载。画布会验证对象层真实 Alpha，并按坐标补为原图尺寸的透明 PNG。

`GET /api/agent/capabilities` 应显式声明该模型路由是否支持原生拆层以及使用的字段合同；模型支持普通参考图生成不等于代理已支持拆层。对于不支持的组合，在 DREO 端提交前返回明确的字段错误；对于已受理任务返回 `task_id`，避免客户端误以为未提交而重复扣费。

## 排查顺序

1. DREO 后台按任务提交时间查三条 HTTP 422 请求，给出经过脱敏的 `detail.loc`、`detail.msg`、`detail.type`；不要传播 Token、storage_key、图片签名链接或完整提示词。
2. 在测试环境验证入站字段校验、转发到火山方舟的字段映射，以及任务查询返回所有图层元数据。使用模拟响应的本地测试不会消耗生图额度。
3. DREO 确认代理能力后，再由用户发起一次真实拆层验收。核对底图、透明对象 PNG、坐标、数量、下载时效及任务计费；不要自动重试旧失败任务。

官方参考：[Seedream 5.0 Pro 教程](https://docs.volcengine.com/docs/ark/seedream-5-0-pro?lang=zh)、[图片生成 API](https://docs.volcengine.com/docs/ark/image-generation-api?lang=zh)。
