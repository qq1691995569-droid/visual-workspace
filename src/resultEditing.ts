export function resultEditing(data: {tool?:string;iterationContext?:{tool:string};localEdit?:unknown}, source?:{tool?:string}) {
  const tool=data.iterationContext?.tool || source?.tool || data.tool || 'redraw'
  return {tool,skill:!!data.localEdit || ['style','material','light','furniture'].includes(tool)}
}
