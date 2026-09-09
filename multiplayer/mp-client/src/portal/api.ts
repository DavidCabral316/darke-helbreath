export interface Account { userName: string; email: string; isGameMaster: boolean }
export interface Character { id: string; name: string; town: string; world: string; level: number; experience: number; gender: number; skin: number; hair: number; clothes: number; deletedAt: string | null; online: boolean }
export async function api<T>(path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
        const csrf = await fetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store' });
        if (!csrf.ok) throw new Error('No se pudo contactar con el servidor.');
        headers['X-CSRF-TOKEN'] = (await csrf.json()).token;
        headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? (response.status === 401 ? 'Iniciá sesión para continuar.' : response.status === 429 ? 'Demasiados intentos. Esperá un minuto.' : 'No se pudo completar la solicitud.'));
    }
    return response.json();
}

export function selectedCharacterId(): string | undefined {
    return /^\/play\/([a-f0-9-]+)$/.exec(window.location.pathname)?.[1];
}
let activeName = '';
export function setActiveCharacterName(name: string) { activeName = name; }
export function activeCharacterName() { return activeName; }
