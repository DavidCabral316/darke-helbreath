import { useSyncExternalStore } from 'react';
import type { ProgressionUpdated } from '../proto/generated/network';
export type EconomyAction={economy:{action:string;offerId?:string;itemUid?:string;revision:bigint}};
type Action = { attribute: string } | { potion: string } | EconomyAction;
let snapshot: {stats?: ProgressionUpdated; notice:string; connected:boolean} = {notice:'',connected:false};
const listeners = new Set<() => void>();
let owner: object | undefined; let sender: ((action:Action)=>void) | undefined;
export function publishAdventure(stats: ProgressionUpdated, source:object, send:(action:Action)=>void) {
    owner = source; sender = send;
    snapshot = {stats, notice:stats.notice || snapshot.notice, connected:true};
    listeners.forEach(fn=>fn());
}
export function disconnectAdventure(source:object) {
    if (owner !== source) return;
    sender=undefined; snapshot={...snapshot,connected:false};listeners.forEach(fn=>fn());
}
export function adventureAction(action:Action) { sender?.(action); }
export function useAdventure() {
    return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>snapshot);
}
