# Visual Workspace

> 2026-10-20 版本：换电脑启动及 DREO 配置请优先阅读 [接续指南](docs/CONTINUE_AT_HOME.md)。本地模型状态见 [LOCAL_VISION.md](server/LOCAL_VISION.md)。下文部分早期设计记录仅用于历史参考。

基于 React Flow 的图像工作流画布原型，目前聚焦画布，不包含 Figma 自动化和 Agent。

## 启动

```powershell
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

## 当前功能

图片导入与拖放（PNG/JPG/WebP，单张上限 25MB）、无限平移缩放、框选、移动与调整图片节点尺寸、拖线添加工具、右键菜单、参数编辑、节点复制、图片下载、定稿标记、图层定位及删除。

IndexedDB 自动保存；支持包含图片的 `.visproj` JSON 文件导入导出和视图恢复。

## 当前边界

文生图、图生图、图片编辑、风格转换、资产驱动的局部材质优化及模型／对象替换已接入本机 DREO HTTP 任务链路。真实生图必须由用户点击执行。画布支持撤销／重做、追加批次、收纳、结果迭代与滑块对比；去背景、多图层、扩图、消除、高清放大的专用执行器仍待接入，不模拟生成成功。

原型 `.visproj` 为 JSON，图片以 data URL 内嵌。后续迁移到 ZIP + 二进制资源时需要版本迁移。自动保存仅在当前浏览器和来源下可用，请导出项目备份。

## 开源底座

React Flow / xyflow：https://github.com/xyflow/xyflow （MIT），用于节点、连线及视图管理，保留默认署名。另使用 Vite、React、TypeScript、lucide-react 和 idb-keyval。未复制 tldraw 或 Excalidraw 源码。

## 验证

```powershell
npm.cmd run build
npm.cmd run lint
npx.cmd playwright install chromium
npx.cmd playwright test
```

浏览器检查覆盖图片上传、拖线创建工具、参数保存、刷新恢复、项目导入导出，以及缺少输入和无效文件的处理。

## 后续顺序

1. 图片与连线交互验收，补齐撤销和分组。
2. 配置风格分析接口并验收第一批真实场景结果；补齐其他技能定义。
3. 任务持久化、结果节点、版本谱系及版本包。
4. 资产库、批量流程和项目包格式升级。

## 图像创作参数

底部创作面板支持文生图 / 图生图、参考图、提示词、模型选择、1K/2K/4K、13 种比例、五档精细度与 1–4 张输出。选择工具节点时编辑该节点，未选择工具时编辑新建草稿。上传参考图会连接到正在编辑的工具；没有活动工具时会选中新图片并切换到图生图。

生成偏好保存在节点的 `data.generation` 中，草稿在 `project.draft` 中；旧项目自动补齐默认参数。尺寸按目标长边和比例估算到 8 的倍数，实际尺寸以未来执行器输出为准。模型目录仅是未接入的选择偏好，不代表平台已支持该模型或全部参数组合。

参数验证测试：`node --test tests/generation.test.mjs`。


## 节点编辑与工作流分组

生成参数现在可以直接在工具节点中编辑，底部面板负责快速新建，默认收起。参数弹窗使用固定屏幕尺寸，不随画布缩放。图片与工具节点均可折叠，保留源图、提示词、参数和连线。

使用卡片右上角勾选框或框选选择至少两个未分组节点，点击“创建分组”。分组标题可重命名并拖动，内部节点随组移动；解除分组保留世界坐标和连线。分组边界会随内容扩展，暂不支持嵌套分组和工作流模板执行。分组容器不能通过 Delete 连带删除内容，请先解除分组再删除节点。

折叠状态与父子关系随项目导出和本地保存。参数与坐标测试：`node --test tests/generation.test.mjs tests/graphLayout.test.mjs`。


## 统一工作台主题

全局浮动工具采用浅灰蓝配色、柔和凸起阴影和按需展开面板。左侧工具轨可切换选择/抓手模式、工具/图层面板、上传、新建图像、图片预览和缩略地图。工具面板、缩略地图默认关闭。

双击图片打开大图预览，可下载，Esc 或点击遮罩关闭；多张图片时可用前后按钮切换。双击不再同时缩放画布。主画布继续采用纯图片节点展示，图片信息只保留在项目数据中。

## 图片内置快捷技能

图片顶部操作栏直接使用 `src/builtinSkills.ts` 中的内置技能定义。去背景、多图层、变清晰立即创建旁边的结果占位；编辑、引用生成使用简短输入栏；扩图直接在源图外调整范围与比例；消除直接在图上涂抹，支持撤回笔画。确认后保存源图引用、技能版本、提示词和归一化范围/蒙版，取消不修改原图。

编辑与引用生成已接入真实图生图。去背景、多图层、变清晰、扩图、消除的专用执行器仍明确标记“执行服务待接入 / 尚未生成”，不显示模拟进度。


## 内置技能节点与场景风格转换 V1

图片连接菜单保留图生图、材质优化、风格转换、光影优化、模型替换；文生图使用底部创作入口。材质优化、模型替换直接进入圈选与资产绑定。光影优化仍待专用执行器。旧项目的家具替换／材质节点仍可进入资产编辑。

场景风格转换的完整规则固化在 `server/skills/scene-style-v1.json`，依据本机 `scene-material-transfer` 与用户提供的八步流程。后续行为变更应另存 V2 等完整版本，不覆盖已发布规则。节点输入上口为底图、下口为参考；第一张参考优先。也可在节点内调整底图和参考选择。保护范围默认包含家电产品、人物及动物，需要用户确认。

执行顺序：

1. 本机 Python（Pillow + numpy）按指定 GaussianBlur(1.2)、FIND_EDGES、归一化、阈值 55、MaxFilter(3) 生成灰度稿与白底黑线稿；保留 EXIF 方向和原始尺寸。
2. 视觉分析接口读取彩色底图与 1–3 张风格图，制定逐表面 JSON 映射。参考只参与分析。缺少解析接口时暂停，也可导入已分析好的 JSON。保护产品的原始颜色材质等可见事实需写进 JSON，避免去色丢失信息。
3. 后端校验方案、保护确认、底图是否变更、指定模型是否开放；DREO 仅上传灰度稿与线稿，生成请求的 `image_paths` 严格限制为两个 storage_key。prompt 仅为 JSON 字符串，模型固定 `doubao-seedream-5-0-pro-260628`，2K、4 张、preserve 光影。
4. 比例沿用底图，容差 0.6%，支持模型公布的标准比例；非标准比例会明确拒绝，绝不自动裁切或强行改成 3:4。3:4 为推荐比例。
5. 用户点击执行后提交一次任务，后台轮询并及时下载签名地址结果，即使节点折叠或浏览器关闭仍继续（本地开发服务须保持运行）。按请求 ID 去重；提交结果不确定时暂停并要求去 DREO 核对，不自动重新生成。
6. 结果以实际图片落在画布；已完成结果保留。可双击查看、切换底图对比、下载，并查看 geometry / product / material / lighting 四项复核。配置视觉接口时自动复核，未配置或失败时明确标为人工复核；模型成功不代表像素级结构或产品保护通过。

本地任务、输入、预处理图和下载结果保存在 `.canvas-data/`，已排除版本控制；不包含个人 Token。`.visproj` 保存节点配置、预处理预览、JSON、任务 ID 与已落画布结果。本地预处理/任务恢复记录尚不打进项目包：换机器后需重新准备底图；任务历史不会自动重新扣费生成。

### 连接配置

使用 `npm run dev`（本机 Vite 服务 + 同源技能 API）。`vite preview` / 静态 dist 不含执行接口，不作为生产部署方案。API 限制为本机回环地址和同源调用，个人 DREO Token 仅在服务端读取 `~/.dreo-visual-lab/credentials.json`，不会下发浏览器。

本机已通过 `CANVAS_VISION_CONFIG_PATH` 复用已有场景工作流的 `.env.local` 解析配置。其他机器可将 `.env.example` 复制为 `.env.local`，填写 `CANVAS_VISION_ENDPOINT`（完整 chat/completions 地址）、`CANVAS_VISION_TOKEN`、`CANVAS_VISION_MODEL` 后重启。该接口须支持图片输入、JSON 输出；不能仅填写生图模型。可用 `CANVAS_PYTHON` 指定带 Pillow/numpy 的 Python。本机默认采用 Codex bundled Python。不要把任何密钥写进 `VITE_` 变量。

### 本次验证范围

DREO capabilities 已实连核验，指定 Seedream 模型可用。真实 Python 预处理及本地隔离模拟服务的提交、去重、下载四图链路已验证；模拟服务不消耗真实额度。未向真实 DREO 提交付费出图，未完成真实图片视觉验收；当前机器通过被忽略的 `.env.local` 引用现有 `E:/codex/V7/V7/.env.local` 的解析配置；只读取解析地址、模型、Token，不修改旧应用，不复制 Token。配置存在已核验，但未调用真实视觉分析模型，仍需用实际图片验收。

```powershell
node --test tests/generation.test.mjs tests/graphLayout.test.mjs tests/scene-contract.test.mjs tests/skill-api.integration.test.mjs
```


## 简化技能节点与补充说明优先（V2）

当前节点展示输入缩略图、生图模型、画质/比例、张数、可选补充说明和生成按钮。保护确认、灰度/线稿、风格分析、JSON 方案、服务细节及任务 ID 已移入后台；点击生成后由后端自动执行完整技能流程。其他未接入技能仍明确禁用执行，不会冒充成功。

V1 固定参数流程作为历史兼容接口保留。新的 `/api/skills/style/run` 使用 V2，模型列表来自 DREO capabilities，支持双图参考的模型才可选择；画质、比例、张数按所选模型能力严格校验。节点参数高于内置默认参数，模型不支持时不会在服务端静默替换模型、降低画质或修改张数。

补充说明是最高视觉要求：分析阶段编译出 `resolvedInstructions`、`execution` 与 `adjustments`。明确要求修改产品或光影时，相关默认 preserve 可被覆盖；未授权范围仍保留。生图请求只使用编译后的有效规则，不再追加被覆盖的原始内置规则；复核也依据同一方案。缺少冲突解析结构时暂停，避免带着互相矛盾的要求生成。上传协议、模型能力和凭据访问等程序约束不由文字补充更改。真实视觉执行效果仍须图片验收。

左侧工具轨底部「技能后台管理」可编辑场景风格转换规则，保存为新完整版本并启用，也可切回旧版本。V1、V2 的初始完整快照分别保存在 `server/skills/scene-style-v1.json`、`scene-style-v2.json`，本机管理版本保存在 `.canvas-data/skill-config.json`；不会覆盖历史版本。每个新任务固化所用规则快照、生成参数、补充说明、最终方案和冲突调整记录，后台可查看最近记录。修改后台仅影响之后提交的任务。

本次集成测试用隔离模拟视觉/生图服务验证了：自动预处理到出图下载、补充改色和暖光覆盖默认保护、两张结构图协议、2 张/1K/16:9 参数传递、版本发布与回退、任务审计；没有提交真实付费生图。


## DREO 普通生图接口接入（2026-10-19）

已读取飞书《接入方式》文档（SH1YdDTMJoGS2Rxyf8fcjCqxnBd，revision 208），核对本机 DREO 凭据与 capabilities。后端新增 `/api/skills/images/tasks`：文生图使用 `image-gen`，图生图使用 `conversation-image`，参考图逐张上传为 storage_key，指定 provider/model，`interactive:false`。支持模型公布的 1–9 张；Midjourney 仅允许固定 4 张。画质、比例、质量档位按 capabilities 严格校验，不支持的设置在上传/扣费前拒绝。Token 仅由服务端读取。

底部点击生成会创建任务节点并直接提交；普通文生图、图生图节点可直接生成。图片顶部编辑/引用生成的输入确认后直接创建结果位置并调用图生图，不增加参数弹窗。去背景、消除、扩图、分层和 Topaz 等专用快捷操作仍待各自执行器接入，不能据此认为它们均已可执行。

后台复用持久化、去重、轮询和下载机制；刷新后可通过 request ID / job ID 恢复状态。提交不确定时禁止自动重提。实际结果以纯图片节点落画布，未出图的输入预览不能当成成品预览、下载或再次作为生成源。

普通生图使用非原生会话模式，尚不提供 previous_task_id 连续会话、自定义 GPT 像素尺寸和通用节点流水线自动调度。分辨率档位不代表固定最长边；UI 的像素仅是估算，结果记录真实像素。

验证包括真实 capabilities 连通、前端模型与参数菜单、隔离模拟平台的文生图/双参考图生图、结果下载、请求去重与参数拒绝。不包含真实扣费出图及视觉质量验收。

## 室内场景多图层原生拆分（2026-10-24）

新建的多图层任务先用内置 v3 人设形成对象清单，再将一张原图通过 DREO `conversation-image` 提交一次 Seedream 5.0 Pro 原生 `layer_decomposition` 任务。结果必须包含底图和对象图层的 `z_index`、`bounding_box.normalized`、下载地址；服务端验证 PNG Alpha，并将局部图层补成与输入图同尺寸、同坐标的透明 PNG。画布保留原图，将底图和各对象作为可单独编辑、下载的节点，并为收拢分组生成预览。旧任务继续按保存的旧执行路径恢复，不自动重提付费任务。

DREO 任务代理需要将 `layer_decomposition`、`size`、`output_format` 等参数透传给 Seedream，并在任务查询结果中保留图层元数据。如果代理不支持这些字段，任务会保留并暂停，不会悄悄改成逐张白底重绘。2026-10-24 两次实图提交均收到 DREO HTTP 422、未返回任务号；当前代理未给出具体字段错误，不能据此断定是哪一项被拒绝。画布现将这类明确拒绝标为“提交未被受理”，不会错误提示用户查询不存在的远端任务，也不会自动重提。隔离模拟联调已通过；真实平台兼容性和视觉质量仍需 DREO 接口确认后再由用户发起验证。

## 连线断开与改接

点击连线会高亮，并显示“断开”按钮；也可按 Delete / Backspace 删除选中的连线。选线会清除节点选择，避免连同节点一起删除。拖动线端圆点可以改接其他输入口，拖到空白处松开直接断开，且不会额外弹出新增节点菜单。点击区域已加宽，按钮保持固定屏幕尺寸。布局与连线随项目保存；已提交生图任务继续使用提交时的输入快照，断开画布连线不会取消或更改远端任务。

本次浏览器验收在独立测试画布确认：断开按钮、Delete、端点拖空断开及拖到其他节点改接，全部只修改连线，原 5 个节点保持；主画布未自动删除任何用户连线。


## 画布资产库与局部编辑

左轨保留选择、抓手、图层、资产库、新建、预览、缩略图和技能管理；移除重复的创作工具和上传按钮。拖入、粘贴和顶部导入图片入口保持可用。

- 本机画布资产分为 AI 材质和 AI 模型／对象，模型资产指二维外观参考，不是三维模型文件。数据存于 `.canvas-data/assets/`，采用原子写入与内容去重；不依赖其他资产应用，不自动发布公共库。可搜索、手动添加图片与 Prompt、导入 JSON、导出完整备份。
- 图片工具条「提取资产」：点选对象 → 点击识别获取 AI 建议轮廓和名称 → 加选／减选修边 → 确认范围 → 显式点击分析提取描述 → 逐项校对名称、材质 Prompt、置信度与不确定项 → 确认入库。由画布自己的分析合同和视觉接口负责识别，使用 `CANVAS_VISION_ENDPOINT / TOKEN / MODEL` 配置；不调用其他资产应用服务器。视觉模型未配置时明确报错，不静默切换。输出是选区裁片加描述，不承诺自动抠图。反推候选不自动入库，不额外生成材质预览。
- 「材质优化／模型替换」统一放在图片右侧连接菜单，创建连接原图的技能节点；图片顶部不重复提供入口。节点内绑定选区与同类型资产，保存后回到节点调整模型、画质、1–4 张和补充说明，再生成。选区资产可重新打开调整，本次描述不覆盖库内原文。`/api/skills/assets/edit/tasks` 使用 JSON 局部编辑合同，参考为原图、蒙版、资产外观图，随后通过现有 DREO 任务链路生成。
- 本机 Pillow 将每张结果合成回输入原图尺寸，只替换蒙版内像素，蒙版外严格保留原图的解码像素。尺寸比例沿用底图；模型采样质量档位不会改变最终合成的原图尺寸。材质保留目标造型，模型替换仅允许改变所选对象造型；选区内结构、Logo、遮挡与材质仍需人工复核。
- 结果追加到画布，复用生成动画、计时、连接、原图滑块对比；每个结果保存选区和资产快照。后续在底部补充修改，直接复用该局部工作流生成新版本，无需再次调出技能模块。

隔离测试：`node --test --test-concurrency=1 tests/*.test.mjs`。集成测试使用本地模拟 DREO 和临时数据目录，不调用真实生成；像素保护测试检查选区外逐像素不变。


### 点选对象与范围确认

资产选择默认使用点选模式，标记一个对象后显式点击「识别对象」，由画布自身的 `/api/skills/assets/locate` 调用已配置视觉接口，返回归一化建议轮廓、对象名、置信度和不确定项；不会把建议轮廓称为像素级分割。无结果、点击位置未被覆盖或几乎整图的建议会被拒绝，不生成假选区。

加选／减选笔刷仅在本机修改蒙版，支持撤销；矩形和多边形收进「更多」。每次识别、修边后必须重新确认范围，才允许保存到技能节点或提取描述。节点保存点标记、轮廓、笔画和确认状态；重新打开可继续调整。后台预处理与成图合成使用相同笔画，减选区域恢复原图像素。选区和资产绑定时不再重复显示节点已有的生图参数。

## Person asset sheets

AI person extraction automatically describes one selected subject and generates a 3x3 identity reference sheet through the configured canvas image service. The server splits it into front/side/back full-body, three portrait angles, and eye/lip/hair detail images. The front full-body image is the library cover; selecting the asset reveals the remaining views, with full-size detail previews. All views are saved together and included in backup/import. Missing source details are AI-inferred and need consistency review. Request IDs deduplicate submissions; the open library resumes pending task polling without repeating generation.

## Name-based asset extraction

Canvas extraction accepts object names (up to six per request) without any manual selection. It analyzes the full source image, checks that every requested object is represented, merges small finishing details into reusable surfaces, and preserves visible bed/furniture components when their materials differ. Each material gets its own generated preview: furniture uses white-background component close-ups; floors/walls use neutral spatial application scenes. Original source, generated preview, object overview, material-only prompt, confidence and uncertainties are stored separately. Explicit Start hands analysis and preview generation to canvas placeholders; archive is an explicit action from the resulting image, with suggested name/category editable before confirmation. Legacy auto-archive tasks retain their original behavior. Completed source/part fingerprints are reused, duplicate request IDs never resubmit paid generation, and partial completed assets remain available if another preview fails. Region selection is reserved for applying an asset to a local edit.

## Canvas extraction handoff

Object confirmation now closes the extraction modal immediately. Non-modal canvas placeholders track analysis and each generated preview through project-persisted extraction records; polling lives outside node rendering and continues when results are offscreen or grouped. Canvas requests stage generated asset drafts instead of automatically archiving them. Select a result and use Save asset to review the suggested material name/category and prompt, then confirm library persistence. Earlier in-flight extraction IDs are restored from session storage without reposting generation. Existing legacy auto-archive tasks retain their original behavior.

## 换电脑继续开发

完整启动、Python 环境、模型配置、画布与资产备份方法见 [换电脑继续开发](docs/CONTINUE_AT_HOME.md)。源码不包含密钥、原始项目图片、资产库和任务记录。

## 对象绑定与后台局部编辑

材质优化、模型替换的弹窗只负责连续点选 1–4 个对象、绑定对应资产与补充说明，不在弹窗中调用视觉模型，也不重复显示生成参数。点击“保存对象与资产，返回画布”后，统一在画布节点设置模型、画质、比例和张数，再点击生成。

后台任务先持久化并返回编号，再并发识别各对象范围、组合联合蒙版与编号参考板，最后上传并提交生图。节点及占位图显示四阶段状态。识别、参数校验或蒙版组合失败时不提交生图；服务中断后的前置识别任务暂停，等待用户重新生成。已有明确选区的旧局部编辑请求仍保持兼容。

材质优化规则 v3：资产封面默认仅预览，生图只接收底图、范围定位图与材质提示词。逐对象勾选「使用当前材质图片作为参考」后才上传该对象的图片；混合模式参考板不包含未勾选对象的封面。补充说明优先覆盖颜色、织法等冲突属性，未涉及属性沿用材质目标，选区外仍保留原图。历史 v1/v2 规则代码保留，当前请求记录 ruleVersion=material-prompt-first-v3。

任务异常恢复：前端单次查询 20 秒超时，连续 3 次失败停止自动等待；缺失记录明确提示需要核对。远端连续查询失败或超过 15 分钟未结束会显示待处理状态，可在节点重新查询原任务找回结果，不重复提交生图。「停止本地等待」不会取消远端任务，重新生图前需核对远端结果。

画布持久化：状态更新立即进入串行保存队列，拖动结束后保存坐标；并发更新合并最新快照，不再用可无限推迟的防抖保存。保存未完成或失败时，刷新前提示未保存，读取失败时禁止空画布覆盖已有项目。刷新后的完成任务会查询一次已保存结果，用于恢复缺失图片。
