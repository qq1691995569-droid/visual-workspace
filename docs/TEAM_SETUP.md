# 同事接入画板（2026-10-21）

仓库：https://github.com/qq1691995569-droid/visual-workspace

这是公开仓库，同事无需邀请即可查看和克隆源码。DREO 生图仍需各自的平台权限和个人令牌。当前源码已直接更新到 main，请勿覆盖为旧 ZIP 快照。

## 可直接复制给 AI 助手的接入提示词

```text
请帮我在这台电脑安装并启动 Visual Workspace 画板，仓库为：
https://github.com/qq1691995569-droid/visual-workspace

1. 这是公开仓库，无需 GitHub 登录即可克隆。先检查本地是否已有项目；未安装则克隆 main，已有则先保护本地改动，再安全拉取最新版本。直接使用源码，不解压仓库中的旧快照覆盖它。
2. 阅读 README.md、docs/TEAM_SETUP.md、docs/CONTINUE_AT_HOME.md。检查 Git、Node.js（推荐 24 LTS）和 Python 3.11+。Windows 用 npm.cmd ci，创建 .venv，并用虚拟环境的 Python 安装 requirements.txt。
3. 若 .env.local 不存在，从 .env.example 复制；已有配置不要覆盖。将 CANVAS_PYTHON 设置为本机虚拟环境 Python 的绝对路径。
4. 帮我配置自己的 DREO 生图接口：先检查本机是否已有合法配置；没有时引导我在本地填写平台管理员提供的服务根地址和个人 Agent API token。默认文件为用户目录下 .dreo-visual-lab/credentials.json，字段为 origin 和 token；origin 不追加 /api/agent，token 不加 Bearer 前缀。也可通过 .env.local 的 CANVAS_DREO_CONFIG 指定配置文件绝对路径。不要让我把密钥发到聊天里，不输出或提交密钥，不使用 VITE_ 前缀保存密钥。
5. 需要图像识别/资产提取时，再配置自己的 CANVAS_VISION_ENDPOINT、CANVAS_VISION_TOKEN、CANVAS_VISION_MODEL；不要把未配置的功能报告为可用。先完成基础画板和 DREO 生图，不自动下载大型本地模型。
6. 运行构建和代码检查，使用 npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort 启动完整服务；不要用 preview 代替后端服务。已有服务时先确认归属，不随意结束其他程序。
7. 检查启动日志，给我打开 http://127.0.0.1:5173/ 的方式。接口测试先做只读检查，真实付费生图由我手动提交一张图片验证。
8. 告诉我下次如何启动、如何更新、如何导入 .visproj 项目。说明画布保存在当前浏览器，团队不会自动同步画布或资产；不要删除或覆盖已有数据。
完成后简要报告启动地址、代码版本、已经验证的功能及仍缺少的配置。
```

## 交付范围

- 代码检查和构建可以验证安装；每位同事仍需自己的平台权限、凭据和可访问平台的网络。
- 分享现有画布：发送通过「导出项目」生成的 `.visproj`，同事在项目管理中导入。资产库使用自己的导出/导入功能。
- 固定使用 `127.0.0.1:5173` 和同一个浏览器；更换地址、端口、浏览器会使用不同的本地画布存储。
- 安装完成后可在 Windows 双击 `Start-Canvas.cmd` 启动；保持服务窗口运行。
- 去背景、多图层等本地增强能力需额外部署，见 `server/LOCAL_VISION.md`；本地 Topaz 尚未接入。

## 本次交互更新

提交生成后立即清空创作输入；单击画布空白处也清空当前输入。点选任务占位框或结果图可恢复提示词、参考图和参数。任务记录随画布保存在本机，不随 Git 自动共享。
