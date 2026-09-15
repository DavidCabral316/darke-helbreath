import { useEffect, useRef, useState } from 'react';
import { getItemById, ItemEffect, mergeItemEffects, type Effect, type EquipmentSlot, type InventoryItem } from '../constants/Items';
import { Gender, SkinColor } from '../Types';
import { PlayerAppearanceManager, PlayerState } from '../utils/PlayerAppearanceManager';

export type HelbreathSpriteFrame = { x: number; y: number; w: number; h: number; px: number; py: number };
export type HelbreathSpriteSheet = { frames: HelbreathSpriteFrame[]; png: Blob };
type Sheet = HelbreathSpriteSheet;
const cache = new Map<string, Promise<Sheet[]>>();

export function loadHelbreathSprite(name: string): Promise<Sheet[]> {
    if (cache.has(name)) return cache.get(name)!;
    const promise = fetch(`/assets/sprites/${name}.spr`).then(async response => {
        if (!response.ok) throw new Error('Sprite no disponible');
        const buffer = await response.arrayBuffer(); const view = new DataView(buffer); let offset = 2;
        const metadata: { frames: HelbreathSpriteFrame[]; length: number }[] = [];
        for (let sheetIndex = 0; sheetIndex < view.getInt16(0, true); sheetIndex++) {
            const count = view.getInt16(offset, true); const length = view.getInt32(offset + 2, true); offset += 15;
            const frames: HelbreathSpriteFrame[] = [];
            for (let frameIndex = 0; frameIndex < count; frameIndex++, offset += 12) frames.push({ x: view.getInt16(offset, true), y: view.getInt16(offset + 2, true), w: view.getInt16(offset + 4, true), h: view.getInt16(offset + 6, true), px: view.getInt16(offset + 8, true), py: view.getInt16(offset + 10, true) });
            metadata.push({ frames, length });
        }
        return metadata.map(sheet => { offset += 4; const png = new Blob([buffer.slice(offset, offset + sheet.length)], { type: 'image/png' }); offset += sheet.length; return { frames: sheet.frames, png }; });
    });
    cache.set(name, promise); promise.catch(() => cache.delete(name)); return promise;
}

interface CharacterPreviewProps {
    gender: number | Gender; skin: number | SkinColor; hair: number; clothes: number;
    equippedItems?: Partial<Record<EquipmentSlot, InventoryItem>>;
    className?: string; ariaLabel?: string;
}

const colorCss = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
function equipmentSignature(items: Partial<Record<EquipmentSlot, InventoryItem>>): string {
    return Object.entries(items).sort(([a], [b]) => a.localeCompare(b)).map(([slot, item]) => `${slot}:${item?.itemId ?? 0}:${item?.effectOverrides?.map(effect => `${effect.effect}:${effect.effectColor ?? ''}`).join(',') ?? ''}`).join('|');
}

