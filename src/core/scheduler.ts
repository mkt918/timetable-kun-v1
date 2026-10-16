// ============================================================
// 自動配置
// ============================================================
// 未配置の授業を、制約（重複・勤務不可・会議・教室・1日上限）を守って配置する。
//   1. 置ける枠が少ない授業から順に配置（難しいものを先に）
//   2. 同じ授業は別の日に分散、1日の偏りが少ない枠を優先
//   3. 置けないときは、邪魔している1コマを別の枠へ動かせないか試す
//   4. 乱択を変えて何度か試し、最も多く置けた結果を採用
// 固定（locked）の配置は動かさない。
import { Id, Lesson, Placement, TimetableData, newId, slotKey } from './types';

export interface ScheduleOptions {
  /** 対象クラス（空 = 全クラス） */
  classIds?: Id[];
  /** 未固定の配置をいったん外してから組み直す */
  rebuild?: boolean;
  /** 試行回数 */
  attempts?: number;
  /** 乱数シード（テスト用） */
  seed?: number;
}

export interface ScheduleResult {
  placements: Placement[];
  placedHours: number;
  unplaced: { lessonId: Id; hours: number }[];
}

interface Unit {
  /** 同時に置く授業（選択群なら複数） */
  lessons: Lesson[];
  length: number;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

class Grid {
  /** 資源キー（c:クラス t:教員 r:教室） -> 使用中の slotKey -> unit番号 */
  used = new Map<string, Map<string, number>>();
  blocked = new Map<string, Set<string>>();
  dayCount = new Map<string, number>();

  constructor(private data: TimetableData) {
    for (const t of data.teachers) {
      const set = new Set(t.unavailable);
      this.blocked.set(`t:${t.id}`, set);
    }
    for (const m of data.meetings) {
      for (const t of m.teacherIds) {
        let set = this.blocked.get(`t:${t}`);
        if (!set) this.blocked.set(`t:${t}`, (set = new Set()));
        m.slots.forEach(s => set!.add(s));
      }
    }
  }

  static resources(l: Lesson, inGroup: boolean): string[] {
    // 選択群の授業同士はクラスを共有できるので、クラス資源は群単位で取る
    const r = l.teacherIds.map(t => `t:${t}`);
    if (!inGroup) r.push(...l.classIds.map(c => `c:${c}`));
    if (l.roomId) r.push(`r:${l.roomId}`);
    return r;
  }

  static unitResources(u: Unit): string[] {
    const inGroup = u.lessons.length > 1 || !!u.lessons[0].groupId;
    const set = new Set<string>();
    for (const l of u.lessons) Grid.resources(l, inGroup).forEach(r => set.add(r));
    if (inGroup) {
      for (const l of u.lessons) l.classIds.forEach(c => set.add(`c:${c}`));
    }
    return [...set];
  }

  /** 置けない理由になっている unit 番号（-1 = 動かせないもの） */
  blockers(res: string[], day: number, period: number, length: number): Set<number> | null {
    if (period + length > this.data.settings.periods) return null;
    const out = new Set<number>();
    for (let i = 0; i < length; i++) {
      const k = slotKey(day, period + i);
      for (const r of res) {
        if (this.blocked.get(r)?.has(k)) return null;
        const u = this.used.get(r)?.get(k);
        if (u !== undefined) out.add(u);
      }
    }
    return out;
  }

  maxPerDayOk(u: Unit, day: number): boolean {
    for (const l of u.lessons) {
      for (const tid of l.teacherIds) {
        const t = this.data.teachers.find(x => x.id === tid);
        if (!t?.maxPerDay) continue;
        if ((this.dayCount.get(`${tid}|${day}`) ?? 0) + u.length > t.maxPerDay) return false;
      }
    }
    return true;
  }

  put(res: string[], day: number, period: number, length: number, unitNo: number, u: Unit) {
    for (let i = 0; i < length; i++) {
      const k = slotKey(day, period + i);
      for (const r of res) {
        let m = this.used.get(r);
        if (!m) this.used.set(r, (m = new Map()));
        m.set(k, unitNo);
      }
    }
    for (const tid of new Set(u.lessons.flatMap(l => l.teacherIds))) {
      const k = `${tid}|${day}`;
      this.dayCount.set(k, (this.dayCount.get(k) ?? 0) + length);
    }
  }

