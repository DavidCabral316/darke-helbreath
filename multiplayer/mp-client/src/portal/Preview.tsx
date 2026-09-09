import { useEffect, useRef, useState } from 'react';

export type HelbreathSpriteFrame = { x: number; y: number; w: number; h: number; px: number; py: number };
export type HelbreathSpriteSheet = { frames: HelbreathSpriteFrame[]; png: Blob };
const cache = new Map<string, Promise<Sheet[]>>();
type Sheet = HelbreathSpriteSheet;
export function loadHelbreathSprite(name: string): Promise<Sheet[]> {
    if (cache.has(name)) return cache.get(name)!;
    const promise = fetch(`/assets/sprites/${name}.spr`).then(async response => {
        if (!response.ok) throw new Error('Sprite no disponible');
        const buffer = await response.arrayBuffer(); const v = new DataView(buffer); let offset = 2;
        const metadata: { frames: HelbreathSpriteFrame[]; length: number }[] = [];
        for (let s = 0; s < v.getInt16(0, true); s++) {
            const count = v.getInt16(offset, true); const length = v.getInt32(offset + 2, true); offset += 15;
            const frames: HelbreathSpriteFrame[] = [];
            for (let f = 0; f < count; f++, offset += 12) frames.push({ x: v.getInt16(offset,true), y: v.getInt16(offset+2,true), w: v.getInt16(offset+4,true), h: v.getInt16(offset+6,true), px: v.getInt16(offset+8,true), py: v.getInt16(offset+10,true) });
            metadata.push({ frames, length });
        }
        return metadata.map(s => { offset += 4; const png = new Blob([buffer.slice(offset, offset + s.length)], {type:'image/png'}); offset += s.length; return { frames: s.frames, png }; });
    });
    cache.set(name,promise); promise.catch(() => cache.delete(name)); return promise;
}

export function CharacterPreview({ gender, skin, hair, clothes }: { gender: number; skin: number; hair: number; clothes: number }) {
    const canvas = useRef<HTMLCanvasElement>(null); const [error,setError] = useState(false);
    useEffect(() => {
        let cancelled = false; let timer: ReturnType<typeof setInterval> | undefined; const bitmaps: ImageBitmap[] = [];
        setError(false);
        async function render() {
            const body = (gender === 0 ? ['wm','ym','bm'] : ['ww','yw','bw'])[skin];
            const layers: {name:string;sheet:number;directional:boolean}[] = [{name:body,sheet:4,directional:false}];
            if (hair !== 2) layers.push({name:gender === 0?'mhr':'whr',sheet:hair*12,directional:true});
            layers.push({name:gender === 0?'mpt':'wpt',sheet:clothes*12,directional:true});
            const sheets = await Promise.all(layers.map(async layer => {
                const sheet = (await loadHelbreathSprite(layer.name))[layer.sheet];
                const bitmap = await createImageBitmap(sheet.png);
                if (cancelled) { bitmap.close(); return null; }
                bitmaps.push(bitmap); return {...layer, sheet, bitmap};
            }));
            if (cancelled) return;
            let tick=0;
            const draw = () => {
                const ctx = canvas.current?.getContext('2d'); if (!ctx) return;
                ctx.clearRect(0,0,240,220); ctx.imageSmoothingEnabled=false;
                ctx.fillStyle='rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(120,177,44,12,0,0,Math.PI*2);ctx.fill();
                for (const layer of sheets) {
                    if (!layer) continue;
                    const perDirection = layer.directional ? layer.sheet.frames.length/8 : layer.sheet.frames.length;
                    const f = layer.sheet.frames[(layer.directional?4*perDirection:0) + tick%perDirection];
                    if (f?.w && f.h) ctx.drawImage(layer.bitmap,f.x,f.y,f.w,f.h,120+f.px*2,174+f.py*2,f.w*2,f.h*2);
                }
                tick++;
            };
            draw(); timer=setInterval(draw,180);
        }
        render().catch(() => { if (!cancelled) setError(true); });
        return () => {cancelled=true;clearInterval(timer);bitmaps.forEach(b=>b.close());};
    },[gender,skin,hair,clothes]);
    return <div className="character-preview"><canvas ref={canvas} width={240} height={220} role="img" aria-label="Vista previa animada del personaje" />{error && <small>No se pudo cargar la vista previa.</small>}</div>;
}
