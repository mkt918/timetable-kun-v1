import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { emptyData, TimetableData } from './types';
import {
  buildIndex, checkMove, checkPlace, cleanup, findIssues, movePlacement, names, placeLesson,
  remainingHours, removePlacement, checkSwap, swapPlacements,
} from './logic';
import { autoSchedule } from './scheduler';
import { sampleData } from './sample';
import { parseSaveFile, parseTable } from './io';

function tiny(): TimetableData {
  const d = emptyData();
  d.settings.periods = 4;
  d.settings.days = ['月', '火'];
  d.subjects = [
    { id: 's1', name: '数学', shortName: '数', departmentId: null },
    { id: 's2', name: '体育', shortName: '体', departmentId: null },
    { id: 's3', name: '音楽', shortName: '音', departmentId: null },
    { id: 's4', name: '美術', shortName: '美', departmentId: null },
  ];
  d.classes = [
    { id: 'c1', name: '1-1', grade: 1, homeroomTeacherId: null },
    { id: 'c2', name: '1-2', grade: 1, homeroomTeacherId: null },
  ];
  const t = (id: string) => ({ id, name: id, departmentId: null, divisionIds: [], unavailable: [], maxPerDay: 0 });
  d.teachers = [t('tA'), t('tB'), t('tC')];
  d.groups = [{ id: 'g1', name: '芸術' }];
  d.lessons = [
    { id: 'L1', subjectId: 's1', classIds: ['c1'], teacherIds: ['tA'], roomId: null, weeklyCount: 2, blockLength: 1, groupId: null },
    { id: 'L2', subjectId: 's1', classIds: ['c2'], teacherIds: ['tA'], roomId: null, weeklyCount: 2, blockLength: 1, groupId: null },
    { id: 'L3', subjectId: 's2', classIds: ['c1', 'c2'], teacherIds: ['tB', 'tC'], roomId: null, weeklyCount: 3, blockLength: 2, groupId: null },
    { id: 'G1', subjectId: 's3', classIds: ['c1', 'c2'], teacherIds: ['tB'], roomId: null, weeklyCount: 1, blockLength: 1, groupId: 'g1' },
    { id: 'G2', subjectId: 's4', classIds: ['c1', 'c2'], teacherIds: ['tC'], roomId: null, weeklyCount: 1, blockLength: 1, groupId: 'g1' },
  ];
  return d;
}

describe('配置', () => {
  it('教員の重複は置けない', () => {
    let d = tiny();
    d = produce(d, x => placeLesson(x, 'L1', 0, 0));
    const r = checkPlace(d, buildIndex(d), 'L2', 0, 0, names(d));
    expect(r.map(x => x.kind)).toContain('teacher');
    expect(checkPlace(d, buildIndex(d), 'L2', 0, 1, names(d))).toEqual([]);
  });

  it('合同・連続：2クラスに2コマ連続で入り、端数は1コマ', () => {
    let d = tiny();
    d = produce(d, x => placeLesson(x, 'L3', 0, 0));
    expect(d.placements).toHaveLength(1);
    expect(d.placements[0].length).toBe(2);
    const r = checkPlace(d, buildIndex(d), 'L1', 0, 1, names(d));
    expect(r.map(x => x.kind)).toContain('class');
    d = produce(d, x => placeLesson(x, 'L3', 1, 3));
    expect(d.placements[1].length).toBe(1);
    expect(remainingHours(buildIndex(d), d.lessons[2])).toBe(0);
    expect(checkPlace(d, buildIndex(d), 'L3', 1, 0, names(d)).map(x => x.kind)).toEqual(['full']);
  });

  it('連続が最終時限を超える枠には置けない', () => {
    const d = tiny();
    expect(checkPlace(d, buildIndex(d), 'L3', 0, 3, names(d)).map(x => x.kind)).toContain('range');
  });

  it('選択群は同じ枠にまとめて置かれ、まとめて動く', () => {
    let d = tiny();
    d = produce(d, x => placeLesson(x, 'G1', 0, 2));
    expect(d.placements).toHaveLength(2);
    expect(findIssues(d).filter(i => i.severity === 'error')).toEqual([]);
    d = produce(d, x => movePlacement(x, d.placements[0].id, 1, 0));
    expect(d.placements.every(p => p.day === 1 && p.period === 0)).toBe(true);
    d = produce(d, x => removePlacement(x, d.placements[1].id));
    expect(d.placements).toHaveLength(0);
  });

  it('自分自身の元の位置は移動判定で無視する', () => {
    let d = tiny();
    d = produce(d, x => placeLesson(x, 'L3', 0, 0));
    expect(checkMove(d, buildIndex(d), d.placements[0].id, 0, 1, names(d))).toEqual([]);
  });

  it('勤務不可・会議', () => {
    let d = tiny();
    d.teachers[0].unavailable = ['0-0'];
    d.meetings = [{ id: 'm', name: '職員会議', slots: ['0-1'], teacherIds: ['tA'] }];
    const idx = buildIndex(d);
    expect(checkPlace(d, idx, 'L1', 0, 0, names(d)).map(x => x.kind)).toContain('unavailable');
    expect(checkPlace(d, idx, 'L1', 0, 1, names(d)).map(x => x.kind)).toContain('meeting');
  });
});

