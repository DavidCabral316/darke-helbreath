import { useEffect, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { adventureAction, useAdventure } from './store';
import { inventoryDialogStore, toggleInventoryDialog, setInventoryDialogOpen } from '../ui/store/InventoryDialog.store';
import { toggleCastDialog, setCastDialogOpen } from '../ui/store/CastDialog.store';
import { toggleControlsDialog } from '../ui/store/ControlsDialog.store';
import { monsterHoverOverlayStore } from '../ui/store/MonsterHoverOverlay.store';
import './adventure.css';
import {EconomyPanel} from './EconomyPanel';
import {GameMasterPanel} from './GameMasterPanel';
import {NpcDialogueOverlay} from './NpcDialogueOverlay';
import {BeginnerGuideOverlay} from './BeginnerGuideOverlay';
import {LevelUpCelebration} from './LevelUpCelebration';

function Meter({name,value,max,kind}:{name:string;value:number;max:number;kind:string}) {
    return <div className={`adventure-meter ${kind}`}><div style={{width:`${Math.min(100,100*value/Math.max(1,max))}%`}}/><span>{name} <b>{value} / {max}</b></span></div>;
}
export function AdventureHud() {
    const {stats:s,notice,connected} = useAdventure();
    const [attributes,setAttributes] = useState(false);
    const [help,setHelp] = useState(!sessionStorage.getItem('darke.adventure.welcome'));
    const [intro,setIntro] = useState(!localStorage.getItem('darke.lore.intro'));
    const bag = useStore(inventoryDialogStore,s=>s.baggedItems);
    const target = useStore(monsterHoverOverlayStore,s=>s.monsterInfo);
    const worldId=s?.worldId;
    useEffect(()=>{if(worldId)document.body.dataset.worldId=worldId;else delete document.body.dataset.worldId;return()=>{delete document.body.dataset.worldId;}},[worldId]);
    if (!s) return null;
    const drink = (itemId:number) => { const item=bag.find(i=>i.itemId===itemId); if(item) adventureAction({potion:item.itemUid}); };
    const count = (id:number) => bag.filter(i=>i.itemId===id).reduce((n,i)=>n+(i.quantity ?? 1),0);
    const xp = Number(s.experience-s.levelStart); const xpMax = Number(s.nextLevel-s.levelStart);
    const worldNames:Record<string,string>={training:'Patio de iniciación',aresden:'Aresden',elvine:'Elvine',middleland:'Middleland','darke-shop':'Mercado del Umbral','darke-vault':'Almacén del Umbral','darke-bsmith':'Forja del Umbral','darke-magic':'Santuario arcano',areshop:'Tienda de Aresden',arewrus:'Almacén de Aresden',arebsmith:'Forja de Aresden',arewzdtwr:'Santuario de Aresden',elvshop:'Tienda de Elvine',elvwrus:'Almacén de Elvine',elvbsmith:'Forja de Elvine',elvwzdtwr:'Santuario de Elvine'};
    const location=worldNames[s.worldId]??s.worldId??(s.sanctuary?'✦ Refugio seguro':'Tierras desconocidas');
    return <><aside className="adventure-hud" aria-label="Estado del aventurero">
        <header><span>PRIMERA AVENTURA</span><strong>Nivel {s.level}</strong></header>
        <div className="adventure-location">{location} · {s.x}, {s.y}</div>
        <div className="adventure-gold">🪙 {s.gold} oro</div>
        <Meter name="Vida" value={s.hp} max={s.maxHp} kind="health"/>
        <Meter name="Maná" value={s.mana} max={s.maxMana} kind="mana"/>
        <Meter name="Energía" value={s.stamina} max={s.maxStamina} kind="stamina"/>
        {s.level<s.maxLevel?<Meter name="XP" value={xp} max={xpMax} kind="xp"/>:<p className="adventure-complete">✓ Tramo 1–{s.maxLevel} completado</p>}
        <div className="adventure-actions"><button disabled={!connected || s.hp===0 || !count(36)} onClick={()=>drink(36)}>Vida +50 · {count(36)}</button><button disabled={!connected || s.hp===0 || !count(165)} onClick={()=>drink(165)}>Maná +40 · {count(165)}</button></div>
        <div className="adventure-actions"><button onClick={()=>{if(window.innerWidth<=900){document.body.dataset.gamePanel='inventory';setInventoryDialogOpen(true);}else toggleInventoryDialog();}}>Inventario</button><button onClick={()=>{if(window.innerWidth<=900){document.body.dataset.gamePanel='cast';setCastDialogOpen(true);}else toggleCastDialog();}}>Magia</button></div>
        <button className="adventure-wide" onClick={()=>setAttributes(!attributes)} aria-expanded={attributes}>Atributos {s.points>0?`· ${s.points} puntos disponibles`:'y equipo'} {attributes?'−':'+'}</button>
        {attributes&&<section aria-label="Distribuir atributos"><p className="adventure-small">3 puntos por nivel. La asignación es permanente en esta alfa.</p>{[
            ['strength','Fuerza',s.strength,'Daño físico'],['vitality','Vitalidad',s.vitality,'Vida y defensa'],['intelligence','Inteligencia',s.intelligence,'Maná, magia y lanzamiento'],['agility','Agilidad',s.agility,'Velocidad, defensa y energía']
        ].map(([key,label,value,description])=><div className="adventure-attribute" key={key}><span>{label}<small>{description}</small></span><b>{value}</b><button aria-label={`Mejorar ${label}`} disabled={!connected || s.points<1 || s.hp===0} onClick={()=>adventureAction({attribute:String(key)})}>+</button></div>)}
            <p className="adventure-small">Daño {s.damage} · Defensa {s.defense} · Magia {s.magicDamage}</p><p className="adventure-small">Equipo: armas, escudos, torso, hauberk, piernas, casco, botas y capa. Túnicas y gorros también pueden mejorar magia y maná.</p>
        </section>}
        {target&&<section className="adventure-target"><b>{target.name}</b><Meter name="Objetivo" value={target.hp} max={target.maxHp} kind="health"/></section>}
        <p className="adventure-notice" role="status">{!connected?'Conexión interrumpida.':notice || 'Tu historia comienza en el refugio.'}</p>
        <EconomyPanel/>
        <GameMasterPanel/>
        <LevelUpCelebration/>
        <div className="adventure-actions"><button onClick={()=>setHelp(!help)}>Primeros pasos</button><button onClick={toggleControlsDialog}>Menú del juego</button></div>
        {help&&<section className="adventure-help"><h2>Del refugio al primer combate</h2><ol><li>Movete con clic sobre el suelo. El refugio está alrededor de 150,150.</li><li>Buscá slimes cerca de <b>141,140</b>. Hacé clic sobre un enemigo en modo ataque.</li><li>Después probá hormigas (132,141), serpientes (141,132) y orcos (132,132).</li><li>Cada muerte da XP y oro. Recogé el botín haciendo clic; también pueden caer piezas de armadura.</li><li>Los comercios ahora son lugares físicos: cruzá la puerta de cada edificio y acercate a su NPC.</li><li>La tienda vende pociones, la forja armas y armaduras, el almacén guarda objetos y el santuario enseña magia.</li><li>Las salidas de la ciudad conducen a Middleland; desde allí podés viajar entre Aresden y Elvine.</li><li>Al morir, elegí Volver al refugio. No perdés XP, oro ni equipo.</li></ol><button onClick={()=>{sessionStorage.setItem('darke.adventure.welcome','1');setHelp(false);}}>Entendido, ¡a explorar!</button></section>}
    </aside><NpcDialogueOverlay/><BeginnerGuideOverlay blocked={intro}/>{intro&&<div className="lore-backdrop" role="dialog" aria-modal="true" aria-labelledby="lore-title"><section className="lore-intro"><div><span>CRÓNICAS DE HELBREATH</span><h1 id="lore-title">Dos reinos. Una tierra herida.</h1><p>Aresden y Elvine disputan desde hace generaciones el corazón de Middleland. Entre portales antiguos, criaturas corrompidas y secretos arcanos, una nueva estirpe de aventureros decidirá si este mundo encuentra equilibrio… o arde para siempre.</p><button onClick={()=>{localStorage.setItem('darke.lore.intro','1');setIntro(false)}}>Comenzar mi historia</button></div></section></div>}</>;
}
