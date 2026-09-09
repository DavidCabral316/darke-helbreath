import {useEffect,useMemo,useState} from 'react';
import {useStore} from '@tanstack/react-store';
import {adventureAction,useAdventure} from './store';
import {inventoryDialogStore} from '../ui/store/InventoryDialog.store';
import {appStore} from '../ui/store/App.store';
import {Gender} from '../Types';
import {getItemById,getItemInventorySpriteKeyWithOverrides} from '../constants/Items';

type Offer={id:string;name:string;service:string;price:number;itemId:number;spellId:number;level:number;intelligence:number};
type Quest={id:string;name:string;service:string;description:string;requiredKills:number;gold:number;itemId:number};
export function EconomyPanel(){
 const {stats,connected}=useAdventure();
 const bag=useStore(inventoryDialogStore,s=>s.baggedItems),gender=useStore(inventoryDialogStore,s=>s.playerGender);
 const spriteFrames=useStore(appStore,s=>s.spriteFrameMap);
 const [offers,setOffers]=useState<Offer[]>([]),[quests,setQuests]=useState<Quest[]>([]),[open,setOpen]=useState(true);
 useEffect(()=>{const c=new AbortController();fetch('/api/game/economy',{signal:c.signal}).then(r=>r.ok?r.json():Promise.reject()).then(r=>{setOffers(r.offers??[]);setQuests(r.quests??[])}).catch(()=>{});return()=>c.abort();},[]);
 const byItem=useMemo(()=>new Map(offers.filter(o=>o.itemId).map(o=>[o.itemId,o])),[offers]);
 if(!stats?.service)return null;
 const send=(action:string,offerId='',itemUid='')=>adventureAction({economy:{action,offerId,itemUid,revision:stats.tradeRevision}});
 const title=stats.service==='shop'?'Mercado y provisiones':stats.service==='blacksmith'?'Forja y armaduras':stats.service==='magic'?'Santuario arcano':'Almacén personal';
 const rows=offers.filter(o=>o.service===stats.service);
 const serviceQuests=quests.filter(q=>q.service===stats.service);
 const icon=(o:Offer)=>{if(!o.itemId)return <span className="economy-icon">✦</span>;const item=getItemById(o.itemId),key=item&&getItemInventorySpriteKeyWithOverrides(item,gender??Gender.MALE),src=key&&spriteFrames.get(key);return <span className="economy-icon">{src?<img src={src} alt=""/>:'◇'}</span>};
 return <section className="economy" aria-label={title}>
  <button className="adventure-wide economy-heading" onClick={()=>setOpen(!open)} aria-expanded={open}><b>🪙 {stats.gold} oro</b><span>{title} {open?'−':'+'}</span></button>
  {open&&<div className="economy-body">
   {serviceQuests.length>0&&<section className="quest-list"><h3>Encargos</h3>{serviceQuests.map(q=>{const globalIndex=quests.findIndex(x=>x.id===q.id),claimed=(stats.questRewardsMask&(1<<globalIndex))!==0,ready=stats.kills>=q.requiredKills;return <div className={`quest-card ${claimed?'completed':''}`} key={q.id}><strong>{claimed?'✓ ':ready?'! ':''}{q.name}</strong><p>{q.description}</p><small>Progreso: {Math.min(stats.kills,q.requiredKills)} / {q.requiredKills} · {q.gold} oro{q.itemId?` · ${getItemById(q.itemId)?.name??'objeto'}`:''}</small><button disabled={!connected||claimed||!ready} onClick={()=>send('quest-claim',q.id)}>{claimed?'Completada':ready?'Cobrar':'En progreso'}</button></div>})}</section>}
   {(stats.service==='shop'||stats.service==='blacksmith'||stats.service==='magic')&&<>{rows.map(o=>{const known=o.spellId>=0&&stats.knownSpells.includes(o.spellId),requiresInt=o.spellId>=0&&o.intelligence>10;return <div className="economy-row" key={o.id}>{icon(o)}<span>{o.name}<small>Nivel {o.level}{requiresInt?` · INT ${o.intelligence}`:''}</small></span><button disabled={!connected||known||stats.level<o.level||stats.intelligence<o.intelligence||stats.gold<o.price} onClick={()=>send('buy',o.id)}>{known?'Aprendido':`${o.price} oro`}</button></div>;})}{(stats.service==='shop'||stats.service==='blacksmith')&&<><h3>Vender objetos</h3>{bag.filter(i=>byItem.get(i.itemId)?.service===stats.service).map(i=>{const o=byItem.get(i.itemId)!;return <div className="economy-row" key={i.itemUid}>{icon(o)}<span>{o.name}<small>Pila: {i.quantity??1}</small></span><button onClick={()=>send('sell','',i.itemUid)}>+{Math.max(1,Math.floor(o.price/5))*(i.quantity??1)}</button></div>})}</>}</>}
   {stats.service==='warehouse'&&<><h3>Mochila → almacén</h3>{bag.map(i=><div className="economy-row" key={i.itemUid}><span>{getItemById(i.itemId)?.name??`Objeto desconocido`}<small>Cantidad {i.quantity??1}</small></span><button onClick={()=>send('deposit','',i.itemUid)}>Guardar</button></div>)}<h3>Almacén → mochila</h3>{stats.warehouse.map(i=><div className="economy-row" key={i.itemUid.toString()}><span>{getItemById(i.itemId)?.name??`Objeto desconocido`}<small>Cantidad {i.quantity??1}</small></span><button onClick={()=>send('withdraw','',i.itemUid.toString())}>Retirar</button></div>)}</>}
   <p className="economy-exit">Para salir, cruzá nuevamente la puerta del edificio.</p>
  </div>}
 </section>;
}
