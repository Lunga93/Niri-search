// Look Launcher - TypeScript IPC Layer
// Typed wrappers for Tauri IPC calls

import type {
  Candidate,
  SearchResponse,
  HealthIssue,
  ConfigEntry,
  SystemInfo,
  ProcessInfo,
  ClipboardEntry,
  QuickFolder,
  FileMeta,
  ToolAction,
  SourceBlock,
  TranslationResult,
  WebSuggestion,
  CalcResult,
  ActionState,
} from '../types/index';

// Tauri IPC types
declare global {
  interface Window {
    __TAURI__: {
      core: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
      event: {
        listen: (event: string, callback: (event: { payload: unknown }) => void) => Promise<() => void>;
      };
    };
  }
}

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

// Search
export async function search(query: string, limit: number = 40): Promise<SearchResponse> {
  return invoke('search', { query, limit }) as Promise<SearchResponse>;
}

export async function recordUsage(candidateId: string, action: string): Promise<void> {
  return invoke('record_usage', { candidateId, action }) as Promise<void>;
}

// File operations
export async function openPath(path: string, kind: string, id: string): Promise<void> {
  return invoke('open_path', { path, kind, id }) as Promise<void>;
}

export async function openElevated(path: string): Promise<void> {
  return invoke('open_elevated', { path }) as Promise<void>;
}

export async function revealPath(path: string): Promise<void> {
  return invoke('reveal_path', { path }) as Promise<void>;
}

// Tool actions
export async function toolActions(actions: string[], row: Record<string, unknown>, isDir: boolean): Promise<ToolAction[]> {
  return invoke('tool_actions', { actions, row, isDir }) as Promise<ToolAction[]>;
}

export async function performToolAction(action: string, row: Record<string, unknown>, isDir: boolean): Promise<void> {
  return invoke('perform_tool_action', { action, row, isDir }) as Promise<void>;
}

// Source blocks
export async function sourceBlock(row: Record<string, unknown>): Promise<SourceBlock> {
  return invoke('source_block', { row }) as Promise<SourceBlock>;
}

export async function sourceBlocks(): Promise<SourceBlock[]> {
  return invoke('source_blocks') as Promise<SourceBlock[]>;
}

export async function performBlock(blockId: string, row: Record<string, unknown>, asTarget: boolean): Promise<void> {
  return invoke('perform_block', { blockId, row, asTarget }) as Promise<void>;
}

export async function sourceRows(blockId: string, parent: string): Promise<Candidate[]> {
  return invoke('source_rows', { blockId, parent }) as Promise<Candidate[]>;
}

export async function sourcePreview(row: Record<string, unknown>): Promise<string> {
  return invoke('source_preview', { row }) as Promise<string>;
}

// Config
export async function reloadConfig(): Promise<void> {
  return invoke('reload_config') as Promise<void>;
}

export async function getConfig(): Promise<ConfigEntry[]> {
  return invoke('get_config') as Promise<ConfigEntry[]>;
}

export async function setConfig(updates: ConfigEntry[]): Promise<void> {
  return invoke('set_config', { updates }) as Promise<void>;
}

export async function resetConfig(): Promise<void> {
  return invoke('reset_config') as Promise<void>;
}

// Index
export async function requestIndexRefresh(): Promise<void> {
  return invoke('request_index_refresh') as Promise<void>;
}

export async function forceIndexRefresh(): Promise<void> {
  return invoke('force_index_refresh') as Promise<void>;
}

// Window
export async function hideWindow(): Promise<void> {
  return invoke('hide_window') as Promise<void>;
}

export async function confirmHide(arm: boolean): Promise<void> {
  return invoke('confirm_hide', { arm }) as Promise<void>;
}

export async function quitApp(): Promise<void> {
  return invoke('quit_app') as Promise<void>;
}

// Icons
export async function getIcon(kind: string, path: string, id: string): Promise<string> {
  return invoke('get_icon', { kind, path, id }) as Promise<string>;
}

// File metadata
export async function getFileMeta(path: string): Promise<FileMeta> {
  return invoke('get_file_meta', { path }) as Promise<FileMeta>;
}

export async function getAppVersion(path: string): Promise<string> {
  return invoke('get_app_version', { path }) as Promise<string>;
}

export async function isDevBuild(): Promise<boolean> {
  return invoke('is_dev_build') as Promise<boolean>;
}

// Clipboard
export async function copyFilesToClipboard(paths: string[]): Promise<void> {
  return invoke('copy_files_to_clipboard', { paths }) as Promise<void>;
}

export async function getClipboardHistory(query: string = ''): Promise<ClipboardEntry[]> {
  return invoke('get_clipboard_history', { query }) as Promise<ClipboardEntry[]>;
}

export async function deleteClipboardEntry(timestamp: number, text: string): Promise<void> {
  return invoke('delete_clipboard_entry', { timestamp, text }) as Promise<void>;
}

export async function copyToClipboard(text: string): Promise<void> {
  return invoke('copy_to_clipboard', { text }) as Promise<void>;
}

export async function copyToClipboardLabeled(text: string, label: string): Promise<void> {
  return invoke('copy_to_clipboard_labeled', { text, label }) as Promise<void>;
}

