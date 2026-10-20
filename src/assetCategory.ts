import type {VisualAsset} from './AssetLibrary'
export const materialCategories:Record<string,string>={fabric:'织物 / 面料',wood:'木材 / 木纹',stone:'石材',metal:'金属',leather:'皮革',glass:'玻璃',ceramic:'陶瓷',paint:'涂料 / 灰泥',plastic:'塑料',other:'其他材质'}
export function assetCategory(asset:VisualAsset){
 if(asset.kind==='person')return '人物'
 if(asset.kind==='model')return '模型 / 对象'
 if(asset.materialCategory&&asset.materialCategory!=='other'&&materialCategories[asset.materialCategory])return materialCategories[asset.materialCategory]
 // Old records may predate categories. Infer display grouping only from the saved
 // reusable surface prompt, never from the furniture name or an unknown substrate.
 const text=asset.prompt.toLowerCase(),matches=new Set<string>()
 for(const [key,pattern] of Object.entries({fabric:/织物|织纹|纺织|织造|经纬|圈绒|羊毛|棉麻|毛毡|fabric|textile|woven|wool/,wood:/木纹|木材|实木|橡木|胡桃木|wood|timber/,stone:/石材|大理石|花岗岩|洞石|marble|granite|travertine/,metal:/金属|不锈钢|铝合金|黄铜|metal|steel|brass/,leather:/皮革|真皮|仿皮|leather/,glass:/玻璃|glass/,ceramic:/陶瓷|瓷砖|ceramic|porcelain/,paint:/墙漆|涂料|灰泥|乳胶漆|paint|plaster|stucco/,plastic:/塑料|树脂|plastic|resin/}))if(pattern.test(text))matches.add(key)
 return matches.size===1?materialCategories[[...matches][0]]:materialCategories.other
}
