import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {useStore} from '@tanstack/react-store';
import {inventoryItemHoverOverlayStore} from '../store/InventoryItemHoverOverlay.store';
import {inventoryDialogStore} from '../store/InventoryDialog.store';
import {useFullscreenPortalTarget} from '../hooks/utils';
import {useAdventure} from '../../adventure/store';
import type {EquipmentSlot} from '../../constants/Items';

type Bonus={damage:number;defense:number;level:number;magic:number;mana:number};
export function InventoryItemHoverOverlay(){
    const info=useStore(inventoryItemHoverOverlayStore,s=>s.hoverInfo),suppress=useStore(inventoryItemHoverOverlayStore,s=>s.suppressOverlay);
    const equipment=useStore(inventoryDialogStore,s=>s.equippedItems);
    const {stats}=useAdventure();const target=useFullscreenPortalTarget();
    const [rules,setRules]=useState<Record<string,Bonus>>();
    useEffect(()=>{const controller=new AbortController();fetch('/api/game/equipment-rules',{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(r=>setRules(r.equipment)).catch(()=>{});return()=>controller.abort();},[]);
    if(!info||suppress||!target)return null;
    const bonus=rules?.[info.itemId],equipped=equipment[info.itemType as EquipmentSlot];
    const previous=rules?.[equipped?.itemId??-1],alreadyEquipped=equipped?.itemUid===info.itemUid;
    const delta=(name:string,key:'damage'|'defense',current:number)=>{
        const difference=(bonus?.[key]??0)-(previous?.[key]??0);
        return <p className={difference>0?'item-gain':difference<0?'item-loss':''}>{name}: {current} → {current+difference} ({difference>0?'+':''}{difference})</p>;
    };
    return createPortal(<div role="tooltip" style={{position:'fixed',left:Math.max(8,Math.min(info.mouseX+15,window.innerWidth-278)),top:Math.max(8,Math.min(info.mouseY+20,window.innerHeight-260)),zIndex:30000,pointerEvents:'none',background:'#21170ffa',border:'1px solid #927341',borderRadius:6,boxShadow:'0 4px 16px #0009'}}>
        <div className="item-comparison"><h3>{info.itemName}</h3>
        {info.stackable&&<p>Cantidad: {info.quantity??1}</p>}
        {info.itemId===36?<p>Recupera hasta 50 de vida. Espera: 2 segundos.</p>:info.itemId===165?<p>Recupera hasta 40 de maná. Espera: 2 segundos.</p>:<>
            {!rules?<p>No se pudieron cargar las estadísticas todavía.</p>:<>
                <p>{[['Daño',bonus?.damage],['Defensa',bonus?.defense],['Magia',bonus?.magic],['Maná',bonus?.mana]].filter(x=>x[1]).map(x=>`${x[0]} +${x[1]}`).join(' · ')||'Sin bonificación de combate en esta alfa.'}</p>
                <p className={(stats?.level??1)<(bonus?.level??1)?'item-loss':''}>Nivel requerido: {bonus?.level??1}</p>
                {alreadyEquipped?<p>✓ Equipado actualmente</p>:stats&&info.itemType!=='misc'&&<><p>Al reemplazar tu equipo actual:</p>{delta('Daño','damage',stats.damage)}{delta('Defensa','defense',stats.defense)}</>}
            </>}
        </>}
        {info.gender&&<p>Para personaje {info.gender==='female'?'femenino':'masculino'}.</p>}
        <p>{info.consumable?'Doble clic para usar.':info.source==='ground'?'Recogelo para equiparlo.':'Doble clic para equipar o arrastrar a su ranura.'}</p>
        </div>
    </div>,target);
}