// Calculator
export async function evalCalc(expr: string): Promise<string> {
  return invoke('eval_calc', { expr }) as Promise<string>;
}

export async function calcInline(query: string): Promise<CalcResult | null> {
  return invoke('calc_inline', { query }) as Promise<CalcResult | null>;
}

// Shell
export async function runShellCommand(cmd: string): Promise<string> {
  return invoke('run_shell_command', { cmd }) as Promise<string>;
}

// System
export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke('get_system_info') as Promise<SystemInfo>;
}

export async function getHomeDir(): Promise<string> {
  return invoke('get_home_dir') as Promise<string>;
}

export async function getPlatform(): Promise<string> {
  return invoke('get_platform') as Promise<string>;
}

// Processes
export async function listProcesses(): Promise<ProcessInfo[]> {
  return invoke('list_processes') as Promise<ProcessInfo[]>;
}

export async function killProcess(pid: number): Promise<void> {
  return invoke('kill_process', { pid }) as Promise<void>;
}

export async function searchProcesses(query: string, refresh: boolean): Promise<ProcessInfo[]> {
  return invoke('search_processes', { query, refresh }) as Promise<ProcessInfo[]>;
}

export async function searchKillTargets(query: string): Promise<ProcessInfo[]> {
  return invoke('search_kill_targets', { query }) as Promise<ProcessInfo[]>;
}

export async function processDetail(pid: number): Promise<Record<string, unknown>> {
  return invoke('process_detail', { pid }) as Promise<Record<string, unknown>>;
}

export async function processCpu(pid: number): Promise<number> {
  return invoke('process_cpu', { pid }) as Promise<number>;
}

// Running apps
export async function listRunningApps(): Promise<ProcessInfo[]> {
  return invoke('list_running_apps') as Promise<ProcessInfo[]>;
}

export async function activateRunningApp(pid: number, desktopId: string, exec: string): Promise<void> {
  return invoke('activate_running_app', { pid, desktopId, exec }) as Promise<void>;
}

// Folders
export async function getQuickFolders(): Promise<QuickFolder[]> {
  return invoke('get_quick_folders') as Promise<QuickFolder[]>;
}

export async function scanMusicFolder(folder: string): Promise<string[]> {
  return invoke('scan_music_folder', { folder }) as Promise<string[]>;
}

export async function pickFolder(): Promise<string | null> {
  return invoke('pick_folder') as Promise<string | null>;
}

export async function pickImage(): Promise<string | null> {
  return invoke('pick_image') as Promise<string | null>;
}

export async function listFolder(path: string): Promise<FileMeta[]> {
  return invoke('list_folder', { path }) as Promise<FileMeta[]>;
}

// Fonts
export async function listFonts(): Promise<string[]> {
  return invoke('list_fonts') as Promise<string[]>;
}

// Blur
export async function setBlurRegion(rects: Array<{ x: number; y: number; width: number; height: number }>): Promise<void> {
  return invoke('set_blur_region', { rects }) as Promise<void>;
}

// Window effects
export async function listCandidateDrives(): Promise<string[]> {
  return invoke('list_candidate_drives') as Promise<string[]>;
}

export async function setWindowEffect(effect: string): Promise<void> {
  return invoke('set_window_effect', { effect }) as Promise<void>;
}

// Translation
export async function translate(text: string, targetLang: string): Promise<TranslationResult> {
  return invoke('translate', { text, targetLang }) as Promise<TranslationResult>;
}

// Quick Actions
export async function quickActions(resultId: string, kind: string): Promise<ToolAction[]> {
  return invoke('quick_actions', { resultId, kind }) as Promise<ToolAction[]>;
}

export async function launchpadLayout(): Promise<ToolAction[]> {
  return invoke('launchpad_layout') as Promise<ToolAction[]>;
}

export async function systemUptime(): Promise<string | null> {
  return invoke('system_uptime') as Promise<string | null>;
}

export async function quickActionState(actionId: string, infoKeys: string[]): Promise<ActionState> {
  return invoke('quick_action_state', { actionId, infoKeys }) as Promise<ActionState>;
}

export async function quickActionApply(actionId: string, intent: Record<string, unknown>): Promise<void> {
  return invoke('quick_action_apply', { actionId, intent }) as Promise<void>;
}

export async function quickActionApplyItem(actionId: string, itemId: string, intent: Record<string, unknown>): Promise<void> {
  return invoke('quick_action_apply_item', { actionId, itemId, intent }) as Promise<void>;
}

// Weather
export async function weatherCurrent(): Promise<Record<string, unknown> | null> {
  return invoke('weather_current') as Promise<Record<string, unknown> | null>;
}

// Now Playing
export async function nowPlayingCurrent(): Promise<Record<string, unknown> | null> {
  return invoke('now_playing_current') as Promise<Record<string, unknown> | null>;
}

export async function nowPlayingCommand(command: string, player: string): Promise<boolean> {
  return invoke('now_playing_command', { command, player }) as Promise<boolean>;
}

