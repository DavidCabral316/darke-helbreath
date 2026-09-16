import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useStore } from '@tanstack/react-store';
import { DraggableDialog } from './DraggableDialog';
import { RpgButton } from '../components/RpgButton';
import { EventBus } from '../../game/EventBus';
import { IN_UI_SUPPRESS_POINTER_INPUT } from '../../constants/EventNames';
import { getNetworkManager } from '../../utils/RegistryUtils';
import { partyStore } from '../store/Party.store';
import type { IRefPhaserGame } from '../../PhaserGame';
import type { ChatMessageEntry } from '../store/ChatDialog.store';

interface ChatDialogProps {
    messages: ChatMessageEntry[];
    position: { x: number; y: number };
    phaserRef: RefObject<IRefPhaserGame | null>;
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

export function ChatDialog({
    messages,
    position,
    phaserRef,
    onClose,
    zIndex,
    onBringToFront,
}: ChatDialogProps) {
    const [draft, setDraft] = useState('');
    const [partyName, setPartyName] = useState('');
    const [partyOpen, setPartyOpen] = useState(false);
    const partyState = useStore(partyStore, (state) => state);
    const messagesRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const element = messagesRef.current;
        if (!element) {
            return;
        }

        element.scrollTop = element.scrollHeight;
    }, [messages.length]);

    const formattedMessages = useMemo(() => {
        return messages.map((entry, index) => ({
            key: `${entry.timestampMs}-${index}`,
            time: new Date(entry.timestampMs).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            }),
            ...entry,
        }));
    }, [messages]);

    const suppressPointerLeak = () => {
        EventBus.emit(IN_UI_SUPPRESS_POINTER_INPUT, 150);
    };

    const sendMessage = () => {
        const message = draft.trim();
        if (!message) {
            return;
        }

        const game = phaserRef.current?.game;
        if (!game) {
            return;
        }

        const networkManager = getNetworkManager(game);
        if (!networkManager) {
            return;
        }

        networkManager.sendChatMessage(message);
        setDraft('');
        suppressPointerLeak();
    };

    const sendPartyCommand = (command: string) => {
        const game = phaserRef.current?.game;
        const networkManager = game ? getNetworkManager(game) : undefined;
        if (!networkManager) return;
        networkManager.sendChatMessage(command);
        suppressPointerLeak();
    };

    return (
        <DraggableDialog
            title="Chat"
            position={position}
            id="chat-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                onClose();
            }}
        >
            <div
                className="chat-panel"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: 420,
                    maxHeight: '70vh',
                    gap: 8,
                }}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    suppressPointerLeak();
                }}
            >
                <div
                    ref={messagesRef}
                    style={{
                        flex: 1,
                        minHeight: 140,
                        maxHeight: 260,
                        overflowY: 'auto',
                        padding: 8,
                        border: '1px solid rgba(240, 220, 180, 0.35)',
                        background: 'rgba(20, 12, 6, 0.45)',
                        color: 'var(--rpg-parchment)',
                        fontFamily: '"Trebuchet MS", sans-serif',
                        fontSize: 14,
                        lineHeight: 1.4,
                    }}
                >
                    {formattedMessages.length === 0 ? (
                        <div style={{ opacity: 0.7 }}>Todavía no hay mensajes.</div>
                    ) : (
                        formattedMessages.map((entry) => (
                            <div key={entry.key} style={{ marginBottom: 6, wordBreak: 'break-word' }}>
                                <span style={{ opacity: 0.7 }}>[{entry.time}] </span>
                                <span style={{ fontWeight: 700 }}>{entry.senderCharacterName}:</span>{' '}
                                <span>{entry.message}</span>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <input
                        type="text"
                        value={draft}
                        maxLength={256}
                        aria-label="Mensaje de chat"
                        placeholder="Escribí un mensaje…"
                        onChange={(e) => setDraft(e.target.value)}
                        onFocus={suppressPointerLeak}
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            suppressPointerLeak();
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '8px 10px',
                            border: '1px solid rgba(240, 220, 180, 0.35)',
                            background: 'rgba(12, 8, 4, 0.85)',
                            color: 'var(--rpg-parchment)',
                            fontSize: 14,
                        }}
                    />
                    <RpgButton
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            sendMessage();
                        }}
                        disabled={!draft.trim()}
                        style={{ width: 90 }}
                    >
                        Enviar
                    </RpgButton>
                </div>

                <div
                    aria-label="Controles de grupo"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        padding: 8,
                        border: '1px solid rgba(163, 111, 255, 0.45)',
                        borderRadius: 8,
                        background: 'linear-gradient(90deg, rgba(37, 20, 62, 0.86), rgba(15, 11, 25, 0.78))',
                        flexShrink: 0,
                    }}
                >
                    <button
                        type="button"
                        aria-expanded={partyOpen}
                        onClick={() => {
                            setPartyOpen((open) => !open);
                            suppressPointerLeak();
                        }}
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            suppressPointerLeak();
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            width: '100%',
                            padding: '6px 4px',
                            border: 'none',
                            background: 'transparent',
                            color: partyState.inParty ? '#9df0b5' : 'var(--rpg-parchment)',
                            fontFamily: '"Trebuchet MS", sans-serif',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'left',
                        }}
                    >
                        <span>
                            {partyOpen ? '▾' : '▸'} Grupo{' '}
                            <span style={{ fontWeight: 400, opacity: 0.85, fontSize: 13 }}>
                                {partyState.inParty
                                    ? `· con ${partyState.partnerName ?? 'compañero'}`
                                    : '· sin grupo'}
                            </span>
                        </span>
                    </button>
                    {partyOpen && (
                    <>
                    <div
                        aria-live="polite"
                        style={{
                            fontSize: 13,
                            color: partyState.inParty ? '#9df0b5' : 'var(--rpg-parchment)',
                            opacity: partyState.inParty ? 1 : 0.8,
                        }}
                    >
                        {partyState.inParty
                            ? 'XP y botín compartidos con tu compañero.'
                            : 'Invitá a otro jugador del mismo mapa por su nombre.'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                        type="text"
                        value={partyName}
                        maxLength={24}
                        aria-label="Nombre del jugador para invitar"
                        placeholder="Nombre del jugador"
                        disabled={partyState.inParty}
                        onChange={(e) => setPartyName(e.target.value)}
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            suppressPointerLeak();
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter' && partyName.trim()) {
                                e.preventDefault();
                                sendPartyCommand(`/party invitar ${partyName.trim()}`);
                                setPartyName('');
                            }
                        }}
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '10px 12px',
                            border: '1px solid rgba(206, 175, 255, 0.45)',
                            borderRadius: 6,
                            background: 'rgba(10, 7, 17, 0.85)',
                            color: 'var(--rpg-parchment)',
                            fontSize: 14,
                        }}
                    />
                    <RpgButton
                        disabled={!partyName.trim() || partyState.inParty}
                        onClick={() => {
                            sendPartyCommand(`/party invitar ${partyName.trim()}`);
                            setPartyName('');
                        }}
                        style={{ width: '100%' }}
                    >
                        Invitar
                    </RpgButton>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                    <RpgButton onClick={() => sendPartyCommand('/party aceptar')} style={{ flex: 1 }}>Aceptar</RpgButton>
                    <RpgButton onClick={() => sendPartyCommand('/party rechazar')} style={{ flex: 1 }}>Rechazar</RpgButton>
                    <RpgButton onClick={() => sendPartyCommand('/party salir')} style={{ flex: 1 }}>Salir</RpgButton>
                    </div>
                    </>
                    )}
                </div>
            </div>
        </DraggableDialog>
    );
}
