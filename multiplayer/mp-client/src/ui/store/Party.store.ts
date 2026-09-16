import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { PARTY_MEMBER_MOVED_RECEIVED, PARTY_STATUS_UPDATED } from '../../constants/EventNames';

export interface PartyState {
    inParty: boolean;
    partnerPlayerId: string | undefined;
    partnerName: string | undefined;
    partnerX: number | undefined;
    partnerY: number | undefined;
}

const initialPartyState: PartyState = {
    inParty: false,
    partnerPlayerId: undefined,
    partnerName: undefined,
    partnerX: undefined,
    partnerY: undefined,
};

export const partyStore = new Store<PartyState>(initialPartyState);

export function resetPartyState(): void {
    partyStore.setState(() => ({ ...initialPartyState }));
}

EventBus.on(
    PARTY_STATUS_UPDATED,
    (payload: { inParty: boolean; partnerPlayerId: string; partnerName: string }) => {
        partyStore.setState((state) => ({
            ...state,
            inParty: payload.inParty,
            partnerPlayerId: payload.inParty ? payload.partnerPlayerId : undefined,
            partnerName: payload.inParty ? payload.partnerName : undefined,
            partnerX: payload.inParty ? state.partnerX : undefined,
            partnerY: payload.inParty ? state.partnerY : undefined,
        }));
    },
);

EventBus.on(
    PARTY_MEMBER_MOVED_RECEIVED,
    (payload: { playerId: string; characterName: string; x: number; y: number }) => {
        partyStore.setState((state) => {
            if (!state.inParty || state.partnerPlayerId !== payload.playerId) return state;
            return { ...state, partnerX: payload.x, partnerY: payload.y };
        });
    },
);
