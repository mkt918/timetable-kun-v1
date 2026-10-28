// ============================================================
// 配置判定・配置操作・チェック（純粋関数）
// ============================================================
import {
  Id, Lesson, Placement, TimetableData, newId, slotKey,
} from './types';

// ------------------------------------------------------------
// 参照用インデックス
// ------------------------------------------------------------

export interface Occupant {
  placement: Placement;
  lesson: Lesson;
}

export interface Index {
  lessonById: Map<Id, Lesson>;
  /** slotKey -> その枠を占めている配置 */
  occupancy: Map<string, Occupant[]>;
  /** lessonId -> 配置済みコマ数 */
  placedHours: Map<Id, number>;
  /** teacherId -> 会議で埋まっている slotKey -> 会議名 */
  meetingSlots: Map<Id, Map<string, string>>;
  /** groupId -> 授業 */
  groupLessons: Map<Id, Lesson[]>;
}

export function buildIndex(data: TimetableData): Index {
  const lessonById = new Map(data.lessons.map(l => [l.id, l]));
  const occupancy = new Map<string, Occupant[]>();
  const placedHours = new Map<Id, number>();
  for (const pl of data.placements) {
    const lesson = lessonById.get(pl.lessonId);
    if (!lesson) continue;
    placedHours.set(lesson.id, (placedHours.get(lesson.id) ?? 0) + pl.length);
    for (let i = 0; i < pl.length; i++) {
      const key = slotKey(pl.day, pl.period + i);
      const list = occupancy.get(key);
      if (list) list.push({ placement: pl, lesson });
      else occupancy.set(key, [{ placement: pl, lesson }]);
    }
  }
  const meetingSlots = new Map<Id, Map<string, string>>();
  for (const m of data.meetings) {
    for (const tid of m.teacherIds) {
      let map = meetingSlots.get(tid);
      if (!map) meetingSlots.set(tid, (map = new Map()));
      for (const s of m.slots) map.set(s, m.name);
    }
  }
  const groupLessons = new Map<Id, Lesson[]>();
  for (const l of data.lessons) {
    if (!l.groupId) continue;
    const list = groupLessons.get(l.groupId);
    if (list) list.push(l);
    else groupLessons.set(l.groupId, [l]);
  }
  return { lessonById, occupancy, placedHours, meetingSlots, groupLessons };
}

export const remainingHours = (idx: Index, lesson: Lesson) =>
  lesson.weeklyCount - (idx.placedHours.get(lesson.id) ?? 0);

/** 次に置くときのコマ数（端数があれば短くなる） */
export const nextLength = (idx: Index, lesson: Lesson) =>
  Math.max(0, Math.min(lesson.blockLength, remainingHours(idx, lesson)));

// ------------------------------------------------------------
// 表示用の名前解決
// ------------------------------------------------------------

export function names(data: TimetableData) {
  const subject = new Map(data.subjects.map(s => [s.id, s]));
  const cls = new Map(data.classes.map(c => [c.id, c]));
  const teacher = new Map(data.teachers.map(t => [t.id, t]));
  const room = new Map(data.rooms.map(r => [r.id, r]));
  const dept = new Map(data.departments.map(d => [d.id, d]));
  const group = new Map(data.groups.map(g => [g.id, g]));
  return {
    subject, cls, teacher, room, dept, group,
    subjectName: (id: Id) => subject.get(id)?.name ?? '（不明な科目）',
    subjectShort: (id: Id) => {
      const s = subject.get(id);
      return s ? (s.shortName || s.name) : '?';
    },
    className: (id: Id) => cls.get(id)?.name ?? '?',
    teacherName: (id: Id) => teacher.get(id)?.name ?? '?',
    roomName: (id: Id | null) => (id ? room.get(id)?.name ?? '?' : ''),
    lessonColor: (l: Lesson) => {
      const s = subject.get(l.subjectId);
      return (s?.departmentId && dept.get(s.departmentId)?.color) || '#94a3b8';
    },
    lessonLabel: (l: Lesson) => {
      const sub = subject.get(l.subjectId);
      const c = l.classIds.map(id => cls.get(id)?.name ?? '?').join('・');
      const t = l.teacherIds.map(id => teacher.get(id)?.name ?? '?').join('・');
      return `${sub?.name ?? '?'}（${c} / ${t}）`;
    },
  };
}
export type Names = ReturnType<typeof names>;

