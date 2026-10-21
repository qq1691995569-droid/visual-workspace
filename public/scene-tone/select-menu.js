// Adapt the standalone workbench controls without changing their existing change handlers.
const style=document.createElement('link');style.rel='stylesheet';style.href='/scene-tone/select-menu.css';document.head.append(style)
let current
function close(){if(current){current.menu.remove();current.button.setAttribute('aria-expanded','false');current=null}}
function enhance(select){
 if(select.dataset.canvasSelect)return
 select.dataset.canvasSelect='true';select.hidden=true;select.style.setProperty('display','none','important')
 const button=document.createElement('button');button.type='button';button.className='tone-select';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false')
 const label=select.getAttribute('aria-label')||select.closest('label')?.textContent?.trim().slice(0,40)||'选择参数';button.setAttribute('aria-label',label)
 select.after(button)
 const sync=()=>{button.textContent=(select.selectedOptions[0]?.textContent||'请选择')+'  ⌄';button.disabled=select.disabled}
 sync();select.addEventListener('change',sync)
 new MutationObserver(sync).observe(select,{subtree:true,childList:true,attributes:true})
 button.onclick=()=>{
  if(current?.button===button){close();return}close()
  const menu=document.createElement('div');menu.className='tone-select-menu';menu.role='listbox';menu.setAttribute('aria-label',label)
  const rect=button.getBoundingClientRect(),width=Math.min(Math.max(rect.width,180),innerWidth-16),height=Math.min(290,select.options.length*44+18)
  menu.style.cssText=`left:${Math.max(8,Math.min(rect.left,innerWidth-width-8))}px;width:${width}px;max-height:${Math.max(40,Math.min(height,Math.max(rect.top-12,innerHeight-rect.bottom-12)))}px;top:${innerHeight-rect.bottom>height?rect.bottom+6:Math.max(8,rect.top-height-6)}px`
  Array.from(select.options).forEach(option=>{const item=document.createElement('button');item.type='button';item.role='option';item.textContent=option.textContent+(option.selected?'  ✓':'');item.disabled=option.disabled;item.setAttribute('aria-selected',String(option.selected));item.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close();button.focus()};menu.append(item)})
  ;(select.closest("dialog[open]")||document.body).append(menu);button.setAttribute('aria-expanded','true');current={button,menu}
  const first=menu.querySelector('[aria-selected=true]')||menu.querySelector('button:not(:disabled)');first?.focus()
  menu.onkeydown=e=>{const all=[...menu.querySelectorAll('button:not(:disabled)')],i=all.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();close();button.focus()}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();all[e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowDown'?1:-1)+all.length)%all.length]?.focus()}else if(e.key==='Tab')close()}
 }
}
const scan=()=>document.querySelectorAll('select:not([data-canvas-select])').forEach(enhance)
scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true})
document.addEventListener('pointerdown',e=>{if(current&&!current.menu.contains(e.target)&&!current.button.contains(e.target))close()},true)
window.addEventListener('resize',close)
