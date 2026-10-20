import {Palette,Box,UserRound,ChevronRight} from 'lucide-react'
import type {AssetKind,VisualAsset} from './AssetLibrary'

const categories=[
  {kind:'material' as const,title:'AI 材质',description:'颜色、纹理与表面质感',Icon:Palette},
  {kind:'model' as const,title:'AI 模型／对象',description:'家具、产品与物体外观',Icon:Box},
  {kind:'person' as const,title:'AI 人物',description:'人物外观与多视图参考',Icon:UserRound},
]
export function AssetCategoryHome({assets,search,coverSize,onSelect}:{assets:VisualAsset[];search:string;coverSize:number;onSelect:(kind:AssetKind)=>void}) {
  const query=search.trim().toLowerCase()
  const groups=categories.map(category=>({...category,items:assets.filter(asset=>asset.kind===category.kind).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))})).filter(category=>!query||`${category.title} ${category.description}`.toLowerCase().includes(query)||category.items.some(asset=>`${asset.name} ${asset.prompt} ${asset.tags.join(' ')}`.toLowerCase().includes(query)))
  return <><div className="asset-list-heading"><div><strong>资产分类</strong><span>3 个分类</span></div></div><div className="asset-grid asset-category-home" style={{gridTemplateColumns:`repeat(auto-fill,minmax(min(100%,${coverSize}px),1fr))`}}>{groups.map(({kind,title,description,Icon,items})=><button type="button" className="asset-tile asset-category-card" key={kind} onClick={()=>onSelect(kind)} aria-label={`打开${title}，${items.length}项资产`}>
    {items[0]?<img loading="lazy" decoding="async" src={items[0].image} alt={`${title}封面`}/>:<span className={`asset-category-placeholder ${kind}`}><Icon size={36} strokeWidth={1.2}/><span>暂无资产</span></span>}
    <strong>{title}</strong><span className="asset-card-description">{description}</span><span className="asset-category-footer"><span>{items.length} 项资产</span><ChevronRight size={14}/></span>
  </button>)}{!groups.length&&<div className="asset-empty">没有匹配的分类或资产</div>}</div></>
}