describe('入れ替え', () => {
  it('入れ替え先で先生が重なるなら拒否し、重ならなければ入れ替える', () => {
    let d = tiny();
    d.lessons.push({ id: 'L4', subjectId: 's2', classIds: ['c1'], teacherIds: ['tB'], roomId: null, weeklyCount: 1, blockLength: 1, groupId: null });
    // a: L1(1-1, tA) 月1 / b: L4(1-1, tB) 月2 / c: L2(1-2, tA) 月2
    d = produce(d, x => { placeLesson(x, 'L1', 0, 0); placeLesson(x, 'L4', 0, 1); placeLesson(x, 'L2', 0, 1); });
    const [a, b, c] = d.placements;
    // a を月2へ動かすと tA が c と重なる
    expect(checkSwap(d, a, b, names(d)).map(r => r.kind)).toContain('teacher');
    // c を外せば入れ替えられる
    d = produce(d, x => removePlacement(x, c.id));
    expect(checkSwap(d, a, b, names(d))).toEqual([]);
    d = produce(d, x => swapPlacements(x, a.id, b.id));
    expect(d.placements.find(p => p.id === a.id)).toMatchObject({ day: 0, period: 1 });
    expect(d.placements.find(p => p.id === b.id)).toMatchObject({ day: 0, period: 0 });
  });
});

describe('チェック', () => {
  it('重複を検出する', () => {
    const d = tiny();
    d.placements = [
      { id: 'p1', lessonId: 'L1', day: 0, period: 0, length: 1, locked: false },
      { id: 'p2', lessonId: 'L2', day: 0, period: 0, length: 1, locked: false },
    ];
    const cats = findIssues(d).map(i => i.category);
    expect(cats).toContain('教員の重複');
  });

  it('週コマ数を減らすと超過分の配置が外れる', () => {
    let d = tiny();
    d = produce(d, x => { placeLesson(x, 'L1', 0, 0); placeLesson(x, 'L1', 0, 1); });
    d = produce(d, x => { x.lessons[0].weeklyCount = 1; cleanup(x); });
    expect(d.placements).toHaveLength(1);
  });
});

describe('自動配置', () => {
  it('小さなデータを完全に配置できる', () => {
    const d = tiny();
    const r = autoSchedule(d, { seed: 1 });
    expect(r.unplaced).toEqual([]);
    const out = { ...d, placements: r.placements };
    expect(findIssues(out).filter(i => i.severity === 'error')).toEqual([]);
  });

  it('サンプルデータをエラーなしで配置できる', () => {
    const d = sampleData();
    const r = autoSchedule(d, { seed: 42 });
    const out = { ...d, placements: r.placements };
    expect(findIssues(out).filter(i => i.severity === 'error')).toEqual([]);
    const total = d.lessons.reduce((s, l) => s + l.weeklyCount, 0);
    const placed = r.placements.reduce((s, p) => s + p.length, 0);
    expect(placed / total).toBeGreaterThan(0.95);
  });

  it('固定した配置は動かさない', () => {
    let d = tiny();
    d = produce(d, x => { placeLesson(x, 'L1', 1, 3); x.placements[0].locked = true; });
    const r = autoSchedule(d, { seed: 3, rebuild: true });
    expect(r.placements.find(p => p.id === d.placements[0].id)).toMatchObject({ day: 1, period: 3 });
  });
});

describe('入出力', () => {
  it('Excel の貼り付け（TSV）と CSV を読める', () => {
    expect(parseTable('名前\t教科\n教員A\t数学\n')).toEqual([['名前', '教科'], ['教員A', '数学']]);
    expect(parseTable('"a,b",c\r\nd,"e""f"')).toEqual([['a,b', 'c'], ['d', 'e"f']]);
  });

  it('保存ファイルを往復できる', () => {
    const d = sampleData();
    const back = parseSaveFile(JSON.stringify(d));
    expect(back.lessons.length).toBe(d.lessons.length);
    expect(() => parseSaveFile('{"version":1}')).toThrow();
  });
});
