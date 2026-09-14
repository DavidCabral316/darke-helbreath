import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {EventBus} from '../game/EventBus';
import {selectedCharacterId} from '../portal/api';
import {useFullscreenPortalTarget} from '../ui/hooks/utils';
import {LUMI_EVENT,type LumiEvent} from './store';

export function LumiEventOverlay(){
    return <CharacterLumi key={selectedCharacterId()} characterId={selectedCharacterId()??''}/>;
}
function CharacterLumi({characterId}:{characterId:string}){
    const target=useFullscreenPortalTarget();
    const [queue,setQueue]=useState<LumiEvent[]>([]);
    const [visible,setVisible]=useState(false);
    const current=queue[0];
    useEffect(()=>{
        const key=`darke.lumi-events.v1.${characterId}`;
        let counts:Record<string,number>={};
        try{const saved=JSON.parse(localStorage.getItem(key)||'{}');if(saved&&typeof saved==='object')counts=saved;}catch{}
        const receive=(event:LumiEvent)=>{
            const count=Number(counts[event.kind])||0;
            if(!characterId||count>=2)return;
            counts[event.kind]=count+1;
            try{localStorage.setItem(key,JSON.stringify(counts));}catch{}
            setQueue(q=>[...q,event]);
        };
        EventBus.on(LUMI_EVENT,receive);
        return()=>{EventBus.off(LUMI_EVENT,receive);};
    },[characterId]);
    useEffect(()=>{
        if(!current)return;
        setVisible(false);
        // Let the level-up burst finish; avoid covering a cinematic or commerce window.
        let timeout:number|undefined;
        const interval=window.setInterval(()=>{
            if(document.querySelector('.npc-cinematic,.economy-overlay'))return;
            clearInterval(interval);setVisible(true);
            timeout=window.setTimeout(()=>setQueue(q=>q.slice(1)),12000);
        },current.kind==='level'?2800:700);
        return()=>{clearInterval(interval);clearTimeout(timeout);};
    },[current]);
    if(!current||!visible||!target)return null;
    const message=current.kind==='level'?`¡Nivel ${current.level}! Ya tenés ${current.points} puntos para distribuir. Abrí Atributos y elegí cómo fortalecer a tu personaje.`:current.kind==='loot'?'¡Mirá ese brillo! Cayó un objeto especial. Revisá sus atributos y requisitos antes de equiparlo: cada hallazgo puede cambiar tu aventura.':'Lo siento… esta batalla fue demasiado. Reviví, reponé tus pociones y buscá enemigos de tu nivel. Podés guiarte por los portales del minimapa.';
    const emotion=current.kind==='level'?'happy':current.kind==='loot'?'surprised':'sad';
    return createPortal(<aside className={`lumi-event lumi-${emotion}`} aria-label="Consejo de Lumi">
        <img src={`/assets/darke/ui/guide-lumi-${emotion}.png`} alt={`Lumi ${emotion==='sad'?'triste':emotion==='happy'?'alegre':'sorprendida'}`}/>
        <section role="status"><header><span>✦ LUMI · TU GUÍA</span><button aria-label="Cerrar consejo" onClick={()=>setQueue(q=>q.slice(1))}>×</button></header><p>{message}</p><small>Consejo introductorio · desaparece en unos segundos</small></section>
    </aside>,target);
}
