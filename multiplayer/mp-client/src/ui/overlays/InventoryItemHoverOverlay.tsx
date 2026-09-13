import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {useStore} from '@tanstack/react-store';
import {inventoryItemHoverOverlayStore} from '../store/InventoryItemHoverOverlay.store';
import {inventoryDialogStore} from '../store/InventoryDialog.store';
import {useFullscreenPortalTarget} from '../hooks/utils';
import {useAdventure} from '../../adventure/store';
import {ItemEffect,type EquipmentSlot} from '../../constants/Items';

type Bonus={damage:number;defense:number;level:number;magic:number;mana:number;attackSpeed:number};
export function InventoryItemHoverOverlay(){
    const info=useStore(inventoryItemHoverOverlayStore,s=>s.hoverInfo),suppress=useStore(inventoryItemHoverOverlayStore,s=>s.suppressOverlay);
    const equipment=useStore(inventoryDialogStore,s=>s.equippedItems);
    const {stats}=useAdventure();const target=useFullscreenPortalTarget();
    const [rules,setRules]=useState<Record<string,Bonus>>();
    useEffect(()=>{const controller=new AbortController();fetch('/api/game/equipment-rules',{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(r=>setRules(r.equipment)).catch(()=>{});return()=>controller.abort();},[]);
    if(!info||suppress||!target)return null;
    const bonus=rules?.[info.itemId],equipped=equipment[info.itemType as EquipmentSlot];
    const effects=info.effectOverrides??[];
    const value=(effect:ItemEffect)=>effects.find(e=>e.effect===effect)?.effectColor??0;
    const rarity=value(ItemEffect.AFFIX_RARITY);
    const rarityName=['','Superior','Excepcional','Heroico','Mítico'][rarity]??'Especial';
    const affixRows:[ItemEffect,string,string][]=[
        [ItemEffect.AFFIX_DAMAGE,'Daño adicional','+'],[ItemEffect.AFFIX_DEFENSE,'Defensa adicional','+'],
        [ItemEffect.AFFIX_ATTACK_SPEED,'Velocidad de ataque','-'],[ItemEffect.AFFIX_CRITICAL,'Golpe crítico','‰'],
        [ItemEffect.AFFIX_POISON,'Envenenar','‰'],[ItemEffect.AFFIX_BURN,'Quemar','‰'],
        [ItemEffect.AFFIX_FREEZE,'Congelar','‰'],[ItemEffect.AFFIX_PARALYSIS,'Paralizar','‰'],
        [ItemEffect.AFFIX_LIFE_STEAL,'Robo de vida','%'],[ItemEffect.AFFIX_MANA_STEAL,'Recuperación de maná',''],
        [ItemEffect.AFFIX_HEALTH,'Vida máxima','+'],[ItemEffect.AFFIX_MANA,'Maná máximo','+'],
        [ItemEffect.AFFIX_GOLD_FIND,'Oro adicional','%'],[ItemEffect.AFFIX_EXPERIENCE_FIND,'Experiencia adicional','%'],
    ];
    const prefix:Partial<Record<ItemEffect,string>>={[ItemEffect.AFFIX_DAMAGE]:'Afilado',[ItemEffect.AFFIX_DEFENSE]:'Fortificado',[ItemEffect.AFFIX_POISON]:'Venenoso',[ItemEffect.AFFIX_BURN]:'Ígneo',[ItemEffect.AFFIX_FREEZE]:'Glacial',[ItemEffect.AFFIX_PARALYSIS]:'Fulminante',[ItemEffect.AFFIX_CRITICAL]:'Crítico',[ItemEffect.AFFIX_LIFE_STEAL]:'Vampírico',[ItemEffect.AFFIX_MANA_STEAL]:'Arcano',[ItemEffect.AFFIX_ATTACK_SPEED]:'Ágil',[ItemEffect.AFFIX_HEALTH]:'Vital',[ItemEffect.AFFIX_MANA]:'Sabio',[ItemEffect.AFFIX_GOLD_FIND]:'Próspero',[ItemEffect.AFFIX_EXPERIENCE_FIND]:'Iluminado'};
    const specialName=effects.find(e=>prefix[e.effect]);
    const previous=rules?.[equipped?.itemId??-1],alreadyEquipped=equipped?.itemUid===info.itemUid;
    const delta=(name:string,key:'damage'|'defense',current:number)=>{
        const difference=(bonus?.[key]??0)-(previous?.[key]??0);
        return <p className={difference>0?'item-gain':difference<0?'item-loss':''}>{name}: {current} → {current+difference} ({difference>0?'+':''}{difference})</p>;
    };
    return createPortal(<div role="tooltip" style={{position:'fixed',left:Math.max(8,Math.min(info.mouseX+15,window.innerWidth-278)),top:Math.max(8,Math.min(info.mouseY+20,window.innerHeight-260)),zIndex:30000,pointerEvents:'none',background:'#21170ffa',border:'1px solid #927341',borderRadius:6,boxShadow:'0 4px 16px #0009'}}>
        <div className="item-comparison"><h3 style={rarity?{color:`#${(info.appearanceGlowColor??0xffd166).toString(16).padStart(6,'0')}`}:{}}>{rarity?`${info.itemName} ${prefix[specialName?.effect as ItemEffect]??''} · ${rarityName}`:info.itemName}</h3>
        {!!rarity&&<><p>✦ Hallazgo especial de monstruo</p>{affixRows.filter(([effect])=>value(effect)>0).map(([effect,label,suffix])=><p className="item-gain" key={effect}>{label}: {suffix==='‰'?(value(effect)/10).toFixed(1)+'%':`${suffix}${value(effect)}${suffix==='%'?'%':''}`}</p>)}</>}
        {info.stackable&&<p>Cantidad: {info.quantity??1}</p>}
        {info.itemId===36?<p>Recupera hasta 50 de vida. Espera: 2 segundos.</p>:info.itemId===164?<p>Recupera hasta 180 de vida. Espera: 2 segundos.</p>:info.itemId===307?<p>Recupera hasta 500 de vida. Espera: 2 segundos.</p>:info.itemId===165?<p>Recupera hasta 40 de maná. Espera: 2 segundos.</p>:info.itemId===166?<p>Recupera hasta 150 de maná. Espera: 2 segundos.</p>:info.itemId===308?<p>Recupera hasta 420 de maná. Espera: 2 segundos.</p>:<>
            {!rules?<p>No se pudieron cargar las estadísticas todavía.</p>:<>
                <p>{[['Daño',bonus?.damage],['Defensa',bonus?.defense],['Magia',bonus?.magic],['Maná',bonus?.mana]].filter(x=>x[1]).map(x=>`${x[0]} +${x[1]}`).join(' · ')||'Sin bonificación directa de combate.'}</p>
                {!!bonus?.attackSpeed&&<p className={bonus.attackSpeed<0?'item-gain':'item-loss'}>Velocidad: {bonus.attackSpeed<0?'más rápida':'más lenta'} ({Math.abs(bonus.attackSpeed)} ms)</p>}
                <p className={(stats?.level??1)<Math.max(bonus?.level??1,value(ItemEffect.AFFIX_REQUIRED_LEVEL))?'item-loss':''}>Nivel requerido: {Math.max(bonus?.level??1,value(ItemEffect.AFFIX_REQUIRED_LEVEL))}</p>
                {alreadyEquipped?<p>✓ Equipado actualmente</p>:stats&&info.itemType!=='misc'&&<><p>Al reemplazar tu equipo actual:</p>{delta('Daño','damage',stats.damage)}{delta('Defensa','defense',stats.defense)}</>}
            </>}
        </>}
        {info.gender&&<p>Para personaje {info.gender==='female'?'femenino':'masculino'}.</p>}
        <p>{info.consumable?'Doble clic para usar.':info.source==='ground'?'Recogelo para equiparlo.':'Doble clic para equipar o arrastrar a su ranura.'}</p>
        </div>
    </div>,target);
}