// Lunar date
export async function lunarDate(year: number, month: number, day: number, tz: number): Promise<{ day: number; month: number; year: number; leap: boolean }> {
  return invoke('lunar_date', { year, month, day, tz }) as Promise<{ day: number; month: number; year: number; leap: boolean }>;
}

// Speed test
export async function speedTest(): Promise<Record<string, unknown>> {
  return invoke('speed_test') as Promise<Record<string, unknown>>;
}

export async function localIpv4(): Promise<string | null> {
  return invoke('local_ipv4') as Promise<string | null>;
}

// Todo
export async function todoList(): Promise<Array<{ id: string; name: string; done: boolean; due_date?: string; created_at_unix_s: number }>> {
  return invoke('todo_list') as Promise<Array<{ id: string; name: string; done: boolean; due_date?: string; created_at_unix_s: number }>>;
}

export async function todoSave(tasks: Array<{ id: string; name: string; done: boolean; due_date?: string; created_at_unix_s: number }>): Promise<void> {
  return invoke('todo_save', { tasks }) as Promise<void>;
}

// Music
export async function musicPlay(path: string): Promise<void> {
  return invoke('music_play', { path }) as Promise<void>;
}

export async function musicPauseBackend(): Promise<void> {
  return invoke('music_pause') as Promise<void>;
}

export async function musicResumeBackend(): Promise<void> {
  return invoke('music_resume') as Promise<void>;
}

export async function musicStopBackend(): Promise<void> {
  return invoke('music_stop') as Promise<void>;
}

export async function musicIsFinished(): Promise<boolean> {
  return invoke('music_is_finished') as Promise<boolean>;
}

// Autostart
export async function setAutostart(enabled: boolean): Promise<void> {
  return invoke('set_autostart', { enabled }) as Promise<void>;
}

export async function getAutostart(): Promise<boolean> {
  return invoke('get_autostart') as Promise<boolean>;
}

// Highlight
export async function highlightFile(path: string): Promise<string> {
  return invoke('highlight_file_cmd', { path }) as Promise<string>;
}

export async function highlightShell(source: string): Promise<string> {
  return invoke('highlight_shell_cmd', { source }) as Promise<string>;
}

// Trash
export async function trashPaths(paths: string[]): Promise<void> {
  return invoke('trash_paths', { paths }) as Promise<void>;
}

export async function countTrashItems(): Promise<number> {
  return invoke('count_trash_items') as Promise<number>;
}

export async function emptyTrash(): Promise<void> {
  return invoke('empty_trash') as Promise<void>;
}

// AI / Web answers
export async function instantHasMatch(query: string): Promise<boolean> {
  return invoke('instant_has_match', { query }) as Promise<boolean>;
}

export async function definitionalEntity(query: string): Promise<{ text: string; source: string; url?: string } | null> {
  return invoke('definitional_entity', { query }) as Promise<{ text: string; source: string; url?: string } | null>;
}

export async function instantAnswer(query: string): Promise<{ text: string; source: string; url?: string } | null> {
  return invoke('instant_answer', { query }) as Promise<{ text: string; source: string; url?: string } | null>;
}

export async function duckduckgoAnswer(query: string): Promise<{ text: string; source: string; url?: string } | null> {
  return invoke('duckduckgo_answer', { query }) as Promise<{ text: string; source: string; url?: string } | null>;
}

export async function wikipediaAnswer(term: string): Promise<{ text: string; source: string; url?: string } | null> {
  return invoke('wikipedia_answer', { term }) as Promise<{ text: string; source: string; url?: string } | null>;
}

export async function webSuggestions(query: string, limit: number): Promise<WebSuggestion[]> {
  return invoke('web_suggestions', { query, limit }) as Promise<WebSuggestion[]>;
}

// URL classification
export async function classifyUrl(query: string): Promise<{ url: string; tier: string } | null> {
  return invoke('classify_url', { query }) as Promise<{ url: string; tier: string } | null>;
}

export async function recordUrlHit(url: string): Promise<void> {
  return invoke('record_url_hit', { url }) as Promise<void>;
}

export async function recentUrls(query: string, limit: number): Promise<Array<{ url: string; title: string; hit_count: number; last_used_at_unix_s: number; score: number }>> {
  return invoke('recent_urls', { query, limit }) as Promise<Array<{ url: string; title: string; hit_count: number; last_used_at_unix_s: number; score: number }>>;
}

// Health
export async function getHealthIssues(): Promise<HealthIssue[]> {
  return invoke('get_health_issues') as Promise<HealthIssue[]>;
}

// Events
export async function onWindowShown(callback: () => void): Promise<() => void> {
  return listen('window-shown', () => callback());
}

export async function onWindowHidden(callback: () => void): Promise<() => void> {
  return listen('window-hidden', () => callback());
}

export async function onHealthChanged(callback: (issues: HealthIssue[]) => void): Promise<() => void> {
  return listen('health-changed', (event) => callback(event.payload as HealthIssue[]));
}

export async function onIndexReady(callback: () => void): Promise<() => void> {
  return listen('index-ready', () => callback());
}

// Version
export async function getLookappVersion(): Promise<string> {
  return invoke('get_lookapp_version') as Promise<string>;
}
