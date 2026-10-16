// ============================================================
// サンプルデータ（架空の学校）
// ============================================================
import { Id, Lesson, TimetableData, emptyData, newId } from './types';

export function sampleData(): TimetableData {
  const d = emptyData();
  d.settings = { schoolName: 'サンプル高校', days: ['月', '火', '水', '木', '金'], periods: 6 };

  const dept = (name: string, color: string) => {
    const x = { id: newId('dp'), name, color };
    d.departments.push(x);
    return x.id;
  };
  const DP = {
    jp: dept('国語', '#ef4444'), ma: dept('数学', '#3b82f6'), en: dept('英語', '#8b5cf6'),
    sc: dept('理科', '#10b981'), so: dept('地歴公民', '#f59e0b'), pe: dept('保健体育', '#06b6d4'),
    ar: dept('芸術', '#ec4899'), ho: dept('家庭', '#f97316'), it: dept('情報', '#6366f1'),
    hr: dept('特別活動', '#64748b'),
  };

  const subj = (name: string, shortName: string, departmentId: Id) => {
    const x = { id: newId('sb'), name, shortName, departmentId };
    d.subjects.push(x);
    return x.id;
  };
  const S = {
    jp: subj('国語', '国', DP.jp), ma: subj('数学', '数', DP.ma), en: subj('英語', '英', DP.en),
    sc: subj('理科', '理', DP.sc), so: subj('地歴公民', '社', DP.so), pe: subj('体育', '体', DP.pe),
    mu: subj('音楽', '音', DP.ar), art: subj('美術', '美', DP.ar), cal: subj('書道', '書', DP.ar),
    ho: subj('家庭基礎', '家', DP.ho), it: subj('情報I', '情', DP.it),
    lhr: subj('LHR', 'LHR', DP.hr), ip: subj('総合的な探究', '探', DP.hr),
  };

  const room = (name: string, shortName: string) => {
    const x = { id: newId('rm'), name, shortName };
    d.rooms.push(x);
    return x.id;
  };
  const R = {
    gym: room('体育館', '体館'), mu: room('音楽室', '音室'), art: room('美術室', '美室'),
    cal: room('書道室', '書室'), ho: room('家庭科室', '家室'), pc: room('PC室', 'PC'),
  };

  const divs = ['教務部', '生徒指導部', '進路指導部'].map(name => ({ id: newId('dv'), name }));
  d.divisions = divs;

  const teacher = (name: string, departmentId: Id) => {
    const x = {
      id: newId('tc'), name, departmentId,
      divisionIds: [divs[d.teachers.length % 3].id], unavailable: [] as string[], maxPerDay: 0,
    };
    d.teachers.push(x);
    return x.id;
  };
  let n = 0;
  const T = (dp: Id) => teacher(`教員${String.fromCharCode(65 + (n++ % 26))}${n > 26 ? n : ''}`, dp);
  const jp = [T(DP.jp), T(DP.jp), T(DP.jp)];
  const ma = [T(DP.ma), T(DP.ma), T(DP.ma)];
  const en = [T(DP.en), T(DP.en), T(DP.en)];
  const sc = [T(DP.sc), T(DP.sc)];
  const so = [T(DP.so), T(DP.so)];
  const pe = [T(DP.pe), T(DP.pe)];
  const mu = T(DP.ar), art = T(DP.ar), cal = T(DP.ar);
  const ho = T(DP.ho);
  const it = T(DP.it);
  // 勤務不可の例
  d.teachers.find(t => t.id === cal)!.unavailable = ['0-0', '0-1', '4-4', '4-5'];

  for (let g = 1; g <= 3; g++) {
    for (let c = 1; c <= 3; c++) {
      d.classes.push({ id: newId('cl'), name: `${g}-${c}`, grade: g, homeroomTeacherId: null });
    }
  }
  d.classes.forEach((c, i) => { c.homeroomTeacherId = d.teachers[i].id; });

  const L = (subjectId: Id, classIds: Id[], teacherIds: Id[], weeklyCount: number, extra: Partial<Lesson> = {}) => {
    d.lessons.push({
      id: newId('ls'), subjectId, classIds, teacherIds, roomId: null, weeklyCount, blockLength: 1, groupId: null, ...extra,
    });
  };

  const byGrade = (g: number) => d.classes.filter(c => c.grade === g);
  for (let g = 1; g <= 3; g++) {
    const cls = byGrade(g);
    const gi = g - 1;
    cls.forEach((c, i) => {
      L(S.jp, [c.id], [jp[(gi + i) % 3]], 4);
      L(S.ma, [c.id], [ma[(gi + i) % 3]], 4);
      L(S.en, [c.id], [en[(gi + i) % 3]], 4);
      L(S.sc, [c.id], [sc[(gi + i) % 2]], 3);
      L(S.so, [c.id], [so[(gi + i) % 2]], 3);
      L(S.lhr, [c.id], [d.teachers[d.classes.indexOf(c)].id], 1);
      L(S.ip, [c.id], [d.teachers[d.classes.indexOf(c)].id], 1);
    });
    // 体育：2クラス合同・2人TT、1クラスは単独
    L(S.pe, [cls[0].id, cls[1].id], [pe[0], pe[1]], 3, { roomId: R.gym });
    L(S.pe, [cls[2].id], [pe[gi % 2]], 3, { roomId: R.gym });
    if (g === 1) {
      // 芸術：選択群（音楽・美術・書道を1年全クラスで同時展開）、2コマ連続
      const grp = { id: newId('gp'), name: '1年 芸術選択' };
      d.groups.push(grp);
      const all = cls.map(c => c.id);
      L(S.mu, all, [mu], 2, { roomId: R.mu, blockLength: 2, groupId: grp.id });
      L(S.art, all, [art], 2, { roomId: R.art, blockLength: 2, groupId: grp.id });
      L(S.cal, all, [cal], 2, { roomId: R.cal, blockLength: 2, groupId: grp.id });
      cls.forEach(c => L(S.it, [c.id], [it], 2, { roomId: R.pc }));
    } else {
      cls.forEach(c => L(S.ho, [c.id], [ho], 2, { roomId: R.ho, blockLength: 2 }));
      cls.forEach(c => L(S.it, [c.id], [it], 1, { roomId: R.pc }));
    }
  }

  d.meetings.push({
    id: newId('mt'), name: '教務部会', slots: ['0-5'],
    teacherIds: d.teachers.filter(t => t.divisionIds.includes(divs[0].id)).map(t => t.id),
  });
  return d;
}
