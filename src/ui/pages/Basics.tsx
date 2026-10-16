import { useState } from 'react';
import { useApp } from '../../store';
import { newId } from '../../core/types';
import { DelButton, Empty, NumberCell, PageHead, PasteImport, Select, TextCell, confirmDelete } from '../common';

const ALL_DAYS = ['月', '火', '水', '木', '金', '土'];

export function SettingsPage() {
  const data = useApp(s => s.data);
  const update = useApp(s => s.update);
  const { settings } = data;
  const placed = data.placements.length;

  const setDays = (on: string) => {
    const next = ALL_DAYS.filter(d => (d === on ? !settings.days.includes(d) : settings.days.includes(d)));
    if (next.length === 0) return;
    const removed = settings.days.filter(d => !next.includes(d));
    if (removed.length && placed && !window.confirm(`${removed.join('・')}曜を外すと、その曜日の配置も外れます。よろしいですか？`)) return;
    update(d => {
      // 曜日のインデックスがずれるので配置・勤務不可・会議を付け替える
      const map = new Map(d.settings.days.map((x, i) => [i, next.indexOf(x)]));
      const remap = (k: string) => {
        const [dd, pp] = k.split('-').map(Number);
        const n = map.get(dd) ?? -1;
        return n < 0 ? null : `${n}-${pp}`;
      };
      d.placements = d.placements.flatMap(p => {
        const n = map.get(p.day) ?? -1;
        return n < 0 ? [] : [{ ...p, day: n }];
      });
      d.teachers.forEach(t => { t.unavailable = t.unavailable.map(remap).filter(Boolean) as string[]; });
      d.meetings.forEach(m => { m.slots = m.slots.map(remap).filter(Boolean) as string[]; });
      d.settings.days = next;
    });
  };

  return (
    <div className="page narrow">
      <PageHead title="基本設定" desc="曜日と1日の時限数を決めます。あとから変更もできます。" />
      <div className="card form">
        <label className="field">
          <span>学校名（印刷物の見出しに使います）</span>
          <TextCell value={settings.schoolName} placeholder="例：〇〇高校" onCommit={v => update(d => { d.settings.schoolName = v; })} width="100%" />
        </label>
        <div className="field">
          <span>授業のある曜日</span>
          <div className="toggle-row">
            {ALL_DAYS.map(d => (
              <button key={d} className={`toggle ${settings.days.includes(d) ? 'on' : ''}`} onClick={() => setDays(d)}>{d}</button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>1日の時限数</span>
          <div className="row gap">
            <NumberCell value={settings.periods} min={1} max={10} onCommit={v => {
              if (v < settings.periods && placed && !window.confirm(`${v + 1}限以降の配置は外れます。よろしいですか？`)) return;
              update(d => { d.settings.periods = v; });
            }} />
            <span className="muted">時限</span>
          </div>
        </label>
      </div>
    </div>
  );
}

export function ClassesPage() {
  const data = useApp(s => s.data);
  const update = useApp(s => s.update);
  const toast = useApp(s => s.toast);
  const [grade, setGrade] = useState(1);
  const [count, setCount] = useState(6);
  const [paste, setPaste] = useState(false);

  const teacherOpts = data.teachers.map(t => ({ value: t.id, label: t.name }));
  const grades = [...new Set(data.classes.map(c => c.grade))].sort((a, b) => a - b);

  const bulkAdd = () => {
    update(d => {
      for (let i = 1; i <= count; i++) {
        const name = `${grade}-${i}`;
        if (!d.classes.some(c => c.name === name)) {
          d.classes.push({ id: newId('cl'), name, grade, homeroomTeacherId: null });
        }
      }
      d.classes.sort((a, b) => a.grade - b.grade);
    });
    toast(`${grade}年のクラスを作成しました`);
  };

  return (
    <div className="page">
      <PageHead
        title="クラス"
        desc="学年ごとにまとめて作成できます。クラス名はあとから自由に変えられます。"
        actions={<button className="btn" onClick={() => setPaste(true)}>表から貼り付け</button>}
      />
      <div className="card row gap wrap">
        <NumberCell value={grade} min={1} max={9} width={56} onCommit={setGrade} />
        <span>年生を</span>
        <NumberCell value={count} min={1} max={20} width={56} onCommit={setCount} />
        <span>クラス</span>
        <button className="btn primary" onClick={bulkAdd}>まとめて作成</button>
        <span className="muted small">（例：1-1 〜 1-{count}）</span>
      </div>

      {data.classes.length === 0 ? <Empty>まだクラスがありません。上のボタンで作成してください。</Empty> : (
        grades.map(g => (
          <div key={g} className="card">
            <h4>{g}年</h4>
            <table className="table">
              <thead><tr><th>クラス名</th><th>学年</th><th>担任</th><th /></tr></thead>
              <tbody>
                {data.classes.filter(c => c.grade === g).map(c => (
                  <tr key={c.id}>
                    <td><TextCell value={c.name} onCommit={v => update(d => { d.classes.find(x => x.id === c.id)!.name = v; })} width={120} /></td>
                    <td><NumberCell value={c.grade} min={1} max={9} width={56} onCommit={v => update(d => { d.classes.find(x => x.id === c.id)!.grade = v; d.classes.sort((a, b) => a.grade - b.grade); })} /></td>
                    <td><Select value={c.homeroomTeacherId} options={teacherOpts} placeholder="（未設定）" onChange={v => update(d => { d.classes.find(x => x.id === c.id)!.homeroomTeacherId = v; })} /></td>
                    <td className="right"><DelButton onClick={() => {
                      const n = data.lessons.filter(l => l.classIds.includes(c.id)).length;
                      if (confirmDelete(`${c.name}${n ? `（授業${n}件に関係）` : ''}`)) update(d => { d.classes = d.classes.filter(x => x.id !== c.id); });
                    }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
      {paste && (
        <PasteImport title="クラスを貼り付けで追加" columns={['クラス名', '学年']} example={'1-1\t1\n1-2\t1'}
          onClose={() => setPaste(false)}
          onImport={rows => {
            update(d => {
              for (const [name, g] of rows) {
                if (!name || d.classes.some(c => c.name === name)) continue;
                d.classes.push({ id: newId('cl'), name, grade: Number(g) || Number(name.match(/\d/)?.[0]) || 1, homeroomTeacherId: null });
              }
              d.classes.sort((a, b) => a.grade - b.grade);
            });
            toast('クラスを追加しました');
          }} />
      )}
    </div>
  );
}

const PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];

export function SubjectsPage() {
  const data = useApp(s => s.data);
  const update = useApp(s => s.update);
  const toast = useApp(s => s.toast);
  const [paste, setPaste] = useState(false);
  const deptOpts = data.departments.map(d => ({ value: d.id, label: d.name }));

  const findOrAddDept = (d: typeof data, name: string) => {
    if (!name) return null;
    let dp = d.departments.find(x => x.name === name);
    if (!dp) {
      dp = { id: newId('dp'), name, color: PALETTE[d.departments.length % PALETTE.length] };
      d.departments.push(dp);
    }
    return dp.id;
  };

  return (
    <div className="page">
      <PageHead title="教科・科目" desc="教科は色分けに使います。科目の「略称」が時間割のマスに表示されます。"
        actions={<button className="btn" onClick={() => setPaste(true)}>表から貼り付け</button>} />
      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <h4>教科</h4>
            <button className="btn small" onClick={() => update(d => { d.departments.push({ id: newId('dp'), name: '新しい教科', color: PALETTE[d.departments.length % PALETTE.length] }); })}>＋ 追加</button>
          </div>
          {data.departments.length === 0 ? <Empty>例：国語、数学、英語…</Empty> : (
            <table className="table">
              <tbody>
                {data.departments.map(dp => (
                  <tr key={dp.id}>
                    <td style={{ width: 44 }}>
                      <input type="color" className="color" value={dp.color} onChange={e => {
                        const v = e.target.value;
                        update(d => { d.departments.find(x => x.id === dp.id)!.color = v; });
                      }} />
                    </td>
                    <td><TextCell value={dp.name} onCommit={v => update(d => { d.departments.find(x => x.id === dp.id)!.name = v; })} /></td>
                    <td className="muted small">{data.subjects.filter(s => s.departmentId === dp.id).length}科目</td>
                    <td className="right"><DelButton onClick={() => { if (confirmDelete(dp.name)) update(d => { d.departments = d.departments.filter(x => x.id !== dp.id); }); }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h4>科目</h4>
            <button className="btn small" onClick={() => update(d => { d.subjects.push({ id: newId('sb'), name: '新しい科目', shortName: '', departmentId: d.departments[0]?.id ?? null }); })}>＋ 追加</button>
          </div>
          {data.subjects.length === 0 ? <Empty>例：現代の国語、数学I、体育…</Empty> : (
            <table className="table">
              <thead><tr><th>科目名</th><th>略称</th><th>教科</th><th /></tr></thead>
              <tbody>
                {data.subjects.map(s => (
                  <tr key={s.id}>
                    <td><TextCell value={s.name} onCommit={v => update(d => { d.subjects.find(x => x.id === s.id)!.name = v; })} /></td>
                    <td><TextCell value={s.shortName} placeholder={s.name.slice(0, 3)} width={80} onCommit={v => update(d => { d.subjects.find(x => x.id === s.id)!.shortName = v; })} /></td>
                    <td><Select value={s.departmentId} options={deptOpts} onChange={v => update(d => { d.subjects.find(x => x.id === s.id)!.departmentId = v; })} /></td>
                    <td className="right"><DelButton onClick={() => {
                      const n = data.lessons.filter(l => l.subjectId === s.id).length;
                      if (confirmDelete(`${s.name}${n ? `（授業${n}件も削除されます）` : ''}`)) update(d => { d.subjects = d.subjects.filter(x => x.id !== s.id); });
                    }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {paste && (
        <PasteImport title="科目を貼り付けで追加" columns={['科目名', '略称', '教科']} example={'現代の国語\t現国\t国語\n数学I\t数I\t数学'}
          onClose={() => setPaste(false)}
          onImport={rows => {
            update(d => {
              for (const [name, short, dept] of rows) {
                if (!name || d.subjects.some(s => s.name === name)) continue;
                d.subjects.push({ id: newId('sb'), name, shortName: short ?? '', departmentId: findOrAddDept(d, dept ?? '') });
              }
            });
            toast('科目を追加しました');
          }} />
      )}
    </div>
  );
}

export function RoomsPage() {
  const data = useApp(s => s.data);
  const update = useApp(s => s.update);
  return (
    <div className="page narrow">
      <PageHead title="特別教室" desc="体育館・音楽室など、同じ時間に1つの授業しか使えない部屋を登録します。授業ごとに使う教室を指定すると、重なりを防げます。"
        actions={<button className="btn primary" onClick={() => update(d => { d.rooms.push({ id: newId('rm'), name: '新しい教室', shortName: '' }); })}>＋ 追加</button>} />
      <div className="card">
        {data.rooms.length === 0 ? <Empty>特別教室を使わない場合は登録不要です。</Empty> : (
          <table className="table">
            <thead><tr><th>教室名</th><th>略称</th><th>使う授業</th><th /></tr></thead>
            <tbody>
              {data.rooms.map(r => (
                <tr key={r.id}>
                  <td><TextCell value={r.name} onCommit={v => update(d => { d.rooms.find(x => x.id === r.id)!.name = v; })} /></td>
                  <td><TextCell value={r.shortName} width={80} onCommit={v => update(d => { d.rooms.find(x => x.id === r.id)!.shortName = v; })} /></td>
                  <td className="muted small">{data.lessons.filter(l => l.roomId === r.id).length}件</td>
                  <td className="right"><DelButton onClick={() => { if (confirmDelete(r.name)) update(d => { d.rooms = d.rooms.filter(x => x.id !== r.id); }); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
