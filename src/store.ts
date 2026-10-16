// ============================================================
// アプリ状態（データ本体 + 元に戻す/やり直す + 自動保存）
// ============================================================
import { create } from 'zustand';
import { produce } from 'immer';
import { Id, TimetableData, emptyData } from './core/types';
import { cleanup } from './core/logic';
import { parseSaveFile } from './core/io';

const STORAGE_KEY = 'timetable-kun-v2';
const MAX_HISTORY = 100;

export type ViewType = 'class' | 'teacher' | 'room';

/** 時間割編集の選択状態 */
export type Selection =
  | { kind: 'none' }
  | { kind: 'lesson'; lessonId: Id }
  | { kind: 'placement'; placementId: Id };

export interface Toast { id: number; text: string; tone: 'ok' | 'error' | 'info' }

interface AppState {
  data: TimetableData;
  past: TimetableData[];
  future: TimetableData[];
  /** 最後に保存した時刻（表示用） */
  savedAt: number | null;
  saveError: string | null;

  page: string;
  view: { type: ViewType; id: Id | null };
  selection: Selection;
  toasts: Toast[];

  /** データを変更する唯一の入口。変更後に参照の掃除と自動保存を行う */
  update: (fn: (d: TimetableData) => void, opts?: { label?: string }) => void;
  replaceAll: (d: TimetableData) => void;
  undo: () => void;
  redo: () => void;

  setPage: (p: string) => void;
  setView: (type: ViewType, id: Id | null) => void;
  select: (s: Selection) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
}

function load(): TimetableData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseSaveFile(raw);
  } catch (e) {
    console.error(e);
  }
  return emptyData();
}

let saveTimer: number | undefined;
function scheduleSave(get: () => AppState, set: (p: Partial<AppState>) => void) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get().data));
      set({ savedAt: Date.now(), saveError: null });
    } catch (e) {
      set({ saveError: 'ブラウザへの保存に失敗しました。「データ」画面からファイルに保存してください。' });
      console.error(e);
    }
  }, 300);
}

let toastSeq = 0;

export const useApp = create<AppState>((set, get) => ({
  data: load(),
  past: [],
  future: [],
  savedAt: null,
  saveError: null,
  page: 'home',
  view: { type: 'class', id: null },
  selection: { kind: 'none' },
  toasts: [],

  update: (fn) => {
    const before = get().data;
    const after = produce(before, d => { fn(d); cleanup(d); });
    if (after === before) return;
    set({
      data: after,
      past: [...get().past, before].slice(-MAX_HISTORY),
      future: [],
    });
    scheduleSave(get, set);
  },

  replaceAll: (d) => {
    set({
      data: produce(d, x => { cleanup(x); }),
      past: [...get().past, get().data].slice(-MAX_HISTORY),
      future: [],
      selection: { kind: 'none' },
      view: { type: 'class', id: null },
    });
    scheduleSave(get, set);
  },

  undo: () => {
    const { past, data, future } = get();
    if (past.length === 0) return;
    set({ data: past[past.length - 1], past: past.slice(0, -1), future: [data, ...future], selection: { kind: 'none' } });
    scheduleSave(get, set);
  },

  redo: () => {
    const { past, data, future } = get();
    if (future.length === 0) return;
    set({ data: future[0], past: [...past, data], future: future.slice(1), selection: { kind: 'none' } });
    scheduleSave(get, set);
  },

  setPage: (page) => set({ page, selection: { kind: 'none' } }),
  setView: (type, id) => set({ view: { type, id }, selection: { kind: 'none' } }),
  select: (selection) => set({ selection }),
  toast: (text, tone = 'ok') => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    window.setTimeout(() => set({ toasts: get().toasts.filter(t => t.id !== id) }), tone === 'error' ? 6000 : 3000);
  },
}));
