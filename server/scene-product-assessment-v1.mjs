// Versioned analysis contract, shared by automatic and manual style analysis.
export const productAssessmentSchema = {
  status: 'present / absent / uncertain，按底图实际选择一个',
  evidence: '仅依据底图说明可见产品及位置，或说明场景中未见产品；不能依据参考图推断',
  surfaceIds: ['实际产品对应的 targetSurfaces.id；明确没有产品时为空数组'],
}
export const productAssessmentPrompt = `产品存在性协议 v1：风格转换允许没有产品的纯场景。先仅检查第一张底图，输出 productAssessment。
status 只能是 present、absent 或 uncertain，evidence 必须说明可核对的底图依据。产品指家电、设备或用户明确指定保护的商品，不要把所有家具、墙面、地毯都当作保护产品而阻止材质迁移。
明确没有产品时 status=absent、surfaceIds=[]，删除示例中的产品材料和产品表面占位项；无需为了满足格式虚构产品或任意保留一面墙。仍保持机位、家具结构、人物和动物，只转换实际可编辑表面，不从参考图新增产品。
有产品时 status=present，surfaceIds 列出每个实际产品对应的 targetSurfaces.id，记录原色、材质和可见细节，默认 match=preserve、preserve=true；用户明确授权修改产品时才按该范围编辑。
无法判断时 status=uncertain，不得假报 absent；在 surfaceIds 指向疑似产品表面并保守保护。人物和动物即使没有产品也继续保护。示例只展示字段，不代表底图一定有产品。`
