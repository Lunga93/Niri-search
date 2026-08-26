import { getPlatform } from './ipc.ts';

interface PlatformInfo {
    os: string;
    has_compositor: boolean;
    compositor: string | null;
    compositor_blur?: boolean;
    virtual_gpu?: boolean;
}

interface BlurStyle {
    value: string;
    label: string;
    hint: string;
}

let info: PlatformInfo | null = null;

export async function init(): Promise<void> {
    try {
        info = await getPlatform() as unknown as PlatformInfo;
    } catch {
        info = { os: 'linux', has_compositor: false, compositor: null };
    }
    document.documentElement.setAttribute('data-os', info.os);
    if (info.compositor) {
        document.documentElement.setAttribute('data-compositor', info.compositor);
    }
    document.documentElement.setAttribute('data-transparent', String(hasCompositor()));
    if (blurForcedOff()) {
        document.documentElement.setAttribute('data-disable-blur', '');
    }
    if (compositorBlur()) {
        document.documentElement.setAttribute('data-blur', 'compositor');
    }
}

export function compositorBlur(): boolean {
    return info?.compositor_blur ?? false;
}

export function blurForcedOff(): boolean {
    return info?.virtual_gpu ?? false;
}

export function floatingSupported(): boolean {
    return (
        hasCompositor() &&
        !blurForcedOff() &&
        compositor() !== 'hyprland' &&
        !document.documentElement.hasAttribute('data-disable-blur')
    );
}

export function os(): string {
    return info?.os || 'linux';
}

export function hasCompositor(): boolean {
    return info?.has_compositor ?? false;
}

export function compositor(): string | null {
    return info?.compositor || null;
}

export function isWindows(): boolean {
    return info?.os === 'windows';
}

export function isLinux(): boolean {
    return info?.os === 'linux';
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function prefersReducedMotion(): boolean {
    return reduceMotion.matches && !isWindows();
}

export function onReducedMotionChange(callback: () => void): void {
    reduceMotion.addEventListener('change', callback);
}

export function canRunElevated(item: { kind?: string; path?: string }): boolean {
    return isWindows() && item?.kind === 'app' && !item.path?.startsWith('ms-settings:');
}

export function systemFileManager(): string | null {
    return isWindows() ? 'Explorer' : null;
}

export function trashLabel(): string {
    return isWindows() ? 'Recycle Bin' : 'Trash';
}

const WINDOWS_BLUR_RADIUS: Record<string, number> = {
    high_contrast: 30,
    balanced: 20,
    soft: 12,
};

export function applyBlur(radius: number, style: string): void {
    const r = isWindows()
        ? (WINDOWS_BLUR_RADIUS[style] ?? WINDOWS_BLUR_RADIUS.balanced)
        : hasCompositor()
          ? Math.round(radius)
          : 0;
    document.documentElement.style.setProperty('--blur-radius', r + 'px');
}

export function getBlurStyles(): BlurStyle[] {
    if (isWindows()) {
        return [
            { value: 'high_contrast', label: 'Mica', hint: 'Windows 11 native blur' },
            { value: 'balanced', label: 'Acrylic', hint: 'Translucent with blur' },
            { value: 'soft', label: 'Acrylic (Soft)', hint: 'Lightest acrylic' },
        ];
    }
    return [
        { value: 'high_contrast', label: 'High Contrast', hint: 'Darkest and most readable' },
        { value: 'balanced', label: 'Balanced', hint: 'Default translucency' },
        { value: 'soft', label: 'Soft', hint: 'Lightest, most transparent' },
    ];
}
