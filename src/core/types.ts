// ============================================================
// 時間割くん v2 - データモデル
// ============================================================
// 設計の考え方:
//   「授業 (Lesson)」= 科目 + クラス(1つ以上) + 教員(1人以上) + 週コマ数 + 連続数
//   クラスが2つ以上なら「合同」、教員が2人以上なら「TT」。
//   旧版の「担当授業」「クラス別設定」「合同/TT設定」はすべてここに統合した。
//   時間割は「どの授業を、何曜・何限から置いたか (Placement)」の集合だけで表す。

export type Id = string;

export interface Settings {
  schoolName: string;
  /** 曜日ラベル。例: ['月','火','水','木','金'] */
  days: string[];
  /** 1日の時限数 */
  periods: number;
}

/** 教科（国語・数学など）。色分けに使う */
export interface Department {
  id: Id;
  name: string;
  color: string;
}

export interface Subject {
  id: Id;
  name: string;
  /** 時間割セルに表示する略称 */
  shortName: string;
  departmentId: Id | null;
}

export interface SchoolClass {
  id: Id;
  name: string;
  grade: number;
  homeroomTeacherId: Id | null;
}

export interface Teacher {
  id: Id;
  name: string;
  departmentId: Id | null;
  divisionIds: Id[];
  /** 授業を入れられない枠（slotKey の配列） */
  unavailable: string[];
  /** 1日の授業上限（0 = 制限なし） */
  maxPerDay: number;
}

export interface Room {
  id: Id;
  name: string;
  shortName: string;
}

/** 分掌（教務部・生徒指導部など） */
export interface Division {
  id: Id;
  name: string;
}

/** 会議・固定業務。参加教員はその枠に授業を入れられない */
export interface Meeting {
  id: Id;
  name: string;
  slots: string[];
  teacherIds: Id[];
}

/** 選択群：同じ群の授業は常に同じ枠に並んで入る（選択授業・クラス展開など） */
export interface LessonGroup {
  id: Id;
  name: string;
}

export interface Lesson {
  id: Id;
  subjectId: Id;
  classIds: Id[];
  teacherIds: Id[];
  roomId: Id | null;
  /** 週の合計コマ数 */
  weeklyCount: number;
  /** 何コマ連続で置くか（1 = 連続なし） */
  blockLength: number;
  groupId: Id | null;
}

/** 授業を「day 曜 period 限から length コマ」置いたことを表す */
export interface Placement {
  id: Id;
  lessonId: Id;
  day: number;
  period: number;
  /** 連続コマ数（通常は授業の blockLength。端数コマのときは短くなる） */
  length: number;
  /** 固定：自動配置で動かさない */
  locked: boolean;
}

export interface TimetableData {
  version: 2;
  settings: Settings;
  departments: Department[];
  subjects: Subject[];
  classes: SchoolClass[];
  teachers: Teacher[];
  rooms: Room[];
  divisions: Division[];
  meetings: Meeting[];
  groups: LessonGroup[];
  lessons: Lesson[];
  placements: Placement[];
}

export const slotKey = (day: number, period: number) => `${day}-${period}`;
export const parseSlotKey = (key: string) => {
  const [d, p] = key.split('-').map(Number);
  return { day: d, period: p };
};

export function emptyData(): TimetableData {
  return {
    version: 2,
    settings: { schoolName: '', days: ['月', '火', '水', '木', '金'], periods: 6 },
    departments: [],
    subjects: [],
    classes: [],
    teachers: [],
    rooms: [],
    divisions: [],
    meetings: [],
    groups: [],
    lessons: [],
    placements: [],
  };
}

let seq = 0;
export function newId(prefix: string): Id {
  seq = (seq + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${seq.toString(36)}`;
}
