import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {ServerMessage} from '../src/proto/generated/network';

test('conserva el personaje después de reiniciar todos los servicios',async({page,context})=>{
    test.skip(process.env.TEST_AFTER_RESTART !== '1', 'Ejecutar explícitamente después de detener y reiniciar el stack.');
    const saved = JSON.parse(await readFile('../../.run/qa-restart.json','utf8'));
    await page.goto('/login');
    await page.getByLabel('Usuario o correo').fill(saved.username);
    await page.getByLabel('Contraseña',{exact:true}).fill(saved.password);
    await page.getByRole('button',{name:'Entrar a mi cuenta'}).click();
    await expect(page).toHaveURL(/\/characters$/);
    const chars = await (await context.request.get('/api/characters')).json();
    expect(chars[0].id).toBe(saved.id);expect(chars[0].gender).toBe(1);
    let initial:any;
    page.on('websocket',socket=>socket.on('framereceived',frame=>{
        if(typeof frame.payload==='string')return;
        const message=ServerMessage.decode(frame.payload);
        if(message.payload?.$case==='initialState')initial=message.payload.value;
    }));
    await page.getByRole('link',{name:'Entrar al mundo'}).click();
    await expect.poll(()=>Boolean(initial),{timeout:90000}).toBe(true);
    expect(initial.equippedItems[0].item.itemUid.toString()).toBe(saved.itemUid);
    await page.getByRole('link',{name:'Volver a personajes'}).click();
});
