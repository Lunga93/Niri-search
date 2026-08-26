// Look Launcher - TypeScript Type Definitions

// Search result from the backend
export interface Candidate {
  id: string;
  title: string;
  subtitle: string;
  kind: 'app' | 'file' | 'folder' | 'command' | 'source' | 'web' | 'calc' | 'clipboard' | 'process';
  path?: string;
  icon?: string;
  extra?: Record<string, unknown>;
}

// Search response
export interface SearchResponse {
  results: Candidate[];
  truncated: boolean;
}

// Action state from qactions
export type ActionState = 
  | { state: 'available' }
  | { state: 'unavailable'; reason: string }
  | { state: 'in_progress' }
  | { state: 'error'; message: string };

// Health issue
export interface HealthIssue {
  id: string;
  kind: string;
  message: string;
}

// Config entry
export interface ConfigEntry {
  key: string;
  value: string;
}

// Config payload from get_config
export interface ConfigPayload {
  entries: ConfigEntry[];
}

// System info
export interface SystemInfo {
  hostname: string;
  os: string;
  kernel: string;
  uptime: number;
  cpu: string;
  memory: { total: number; used: number };
}

// Process info
export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  command: string;
}

// Clipboard entry
export interface ClipboardEntry {
  id: string;
  text: string;
  timestamp: number;
}

// Quick folder
export interface QuickFolder {
  name: string;
  path: string;
  icon?: string;
}

// File meta
export interface FileMeta {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  modified: number;
  permissions: string;
}

// Tool action
export interface ToolAction {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

// Source block
export interface SourceBlock {
  id: string;
  title: string;
  rows: Candidate[];
}

// Translation result
export interface TranslationResult {
  source: string;
  target: string;
  sourceLang: string;
  targetLang: string;
}

// Web suggestion
export interface WebSuggestion {
  text: string;
  url: string;
}

// Calc result
export interface CalcResult {
  expression: string;
  result: string;
}

// Tauri IPC invoke arguments
export interface InvokeArgs {
  [key: string]: unknown;
}

// Window state
export type WindowState = 'hidden' | 'showing' | 'open' | 'closing';

// Search mode
export type SearchMode = 'main' | 'level' | 'clipboard' | 'process' | 'translate' | 'settings' | 'help' | 'commands';
