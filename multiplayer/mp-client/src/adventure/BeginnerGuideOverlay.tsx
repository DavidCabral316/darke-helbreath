import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {selectedCharacterId} from '../portal/api';
import {useFullscreenPortalTarget} from '../ui/hooks/utils';
import {useAdventure} from './store';

const pages=[
    '¡Por fin llegaste! Soy Lumi, exploradora del Gremio y tu guía durante estos primeros pasos. Estas tierras parecen tranquilas, pero la ciudad necesita aventureros como vos.',
    'Recorré las afueras y buscá slimes, hormigas, serpientes y escorpiones. Son criaturas apropiadas para comenzar: cada victoria te dará experiencia, oro y la posibilidad de encontrar equipo.',
    'Con el oro podrás comprar pociones, armas, armaduras y hechizos. Entrá por las puertas marcadas en el minimapa y hablá con sus habitantes. Avanzá con paciencia: en Helbreath, sobrevivir también es progresar.',
];

export function BeginnerGuideOverlay({blocked}:{blocked:boolean}){
    const {stats}=useAdventure();
    const level=stats?.level;
    const target=useFullscreenPortalTarget();
    const characterId=selectedCharacterId();
    const storageKey=useMemo(()=>characterId?`darke.beginner-guide.v1.${characterId}`:'',[characterId]);
    const [page,setPage]=useState(0);
    const [visible,setVisible]=useState(false);

    useEffect(()=>{
        if(blocked||level!==1||!storageKey)return;
        if(!localStorage.getItem(storageKey)){setPage(0);setVisible(true)}
    },[blocked,level,storageKey]);

    const finish=()=>{localStorage.setItem(storageKey,'1');setVisible(false)};
    if(blocked||!visible||!target)return null;
    const last=page===pages.length-1;
    return createPortal(<div className="npc-cinematic beginner-guide" role="dialog" aria-modal="true" aria-labelledby="beginner-guide-title">
        <button className="npc-cinematic-dismiss" onClick={finish} aria-label="Omitir introducción">×</button>
        <img className="npc-cinematic-character beginner-guide-character" src="/assets/darke/ui/guide-lumi.png" alt="Lumi, guía adulta del Gremio de Aventureros"/>
        <section className="npc-cinematic-box beginner-guide-box">
            <header><strong id="beginner-guide-title">Lumi</strong><span>Guía del Gremio de Aventureros · {page+1}/{pages.length}</span></header>
            <p key={page}>{pages[page]}</p>
            <button onClick={()=>last?finish():setPage(value=>value+1)}>{last?'Comenzar a explorar':'Siguiente'} <span>◆</span></button>
        </section>
    </div>,target);
}
