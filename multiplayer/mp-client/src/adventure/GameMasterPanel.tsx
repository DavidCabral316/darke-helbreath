import { useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { activeCharacterIsGameMaster } from '../portal/api';
import { EventBus } from '../game/EventBus';
import { IN_UI_GM_COMMAND, TOAST_REQUESTED } from '../constants/EventNames';
import { playerDialogStore, setMovementSpeed } from '../ui/store/PlayerDialog.store';
import { requestPlayerTeleportToCell } from '../ui/store/ServerDialog.store';
import { toggleMapDialog } from '../ui/store/MapDialog.store';
import { useAdventure } from './store';

export function GameMasterPanel() {
    const { stats, connected } = useAdventure();
    const movementSpeed = useStore(playerDialogStore, state => state.movementSpeed);
    const [open, setOpen] = useState(true);
    const [godMode, setGodMode] = useState(false);
    if (!activeCharacterIsGameMaster() || !stats) return null;

    const command = (value: string) => connected && EventBus.emit(IN_UI_GM_COMMAND, value);
    const teleportMode = () => {
        requestPlayerTeleportToCell();
        EventBus.emit(TOAST_REQUESTED, { message: 'GM: hacé clic en una celda del mundo.', severity: 'info' });
    };
    const toggleGodMode = () => {
        command('god');
        setGodMode(value => !value);
    };

    return <section className="gm-panel" aria-label="Panel de Game Master">
        <button className="adventure-wide gm-panel-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
            ★ PANEL GM {open ? '−' : '+'}
        </button>
        {open && <div className="gm-panel-body">
            <p>Herramientas privadas de Darkeruz</p>
            <div className="gm-grid">
                <button disabled={!connected || stats.level >= stats.maxLevel} onClick={() => command(`level ${stats.level + 1}`)}>Nivel +1</button>
                <button disabled={!connected || stats.level >= stats.maxLevel} onClick={() => command(`level ${Math.min(stats.maxLevel, stats.level + 10)}`)}>Nivel +10</button>
                <button disabled={!connected || stats.level >= 30} onClick={() => command('level 30')}>Ir a nivel 30</button>
                <button disabled={!connected} onClick={() => command('heal')}>Restaurar todo</button>
                <button disabled={!connected} onClick={() => command('gold 10000')}>+10.000 oro</button>
                <button disabled={!connected} onClick={() => command('spells')}>Todas las magias</button>
                <button disabled={!connected} aria-pressed={godMode} onClick={toggleGodMode}>{godMode ? 'Desactivar dios' : 'Modo dios'}</button>
                <button disabled={!connected} onClick={() => setMovementSpeed(movementSpeed <= 100 ? 220 : 100)}>{movementSpeed <= 100 ? 'Velocidad normal' : 'Supervelocidad'}</button>
                <button disabled={!connected} onClick={teleportMode}>Teleport en mapa</button>
                <button disabled={!connected} onClick={toggleMapDialog}>Viajar a otro mapa</button>
            </div>
            <small>También podés hacer clic derecho directamente sobre el minimapa.</small>
        </div>}
    </section>;
}
