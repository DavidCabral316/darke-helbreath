import {useSyncExternalStore} from 'react';
let open=false;
const listeners=new Set<()=>void>();
function publish(value:boolean){open=value;listeners.forEach(listener=>listener())}
export const openEconomyPanel=()=>publish(true);
export const closeEconomyPanel=()=>publish(false);
export function useEconomyPanelOpen(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener)},()=>open)}
