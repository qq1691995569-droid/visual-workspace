import {useEffect,useState} from 'react'
type Task={provider?:string;id:string;taskId?:string;feature:string;status:string;stage:string;message:string;createdAt?:string;updatedAt?:string;remoteStatus?:string;phase?:number;images:number}
const taskStates={complete:'已完成',running:'处理中',failed:'失败',attention:'待核对'}
type TaskState=keyof typeof taskStates
function taskState(task:Task):TaskState{
 if(task.status==='submission_unknown'||/不确定|记录不足/.test(task.stage))return 'attention'
 if(/失败/.test(task.stage)||['failed','error','rejected'].includes(task.remoteStatus||task.status))return 'failed'
 if(task.status==='complete')return 'complete'
 if(['paused','cancelled','connection_lost','needs_attention','download_pending'].includes(task.status)||task.remoteStatus==='cancelled')return 'attention'
 return 'running'
}
export function TaskMonitor({adminKey}:{adminKey:string}){
 const [tasks,setTasks]=useState<Task[]>([]),[error,setError]=useState(''),[time,setTime]=useState(''),[refresh,setRefresh]=useState(0),[filter,setFilter]=useState('')
 const [stateFilter,setStateFilter]=useState<TaskState|'all'>('all')
 const visibleTasks=tasks.filter(t=>(stateFilter==='all'||taskState(t)===stateFilter)&&[t.id,t.taskId,t.feature,t.message,t.stage].join(' ').toLowerCase().includes(filter.toLowerCase()))
 useEffect(()=>{let active=true;let controller:AbortController;let timer:ReturnType<typeof setTimeout>
  async function read(){controller=new AbortController();try{const response=await fetch('/api/skills/config-admin/tasks',{headers:{Authorization:'Bearer '+adminKey},signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'读取失败');if(active){setTasks(data.tasks);setTime(data.checkedAt);setError(data.unreadable?`${data.unreadable} 条记录无法读取`:'')}}catch(e){if(active)setError(e instanceof Error?e.message:'读取失败')}finally{if(active)timer=setTimeout(read,15000)}}
  void read();return()=>{active=false;controller?.abort();clearTimeout(timer)}
 },[adminKey,refresh])
 return <section className="ui-panel-card admin-editor admin-task-monitor"><div className="admin-editor-heading"><h2>任务监控</h2><button onClick={()=>setRefresh(v=>v+1)}>刷新</button></div><p>本机最近 100 条记录 · 每 15 秒更新 · 只读取状态，不重试生图。其他同事电脑上的任务不会自动汇总到这里。</p><div className="admin-task-filters" role="group" aria-label="按任务状态筛选">{(['all',...Object.keys(taskStates)] as (TaskState|'all')[]).map(state=><button type="button" key={state} data-tone={state} aria-pressed={stateFilter===state} onClick={()=>setStateFilter(state)}>{state!=='all'&&<i className="task-status-dot" aria-hidden="true"/>}{state==='all'?'全部':taskStates[state]}<span>{state==='all'?tasks.length:tasks.filter(t=>taskState(t)===state).length}</span></button>)}</div><input aria-label="搜索任务" placeholder="搜索任务编号、功能或报错" value={filter} onChange={e=>setFilter(e.target.value)}/><p role="status">{error|| (time?'更新于 '+new Date(time).toLocaleTimeString():'正在加载…')}</p><div className="admin-task-list">{visibleTasks.map(t=><article className="admin-task-item" key={t.id}><div className="admin-editor-heading"><strong>{({material:'材质优化',model:'模型替换',image:'图像生成',style:'风格转换',light:'光影优化'} as Record<string,string>)[t.feature]||t.feature}</strong><span className="task-status-badge" data-tone={taskState(t)}><i className="task-status-dot" aria-hidden="true"/>{taskStates[taskState(t)]}</span></div><div className="admin-task-meta"><span>{t.stage}</span><span>{t.createdAt?new Date(t.createdAt).toLocaleString():'历史任务'}</span></div><p>{t.message||'暂无详细原因'}</p><details><summary>查看任务详情</summary><dl><dt>本地任务</dt><dd>{t.id}</dd><dt>{t.provider==='liblib'?'Liblib 任务':'DREO 任务'}</dt><dd>{t.taskId||'未记录任务编号（不代表一定未提交）'}</dd><dt>记录状态</dt><dd>{t.status} {t.remoteStatus?' / DREO：'+t.remoteStatus:''}</dd><dt>执行进度</dt><dd>{t.phase?`步骤 ${t.phase}/4 · `:''}已保存 {t.images} 张</dd><dt>创建时间</dt><dd>{t.createdAt?new Date(t.createdAt).toLocaleString():'历史记录未保存'}</dd></dl></details></article>)}</div>{time&&!visibleTasks.length&&<p>{tasks.length?'没有符合筛选条件的任务':'暂无任务记录'}</p>}</section>
}