export function CharacterPreview({ gender, skin, hair, clothes, equippedItems, className = 'character-preview', ariaLabel = 'Vista previa animada del personaje' }: CharacterPreviewProps) {
    const canvas = useRef<HTMLCanvasElement>(null); const [error, setError] = useState(false);
    const signature = equipmentSignature(equippedItems ?? {});
    const equipmentRef = useRef({ signature: '', items: {} as Partial<Record<EquipmentSlot, InventoryItem>> });
    if (equipmentRef.current.signature !== signature) equipmentRef.current = { signature, items: equippedItems ?? {} };
    const stableEquipment = equipmentRef.current.items;
    useEffect(() => {
        let cancelled = false; let timer: ReturnType<typeof setInterval> | undefined; const bitmaps: ImageBitmap[] = [];
        setError(false);
        async function render() {
            const typedGender = gender === 0 || gender === Gender.MALE ? Gender.MALE : Gender.FEMALE;
            const typedSkin = typeof skin === 'number' ? ([SkinColor.Light, SkinColor.Tanned, SkinColor.Dark][skin] ?? SkinColor.Light) : skin;
            const base = { human: PlayerAppearanceManager.getHumanSpriteName(typedGender, typedSkin), hairStyleIndex: hair, underwearColorIndex: clothes };
            const gear = PlayerAppearanceManager.resolveGearFromEquippedItems(base, stableEquipment, typedGender);
            const hairSprite = typedGender === Gender.MALE ? 'mhr' : 'whr';
            const allowed = new Set([gear.human, gear.underwear, gear.hauberk, gear.leggings, gear.boots, gear.helm, gear.armor, gear.cape, gear.weapon, gear.shield, gear.accessory, hairSprite].filter(Boolean));
            let configs = PlayerAppearanceManager.buildAssetConfigs(4, PlayerState.IdlePeaceMode, gear).configs.filter(config => allowed.has(config.spriteName));
            if (gear.helm) configs = configs.filter(config => config.spriteName !== hairSprite);
            const effectsBySprite = new Map<string, Effect[]>();
            for (const item of Object.values(stableEquipment)) {
                if (!item) continue;
                const definition = getItemById(item.itemId); if (!definition) continue;
                const sprite = typedGender === Gender.MALE ? definition.equippedSpriteMale : definition.equippedSpriteFemale;
                if (sprite) effectsBySprite.set(sprite, mergeItemEffects(definition.effects, item.effectOverrides) ?? []);
            }
            const layers = (await Promise.all(configs.map(async config => {
                const sheet = (await loadHelbreathSprite(config.spriteName))[config.spriteSheetIndex ?? 0]; if (!sheet) return null;
                const bitmap = await createImageBitmap(sheet.png); if (cancelled) { bitmap.close(); return null; }
                bitmaps.push(bitmap); return { config, sheet, bitmap, effects: effectsBySprite.get(config.spriteName) ?? [] };
            }))).filter(Boolean) as Array<{ config: (typeof configs)[number]; sheet: Sheet; bitmap: ImageBitmap; effects: Effect[] }>;
            if (cancelled) return;
            let tick = 0;
            const draw = () => {
                const context = canvas.current?.getContext('2d'); if (!context) return;
                context.clearRect(0, 0, 240, 220); context.imageSmoothingEnabled = false;
                context.fillStyle = 'rgba(0,0,0,.42)'; context.beginPath(); context.ellipse(120, 181, 44, 11, 0, 0, Math.PI * 2); context.fill();
                for (const { config, sheet, bitmap, effects } of layers) {
                    const directional = config.animationType === 'DirectionalSubFrame'; const frameCount = directional ? (config.framesPerDirection ?? 8) : sheet.frames.length;
                    const start = directional ? (config.direction ?? 0) * frameCount : 0; const frame = sheet.frames[start + tick % frameCount];
                    if (!frame?.w || !frame.h) continue;
                    const targetX = 120 + frame.px * 2, targetY = 178 + frame.py * 2;
                    const tint = effects.find(effect => effect.effect === ItemEffect.TINT_APPEARANCE)?.effectColor;
                    const glow = effects.find(effect => effect.effect === ItemEffect.GLOW)?.effectColor;
                    const layerCanvas = document.createElement('canvas'); layerCanvas.width = frame.w * 2; layerCanvas.height = frame.h * 2;
                    const layerContext = layerCanvas.getContext('2d')!; layerContext.imageSmoothingEnabled = false;
                    layerContext.drawImage(bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, layerCanvas.width, layerCanvas.height);
                    if (tint !== undefined) {
                        layerContext.globalCompositeOperation = 'multiply'; layerContext.fillStyle = colorCss(tint); layerContext.fillRect(0, 0, layerCanvas.width, layerCanvas.height);
                        layerContext.globalCompositeOperation = 'destination-in'; layerContext.drawImage(bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, layerCanvas.width, layerCanvas.height);
                    }
                    if (glow !== undefined) { context.save(); context.shadowColor = colorCss(glow); context.shadowBlur = 10; context.drawImage(layerCanvas, targetX, targetY); context.restore(); }
                    context.drawImage(layerCanvas, targetX, targetY);
                }
                tick++;
            };
            draw(); timer = setInterval(draw, 180);
        }
        render().catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; clearInterval(timer); bitmaps.forEach(bitmap => bitmap.close()); };
    }, [gender, skin, hair, clothes, stableEquipment]);
    return <div className={className}><canvas ref={canvas} width={240} height={220} role="img" aria-label={ariaLabel} />{error && <small>No se pudo cargar la vista previa.</small>}</div>;
}
