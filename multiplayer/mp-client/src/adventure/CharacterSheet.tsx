import {useEffect,useMemo,useRef,useState} from 'react';
import {useStore} from '@tanstack/react-store';
import {inventoryDialogStore} from '../ui/store/InventoryDialog.store';
import {playerDialogStore} from '../ui/store/PlayerDialog.store';
import {Gender} from '../Types';
import {PlayerAppearanceManager,PlayerState} from '../utils/PlayerAppearanceManager';
import {loadHelbreathSprite} from '../portal/Preview';
import {useAdventure} from './store';
import {activeCharacterName} from '../portal/api';

export function EquippedCharacterPreview(){
 const canvas=useRef<HTMLCanvasElement>(null),equipped=useStore(inventoryDialogStore,s=>s.equippedItems);
 const gender=useStore(playerDialogStore,s=>s.gender),skin=useStore(playerDialogStore,s=>s.skinColor);
 const hair=useStore(playerDialogStore,s=>s.hairStyleIndex),clothes=useStore(playerDialogStore,s=>s.underwearColorIndex);
 const [error,setError]=useState(false);
 const signature=useMemo(()=>Object.entries(equipped).map(([slot,item])=>`${slot}:${item?.itemId??0}`).join('|'),[equipped]);
 useEffect(()=>{let cancelled=false,timer:ReturnType<typeof setInterval>|undefined;const bitmaps:ImageBitmap[]=[];setError(false);
  async function start(){
   const base={human:PlayerAppearanceManager.getHumanSpriteName(gender,skin),hairStyleIndex:hair,underwearColorIndex:clothes};
   const gear=PlayerAppearanceManager.resolveGearFromEquippedItems(base,equipped,gender);
   const allowed=new Set([gear.human,gear.underwear,gear.hauberk,gear.leggings,gear.boots,gear.helm,gear.armor,gear.cape,gear.weapon,gear.shield,gear.accessory,gender===Gender.MALE?'mhr':'whr'].filter(Boolean));
   let configs=PlayerAppearanceManager.buildAssetConfigs(4,PlayerState.IdlePeaceMode,gear).configs.filter(config=>allowed.has(config.spriteName));
   if(gear.helm)configs=configs.filter(c=>c.spriteName!==(gender===Gender.MALE?'mhr':'whr'));
   const layers=(await Promise.all(configs.map(async config=>{
    const sheet=(await loadHelbreathSprite(config.spriteName))[config.spriteSheetIndex??0];if(!sheet)return null;
    const bitmap=await createImageBitmap(sheet.png);if(cancelled){bitmap.close();return null}bitmaps.push(bitmap);return{config,sheet,bitmap};
   }))).filter(Boolean) as Array<{config:(typeof configs)[number];sheet:Awaited<ReturnType<typeof loadHelbreathSprite>>[number];bitmap:ImageBitmap}>;
   let tick=0;const draw=()=>{const ctx=canvas.current?.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,220,220);ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(110,181,42,10,0,0,Math.PI*2);ctx.fill();
    for(const {config,sheet,bitmap} of layers){const directional=config.animationType==='DirectionalSubFrame';const count=directional?(config.framesPerDirection??8):sheet.frames.length;const start=directional?(config.direction??0)*count:0;const frame=sheet.frames[start+(tick%Math.max(1,count))];if(frame?.w&&frame.h)ctx.drawImage(bitmap,frame.x,frame.y,frame.w,frame.h,110+frame.px*2,178+frame.py*2,frame.w*2,frame.h*2)}tick++};
   draw();timer=setInterval(draw,180);
  }
  start().catch(()=>{if(!cancelled)setError(true)});return()=>{cancelled=true;clearInterval(timer);bitmaps.forEach(b=>b.close())};
 },[gender,skin,hair,clothes,signature,equipped]);
 return <div className="equipped-character-preview"><canvas ref={canvas} width={220} height={220} role="img" aria-label="Personaje con su equipo actual"/>{error&&<small>Vista no disponible</small>}</div>;
}

export function CharacterStatsCard(){
 const {stats:s}=useAdventure();if(!s)return null;
 const currentXp=Number(s.experience-s.levelStart),needed=Number(s.nextLevel-s.levelStart);
 return <section className="character-stats-card" aria-label="Estadísticas del personaje">
  <header><strong>{activeCharacterName()||'Aventurero'}</strong><span>Nivel {s.level}</span></header>
  <div className="character-stat-vitals"><span>HP <b>{s.hp}/{s.maxHp}</b></span><span>MP <b>{s.mana}/{s.maxMana}</b></span><span>EN <b>{s.stamina}/{s.maxStamina}</b></span></div>
  <div className="character-stat-grid"><span>FUE <b>{s.strength}</b></span><span>INT <b>{s.intelligence}</b></span><span>VIT <b>{s.vitality}</b></span><span>AGI <b>{s.agility}</b></span><span>Daño <b>{s.damage}</b></span><span>Magia <b>{s.magicDamage}</b></span><span>Defensa <b>{s.defense}</b></span><span>Bajas <b>{s.kills}</b></span></div>
  <footer>XP {currentXp.toLocaleString()} / {needed.toLocaleString()} · 🪙 {s.gold.toLocaleString()}</footer>
 </section>;
}
