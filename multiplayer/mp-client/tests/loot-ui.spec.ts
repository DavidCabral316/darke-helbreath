import {test,expect} from '@playwright/test';

test('hotbar defaults, learned-only spells, potion audio and Lumi limit',async({page})=>{
    await page.goto('/login');
    await page.evaluate(async()=>{const h=await import('/tests/feature-harness.tsx');h.mount()});
    await expect(page.locator('.hotbar-slot.empty')).toHaveCount(8);
    await page.getByRole('button',{name:'Configurar',exact:true}).click();
    const select=page.getByLabel('Acción del atajo 3',{exact:true});
    await expect(select.locator('option')).toHaveCount(7);
    await page.evaluate(async()=>{const h=await import('/tests/feature-harness.tsx');h.update([0,1])});
    await expect(select.locator('option')).toHaveCount(9);
    await select.selectOption('spell:1');
    await expect(select).toHaveValue('spell:1');
    await page.getByRole('button',{name:'Listo',exact:true}).click();
    const events=await page.evaluate(async()=>{
        const s=await import('/src/adventure/store.ts');const p=await import('/src/proto/generated/network.ts');
        const sounds:string[]=[];const original=window.Audio;const OriginalContext=window.AudioContext;let chimeNotes=0;
        (window as any).Audio=class {volume=1;constructor(url:string){sounds.push(url)}play(){return Promise.resolve()}};
        (window as any).AudioContext=class {state='running';currentTime=0;destination={};resume(){return Promise.resolve()}createOscillator(){return {type:'sine',frequency:{setValueAtTime(){}},connect(){return this},start(){chimeNotes++},stop(){}}}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this}}}};
        const stats=p.ProgressionUpdated.fromPartial({level:30,hp:100});const owner={};
        s.publishAdventure({...stats,notice:'No necesitás esa poción, o debés esperar dos segundos entre usos.'},owner,()=>{});
        s.publishAdventure({...stats,notice:'Poción consumida.'},owner,()=>{});
        s.publishAdventure({...stats,notice:'✦ HALLAZGO ESPECIAL: Espada'},owner,()=>{});
        window.Audio=original;window.AudioContext=OriginalContext;return {sounds,chimeNotes};
    });
    expect(events.sounds).toEqual(['/assets/sounds/E21.mp3']);
    expect(events.chimeNotes).toBe(4);
    await expect(page.getByLabel('Consejo de Lumi')).toBeVisible();
    await page.screenshot({path:'test-results/lumi-and-hotbar.png'});
    await page.getByLabel('Cerrar consejo').click();
    const emit=()=>page.evaluate(async()=>{const {EventBus}=await import('/src/game/EventBus.ts');EventBus.emit('darke:lumi-event',{kind:'loot'})});
    await emit();await expect(page.getByLabel('Consejo de Lumi')).toBeVisible();await page.getByLabel('Cerrar consejo').click();
    await emit();await expect(page.getByLabel('Consejo de Lumi')).toHaveCount(0);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('darke.lumi-events.v1.00000000-0000-0000-0000-000000000001')!).loot)).toBe(2);
});

test('commerce search, affordability and responsive themed window',async({page})=>{
    await page.route('**/api/game/economy',r=>r.fulfill({json:{quests:[],offers:[
        {id:'one',name:'Energy Bolt',service:'magic',price:50,itemId:0,spellId:0,level:1,intelligence:10},
        {id:'two',name:'Fire Ball',service:'magic',price:300,itemId:0,spellId:1,level:10,intelligence:10},
        {id:'three',name:'Blizzard',service:'magic',price:10000,itemId:0,spellId:21,level:150,intelligence:200}
    ]}}));
    await page.goto('/login');
    await page.evaluate(async()=>{const h=await import('/tests/feature-harness.tsx');h.mount();h.update([],'magic');const ui=await import('/src/adventure/economyUi.ts');ui.openEconomyPanel()});
    await expect(page.locator('.economy-row')).toHaveCount(3);
    await page.getByLabel('Buscar en la tienda').fill('fire');await expect(page.locator('.economy-row')).toHaveCount(1);
    await page.getByLabel('Buscar en la tienda').fill('');await page.getByLabel('A mi alcance').check();await expect(page.locator('.economy-row')).toHaveCount(2);
    await page.screenshot({path:'test-results/commerce-jade.png'});
    await page.setViewportSize({width:560,height:800});
    const bounds=await page.getByRole('dialog').boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(560);
    await page.getByLabel('Cerrar servicios').click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
