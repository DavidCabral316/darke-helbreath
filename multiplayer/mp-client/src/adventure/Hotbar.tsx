import {useEffect,useState} from 'react';
import {useStore} from '@tanstack/react-store';
import {useAdventure,adventureAction} from './store';
import {inventoryDialogStore,setInventoryDialogOpen} from '../ui/store/InventoryDialog.store';
import {castDialogStore,setCastDialogOpen} from '../ui/store/CastDialog.store';
import {setChatDialogOpen} from '../ui/store/ChatDialog.store';
import {EventBus} from '../game/EventBus';
import {IN_UI_CAST_SPELL} from '../constants/EventNames';
import {selectedCharacterId} from '../portal/api';

type Binding={code:string;action:string};
const spellNames=['Energy Bolt','Fire Ball','Fire Strike','Chill Wind','Poison Cloud','Triple Energy Bolt','Lightning Bolt','Spike Field','Fire Field','Ice Storm','Ice Strike','Energy Strike','Mass Fire Strike','Mass Chill Wind','Earthworm Strike','Armor Break','Bloody Shock Wave','Mass Ice Strike','Lightning Strike','Meteor Strike','Mass Lightning Strike','Blizzard','Earth Shock Wave','Mass Blizzard','Invisibility','Berserk'];
const actions=[['','Espacio libre'],['potion:36','Vida · pequeña'],['potion:165','Maná · pequeña'],['potion:164','Vida · mediana'],['potion:307','Vida · grande'],['potion:166','Maná · mediana'],['potion:308','Maná · grande'],...spellNames.map((name,id)=>[`spell:${id}`,name])];
const defaultActions=['potion:36','potion:165','','','','','','','',''];
const defaults:Binding[]=defaultActions.map((action,i)=>({code:i===9?'Digit0':`Digit${i+1}`,action}));
const validCode=(code:string)=>/^(Key[A-Z]|Digit[0-9]|F[1-9]|F10)$/.test(code);
const label=(code:string)=>code.replace('Digit','').replace('Key','');
function load(key:string):Binding[]{try{const b=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(b)&&b.length===10&&b.every(x=>x&&validCode(x.code)&&actions.some(a=>a[0]===x.action))&&new Set(b.map(x=>x.code)).size===10)return b;}catch{}return defaults;}
export function Hotbar(){
    const characterId=selectedCharacterId();
    return <CharacterHotbar key={characterId??'guest'} storageKey={`darke.hotkeys.v3.${characterId??'guest'}`}/>;
}
function CharacterHotbar({storageKey}:{storageKey:string}){
    const [bindings,setBindings]=useState(()=>load(storageKey));
    const [config,setConfig]=useState(false),[recording,setRecording]=useState<number|null>(null),[notice,setNotice]=useState('');
    const {stats,connected}=useAdventure();
    const bag=useStore(inventoryDialogStore,s=>s.baggedItems),spells=useStore(castDialogStore,s=>s.spells);
    const availableActions=actions.filter(([a])=>!a.startsWith('spell:')||stats?.knownSpells.includes(Number(a.split(':')[1])));
    const enabled=(action:string)=>{const [type,id]=action.split(':');return !!action&&connected&&!!stats?.hp&&(type==='potion'?bag.some(i=>i.itemId===Number(id)):!!stats?.knownSpells.includes(Number(id))&&spells.some(s=>s.id===Number(id)));};
    const run=(action:string)=>{
        if(!enabled(action))return;
        const [type,id]=action.split(':');
        if(type==='potion'){const item=bag.find(i=>i.itemId===Number(id));if(item)adventureAction({potion:item.itemUid});}
        else {EventBus.emit(IN_UI_CAST_SPELL,{spellId:Number(id)});setNotice('Hechizo preparado: elegí el objetivo sobre el mapa.');}
    };
    useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(bindings));}catch{setNotice('El navegador no permite guardar tus atajos.');}},[bindings,storageKey]);
    useEffect(()=>{
        const keydown=(e:KeyboardEvent)=>{
            if(e.isComposing||e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
            if(recording!==null){
                e.preventDefault();e.stopImmediatePropagation();
                if(e.code==='Escape'){setRecording(null);return;}
                if(!validCode(e.code)){setNotice('Usá letras, números o F1–F10. Escape cancela.');return;}
                if(bindings.some((b,i)=>i!==recording&&b.code===e.code)){setNotice('Esa tecla ya está asignada. Elegí otra.');return;}
                setBindings(b=>b.map((x,i)=>i===recording?{...x,code:e.code}:x));setRecording(null);setNotice('Atajo guardado en este navegador.');return;
            }
            if(e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
            const binding=bindings.find(b=>b.code===e.code);
            if(binding?.action){e.preventDefault();e.stopImmediatePropagation();run(binding.action);}
        };
        window.addEventListener('keydown',keydown,true);return()=>window.removeEventListener('keydown',keydown,true);
    },[bindings,recording,bag,spells,stats,connected]);
    return <><nav className="mobile-game-tabs" aria-label="Paneles del juego">{[['stats','Estado'],['inventory','Bolsa'],['chat','Chat'],['cast','Magia'],['hotbar','Atajos']].map(([id,name])=><button key={id} onClick={()=>{document.body.dataset.gamePanel=id;if(id==='inventory')setInventoryDialogOpen(true);if(id==='chat')setChatDialogOpen(true);if(id==='cast')setCastDialogOpen(true);}}>{name}</button>)}</nav><section className="hotbar" aria-label="Atajos rápidos">
        <header><strong>ATAJOS RÁPIDOS</strong><button onClick={()=>{setConfig(!config);setRecording(null);}}>{config?'Listo':'Configurar'}</button></header>
        {!config?<div className="hotbar-slots">{bindings.map((b,i)=><button key={i} className={`hotbar-slot ${b.action.startsWith('potion:')?([36,164,307].includes(Number(b.action.split(':')[1]))?'life':'mana'):b.action?'arcane':'empty'}`} title={actions.find(a=>a[0]===b.action)?.[1]} disabled={!!b.action&&!enabled(b.action)} onClick={()=>b.action?run(b.action):setConfig(true)}><kbd>{label(b.code)}</kbd><i aria-hidden="true">{!b.action?'+':b.action.startsWith('potion:')?'⚗':'✦'}</i><span>{actions.find(a=>a[0]===b.action)?.[1]}</span></button>)}</div>:<div className="hotbar-config">{bindings.map((b,i)=><label key={i}><button aria-label={`Cambiar tecla ${i+1}`} onClick={()=>{setRecording(i);setNotice('Presioná la nueva tecla. Escape cancela.');}}>{recording===i?'Tecla…':label(b.code)}</button><select aria-label={`Acción del atajo ${i+1}`} value={availableActions.some(a=>a[0]===b.action)?b.action:''} onChange={e=>setBindings(old=>old.map((x,j)=>j===i?{...x,action:e.target.value}:x))}>{availableActions.map(([a,n])=><option key={a} value={a}>{n}</option>)}</select></label>)}<button onClick={()=>{setBindings(defaults);setRecording(null);}}>Restablecer</button></div>}
        <p role="status">{notice||'Comprá y aprendé hechizos en el santuario para asignarlos. Atajo + clic en el objetivo; el chat no activa atajos.'}</p>
    </section></>;
}
