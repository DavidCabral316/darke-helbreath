import { useSyncExternalStore } from 'react';
import type { ProgressionUpdated } from '../proto/generated/network';
import { SPECIAL_LOOT_DROP_SOUND } from '../constants/SoundFileNames';
import { soundDialogStore } from '../ui/store/SoundDialog.store';
import {EventBus} from '../game/EventBus';
export const LUMI_EVENT='darke:lumi-event';
export type LumiEvent={kind:'level'|'loot'|'death';level?:number;points?:number};
export type EconomyAction={economy:{action:string;offerId?:string;itemUid?:string;revision:bigint}};
type Action = { attribute: string } | { potion: string } | EconomyAction;
let snapshot: {stats?: ProgressionUpdated; notice:string; connected:boolean} = {notice:'',connected:false};
const listeners = new Set<() => void>();
let owner: object | undefined; let sender: ((action:Action)=>void) | undefined;
export function publishAdventure(stats: ProgressionUpdated, source:object, send:(action:Action)=>void) {
    const previous=owner===source&&snapshot.connected?snapshot.stats:undefined;
    owner = source; sender = send;
    if (stats.notice.startsWith('✦ HALLAZGO ESPECIAL:')) {
        const volume=soundDialogStore.state.soundVolume/100;
        if(volume>0){const audio=new Audio(`/assets/sounds/${SPECIAL_LOOT_DROP_SOUND}`);audio.volume=volume;void audio.play().catch(()=>undefined);}
        EventBus.emit(LUMI_EVENT,{kind:'loot'} satisfies LumiEvent);
    }
    if(stats.notice==='Poción consumida.'){
        const volume=soundDialogStore.state.soundVolume/100;
        if(volume>0){const audio=new Audio('/assets/sounds/E21.mp3');audio.volume=volume*0.65;void audio.play().catch(()=>undefined);}
    }
    if(previous&&stats.level>previous.level)EventBus.emit(LUMI_EVENT,{kind:'level',level:stats.level,points:stats.points} satisfies LumiEvent);
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