// ------------------------------------------------------------
// 配置できるかの判定
// ------------------------------------------------------------

export type ReasonKind =
  | 'range' | 'full' | 'class' | 'teacher' | 'room' | 'unavailable' | 'meeting' | 'maxPerDay';

export interface Reason {
  kind: ReasonKind;
  message: string;
}

/** 同じ選択群でまとめて動く授業と、それぞれの配置 */
interface MovingUnit {
  lesson: Lesson;
  length: number;
  /** 移動の場合、元の配置 */
  from: Placement | null;
}

/** 選択群の同じ枠に並んでいる配置（自分を含む） */
export function groupMates(data: TimetableData, idx: Index, pl: Placement): Placement[] {
  const lesson = idx.lessonById.get(pl.lessonId);
  if (!lesson?.groupId) return [pl];
  const mateIds = new Set((idx.groupLessons.get(lesson.groupId) ?? []).map(l => l.id));
  return data.placements.filter(
    p => mateIds.has(p.lessonId) && p.day === pl.day && p.period === pl.period,
  );
}

function unitsForNew(idx: Index, lesson: Lesson): MovingUnit[] {
  const lessons = lesson.groupId ? idx.groupLessons.get(lesson.groupId) ?? [lesson] : [lesson];
  const units: MovingUnit[] = [];
  for (const l of lessons) {
    const len = nextLength(idx, l);
    if (len > 0) units.push({ lesson: l, length: len, from: null });
  }
  return units;
}

function unitsForMove(data: TimetableData, idx: Index, pl: Placement): MovingUnit[] {
  return groupMates(data, idx, pl).map(p => ({
    lesson: idx.lessonById.get(p.lessonId)!, length: p.length, from: p,
  }));
}

function checkUnits(
  data: TimetableData, idx: Index, units: MovingUnit[], day: number, period: number, nm: Names,
): Reason[] {
  const reasons: Reason[] = [];
  const add = (kind: ReasonKind, message: string) => {
    if (!reasons.some(r => r.message === message)) reasons.push({ kind, message });
  };
  if (units.length === 0) {
    add('full', 'すでに全コマ配置済みです');
    return reasons;
  }
  const ignore = new Set(units.map(u => u.from?.id).filter(Boolean) as string[]);
  const groupId = units[0].lesson.groupId;
  const teacherById = new Map(data.teachers.map(t => [t.id, t]));

  for (const u of units) {
    if (period + u.length > data.settings.periods) {
      add('range', `${u.length}コマ連続が最終時限を超えます`);
      continue;
    }
    for (let i = 0; i < u.length; i++) {
      const key = slotKey(day, period + i);
      const occ = (idx.occupancy.get(key) ?? []).filter(o => !ignore.has(o.placement.id));
      for (const o of occ) {
        const sameGroup = groupId && o.lesson.groupId === groupId;
        const label = nm.subjectName(o.lesson.subjectId);
        if (!sameGroup) {
          for (const c of u.lesson.classIds) {
            if (o.lesson.classIds.includes(c)) add('class', `${nm.className(c)}は「${label}」が入っています`);
          }
        }
        for (const t of u.lesson.teacherIds) {
          if (o.lesson.teacherIds.includes(t)) add('teacher', `${nm.teacherName(t)}先生は「${label}」を担当中です`);
        }
        if (u.lesson.roomId && o.lesson.roomId === u.lesson.roomId) {
          add('room', `${nm.roomName(u.lesson.roomId)}は「${label}」で使用中です`);
        }
      }
      for (const t of u.lesson.teacherIds) {
        const teacher = teacherById.get(t);
        if (teacher?.unavailable.includes(key)) add('unavailable', `${teacher.name}先生の勤務不可の時間です`);
        const meeting = idx.meetingSlots.get(t)?.get(key);
        if (meeting) add('meeting', `${nm.teacherName(t)}先生は「${meeting}」があります`);
      }
    }
  }
  return reasons;
}

/** 未配置の授業を (day, period) に置けるか。空配列なら置ける */
export function checkPlace(
  data: TimetableData, idx: Index, lessonId: Id, day: number, period: number, nm: Names,
): Reason[] {
  const lesson = idx.lessonById.get(lessonId);
  if (!lesson) return [{ kind: 'full', message: '授業が見つかりません' }];
  return checkUnits(data, idx, unitsForNew(idx, lesson), day, period, nm);
}

