import type {VisualAsset} from './AssetLibrary'
import {assetCategory} from './assetCategory'

export function AssetCardContent({asset}:{asset:VisualAsset}) {
  return <><img loading="lazy" decoding="async" src={asset.image} alt={asset.name}/><small className="asset-card-meta">{assetCategory(asset)}{asset.sourceObject?` · ${asset.sourceObject}`:''}</small><strong title={asset.name}>{asset.name}</strong><span className="asset-card-description">{asset.objectDescription||asset.prompt}</span><span className="asset-card-tags">{asset.tags.slice(0,3).map(tag=><span key={tag}>#{tag}</span>)}</span></>
}
