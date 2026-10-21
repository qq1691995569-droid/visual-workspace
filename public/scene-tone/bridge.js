// Local canvas integration. Only the same-origin parent may send images.
const session = new URLSearchParams(location.search).get('session');
const send = (type, data = {}) => parent.postMessage({type, session, ...data}, location.origin);
const previewOnly = new URLSearchParams(location.search).get('preview') === '1';
if(previewOnly)document.documentElement.classList.add('canvas-preview');
let savedParameters, previewOpened=false;
function openCanvasPreview(expectedReference){
  if(!previewOnly || previewOpened || !states.target || expectedReference && !states.reference)return;
  if(savedParameters){
    setValues(Object.fromEntries(defs.map(([id,,, ,fallback])=>[id,Number.isFinite(savedParameters[id])?savedParameters[id]:fallback])));
    if(savedParameters.cast)castCorrection=savedParameters.cast;
    if(savedParameters.clarity)clarityCorrection=savedParameters.clarity;
    render();
  }
  previewOpened=true;
  showLargePreview();
  const handle=$('divider')?.querySelector('.drag-handle');
  if(handle){handle.className='comparison-handle';handle.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 7-5 5 5 5m6-10 5 5-5 5"/></svg>'}

  $('closePreview').hidden=true;
  if(states.reference){$('comparisonMode').value='reference';$('comparisonMode').onchange()}
  const apply=document.createElement('button');apply.textContent='保存为新图片';apply.onclick=()=>document.getElementById('canvasApply').click();
  $('dialogContent').querySelector('.bar').append(apply);
  send('tone:preview-ready');
}
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.session !== session) return;
  const {type, blob, name} = event.data;
  if (type === 'tone:image' && blob instanceof Blob) {
    const key = event.data.key === 'reference' ? 'reference' : 'target';
    await loadImage(key, new File([blob], name || 'canvas.png', {type: blob.type}));
    if(!states[key]){send('tone:error',{message:$('status').textContent || '图片解码失败'});return}
    if(key==='target')savedParameters=event.data.parameters;
    openCanvasPreview(event.data.expectedReference);
  }
});
if (parent !== window && session) {
  const button = document.createElement('button');
  button.id='canvasApply';
  button.className = 'primary';
  button.textContent = '应用到画布';
  button.onclick = async () => {
    if (busy || !states.target) return;
    button.disabled = true;
    try { await exportImage(async blob => {
      send('tone:result', {blob, parameters:parameters()});
      status('调色结果已发送到画布。');
    }); } finally { button.disabled = false; }
  };
  document.querySelector('header').append(button);
  send('tone:ready');
}