/** 配置済みの授業を (day, period) へ動かせるか */
export function checkMove(
  data: TimetableData, idx: Index, placementId: Id, day: number, period: number, nm: Names,
): Reason[] {
  const pl = data.placements.find(p => p.id === placementId);
  if (!pl) return [{ kind: 'full', message: '配置が見つかりません' }];
  return checkUnits(data, idx, unitsForMove(data, idx, pl), day, period, nm);
}

// ------------------------------------------------------------
// 配置操作（immer の draft を直接書き換える）
// ------------------------------------------------------------

export function placeLesson(draft: TimetableData, lessonId: Id, day: number, period: number) {
  const idx = buildIndex(draft);
  const lesson = idx.lessonById.get(lessonId);
  if (!lesson) return;
  for (const u of unitsForNew(idx, lesson)) {
    draft.placements.push({
      id: newId('pl'), lessonId: u.lesson.id, day, period, length: u.length, locked: false,
    });
  }
}

export function movePlacement(draft: TimetableData, placementId: Id, day: number, period: number) {
  const idx = buildIndex(draft);
  const pl = draft.placements.find(p => p.id === placementId);
  if (!pl) return;
  const ids = new Set(groupMates(draft, idx, pl).map(p => p.id));
  for (const p of draft.placements) {
    if (ids.has(p.id)) { p.day = day; p.period = period; }
  }
}

export function removePlacement(draft: TimetableData, placementId: Id) {
  const idx = buildIndex(draft);
  const pl = draft.placements.find(p => p.id === placementId);
  if (!pl) return;
  const ids = new Set(groupMates(draft, idx, pl).map(p => p.id));
  draft.placements = draft.placements.filter(p => !ids.has(p.id));
}

export function toggleLock(draft: TimetableData, placementId: Id) {
  const idx = buildIndex(draft);
  const pl = draft.placements.find(p => p.id === placementId);
  if (!pl) return;
  const next = !pl.locked;
  const ids = new Set(groupMates(draft, idx, pl).map(p => p.id));
  for (const p of draft.placements) if (ids.has(p.id)) p.locked = next;
}

/** 2つの配置の位置を入れ替える（どちらも同じ長さのとき） */
export function checkSwap(
  data: TimetableData, a: Placement, b: Placement, nm: Names,
): Reason[] {
  const rest = { ...data, placements: data.placements.filter(p => p.id !== a.id && p.id !== b.id) };
  const idx = buildIndex(rest);
  const ra = checkUnits(rest, idx, [{ lesson: idx.lessonById.get(a.lessonId)!, length: a.length, from: null }], b.day, b.period, nm);
  const idx2 = buildIndex({ ...rest, placements: [...rest.placements, { ...a, day: b.day, period: b.period }] });
  const rb = checkUnits(rest, idx2, [{ lesson: idx2.lessonById.get(b.lessonId)!, length: b.length, from: null }], a.day, a.period, nm);
  return [...ra, ...rb];
}

export function swapPlacements(draft: TimetableData, aId: Id, bId: Id) {
  const a = draft.placements.find(p => p.id === aId);
  const b = draft.placements.find(p => p.id === bId);
  if (!a || !b) return;
  const { day, period } = a;
  a.day = b.day; a.period = b.period;
  b.day = day; b.period = period;
}

// ------------------------------------------------------------
// 削除時の整合性維持
// ------------------------------------------------------------