  take(res: string[], day: number, period: number, length: number, u: Unit) {
    for (let i = 0; i < length; i++) {
      const k = slotKey(day, period + i);
      for (const r of res) this.used.get(r)?.delete(k);
    }
    for (const tid of new Set(u.lessons.flatMap(l => l.teacherIds))) {
      const k = `${tid}|${day}`;
      this.dayCount.set(k, (this.dayCount.get(k) ?? 0) - length);
    }
  }
}

interface Placed {
  unit: Unit;
  res: string[];
  day: number;
  period: number;
  locked: boolean;
}

export function autoSchedule(data: TimetableData, opts: ScheduleOptions = {}): ScheduleResult {
  const attempts = opts.attempts ?? 30;
  const target = new Set(opts.classIds?.length ? opts.classIds : data.classes.map(c => c.id));
  const isTarget = (l: Lesson) => l.classIds.some(c => target.has(c));

  // 残す配置（固定 or 対象外 or rebuild しないとき全部）
  const keep = data.placements.filter(p => {
    const l = data.lessons.find(x => x.id === p.lessonId);
    if (!l) return false;
    return !opts.rebuild || p.locked || !isTarget(l);
  });

  // 残り必要コマを unit に分解（選択群は群でまとめる）
  const hours = new Map<Id, number>();
  for (const p of keep) hours.set(p.lessonId, (hours.get(p.lessonId) ?? 0) + p.length);
  const units: Unit[] = [];
  const doneGroups = new Set<Id>();
  for (const l of data.lessons) {
    if (!isTarget(l) || l.teacherIds.length === 0) continue;
    if (l.groupId) {
      if (doneGroups.has(l.groupId)) continue;
      doneGroups.add(l.groupId);
      const mates = data.lessons.filter(x => x.groupId === l.groupId);
      // 群の授業は同時に置く。群内でコマ数が異なれば、それぞれ残りがある授業だけ並べる
      const rem = new Map(mates.map(m => [m.id, m.weeklyCount - (hours.get(m.id) ?? 0)]));
      for (;;) {
        const active = mates.filter(m => (rem.get(m.id) ?? 0) > 0);
        if (active.length === 0) break;
        const len = Math.min(...active.map(m => Math.min(m.blockLength, rem.get(m.id)!)));
        active.forEach(m => rem.set(m.id, rem.get(m.id)! - len));
        units.push({ lessons: active, length: len });
      }
      continue;
    }
    let rem = l.weeklyCount - (hours.get(l.id) ?? 0);
    while (rem > 0) {
      const len = Math.min(l.blockLength, rem);
      units.push({ lessons: [l], length: len });
      rem -= len;
    }
  }

  const days = data.settings.days.length;
  const periods = data.settings.periods;
  let best: { placed: Placed[]; failed: Unit[]; cost: number } | null = null;

  for (let a = 0; a < attempts; a++) {
    const rand = rng((opts.seed ?? Date.now()) + a * 7919);
    const grid = new Grid(data);
    const placed: Placed[] = [];
    const failed: Unit[] = [];
    // 「どの授業がどの日に置かれたか」で分散させる
    const lessonDays = new Map<Id, Set<number>>();
    const classDayLoad = new Map<string, number>();

    const register = (p: Placed) => {
      const no = placed.length;
      placed.push(p);
      grid.put(p.res, p.day, p.period, p.unit.length, no, p.unit);
      for (const l of p.unit.lessons) {
        let s = lessonDays.get(l.id);
        if (!s) lessonDays.set(l.id, (s = new Set()));
        s.add(p.day);
        for (const c of l.classIds) {
          const k = `${c}|${p.day}`;
          classDayLoad.set(k, (classDayLoad.get(k) ?? 0) + p.unit.length);
        }
      }
    };
    const unregister = (no: number) => {
      const p = placed[no];
      grid.take(p.res, p.day, p.period, p.unit.length, p.unit);
      for (const l of p.unit.lessons) {
        // 同じ日に他の同授業が残っていなければ外す
        const still = placed.some((q, i) => i !== no && q.day === p.day && q.unit.lessons.some(x => x.id === l.id) && q.period >= 0);
        if (!still) lessonDays.get(l.id)?.delete(p.day);
        for (const c of l.classIds) {
          const k = `${c}|${p.day}`;
          classDayLoad.set(k, (classDayLoad.get(k) ?? 0) - p.unit.length);
        }
      }
      p.period = -1; // 無効化
    };

    for (const p of keep) {
      const l = data.lessons.find(x => x.id === p.lessonId)!;
      const unit: Unit = { lessons: [l], length: p.length };
      register({ unit, res: Grid.unitResources(unit), day: p.day, period: p.period, locked: true });
    }

    const score = (u: Unit, day: number, period: number) => {
      let s = rand() * 0.5;
      for (const l of u.lessons) {
        if (lessonDays.get(l.id)?.has(day)) s += 10; // 同じ日に同じ授業は避ける
        for (const c of l.classIds) s += (classDayLoad.get(`${c}|${day}`) ?? 0) * 0.3;
      }
      s += period * 0.05; // 早い時限をやや優先
      return s;
    };

    const freeSlots = (u: Unit, res: string[]) => {
      const out: { day: number; period: number }[] = [];
      for (let d = 0; d < days; d++) {
        if (!grid.maxPerDayOk(u, d)) continue;
        for (let p = 0; p + u.length <= periods; p++) {
          const b = grid.blockers(res, d, p, u.length);
          if (b && b.size === 0) out.push({ day: d, period: p });
        }
      }
      return out;
    };

    // 難しい順（候補が少ない・資源が多い・長い）
    const order = units.map(u => ({ u, res: Grid.unitResources(u) }));
    const difficulty = new Map(order.map(o => [o, freeSlots(o.u, o.res).length - o.res.length * 2 - o.u.length * 3 + rand() * 3]));
    order.sort((x, y) => difficulty.get(x)! - difficulty.get(y)!);

    const tryPlace = (u: Unit, res: string[]): boolean => {
      const cands = freeSlots(u, res);
      if (cands.length > 0) {
        cands.sort((x, y) => score(u, x.day, x.period) - score(u, y.day, y.period));
        register({ unit: u, res, day: cands[0].day, period: cands[0].period, locked: false });
        return true;
      }
      return false;
    };

    for (const { u, res } of order) {
      if (tryPlace(u, res)) continue;
      // 1コマだけ動かして空けられないか
      let ok = false;
      const slots: { d: number; p: number }[] = [];
      for (let d = 0; d < days; d++) for (let p = 0; p + u.length <= periods; p++) slots.push({ d, p });
      slots.sort(() => rand() - 0.5);
      for (const { d, p } of slots) {
        const b = grid.blockers(res, d, p, u.length);
        if (!b || b.size !== 1) continue;
        const no = [...b][0];
        const victim = placed[no];
        if (victim.locked) continue;
        const vd = victim.day, vp = victim.period;
        unregister(no);
        if (grid.blockers(res, d, p, u.length)?.size === 0) {
          register({ unit: u, res, day: d, period: p, locked: false });
          const vres = victim.res;
          const alt = freeSlots(victim.unit, vres);
          if (alt.length > 0) {
            alt.sort((x, y) => score(victim.unit, x.day, x.period) - score(victim.unit, y.day, y.period));
            register({ unit: victim.unit, res: vres, day: alt[0].day, period: alt[0].period, locked: false });
            ok = true;
            break;
          }
          // 戻す
          unregister(placed.length - 1);
        }
        register({ ...victim, day: vd, period: vp });
      }
      if (!ok) failed.push(u);
    }

    const live = placed.filter(p => p.period >= 0);
    // 同じ授業が同じ日に重なった数（少ないほど良い）
    const seen = new Set<string>();
    let dup = 0;
    for (const p of live) for (const l of p.unit.lessons) {
      const k = `${l.id}|${p.day}`;
      if (seen.has(k)) dup++; else seen.add(k);
    }
    const cost = failed.reduce((s, u) => s + u.length, 0) * 1000 + dup;
    if (!best || cost < best.cost) best = { placed: live, failed, cost };
    if (cost === 0) break;
  }

  // 結果を Placement へ
  const out: Placement[] = [...keep];
  let placedHours = 0;
  for (const p of best!.placed) {
    if (p.locked) continue;
    for (const l of p.unit.lessons) {
      out.push({ id: newId('pl'), lessonId: l.id, day: p.day, period: p.period, length: p.unit.length, locked: false });
      placedHours += p.unit.length;
    }
  }

  const unplacedMap = new Map<Id, number>();
  for (const u of best!.failed) for (const l of u.lessons) unplacedMap.set(l.id, (unplacedMap.get(l.id) ?? 0) + u.length);
  return {
    placements: out,
    placedHours,
    unplaced: [...unplacedMap].map(([lessonId, hours]) => ({ lessonId, hours })),
  };
}
