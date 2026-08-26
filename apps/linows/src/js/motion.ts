// Shell entrance motion. The window is only hidden and re-shown, never rebuilt,
// so the reveal replays on every summon instead of running once per process.

const ARMED = 'is-armed';
const ENTERING = 'is-entering';
const REPLAY_GUARD_MS = 250;

let root: HTMLElement | null = null;
let lastPlay = -Infinity;

export function init(rootEl: HTMLElement): void {
    root = rootEl;
}

export function playReveal(): void {
    if (!root) return;
    const now = performance.now();
    if (now - lastPlay < REPLAY_GUARD_MS) return;
    lastPlay = now;
    root.classList.remove(ARMED, ENTERING);
    void root.offsetWidth;
    root.classList.add(ENTERING);
}

export function armReveal(): void {
    if (!root) return;
    lastPlay = -Infinity;
    root.classList.remove(ENTERING);
    root.classList.add(ARMED);
    void root.offsetWidth;
}
