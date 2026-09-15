/** A tiny original arpeggio: bright enough to identify rare loot without masking combat. */
export const SPECIAL_LOOT_CHIME_NOTES = [659.25, 783.99, 987.77, 1318.51] as const;

let audioContext: AudioContext | undefined;

export function playSpecialLootChime(volume: number): void {
    if (volume <= 0) return;
    const AudioContextType = window.AudioContext;
    if (!AudioContextType) return;
    audioContext ??= new AudioContextType();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined);

    const start = audioContext.currentTime + 0.015;
    SPECIAL_LOOT_CHIME_NOTES.forEach((frequency, index) => {
        const oscillator = audioContext!.createOscillator();
        const gain = audioContext!.createGain();
        const noteStart = start + index * 0.09;
        const noteEnd = noteStart + 0.38;
        oscillator.type = index === SPECIAL_LOOT_CHIME_NOTES.length - 1 ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.16), noteStart + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
        oscillator.connect(gain).connect(audioContext!.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteEnd);
    });
}
