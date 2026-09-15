import { useStore } from '@tanstack/react-store';
import { inventoryDialogStore } from '../ui/store/InventoryDialog.store';
import { playerDialogStore } from '../ui/store/PlayerDialog.store';
import { CharacterPreview } from '../portal/Preview';
import { useAdventure } from './store';
import { activeCharacterName } from '../portal/api';

export function EquippedCharacterPreview() {
    const equippedItems = useStore(inventoryDialogStore, state => state.equippedItems);
    const gender = useStore(playerDialogStore, state => state.gender), skin = useStore(playerDialogStore, state => state.skinColor);
    const hair = useStore(playerDialogStore, state => state.hairStyleIndex), clothes = useStore(playerDialogStore, state => state.underwearColorIndex);
    return <CharacterPreview gender={gender} skin={skin} hair={hair} clothes={clothes} equippedItems={equippedItems} className="equipped-character-preview" ariaLabel="Personaje con su equipo actual" />;
}

export function CharacterStatsCard() {
    const { stats } = useAdventure(); if (!stats) return null;
    const currentXp = Number(stats.experience - stats.levelStart), needed = Number(stats.nextLevel - stats.levelStart);
    return <section className="character-stats-card" aria-label="Estadísticas del personaje">
        <header><strong>{activeCharacterName() || 'Aventurero'}</strong><span>Nivel {stats.level}</span></header>
        <div className="character-stat-vitals"><span>HP <b>{stats.hp}/{stats.maxHp}</b></span><span>MP <b>{stats.mana}/{stats.maxMana}</b></span><span>EN <b>{stats.stamina}/{stats.maxStamina}</b></span></div>
        <div className="character-stat-grid"><span>FUE <b>{stats.strength}</b></span><span>INT <b>{stats.intelligence}</b></span><span>VIT <b>{stats.vitality}</b></span><span>AGI <b>{stats.agility}</b></span><span>Daño <b>{stats.damage}</b></span><span>Magia <b>{stats.magicDamage}</b></span><span>Defensa <b>{stats.defense}</b></span><span>Bajas <b>{stats.kills}</b></span></div>
        <footer>XP {currentXp.toLocaleString()} / {needed.toLocaleString()} · 🪙 {stats.gold.toLocaleString()}</footer>
    </section>;
}
