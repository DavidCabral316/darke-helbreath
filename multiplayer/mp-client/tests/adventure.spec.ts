import {test,expect} from '@playwright/test';
import WebSocket from 'ws';
import {readFile,writeFile} from 'node:fs/promises';
import {ClientMessage,ServerMessage} from '../src/proto/generated/network';

test('aventura real por red: XP, atributos, botín, muerte y guardado',async({request})=>{
    test.setTimeout(240000);
    const suffix=Date.now().toString(36), username=`adv${suffix}`, password=`Adventure-test-${suffix}-42`;
    async function post(path:string,data:unknown){const token=(await (await request.get('/api/csrf')).json()).token;return request.post(`/api${path}`,{data,headers:{'X-CSRF-TOKEN':token}});}
    expect((await post('/account/register',{username,email:`${username}@example.test`,password,acceptRules:true})).ok()).toBe(true);
    expect((await post('/account/login',{username,password,remember:false})).ok()).toBe(true);
    const created=await post('/characters',{name:`Adv${suffix}`,town:'aresden',gender:0,skin:0,hair:0,clothes:0});
    expect(created.ok()).toBe(true);const character=await created.json();
    const cookie=(await request.storageState()).cookies.map(c=>`${c.name}=${c.value}`).join('; ');
    const socket=new WebSocket('ws://127.0.0.1:1337/ws',{headers:{Origin:'http://localhost:8080',Cookie:cookie}});
    let stats:any,initial:any,position={x:150,y:150},dead=false;const mobs=new Map<string,any>(),loot=new Map<string,any>(),bag=new Map<string,any>();
    let errors:string[]=[];
    socket.on('error',e=>errors.push(e.message));
    socket.on('message',bytes=>{
        const msg=ServerMessage.decode(new Uint8Array(bytes as Buffer)).payload;if(!msg)return;const v:any=msg.value;
        switch(msg.$case){
            case 'initialState': initial=v;bag.clear();for(const i of v.bagItems)bag.set(i.itemUid.toString(),i);break;
            case 'initialGameWorldState':position={x:v.playerX,y:v.playerY};break;
            case 'progressionUpdated':stats=v;position={x:v.x,y:v.y};break;
            case 'resetPosition':case 'positionCorrected':position={x:v.x??v.destX,y:v.y??v.destY};break;
            case 'monstersEnteredRange':for(const m of v.monsters)mobs.set(m.monsterId.toString(),m);break;
            case 'monstersLeftRange':for(const id of v.monsterIds)mobs.delete(id.toString());break;
            case 'monsterMoved':{const m=mobs.get(v.monsterId.toString());if(m){m.x=v.destX;m.y=v.destY;}break;}
            case 'monsterDied':{const m=mobs.get(v.monsterId.toString());if(m)m.dead=true;break;}
            case 'monsterTakeDamage':{const m=mobs.get(v.monsterId.toString());if(m)m.hp=v.hp;break;}
            case 'groundStatesEnteredRange':for(const s of v.states)if(s.groundItem)loot.set(s.groundItem.itemUid.toString(),{...s.groundItem,...s.loc});break;
            case 'groundStatesLeftRange':for(const s of v.states)if(s.groundItemUid)loot.delete(s.groundItemUid.toString());break;
            case 'itemAddedToBag':if(v.item)bag.set(v.item.itemUid.toString(),v.item);break;
            case 'itemRemovedFromBag':bag.delete(v.itemUid.toString());break;
            case 'playerDied':if(initial&&v.playerId===initial.playerId)dead=true;break;
            case 'playerResurrected':if(initial&&v.playerId===initial.playerId){dead=false;position={x:v.x,y:v.y};}break;
        }
    });
    const send=(kind:string,value:any)=>socket.send(ClientMessage.encode({payload:{$case:kind,value}} as any).finish());
    const sendAsync=(kind:string,value:any)=>new Promise<void>((resolve,reject)=>socket.send(ClientMessage.encode({payload:{$case:kind,value}} as any).finish(),error=>error?reject(error):resolve()));
    const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
    let ping:ReturnType<typeof setInterval>|undefined;
    try{
        await new Promise<void>((resolve,reject)=>{socket.once('open',()=>resolve());socket.once('error',reject);});
        send('authenticateRequest',{id:character.id,characterName:'Ignored client name'});
        let sequence=0;ping=setInterval(()=>send('pingRequest',{sequence:++sequence}),1000);
        await expect.poll(()=>Boolean(stats&&initial),{timeout:15000}).toBe(true);
        expect(stats.level).toBe(1);expect(stats.damage).toBe(16);expect(stats.sanctuary).toBe(true);
        send('allocateAttributeRequest',{attribute:'strength'});send('changePlayerAttackDamageRequest',{attackDamage:99999});
        await wait(1100);expect(stats.strength).toBe(10);expect(stats.damage).toBe(16);
        let map=await readFile('../server/Config/maps/aresden.amd'),header=map.subarray(0,256).toString();
        let width=Number(/MAPSIZEX\s*=\s*(\d+)/.exec(header)![1]),height=Number(/MAPSIZEY\s*=\s*(\d+)/.exec(header)![1]),tile=Number(/TILESIZE\s*=\s*(\d+)/.exec(header)![1]);
        const loadMap=async(name:string)=>{map=await readFile(`../server/Config/maps/${name}.amd`);header=map.subarray(0,256).toString();width=Number(/MAPSIZEX\s*=\s*(\d+)/.exec(header)![1]);height=Number(/MAPSIZEY\s*=\s*(\d+)/.exec(header)![1]);tile=Number(/TILESIZE\s*=\s*(\d+)/.exec(header)![1]);};
        const free=(x:number,y:number)=>x>=0&&y>=0&&x<width&&y<height&&!(map[256+(y*width+x)*tile+8]&128)&&![...mobs.values()].some(m=>!m.dead&&m.x===x&&m.y===y);
        function path(tx:number,ty:number,range=0){
            const start=`${position.x},${position.y}`,queue=[position],parents=new Map<string,string|null>([[start,null]]);let end:string|undefined;
            for(let q=0;q<queue.length&&q<90000;q++){
                const p=queue[q],key=`${p.x},${p.y}`;
                if(Math.max(Math.abs(tx-p.x),Math.abs(ty-p.y))<=range){end=key;break;}
                for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const x=p.x+dx,y=p.y+dy,k=`${x},${y}`;if(!parents.has(k)&&free(x,y)){parents.set(k,key);queue.push({x,y});}}
            }
            const result:{x:number;y:number}[]=[];while(end&&end!==start){const [x,y]=end.split(',').map(Number);result.unshift({x,y});end=parents.get(end)!;}return result;
        }
        async function move(tx:number,ty:number,range=0){
            for(let n=0;n<120;n++){
                if(Math.max(Math.abs(tx-position.x),Math.abs(ty-position.y))<=range)return;
                const next=path(tx,ty,range)[0];if(!next)throw Error(`No path: ${JSON.stringify(position)} -> ${tx},${ty}`);
                send('requestMovement',{curX:position.x,curY:position.y,destX:next.x,destY:next.y,gameWorldId:stats.worldId,dashAttack:false});position=next;await wait(310);
            }
            throw Error('Movement did not reach target');
        }
        await move(144,143);
        const deadline=Date.now()+90000;
        while((stats?.level??1)<2&&Date.now()<deadline){
            const mob=[...mobs.values()].filter(m=>!m.dead&&m.name==='Slime de entrenamiento').sort((a,b)=>Math.abs(a.x-position.x)+Math.abs(a.y-position.y)-Math.abs(b.x-position.x)-Math.abs(b.y-position.y))[0];
            if(!mob){await wait(600);continue;}
            await move(mob.x,mob.y,1);
            send('playerAttackedMonsterRequest',{monsterId:mob.monsterId,attackType:2,rangedAttack:false});await wait(760);
        }
        expect(stats.level).toBe(2);expect(stats.points).toBe(3);
        send('allocateAttributeRequest',{attribute:'vitality'});await expect.poll(()=>stats.vitality).toBe(11);expect(stats.maxHp).toBe(117);
        let drop:any;
        await expect.poll(()=>{drop=[...loot.values()].find(item=>free(item.x,item.y));return Boolean(drop);},{timeout:10000}).toBe(true);
        await move(drop.x,drop.y);send('playerItemPickupRequested',{});await wait(400);expect(loot.has(drop.itemUid.toString())).toBe(false);
        // Walk into the hostile enclosure and let real server AI deliver lethal damage.
        const orc=[...mobs.values()].find(m=>!m.dead&&m.name==='Orco de entrenamiento');
        await move(orc?.x??132,orc?.y??132,1);
        await expect.poll(()=>dead,{timeout:60000}).toBe(true);
        const xp=stats.experience;send('playerResurrectedRequest',{});
        await expect.poll(()=>!dead&&stats.hp>0&&stats.sanctuary,{timeout:10000}).toBe(true);
        expect(stats.experience).toBe(xp);
        expect(stats.gold).toBeGreaterThanOrEqual(8);
        const potionCount=()=>[...bag.values()].filter(i=>i.itemId===36).reduce((n,i)=>n+(i.quantity??1),0);
        const goldBefore=stats.gold,potionsBefore=potionCount(),revisionBefore=stats.tradeRevision;
        // Walk through the authentic shop door; commerce only appears near Shop Keeper.
        await move(126,166);await expect.poll(()=>Math.max(Math.abs(stats.x-126),Math.abs(stats.y-166)),{timeout:10000}).toBeLessThanOrEqual(2);
        await wait(1000);await sendAsync('worldChangeRequest',{worldId:'darke-shop',gameWorldId:'training',validateTeleport:true});
        await expect.poll(()=>stats?.worldId,{timeout:10000}).toBe('darke-shop');
        await loadMap('gshop_1');await move(59,42,4);
        await expect.poll(()=>stats?.service,{timeout:10000}).toBe('shop');
        expect(stats.service).toBe('shop');
        await wait(8000); // comercio se habilita ocho segundos después del último daño
        send('economyRequest',{action:'buy',offerId:'red',itemUid:0n,requestId:crypto.randomUUID(),revision:revisionBefore});
        await expect.poll(()=>stats?.tradeRevision,{timeout:10000}).toBe(revisionBefore+1n);
        expect(stats.gold).toBe(goldBefore-8);expect(potionCount()).toBe(potionsBefore+1);
        // Replaying the stale revision must not charge or grant again.
        send('economyRequest',{action:'buy',offerId:'red',itemUid:0n,requestId:crypto.randomUUID(),revision:revisionBefore});
        await wait(400);expect(stats.gold).toBe(goldBefore-8);expect(potionCount()).toBe(potionsBefore+1);
        await move(50,37);await sendAsync('worldChangeRequest',{worldId:'training',gameWorldId:'darke-shop',validateTeleport:true});
        await expect.poll(()=>stats?.worldId,{timeout:10000}).toBe('training');
        await expect.poll(async()=>{const c=await (await request.get('/api/characters')).json();return c[0].level;}).toBe(2);
        const saved=await (await request.get('/api/characters')).json();expect(saved[0].experience).toBe(Number(xp));
        expect(errors).toEqual([]);
        await writeFile('../../.run/qa-adventure-restart.json',JSON.stringify({username,password,id:character.id,experience:xp.toString(),vitality:11}));
    }finally{clearInterval(ping);socket.close();}
});