/** マスターの削除に合わせて、参照しているデータを掃除する */
export function cleanup(draft: TimetableData) {
  const subj = new Set(draft.subjects.map(s => s.id));
  const cls = new Set(draft.classes.map(c => c.id));
  const tch = new Set(draft.teachers.map(t => t.id));
  const room = new Set(draft.rooms.map(r => r.id));
  const grp = new Set(draft.groups.map(g => g.id));
  const div = new Set(draft.divisions.map(d => d.id));
  const dept = new Set(draft.departments.map(d => d.id));
  const P = draft.settings.periods, D = draft.settings.days.length;
  const validSlot = (k: string) => {
    const [d, p] = k.split('-').map(Number);
    return d < D && p < P;
  };

  draft.subjects.forEach(s => { if (s.departmentId && !dept.has(s.departmentId)) s.departmentId = null; });
  draft.teachers.forEach(t => {
    if (t.departmentId && !dept.has(t.departmentId)) t.departmentId = null;
    t.divisionIds = t.divisionIds.filter(d => div.has(d));
    t.unavailable = t.unavailable.filter(validSlot);
  });
  draft.classes.forEach(c => { if (c.homeroomTeacherId && !tch.has(c.homeroomTeacherId)) c.homeroomTeacherId = null; });
  draft.meetings.forEach(m => {
    m.teacherIds = m.teacherIds.filter(t => tch.has(t));
    m.slots = m.slots.filter(validSlot);
  });
  draft.lessons.forEach(l => {
    l.classIds = l.classIds.filter(c => cls.has(c));
    l.teacherIds = l.teacherIds.filter(t => tch.has(t));
    if (l.roomId && !room.has(l.roomId)) l.roomId = null;
    if (l.groupId && !grp.has(l.groupId)) l.groupId = null;
  });
  draft.lessons = draft.lessons.filter(l => subj.has(l.subjectId) && l.classIds.length > 0);

  const lessonById = new Map(draft.lessons.map(l => [l.id, l]));
  draft.placements = draft.placements.filter(p => {
    const l = lessonById.get(p.lessonId);
    return l && p.day < D && p.period + p.length <= P;
  });
  // 週コマ数を減らした場合などに、超過分の配置を後ろから外す
  const hours = new Map<Id, number>();
  draft.placements = draft.placements.filter(p => {
    const l = lessonById.get(p.lessonId)!;
    const h = (hours.get(l.id) ?? 0) + p.length;
    if (h > l.weeklyCount) return false;
    hours.set(l.id, h);
    return true;
  });
}

// ------------------------------------------------------------
// チェック（問題点の一覧）
// ------------------------------------------------------------

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  severity: Severity;
  category: string;
  message: string;
  /** 関連する枠（クリックでジャンプ） */
  day?: number;
  period?: number;
  /** ジャンプ先 */
  target?: { type: 'class' | 'teacher' | 'room'; id: Id };
}

