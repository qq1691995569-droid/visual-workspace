let previewDoc=null,previewSplit=50,previewResize=null;
const previewMarkup=`<div class="bar"><button id="save">导出原尺寸 PNG</button></div><div class="preview-layout"><div class="preview-image"><div class="viewport"><div class="frame"><canvas id="afterCanvas"></canvas><canvas id="beforeCanvas"></canvas><div id="divider" role="slider" tabindex="0" aria-label="原图与调色效果分界线" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-orientation="horizontal"><span class="drag-handle" aria-hidden="true">‹ ›</span></div><span class="image-label original-label">原图</span><span class="image-label result-label">调色后</span></div></div><div id="referencePair" hidden><div><small>风格参考</small><canvas id="referenceCompare"></canvas></div><div id="referenceResultSlot"><small>原图 / 调整结果 · 拖动对比</small></div></div><p class="drag-tip">拖动图片上的分界线，左右查看效果</p></div><aside class="preview-parameters"><label style="display:block;margin-bottom:18px">对比方式<select id="comparisonMode" style="width:100%;margin-top:8px"><option value="before">原图 / 调整结果</option><option value="reference">参考图 / 调整结果</option></select></label><div id="castTools"><button id="castButton" style="width:100%;margin-bottom:8px">匹配参考光感</button><p id="castStatus">分析参考图的环境偏色，同时保护产品本来的颜色</p><label id="castStrengthWrap" class="parameter-control" hidden><span>参考光感强度 <output id="castStrengthValue">0</output></span><input id="castStrength" aria-label="参考光感强度" type="range" min="0" max="120" value="0"></label><button id="clarityButton" style="width:100%;margin:8px 0">智能通透优化</button><p id="clarityStatus">清理滤镜感，并匹配参考图的黑白层次</p><div id="clarityControls" hidden><label class="parameter-control"><span>通透度强度 <output id="clarityStrengthValue">0</output></span><input id="clarityStrength" aria-label="通透度强度" type="range" min="0" max="120" value="0"></label><label style="display:flex;align-items:center;gap:8px;margin-bottom:18px"><input id="protectHighlights" type="checkbox" checked>保护高光</label></div></div><h3 id="globalAdjustTitle">整体调整</h3><div id="previewControls"></div><div id="qualityReport" role="status"></div><p id="previewInfo"></p><p id="exportInfo" role="status"></p></aside></div>`;
const previewCSS=`
#referencePair:not([hidden]){display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#101817;padding:12px;border-radius:10px}#referencePair>div{min-width:0;text-align:center}#referencePair canvas{max-width:100%;max-height:64vh;object-fit:contain;display:block;margin:10px auto 0}
#dialogContent{padding:16px;background:#202a29;color:#edf4ec;border-radius:10px;font:14px system-ui,sans-serif}
#dialogContent .bar{display:flex;justify-content:flex-end;padding:0 0 14px}
#dialogContent .bar button{padding:10px 18px;border:1px solid #b9cebf;border-radius:8px;background:#d9eddd;color:#173b27}
#dialogContent .preview-layout{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:20px;align-items:start}
#dialogContent .preview-image{min-width:0}
#dialogContent .viewport{background:#101817;border-radius:8px;padding:12px;display:flex;align-items:center;justify-content:center;min-height:240px;overflow:hidden}
#referenceResultSlot .viewport{margin-top:10px;padding:0;background:transparent;min-height:0}
#referenceResultSlot .frame canvas{margin:0;max-height:none}
#dialogContent .frame{position:relative;flex-shrink:0;max-width:100%;touch-action:none;cursor:ew-resize;user-select:none}
#dialogContent .frame canvas{display:block;width:100%;height:auto}
#dialogContent #beforeCanvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#dialogContent #divider{position:absolute;top:0;bottom:0;transform:translateX(-50%);width:36px;touch-action:none;cursor:ew-resize;outline:none;z-index:3}
#dialogContent #divider:before{content:'';position:absolute;top:0;bottom:0;left:17px;width:2px;background:white;box-shadow:0 0 4px #0008}
#dialogContent .drag-handle{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:42px;height:42px;border:2px solid #fff;border-radius:50%;background:#24493de6;color:#fff;font-size:24px;box-shadow:0 2px 12px #0006;white-space:pre}
#dialogContent #divider:focus-visible .drag-handle{outline:3px solid #9deabb;outline-offset:4px}
#dialogContent .image-label{position:absolute;top:12px;padding:4px 8px;border-radius:5px;background:#10271cb3;color:white;font-size:12px;pointer-events:none}
#dialogContent .original-label{left:12px}#dialogContent .result-label{right:12px}
#dialogContent .preview-parameters{padding:18px;background:#2b3633;border:1px solid #45524a;border-radius:10px;min-width:0}
#dialogContent h3{font-size:16px;margin:0 0 22px}
#dialogContent .parameter-control{display:block;margin:0 0 24px}
#dialogContent .parameter-control span{display:flex;justify-content:space-between;gap:10px;margin-bottom:9px;color:#d3ded5;font-size:13px}
#dialogContent output{color:#aadeba;font-variant-numeric:tabular-nums}
#dialogContent input[type=range]{width:100%;accent-color:#99c9aa;cursor:pointer}
#dialogContent p{font-size:12px;line-height:1.7;color:#a6b7ac;margin:12px 0 0;overflow-wrap:anywhere}
#dialogContent #qualityReport{margin:8px 0 16px;padding:10px 12px;border-radius:8px;background:#21302b;color:#bcd3c3;font-size:12px;line-height:1.6}
#dialogContent [hidden]{display:none!important}
#dialogContent .drag-tip{text-align:center}
@media(max-width:800px){#dialogContent .preview-layout{grid-template-columns:1fr}#dialogContent #previewControls{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}#dialogContent .viewport{min-height:180px}}
`;
function updateSplit(){if(!previewDoc)return;const divider=$('divider');$('beforeCanvas').style.clipPath=`inset(0 ${100-previewSplit}% 0 0)`;divider.style.left=previewSplit+'%';divider.setAttribute('aria-valuenow',Math.round(previewSplit));divider.setAttribute('aria-valuetext',`原图 ${Math.round(previewSplit)}%，调色后 ${100-Math.round(previewSplit)}%`)}
function fitPreview(){
if(!previewDoc||!states.target)return;
const viewport=$('dialogContent').querySelector('.viewport'),s=states.target;
if(!document.documentElement.classList.contains('canvas-preview')){const width=Math.max(1,Math.min(viewport.clientWidth-24,window.innerHeight*.64*s.w/s.h));viewport.querySelector('.frame').style.width=width+'px';return}
const paired=$('comparisonMode').value==='reference';
const area=$('dialogContent').querySelector('.preview-image');
const available=Math.max(100,area.clientHeight-70);
const width=Math.max(1,Math.min(viewport.clientWidth-24,available*s.w/s.h));
viewport.querySelector('.frame').style.width=width+'px';
if(paired&&states.reference){
const c=$('referenceCompare'),r=states.reference,slot=c.parentElement;
const height=Math.max(1,Math.min(available,(slot.clientWidth-24)*r.h/r.w,(viewport.clientWidth-24)*s.h/s.w));
c.style.width=height*r.w/r.h+'px';c.style.height='auto';
viewport.querySelector('.frame').style.width=height*s.w/s.h+'px';
}
}
function syncPreview(){if(!previewDoc||!states.target)return;for(const [src,dst] of [['output','afterCanvas'],['before','beforeCanvas']]){let a=$(src),b=$(dst);if(!b)return;b.width=a.width;b.height=a.height;b.getContext('2d').drawImage(a,0,0)}for(const[id]of defs){$('preview-'+id).value=$(id).value;$('preview-'+id+'-value').value=$(id).value}if(states.reference&&$('referenceCompare')){const c=$('referenceCompare');c.width=states.reference.w;c.height=states.reference.h;c.getContext('2d').putImageData(states.reference.data,0,0);}const report=JSON.parse($('output').dataset.quality||'{}');$('qualityReport').textContent='画质检查：'+(report.label||'正在分析')+(report.clipped!=null?` · 裁切风险 ${(report.clipped*100).toFixed(1)}%`:'');$('previewInfo').textContent=$('dimensions').textContent;$('save').disabled=busy;$('exportInfo').textContent=busy?'正在生成原尺寸 PNG…':$('status').textContent;fitPreview();updateSplit()}
function wirePreview(){
for(const[id,name,min,max]of defs){const label=document.createElement('label');label.className='parameter-control';label.innerHTML=`<span>${name}<output id="preview-${id}-value"></output></span><input id="preview-${id}" aria-label="${name}" type="range" min="${min}" max="${max}">`;$('previewControls').append(label);$('preview-'+id).oninput=e=>setValues({[id]:+e.target.value},true);$('preview-'+id).onchange=finishInteractiveRender}
$('comparisonMode').onchange=()=>{const use=$('comparisonMode').value==='reference';if(use&&!states.reference){$('comparisonMode').value='before';return}$('referencePair').hidden=!use;const viewport=$('dialogContent').querySelector('.viewport');if(use)$('referenceResultSlot').append(viewport);else $('referencePair').before(viewport);$('dialogContent').querySelector('.drag-tip').textContent=use?'左侧为风格参考；拖动右图分界线查看原图与调色效果':'拖动图片上的分界线，左右查看效果';fitPreview()};$('save').onclick=()=>$('export').click();const frame=$('dialogContent').querySelector('.frame');let pointer=null;
const move=e=>{if(e.pointerId!==pointer)return;const r=frame.getBoundingClientRect();previewSplit=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));updateSplit()};
frame.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointer=e.pointerId;frame.setPointerCapture(pointer);$('divider').focus({preventScroll:true});move(e)};frame.onpointermove=move;frame.onpointerup=e=>{move(e);pointer=null};frame.onpointercancel=frame.onlostpointercapture=()=>{pointer=null};
$('divider').onkeydown=e=>{let value=previewSplit;if(e.key==='ArrowLeft')value-=e.shiftKey?10:1;else if(e.key==='ArrowRight')value+=e.shiftKey?10:1;else if(e.key==='Home')value=0;else if(e.key==='End')value=100;else return;e.preventDefault();previewSplit=Math.max(0,Math.min(100,value));updateSplit()};
$('castButton').onclick=()=>{if(!states.reference){$('castStatus').textContent='请先导入风格参考图。';return}try{const source=new Uint8ClampedArray(states.target.data.data.length),p=parameters();p.cast={strength:0,a:[0,0,0],b:[0,0,0]};SceneColor.transform(states.target.data.data,source,p);castCorrection=SceneColor.castProfile(source,states.target.mask,states.reference.data.data,states.reference.mask);$('castStrength').value=castCorrection.strength;$('castStrengthValue').value=castCorrection.strength;$('castStrengthWrap').hidden=false;$('castStatus').textContent=castCorrection.label+' · '+castCorrection.summary+'；高饱和产品色会自动降低影响。';render()}catch(e){$('castStatus').textContent='检测失败：'+e.message}};
$('castStrength').oninput=e=>{castCorrection.strength=+e.target.value;$('castStrengthValue').value=e.target.value;requestInteractiveRender()};$('castStrength').onchange=finishInteractiveRender;
if(castCorrection.strength){$('castStrengthWrap').hidden=false;$('castStrength').value=castCorrection.strength;$('castStrengthValue').value=castCorrection.strength;$('castStatus').textContent=castCorrection.label+' · '+castCorrection.summary+'，已应用参考光感。'}
$('clarityButton').onclick=()=>{if(!states.reference){$('clarityStatus').textContent='请先导入风格参考图。';return}try{const source=new Uint8ClampedArray(states.target.data.data.length),p=parameters();p.clarity={strength:0,anchors:[20,55,88],delta:[0,0,0],local:0,preserveHighlights:true};SceneColor.transform(states.target.data.data,source,p);clarityCorrection=SceneColor.clarityProfile(source,states.reference.data.data);$('clarityStrength').value=clarityCorrection.strength;$('clarityStrengthValue').value=clarityCorrection.strength;$('protectHighlights').checked=true;$('clarityControls').hidden=false;$('clarityStatus').textContent=clarityCorrection.label+'，已匹配黑位、中间调和高光。';render()}catch(e){$('clarityStatus').textContent='分析失败：'+e.message}};
$('clarityStrength').oninput=e=>{clarityCorrection.strength=+e.target.value;$('clarityStrengthValue').value=e.target.value;requestInteractiveRender()};$('clarityStrength').onchange=finishInteractiveRender;
$('protectHighlights').onchange=e=>{clarityCorrection.preserveHighlights=e.target.checked;render()};
if(clarityCorrection.strength){$('clarityControls').hidden=false;$('clarityStrength').value=clarityCorrection.strength;$('clarityStrengthValue').value=clarityCorrection.strength;$('protectHighlights').checked=clarityCorrection.preserveHighlights;$('clarityStatus').textContent=clarityCorrection.label+'，已应用层次优化。'}
syncPreview();previewResize=new ResizeObserver(fitPreview);previewResize.observe($('dialogContent').querySelector('.viewport'));previewResize.observe($('dialogContent').querySelector('.preview-image'));
}
function showLargePreview(){if(!states.target)return;previewResize?.disconnect();$('dialogContent').innerHTML='<style>'+previewCSS+'</style>'+previewMarkup;previewDoc=document;$('previewDialog').showModal();wirePreview()}
$('openPreview').onclick=showLargePreview;
$('closePreview').onclick=()=>$('previewDialog').close();$('previewDialog').onclose=()=>{previewDoc=null;previewResize?.disconnect()};
window.addEventListener('resize',fitPreview);
new MutationObserver(()=>{if(previewDoc)syncPreview()}).observe($('status'),{childList:true,subtree:true,characterData:true});
