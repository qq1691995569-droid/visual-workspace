# 换电脑继续开发

## 1. 拉取与启动

安装 Git、Node.js 22.12+（推荐 24 LTS）、Python 3.11+。用实际仓库地址替换下面的占位符：

```powershell
git clone <你的仓库地址> visual-workspace
cd visual-workspace
npm.cmd ci
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env.local
```

在 `.env.local` 中设置本机 Python 的**绝对路径**：

```dotenv
CANVAS_PYTHON=C:/你的项目目录/visual-workspace/.venv/Scripts/python.exe
```

真实生图还需要在家里电脑配置自己的 DREO 凭据和支持图片输入的视觉模型。配置方式见下文。仅调界面无需填写密钥。

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

打开 http://127.0.0.1:5173/ 。请固定使用这个地址；localhost 和 127.0.0.1 的浏览器自动保存互不相通。

## 2. 本机配置

视觉识别配置写在 `.env.local`，修改后重启服务：

```dotenv
CANVAS_VISION_ENDPOINT=你的完整chat/completions接口地址
CANVAS_VISION_TOKEN=你自己的密钥
CANVAS_VISION_MODEL=支持图片输入与JSON输出的视觉模型
CANVAS_PYTHON=C:/你的项目目录/visual-workspace/.venv/Scripts/python.exe
```

生图服务默认读取用户目录下 `.dreo-visual-lab/credentials.json`：

```json
{"origin":"你的DREO服务地址","token":"你自己的DREO令牌"}
```

也可以在 `.env.local` 中用 `CANVAS_DREO_CONFIG` 指向自己的凭据文件。不要使用 `VITE_` 前缀存放任何密钥。仓库只包含配置示例，不包含公司的或个人的令牌。

## 3. 把当前画布与资产带回家

Git 保存程序代码，浏览器里的画布和本机资产不会随代码同步。

1. 在当前画布右上角点击「导出项目」，保存 `.visproj`。回家启动后进入「项目管理 → 导入项目」导入。
2. 在资产库底部点击「备份」，保存资产 JSON。回家在资产库点击「导入」。
3. 需要自定义技能定义和本地任务记录时，停止服务后另行备份 `.canvas-data` 目录；不要提交到公开仓库。旧的运行中任务依赖原服务与账号，换电脑不保证能够恢复。
4. 将项目包、资产备份通过自己信任的渠道传输。它们可能含有原始图片和提示词，不放入源码仓库。

## 4. 每次继续修改前后

```powershell
git pull --ff-only
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

验证：

```powershell
npm.cmd run build
npm.cmd run lint
$env:CANVAS_PYTHON=(Resolve-Path .venv/Scripts/python.exe).Path
node --test --test-concurrency=1 tests/*.test.mjs
```

确认修改后用 `git status` 检查文件，再提交和推送。`npm run preview` 仅用于前端构建预览；完整生图与资产 API 请用 `npm run dev`。

## 5. 给下一次开发会话的接续说明

把这段话贴到新电脑的开发会话：

> 请先阅读 README.md、docs/CONTINUE_AT_HOME.md 和 src/ 和 server/ 中的实际实现，继续维护 Visual Workspace 画布。先检查 Git 分支和现有改动，再按我接下来提出的问题修改。现有约定：普通文生图／图生图复用底部创作框；材质优化和模型替换连续点选 1–4 个对象，自动识别并逐个绑定资产，确认后在画布生成；选区外用原图像素合成保护。资产库独立保存在本机，不连接旧资产库服务器；提取任务在画布生成，用户确认后入库。人物封面只显示全身照，多视图在详情展示。资产详情采用居中大图与信息双栏。保持当前浅灰蓝主题；界面验证使用隔离测试数据，不自动调用付费模型，不改用户主画布。完成后运行构建、lint 和相关测试，并说明实际验证范围。

## 6. 2026-10-20 保存版本说明

当前版本包含多画布项目管理、图片节点原位生成、多参考连线、紧凑完整工具栏、任务删除与状态同步。删除任务停止本地跟踪并丢弃迟到结果；尚不保证远端模型或正在执行的本地计算立即停止。

回家只需运行应用时，不需要重新开发：完成第 1、2 节后保持开发服务终端开启，在浏览器访问 http://127.0.0.1:5173/ 。关闭终端后服务停止，下次在项目目录重新执行启动命令。

### DREO 生图重新接入

1. 在家里电脑登录你有权使用的 DREO 平台，取得该平台服务地址与自己的 Agent API token。此项目不内置令牌申请页面，具体领取入口由平台管理员提供。
2. 创建用户目录下的 `.dreo-visual-lab` 文件夹，例如 `C:/Users/你的用户名/.dreo-visual-lab`。
3. 新建 `credentials.json`，内容按第 2 节 JSON 示例填写。`origin` 是服务根地址，不要加 `/api/agent`；`token` 填令牌本身，不加 `Bearer `。
4. 如果凭据存放在其他位置，在项目 `.env.local` 添加 `CANVAS_DREO_CONFIG=C:/你的路径/credentials.json`。
5. 重启 `npm.cmd run dev -- --host 127.0.0.1 --port 5173`。界面读取模型能力；然后手动用 1 张图片的小任务验证。真实生图可能消耗平台额度。
6. 无法连接时，先检查家庭网络能否访问平台；仅内网服务需使用公司批准的 VPN。401/403 检查令牌和权限，HTTP 500 是服务端错误，不能靠更换前端配置解决。

代码中的请求链路是 `GET /api/agent/capabilities`、`POST /api/agent/upload`、`POST /api/agent/tasks` 和 `GET /api/agent/tasks/{id}`。浏览器调用本机 `/api/skills/...`，由本机服务附加令牌转发到 DREO；不要在浏览器或 `VITE_` 配置中填写令牌。

### 本地增强模型与真实能力边界

模型和 Python 运行环境不随 Git 同步。需要本地去背景、消除、变清晰、多图层时，另按 `server/LOCAL_VISION.md` 执行 `scripts/setup-vision.ps1`；模型下载较大，建议先运行画布和 DREO 生图。

- 变清晰：Real-ESRGAN；本地 Topaz 尚未接入。
- 去背景：BiRefNet 试验接入，复杂家具场景效果仍不稳定。
- 消除：LaMa。
- 多图层：Qwen-Image-Layered / ComfyUI，当前机器未完成效果验收，不承诺部署后可直接达到参考效果。
- 扩图：继续走 DREO 生成流程。

源码备份不包含浏览器画布、用户资产、密钥、模型权重或 `.canvas-data` 任务记录。出发前请逐个导出需要带走的画布。
