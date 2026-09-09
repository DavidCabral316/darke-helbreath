import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {ClientMessage} from '../src/proto/generated/network';
test.use({actionTimeout:15000});

test('interfaz ordenada, chat, hotkeys, fichas y pantalla completa',async({page})=>{
    test.setTimeout(180000);
    const saved=JSON.parse(await readFile('../../.run/qa-adventure-restart.json','utf8'));
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    const sent:string[]=[];page.on('websocket',ws=>ws.on('framesent',frame=>{if(typeof frame.payload!=='string'){const p=ClientMessage.decode(frame.payload).payload;if(p)sent.push(p.$case);}}));
    expect((await page.request.get('/api/game/equipment-rules')).status()).toBe(401);
    await page.goto('/login');await page.getByLabel('Usuario o correo').fill(saved.username);await page.getByLabel('Contraseña',{exact:true}).fill(saved.password);await page.getByRole('button',{name:'Entrar a mi cuenta'}).click();
    await expect(page).toHaveURL(/\/characters$/);
    await page.getByRole('link',{name:'Entrar al mundo'}).click();
    await expect(page).toHaveURL(/\/play\//);
    await page.evaluate(async()=>{const path='/src/game/EventBus.ts';const {EventBus}=await import(path);EventBus.on('current-scene-ready',(scene:any)=>{if(scene.sys.settings.key==='GameWorld')(window as any).__qaScene=scene;});});
    const hud=page.getByRole('complementary',{name:'Estado del aventurero'});
    await expect(hud).toBeVisible({timeout:100000});
    if(await page.getByRole('button',{name:/Entendido/}).isVisible())await page.getByRole('button',{name:/Entendido/}).click();
    const panels=['inventory','chat','cast'];
    for(const p of panels)await expect(page.locator(`[data-dialog-id="${p}-dialog"]`)).toBeVisible();
    await expect(page.getByRole('region',{name:'Atajos rápidos'})).toBeVisible();
    async function noOverlap(){
        const boxes=await page.locator('.adventure-hud,[data-dialog-id="inventory-dialog"],[data-dialog-id="chat-dialog"],[data-dialog-id="cast-dialog"],.hotbar,#game-container').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
        for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];expect(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1,`panels ${i},${j} overlap`).toBe(false);}
    }
    await noOverlap();
    await page.getByRole('button',{name:'Menú del juego'}).click();
    const menu=await page.locator('[data-dialog-id="main-dialog"]').boundingBox(),h=await hud.boundingBox();expect(menu!.x).toBeGreaterThanOrEqual(h!.x+h!.width);
    await page.screenshot({path:'test-results/workspace-menu.png',fullPage:true});
    await page.getByRole('button',{name:'Camera',exact:true}).click();await expect(page.locator('[data-dialog-id="camera-dialog"]')).toBeVisible();await expect(page.locator('[data-dialog-id="main-dialog"]')).toBeHidden();
    await page.getByRole('button',{name:'Menú del juego'}).click();await expect(page.locator('[data-dialog-id="camera-dialog"]')).toBeHidden();
    await page.getByRole('button',{name:'Menú del juego'}).click();
    await page.getByLabel('Mensaje de chat').fill('¡Hola! Mi primera aventura en Darke.');await page.getByRole('button',{name:'Enviar',exact:true}).click();
    await expect(page.getByText('¡Hola! Mi primera aventura en Darke.',{exact:true})).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>(window as any).__qaScene?.children.list.filter((x:any)=>x.text==='¡Hola! Mi primera aventura en Darke.').length)).toBe(1);
    await page.screenshot({path:'test-results/workspace-chat.png',fullPage:true});
    await page.getByRole('button',{name:'Configurar',exact:true}).click();await page.getByRole('button',{name:'Cambiar tecla 1',exact:true}).click();await page.keyboard.press('q');await expect(page.getByRole('button',{name:'Cambiar tecla 1',exact:true})).toHaveText('Q');
    await page.getByRole('button',{name:'Cambiar tecla 2'}).click();await page.keyboard.press('q');await expect(page.getByText('Esa tecla ya está asignada. Elegí otra.')).toBeVisible();await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Listo',exact:true}).click();
    const beforeTyping=sent.filter(x=>x==='consumeItemRequest').length;
    await page.getByLabel('Mensaje de chat').fill('');await page.getByLabel('Mensaje de chat').pressSequentially('q123');await expect(page.getByLabel('Mensaje de chat')).toHaveValue('q123');
    expect(sent.filter(x=>x==='consumeItemRequest').length).toBe(beforeTyping);
    await page.getByLabel('Mensaje de chat').blur();await page.keyboard.press('q');
    await expect.poll(()=>sent.filter(x=>x==='consumeItemRequest').length).toBe(beforeTyping+1);
    const bindings=await page.evaluate(()=>JSON.parse(localStorage.getItem('darke.hotkeys.v2')!));expect(bindings[0].code).toBe('KeyQ');
    await page.evaluate(async()=>{const a='/src/ui/store/InventoryDialog.store.ts';const inv=await import(a);inv.addItemToBag({itemId:53,itemUid:'qa-bounds',bagX:10000,bagY:10000});});
    const bagBox=await page.locator('.inventory-bag-area').boundingBox(),itemBox=await page.locator('.inventory-bag-item').last().boundingBox();expect(itemBox!.x+itemBox!.width).toBeLessThanOrEqual(bagBox!.x+bagBox!.width);expect(itemBox!.y+itemBox!.height).toBeLessThanOrEqual(bagBox!.y+bagBox!.height);
    await page.evaluate(async()=>{const a='/src/ui/store/InventoryDialog.store.ts';const inv=await import(a);inv.removeItemFromBag('qa-bounds');});
    // The real equipped weapon opens the player-facing tooltip (no debug identifiers).
    await page.locator('.inventory-slot-weapon').hover();
    await expect(page.getByRole('tooltip')).toContainText('Daño +5');await expect(page.getByRole('tooltip')).not.toContainText('Item UID');
    await page.screenshot({path:'test-results/workspace-tooltip.png',fullPage:true});
    // Isolated UI fixture: preview an unowned sword; it is never added to the account.
    await page.evaluate(async()=>{const path='/src/ui/store/InventoryItemHoverOverlay.store.ts';const m=await import(path);m.setInventoryItemHoverInfo({itemName:'Long Sword',itemType:'weapon',itemId:53,itemUid:'qa-preview',source:'ground',mouseX:700,mouseY:400});});
    await expect(page.getByRole('tooltip').locator('.item-gain')).toContainText('+4');
    await expect(page.getByRole('tooltip')).toContainText('Nivel requerido: 3');
    await page.screenshot({path:'test-results/workspace-comparison.png',fullPage:true});
    await page.evaluate(async()=>{const a='/src/ui/store/InventoryDialog.store.ts',b='/src/ui/store/InventoryItemHoverOverlay.store.ts';const inv=await import(a),hover=await import(b);(window as any).__qaWeapon=inv.inventoryDialogStore.state.equippedItems.weapon;inv.setEquippedItem('weapon',{itemId:53,itemUid:'qa-strong'});hover.setInventoryItemHoverInfo({itemName:'Short Sword',itemType:'weapon',itemId:3,itemUid:'qa-preview',source:'ground',mouseX:700,mouseY:400});});
    await expect(page.getByRole('tooltip').locator('.item-loss')).toContainText('-4');
    await page.evaluate(async()=>{const a='/src/ui/store/InventoryDialog.store.ts';const inv=await import(a);inv.setEquippedItem('weapon',(window as any).__qaWeapon);});
    const audio=await page.evaluate(async()=>{
        const path='/src/game/objects/Player.ts';const {Player}=await import(path);const played:string[]=[];
        const fake=Object.assign(Object.create(Player.prototype),{dead:false,isLocalPlayer:true,acceptDamage:()=>{},appearanceManager:{getGender:()=> 'female'},soundTracker:{playOnce:(key:string)=>played.push(key)}});
        Player.prototype.applyMonsterDamage.call(fake,5,0,0);Player.prototype.applyMonsterDamage.call(fake,0,0,0);return played;
    });
    expect(audio).toEqual(['C13.mp3']);expect((await page.request.get('/assets/sounds/C13.mp3')).ok()).toBe(true);
    await page.mouse.move(600,400);
    // Real browser fullscreen, entered with a user gesture; no mocked fullscreenElement.
    await page.getByRole('button',{name:'Menú del juego'}).click();
    const full=page.getByRole('button',{name:/Full\s*screen|Pantalla completa|Fullscreen/i});
    await full.first().click();
    await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
    await expect(hud).toBeVisible();for(const p of panels)await expect(page.locator(`[data-dialog-id="${p}-dialog"]`)).toBeVisible();await noOverlap();
    await page.getByRole('button',{name:'Menú del juego'}).click();
    await page.screenshot({path:'test-results/workspace-fullscreen.png',fullPage:true});
    await page.evaluate(()=>document.exitFullscreen());
    await page.setViewportSize({width:1920,height:1080});await noOverlap();
    await page.screenshot({path:'test-results/workspace-wide.png',fullPage:true});
    await page.setViewportSize({width:2536,height:1290});await noOverlap();
    const ratio=await page.locator('#game-container canvas').evaluate(e=>{const r=e.getBoundingClientRect();return (r.width-6)/(r.height-6);});expect(ratio).toBeCloseTo(16/9,1);
    await page.setViewportSize({width:1366,height:768});await noOverlap();await page.screenshot({path:'test-results/workspace-laptop.png',fullPage:true});
    const slots=await page.locator('.inventory-slot').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
    for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){const a=slots[i],b=slots[j];expect(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1).toBe(false);}
    await page.setViewportSize({width:800,height:700});await page.getByRole('navigation',{name:'Paneles del juego'}).getByRole('button',{name:'Chat',exact:true}).click();await expect(page.getByLabel('Mensaje de chat')).toBeVisible();
    await expect(hud).toBeHidden();await expect(page.locator('[data-dialog-id="inventory-dialog"]')).toBeHidden();
    await page.locator('[data-dialog-id="chat-dialog"]').click({button:'right'});await page.getByRole('navigation',{name:'Paneles del juego'}).getByRole('button',{name:'Chat',exact:true}).click();await expect(page.getByLabel('Mensaje de chat')).toBeVisible();
    await page.screenshot({path:'test-results/workspace-compact.png',fullPage:true});
    expect(await page.evaluate(()=>(window as any).__qaScene.children.list.filter((x:any)=>x.text==='¡Hola! Mi primera aventura en Darke.').length)).toBe(0);
    expect(errors).toEqual([]);
    await page.getByRole('link',{name:'Volver a personajes'}).click();
});