export function findIssues(data: TimetableData): Issue[] {
  const idx = buildIndex(data);
  const nm = names(data);
  const issues: Issue[] = [];
  const { days } = data.settings;
  const at = (d: number, p: number) => `${days[d]}${p + 1}`;

  // 授業データ自体の問題
  for (const l of data.lessons) {
    if (l.teacherIds.length === 0) {
      issues.push({
        severity: 'error', category: '授業の設定',
        message: `${nm.subjectName(l.subjectId)}（${l.classIds.map(nm.className).join('・')}）に教員が設定されていません`,
        target: { type: 'class', id: l.classIds[0] },
      });
    }
  }

  // 重複（二重予約）
  for (const [key, occ] of idx.occupancy) {
    const [d, p] = key.split('-').map(Number);
    const seen = new Set<string>();
    for (let i = 0; i < occ.length; i++) {
      for (let j = i + 1; j < occ.length; j++) {
        const a = occ[i].lesson, b = occ[j].lesson;
        const sameGroup = a.groupId && a.groupId === b.groupId;
        if (!sameGroup) {
          for (const c of a.classIds.filter(c => b.classIds.includes(c))) {
            const k = `c${c}`;
            if (seen.has(k)) continue;
            seen.add(k);
            issues.push({
              severity: 'error', category: 'クラスの重複', day: d, period: p,
              message: `${at(d, p)} ${nm.className(c)}：「${nm.subjectName(a.subjectId)}」と「${nm.subjectName(b.subjectId)}」が重なっています`,
              target: { type: 'class', id: c },
            });
          }
        }
        for (const t of a.teacherIds.filter(t => b.teacherIds.includes(t))) {
          const k = `t${t}`;
          if (seen.has(k)) continue;
          seen.add(k);
          issues.push({
            severity: 'error', category: '教員の重複', day: d, period: p,
            message: `${at(d, p)} ${nm.teacherName(t)}先生：「${nm.subjectName(a.subjectId)}」と「${nm.subjectName(b.subjectId)}」が重なっています`,
            target: { type: 'teacher', id: t },
          });
        }
        if (a.roomId && a.roomId === b.roomId && !seen.has(`r${a.roomId}`)) {
          seen.add(`r${a.roomId}`);
          issues.push({
            severity: 'error', category: '教室の重複', day: d, period: p,
            message: `${at(d, p)} ${nm.roomName(a.roomId)}：「${nm.subjectName(a.subjectId)}」と「${nm.subjectName(b.subjectId)}」が重なっています`,
            target: { type: 'room', id: a.roomId },
          });
        }
      }
    }
    // 勤務不可・会議
    const tSeen = new Set<string>();
    for (const o of occ) {
      for (const t of o.lesson.teacherIds) {
        if (tSeen.has(t)) continue;
        tSeen.add(t);
        const teacher = nm.teacher.get(t);
        if (teacher?.unavailable.includes(key)) {
          issues.push({
            severity: 'error', category: '勤務不可', day: d, period: p,
            message: `${at(d, p)} ${teacher.name}先生の勤務不可の時間に「${nm.subjectName(o.lesson.subjectId)}」が入っています`,
            target: { type: 'teacher', id: t },
          });
        }
        const m = idx.meetingSlots.get(t)?.get(key);
        if (m) {
          issues.push({
            severity: 'error', category: '会議と重複', day: d, period: p,
            message: `${at(d, p)} ${nm.teacherName(t)}先生：「${m}」と「${nm.subjectName(o.lesson.subjectId)}」が重なっています`,
            target: { type: 'teacher', id: t },
          });
        }
      }
    }
  }

  // 1日の授業上限
  for (const t of data.teachers) {
    if (!t.maxPerDay) continue;
    for (let d = 0; d < days.length; d++) {
      let n = 0;
      for (let p = 0; p < data.settings.periods; p++) {
        if ((idx.occupancy.get(slotKey(d, p)) ?? []).some(o => o.lesson.teacherIds.includes(t.id))) n++;
      }
      if (n > t.maxPerDay) {
        issues.push({
          severity: 'warning', category: '1日の上限超過', day: d,
          message: `${days[d]}曜 ${t.name}先生：${n}コマ（上限${t.maxPerDay}コマ）`,
          target: { type: 'teacher', id: t.id },
        });
      }
    }
  }

  // 同じ授業が同じ日に2回以上（連続ブロックは1回と数える）
  const perDay = new Map<string, number>();
  for (const p of data.placements) {
    const k = `${p.lessonId}|${p.day}`;
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  for (const [k, n] of perDay) {
    if (n < 2) continue;
    const [lid, d] = k.split('|');
    const l = idx.lessonById.get(lid);
    if (!l) continue;
    issues.push({
      severity: 'warning', category: '同じ日に複数回', day: Number(d),
      message: `${days[Number(d)]}曜 ${nm.lessonLabel(l)}が${n}回入っています`,
      target: { type: 'class', id: l.classIds[0] },
    });
  }

  // 未配置
  for (const l of data.lessons) {
    const r = remainingHours(idx, l);
    if (r > 0) {
      issues.push({
        severity: 'info', category: '未配置',
        message: `${nm.lessonLabel(l)}：あと${r}コマ`,
        target: { type: 'class', id: l.classIds[0] },
      });
    }
  }

  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** 枠ごとのエラー有無（セルの赤枠表示用）。key: `${type}:${id}:${slotKey}` */
export function conflictCells(issues: Issue[]): Set<string> {
  const set = new Set<string>();
  for (const i of issues) {
    if (i.severity === 'error' && i.target && i.day !== undefined && i.period !== undefined) {
      set.add(`${i.target.type}:${i.target.id}:${slotKey(i.day, i.period)}`);
    }
  }
  return set;
}

/** 指定対象の時間割に関わる授業 */
export function lessonsFor(data: TimetableData, type: 'class' | 'teacher' | 'room', id: Id): Lesson[] {
  return data.lessons.filter(l =>
    type === 'class' ? l.classIds.includes(id)
      : type === 'teacher' ? l.teacherIds.includes(id)
        : l.roomId === id);
}

export function occupantsFor(
  idx: Index, type: 'class' | 'teacher' | 'room', id: Id, day: number, period: number,
): Occupant[] {
  return (idx.occupancy.get(slotKey(day, period)) ?? []).filter(o =>
    type === 'class' ? o.lesson.classIds.includes(id)
      : type === 'teacher' ? o.lesson.teacherIds.includes(id)
        : o.lesson.roomId === id);
}
