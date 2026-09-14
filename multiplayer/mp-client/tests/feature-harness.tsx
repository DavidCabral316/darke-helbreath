// Browser component fixture only. Never imported by the production bundle.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Hotbar} from '../src/adventure/Hotbar';
import {EconomyPanel} from '../src/adventure/EconomyPanel';
import {LumiEventOverlay} from '../src/adventure/LumiEventOverlay';
import {publishAdventure} from '../src/adventure/store';
import {ProgressionUpdated} from '../src/proto/generated/network';
import '../src/adventure/workspace.css';
import '../src/adventure/adventure.css';
import '../src/adventure/theme.css';
const owner={};
export function update(knownSpells:number[]=[],service=''){
    publishAdventure(ProgressionUpdated.fromPartial({level:30,hp:200,maxHp:300,mana:80,maxMana:100,intelligence:10,points:6,knownSpells,service,gold:500,worldId:'aresden'}),owner,()=>{});
}
export function mount(){
    history.replaceState(null,'','/play/00000000-0000-0000-0000-000000000001');
    document.getElementById('root')!.style.display='none';document.body.classList.add('adventure-workspace');
    const node=document.createElement('div');document.body.appendChild(node);
    update();createRoot(node).render(<><Hotbar/><EconomyPanel/><LumiEventOverlay/></>);
}
