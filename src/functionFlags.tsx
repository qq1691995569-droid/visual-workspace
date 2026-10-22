import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
type Flags={ready:boolean;features:{id:string;enabled:boolean}[]}
const Context=createContext<Flags>({ready:false,features:[]})
export function FunctionFlagsProvider({children}:{children:ReactNode}){
 const [flags,setFlags]=useState<Flags>({ready:false,features:[]})
 useEffect(()=>{let active=true;const controller=new AbortController()
  const refresh=async()=>{try{const r=await fetch('/api/skills/functions',{signal:controller.signal});if(!r.ok)throw Error();const d=await r.json();if(!Array.isArray(d.features))throw Error();if(active)setFlags({ready:true,features:d.features})}catch{/* Keep the last confirmed flags; no speculative re-enabling. */}}
  void refresh();const timer=setInterval(()=>void refresh(),60000);const focus=()=>void refresh();window.addEventListener('focus',focus)
  return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',focus)}
 },[])
 return <Context.Provider value={flags}>{children}</Context.Provider>
}
export function useFunctionEnabled(){const {ready,features}=useContext(Context);return (id:string)=>ready&&features.find(f=>f.id===(id==='furniture'?'model':id))?.enabled!==false}
