# 拆分清单字段约定

新执行器使用本约定，清单及子任务持久化。

- skillVersion: 3；记录 Skill、PERSONA.md、字段协议及有效后台补充的内容 hash，方便复现实验。
- source: 原图引用、原始 width/height。坐标以未缩放原图为准。
- objects: 对象列表，每项包含唯一 id、name、kind、disposition（separate/background）、includedParts、excludedObjectIds、bbox（归一化 x/y/width/height，范围 0–1）、occludedByIds、uncertainRegions、confidence（0–1）、reviewNotes。
- effects: 投影、反射、透明透景关系。每项含 id、type、ownerObjectIds、receiverObjectIds、处理说明；未知关联显式注明。
- unresolved: 无法确定归属的可见内容，记录范围、原因及建议，不静默丢弃。
- overrides: 用户合并/细拆/留背景的选择及版本。
- confirmed: 清单是否已确认；后续任务绑定确认版本。
- outputs: 每层记录 objectId 或 background、原生任务 id、z_index、bounding_box、文件引用、原画幅尺寸、原始位置、alphaValidated、补全区域、reviewStatus、问题列表。原生局部 PNG 按坐标补到原画幅的透明画布；原图不被覆盖。

约束：id 不重复，所有引用必须存在，禁止对象自遮挡；局部循环遮挡允许并保留原始关系；bbox 不越界。每个实体只属于一个输出，组合成员不能另生成重复层。复杂交错遮挡不能伪造简单层序，也不因此阻止独立对象提取。执行器计算 occlusionReview.groups（互相可达的对象集合）、requiresRegionalMasks 和 needs_review；不自动合成，必须局部蒙版或人工复核。合成使用原始坐标，不通过缩略图位置反算。
