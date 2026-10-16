import { useEffect } from 'react';
import { useApp } from './store';
import { useDerived } from './ui/derived';
import { HomePage } from './ui/pages/Home';
import { ClassesPage, RoomsPage, SettingsPage, SubjectsPage } from './ui/pages/Basics';
import { MeetingsPage, TeachersPage } from './ui/pages/Teachers';
import { LessonsPage } from './ui/pages/Lessons';
import { EditorPage } from './ui/pages/Editor';
import { OverviewPage } from './ui/pages/Overview';
import { CheckPage, DataPage, PrintPage } from './ui/pages/Finish';
import { remainingHours } from './core/logic';

const NAV: { section: string; items: { page: string; label: string }[] }[] = [
  { section: '', items: [{ page: 'home', label: 'はじめに' }] },
  {
    section: '準備',
    items: [
      { page: 'settings', label: '基本設定' },
      { page: 'classes', label: 'クラス' },
      { page: 'subjects', label: '教科・科目' },
      { page: 'teachers', label: '先生' },
      { page: 'rooms', label: '特別教室' },
      { page: 'meetings', label: '会議・分掌' },
      { page: 'lessons', label: '授業' },
    ],
  },
  {
    section: '作成',
    items: [
      { page: 'edit', label: '時間割を作る' },
      { page: 'overview', label: '全体一覧' },
      { page: 'check', label: 'チェック' },
    ],
  },
  {
    section: '仕上げ',
    items: [
      { page: 'print', label: '印刷' },
      { page: 'data', label: 'データ（保存・読込）' },
    ],
  },
];

const PAGES: Record<string, () => JSX.Element> = {
  home: HomePage, settings: SettingsPage, classes: ClassesPage, subjects: SubjectsPage, teachers: TeachersPage,
  rooms: RoomsPage, meetings: MeetingsPage, lessons: LessonsPage, edit: EditorPage, overview: () => <OverviewPage />,
  check: CheckPage, print: PrintPage, data: DataPage,
};

export default function App() {
  const page = useApp(s => s.page);
  const setPage = useApp(s => s.setPage);
  const undo = useApp(s => s.undo);
  const redo = useApp(s => s.redo);
  const canUndo = useApp(s => s.past.length > 0);
  const canRedo = useApp(s => s.future.length > 0);
  const toasts = useApp(s => s.toasts);
  const saveError = useApp(s => s.saveError);
  const { data, idx, issues } = useDerived();

  const errors = issues.filter(i => i.severity === 'error').length;
  const rem = data.lessons.reduce((s, l) => s + remainingHours(idx, l), 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  useEffect(() => {
    document.title = data.settings.schoolName ? `時間割くん - ${data.settings.schoolName}` : '時間割くん';
  }, [data.settings.schoolName]);

  const Page = PAGES[page] ?? HomePage;

  return (
    <div className="app">
      <header className="topbar no-print">
        <button className="brand" onClick={() => setPage('home')}>時間割くん</button>
        <span className="school">{data.settings.schoolName}</span>
        <div className="spacer" />
        <button className={`status-pill ${errors ? 'bad' : 'good'}`} onClick={() => setPage('check')}>
          {errors ? `エラー ${errors}` : 'エラーなし'}
        </button>
        {rem > 0 && <button className="status-pill" onClick={() => setPage('edit')}>未配置 {rem}コマ</button>}
        <button className="btn ghost" disabled={!canUndo} onClick={undo} title="元に戻す（Ctrl+Z）">↶ 元に戻す</button>
        <button className="btn ghost" disabled={!canRedo} onClick={redo} title="やり直す（Ctrl+Y）">↷ やり直す</button>
      </header>
      {saveError && <div className="save-error no-print">{saveError}</div>}
      <div className="body">
        <nav className="sidenav no-print">
          {NAV.map(sec => (
            <div key={sec.section} className="nav-sec">
              {sec.section && <div className="nav-title">{sec.section}</div>}
              {sec.items.map(it => (
                <button key={it.page} className={`nav-item ${page === it.page ? 'on' : ''}`} onClick={() => setPage(it.page)}>
                  {it.label}
                  {it.page === 'check' && errors > 0 && <span className="nav-badge">{errors}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <main className={`content page-${page}`}>
          <Page />
        </main>
      </div>
      <div className="toasts no-print" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}
      </div>
    </div>
  );
}
