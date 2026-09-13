// Lantern hover: a small pool of light that follows the cursor across the
// glass. The CSS (frost.css) does the rendering from custom properties; this
// only feeds it coordinates. Both percentage (classic overlay divs) and px
// (floating tile backgrounds, which subtract their own origin) variants.
//
// Cost is two CSS variables per frame through requestAnimationFrame: no DOM
// churn, no layout, the gradient repaint composites on the GPU.

let rootEl = null;
let rafId = 0;
let cursorX = 0.5;
let cursorY = 0.5;
let winW = 0;
let winH = 0;
let enabled = true;

function setVar(name, value) {
    rootEl.style.setProperty(name, value);
}

function measure() {
    winW = rootEl.clientWidth || 1;
    winH = rootEl.clientHeight || 1;
}

function onMouseMove(e) {
    if (!enabled) return;
    const rect = rootEl.getBoundingClientRect();
    cursorX = (e.clientX - rect.left) / rect.width;
    cursorY = (e.clientY - rect.top) / rect.height;
    if (!rafId) {
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            setVar('--lantern-x', `${cursorX * 100}%`);
            setVar('--lantern-y', `${cursorY * 100}%`);
            setVar('--lantern-px-x', `${Math.round(cursorX * winW)}`);
            setVar('--lantern-px-y', `${Math.round(cursorY * winH)}`);
        });
    }
}

export function init(root) {
    rootEl = root;
    measure();
    setVar('--lantern-x', '50%');
    setVar('--lantern-y', '50%');
    window.addEventListener('resize', measure);
    root.addEventListener('mousemove', onMouseMove, { passive: true });
    root.addEventListener('mouseenter', () => {
        if (enabled) setVar('--lantern-active', '1');
    });
    root.addEventListener('mouseleave', () => {
        setVar('--lantern-active', '0');
    });
}

// On by default; a settings toggle lands later. Reduced-motion callers use
// this to park the light permanently off.
export function setEnabled(on) {
    enabled = !!on;
    if (rootEl && !enabled) setVar('--lantern-active', '0');
}
