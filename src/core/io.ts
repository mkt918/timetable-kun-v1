// ============================================================
// 保存・読み込み・表の貼り付け
// ============================================================
import { TimetableData, emptyData } from './types';
import { cleanup, buildIndex, names, occupantsFor } from './logic';
import { produce } from 'immer';

/** CSV / TSV（Excel からのコピー）を2次元配列にする */
export function parseTable(text: string): string[][] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const firstLine = src.split('\n')[0] ?? '';
  const sep = firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ''));
}

export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map(r => r.map(c => {
    const s = String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
}

export function download(filename: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 保存ファイル（JSON）を読み込み、足りない項目を補って正規化する */
export function parseSaveFile(text: string): TimetableData {
  const raw = JSON.parse(text);
  if (!raw || raw.version !== 2) {
    throw new Error('時間割くん v2 の保存ファイルではありません');
  }
  const base = emptyData();
  const data: TimetableData = {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
  };
  for (const k of ['departments', 'subjects', 'classes', 'teachers', 'rooms', 'divisions', 'meetings', 'groups', 'lessons', 'placements'] as const) {
    if (!Array.isArray(data[k])) (data as unknown as Record<string, unknown>)[k] = [];
  }
  data.teachers = data.teachers.map(t => ({ ...t, divisionIds: t.divisionIds ?? [], unavailable: t.unavailable ?? [], maxPerDay: t.maxPerDay ?? 0, departmentId: t.departmentId ?? null }));
  data.lessons = data.lessons.map(l => ({ ...l, roomId: l.roomId ?? null, groupId: l.groupId ?? null, blockLength: l.blockLength || 1, teacherIds: l.teacherIds ?? [] }));
  data.placements = data.placements.map(p => ({ ...p, locked: !!p.locked, length: p.length || 1 }));
  return produce(data, d => { cleanup(d); });
}

/** 時間割を「対象 × 曜日・時限」のCSVにする */
export function timetableCsv(data: TimetableData, type: 'class' | 'teacher'): string {
  const idx = buildIndex(data);
  const nm = names(data);
  const { days, periods } = data.settings;
  const header = ['', ...days.flatMap(d => Array.from({ length: periods }, (_, p) => `${d}${p + 1}`))];
  const list = type === 'class' ? data.classes : data.teachers;
  const rows = list.map(e => [
    e.name,
    ...days.flatMap((_, d) => Array.from({ length: periods }, (_, p) => {
      const occ = occupantsFor(idx, type, e.id, d, p);
      return occ.map(o => type === 'class'
        ? `${nm.subjectShort(o.lesson.subjectId)}(${o.lesson.teacherIds.map(nm.teacherName).join('・')})`
        : `${nm.subjectShort(o.lesson.subjectId)}(${o.lesson.classIds.map(nm.className).join('・')})`).join(' / ');
    })),
  ]);
  return toCsv([header, ...rows]);
}
