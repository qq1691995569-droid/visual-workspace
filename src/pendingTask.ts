type Task = {id?:string;requestId?:string;jobId?:string;status?:string;message?:string}
export function pendingTask<T extends Task>(jobId:string, source?:{imageJob?:T;skillState?:T}, fallback?:T):T|undefined {
 const matches=(task:T|undefined)=>task&&[task.id,task.jobId,task.requestId].includes(jobId)
 if(matches(source?.imageJob))return source!.imageJob
 if(matches(source?.skillState))return source!.skillState
 return fallback
}
