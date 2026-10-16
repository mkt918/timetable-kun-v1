import { useApp } from '../../store';
import { useDerived } from '../derived';
import { sampleData } from '../../core/sample';
import { remainingHours } from '../../core/logic';

export function HomePage() {
  const { data, idx, issues } = useDerived();
  const setPage = useApp(s => s.setPage);
  const replaceAll = useApp(s => s.replaceAll);
  const toast = useApp(s => s.toast);

  const total = data.lessons.reduce((s, l) => s + l.weeklyCount, 0);
  const rem = data.lessons.reduce((s, l) => s + remainingHours(idx, l), 0);
  const errors = issues.filter(i => i.severity === 'error').length;

  const steps = [
    { page: 'settings', title: '基本設定', desc: '曜日・時限数', done: true, info: `${data.settings.days.join('')}・${data.settings.periods}限` },
    { page: 'classes', title: 'クラス', desc: '学年ごとにまとめて作成', done: data.classes.length > 0, info: `${data.classes.length}クラス` },
    { page: 'subjects', title: '教科・科目', desc: '色分けと略称', done: data.subjects.length > 0, info: `${data.subjects.length}科目` },
    { page: 'teachers', title: '先生', desc: '名簿の貼り付け・勤務不可', done: data.teachers.length > 0, info: `${data.teachers.length}人` },
    { page: 'rooms', title: '特別教室', desc: '必要なときだけ', done: true, optional: true, info: `${data.rooms.length}室` },
    { page: 'meetings', title: '会議・分掌', desc: '会議の時間は授業が入らない', done: true, optional: true, info: `${data.meetings.length}件` },
    { page: 'lessons', title: '授業', desc: '担当・コマ数・合同・TT・連続', done: data.lessons.length > 0, info: `${data.lessons.length}件・${total}コマ` },
    { page: 'edit', title: '時間割を作る', desc: '自動配置＋手で調整', done: total > 0 && rem === 0, info: total ? `${total - rem}/${total}コマ配置` : '' },
    { page: 'check', title: 'チェック', desc: '重なり・不足の確認', done: total > 0 && rem === 0 && errors === 0, info: errors ? `エラー${errors}件` : '' },
    { page: 'print', title: '印刷', desc: 'クラス別・先生別・一覧表', done: false, info: '' },
  ];
  const next = steps.find(s => !s.done && !s.optional);

  return (
    <div className="page narrow">
      <div className="hero">
        <h2>時間割くん</h2>
        <p>上から順に入力していけば時間割ができあがります。入力はすべて自動保存されます。</p>
        <div className="row gap wrap">
          {next && <button className="btn primary" onClick={() => setPage(next.page)}>次の手順：{next.title} →</button>}
          {data.lessons.length === 0 && (
            <button className="btn" onClick={() => { replaceAll(sampleData()); toast('サンプルデータを読み込みました'); setPage('edit'); }}>
              サンプルで試してみる
            </button>
          )}
        </div>
      </div>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.page} className={`${s.done && !s.optional ? 'done' : ''} ${next?.page === s.page ? 'next' : ''}`}>
            <button onClick={() => setPage(s.page)}>
              <span className="step-no">{s.done && !s.optional ? '✓' : i + 1}</span>
              <span className="step-body">
                <b>{s.title}</b>{s.optional && <span className="muted small">（任意）</span>}
                <span className="muted small">{s.desc}</span>
              </span>
              <span className="step-info">{s.info}</span>
            </button>
          </li>
        ))}
      </ol>
      {total > 0 && (
        <div className="card">
          <div className="progress"><div style={{ width: `${((total - rem) / total) * 100}%` }} /></div>
          <div className="muted small mt">配置 {total - rem} / {total} コマ・エラー {errors} 件</div>
        </div>
      )}
    </div>
  );
}
