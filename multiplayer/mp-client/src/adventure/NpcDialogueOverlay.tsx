import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useFullscreenPortalTarget} from '../ui/hooks/utils';
import {useAdventure} from './store';
import {closeEconomyPanel,openEconomyPanel} from './economyUi';

const characters:Record<string,{name:string;role:string;image:string;line:string;accent:string}>={
    shop:{name:'Liora',role:'Mercader de Aresden',image:'/assets/darke/ui/npc-merchant-v2.png',line:'Bienvenido, viajero. Tengo provisiones para el camino y un encargo para quien no tema ensuciar su espada.',accent:'crimson'},
    blacksmith:{name:'Brunna',role:'Maestra de la Forja',image:'/assets/darke/ui/npc-blacksmith-v2.png',line:'El acero revela el carácter de quien lo empuña. Elige entre velocidad y fuerza; ninguna victoria se forja sin sacrificio.',accent:'ember'},
    warehouse:{name:'Selene',role:'Guardiana del Almacén',image:'/assets/darke/ui/npc-warehouse-v2.png',line:'Tus pertenencias estarán seguras bajo mi llave. Cada pieza conservará su identidad hasta que vuelvas a reclamarla.',accent:'sapphire'},
    magic:{name:'Vaeloria',role:'Archimaga de la Torre',image:'/assets/darke/ui/npc-archmage-v2.png',line:'La magia no responde a la fuerza bruta. Cultiva tu inteligencia, domina tu maná y los antiguos conjuros reconocerán tu voluntad.',accent:'arcane'},
};

export function NpcDialogueOverlay(){
    const {stats}=useAdventure(),target=useFullscreenPortalTarget();
    const service=stats?.service??'',lastService=useRef('');
    const [visible,setVisible]=useState(false);
    useEffect(()=>{
        if(service&&service!==lastService.current){lastService.current=service;closeEconomyPanel();setVisible(true)}
        if(!service){lastService.current='';closeEconomyPanel();setVisible(false)}
    },[service]);
    const character=characters[service];
    if(!visible||!character||!target)return null;
    return createPortal(<div className={`npc-cinematic ${character.accent}`} role="dialog" aria-modal="false" aria-label={`Diálogo con ${character.name}`}>
        <button className="npc-cinematic-dismiss" onClick={()=>setVisible(false)} aria-label="Cerrar diálogo">×</button>
        <img className="npc-cinematic-character" src={character.image} alt={`${character.name}, ${character.role}`}/>
        <section className="npc-cinematic-box">
            <header><strong>{character.name}</strong><span>{character.role}</span></header>
            <p>{character.line}</p>
            <button onClick={()=>{setVisible(false);openEconomyPanel()}}>Ver sus servicios <span>◆</span></button>
        </section>
    </div>,target);
}
