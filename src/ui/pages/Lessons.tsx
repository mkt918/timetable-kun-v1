import { useMemo, useState } from 'react';
import { useApp } from '../../store';
import { Lesson, newId } from '../../core/types';
import { useDerived } from '../derived';
import { remainingHours } from '../../core/logic';
import { DelButton, Empty, Modal, MultiPicker, NumberCell, PageHead, Select, TextCell, confirmDelete } from '../common';

function useOptions() {
  const data = useApp(s => s.data);
  return useMemo(() => {
    const deptName = new Map(data.departments.map(d => [d.id, d.name]));
    const grades = [...new Set(data.classes.map(c => c.grade))].sort((a, b) => a - b);
    return {
      subjects: data.subjects.map(s => ({ value: s.id, label: s.name, group: deptName.get(s.departmentId ?? '') ?? '教科なし' })),
      classes: data.classes.map(c => ({ value: c.id, label: c.name, group: `${c.grade}年` })),
      classQuick: grades.map(g => ({ label: `${g}年全部`, values: data.classes.filter(c => c.grade === g).map(c => c.id) })),
      teachers: data.teachers.map(t => ({ value: t.id, label: t.name, group: deptName.get(t.departmentId ?? '') ?? '教科なし' })),
      rooms: data.rooms.map(r => ({ value: r.id, label: r.name })),
      groups: data.groups.map(g => ({ value: g.id, label: g.name })),
    };
  }, [data]);
}

const BLOCK_OPTS = [
  { value: '1', label: '1コマずつ' },
  { value: '2', label: '2コマ連続' },
  { value: '3', label: '3コマ連続' },
];

function Badges({ l }: { l: Lesson }) {
  return (
    <span className="badges">
      {l.classIds.length > 1 && <span className="badge joint" title="複数クラスが同じ時間に受ける授業">合同</span>}
      {l.teacherIds.length > 1 && <span className="badge tt" title="複数の先生で行う授業">TT</span>}
      {l.blockLength > 1 && <span className="badge block">{l.blockLength}連</span>}
    </span>
  );
}

export function LessonsPage() {
  const { data, idx, nm } = useDerived();
  const update = useApp(s => s.update);
  const opts = useOptions();
  const [adding, setAdding] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const ready = data.classes.length > 0 && data.subjects.length > 0;
  const list = data.lessons.filter(l =>
    (!classFilter || l.classIds.includes(classFilter))
    && (!teacherFilter || l.teacherIds.includes(teacherFilter))
    && (!q || nm.lessonLabel(l).includes(q)));

  const slots = data.settings.days.length * data.settings.periods;
  const classHours = data.classes.map(c => {
    // 選択群は群で1回だけ数える
    const seenGroups = new Set<string>();
    let h = 0;
    for (const l of data.lessons) {
      if (!l.classIds.includes(c.id)) continue;
      if (l.groupId) {
        if (seenGroups.has(l.groupId)) continue;
        seenGroups.add(l.groupId);
      }
      h += l.weeklyCount;
    }
    return { c, h };
  });

  const edit = (id: string, fn: (l: Lesson) => void) => update(d => { fn(d.lessons.find(x => x.id === id)!); });

  return (
    <div className="page">
      <PageHead
        title="授業（担当・コマ数）"
        desc={<>「どの科目を・どのクラスに・どの先生が・週何コマ」を1行で設定します。
          <b>クラスを2つ以上</b>選ぶと<span className="badge joint">合同</span>、
          <b>先生を2人以上</b>選ぶと<span className="badge tt">TT</span>になります。</>}
        actions={<>
          <button className="btn" onClick={() => setGroupsOpen(true)}>選択群（{data.groups.length}）</button>
          <button className="btn primary" disabled={!ready} onClick={() => setAdding(true)}>＋ 授業をまとめて追加</button>
        </>}
      />
      {!ready && <div className="notice">先に「クラス」と「教科・科目」を登録してください。</div>}

      {data.classes.length > 0 && (
        <div className="card">
          <div className="hours-strip">
            {classHours.map(({ c, h }) => (
              <button key={c.id} className={`hours-chip ${h > slots ? 'over' : h === slots ? 'full' : ''} ${classFilter === c.id ? 'on' : ''}`}
                onClick={() => setClassFilter(classFilter === c.id ? null : c.id)}
                title={`${c.name}：週${h}コマ（枠は${slots}コマ）`}>
                <b>{c.name}</b> {h}/{slots}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row gap wrap mb">
        <Select value={classFilter} options={opts.classes} placeholder="すべてのクラス" onChange={setClassFilter} />
        <Select value={teacherFilter} options={opts.teachers} placeholder="すべての先生" onChange={setTeacherFilter} />
        <input className="cell-input" placeholder="検索" value={q} onChange={e => setQ(e.target.value)} />
        <span className="muted small">{list.length}件 / 合計 {list.reduce((s, l) => s + l.weeklyCount, 0)}コマ</span>
      </div>

      <div className="card flush">
        {list.length === 0 ? <Empty>授業がありません。「＋ 授業をまとめて追加」から作成してください。</Empty> : (
          <table className="table lessons">
            <thead>
              <tr><th>科目</th><th>クラス</th><th>先生</th><th>週コマ</th><th>置き方</th><th>教室</th><th>選択群</th><th>配置</th><th /></tr>
            </thead>
            <tbody>
              {list.map(l => {
                const rem = remainingHours(idx, l);
                return (
                  <tr key={l.id}>
                    <td>
                      <span className="dot" style={{ background: nm.lessonColor(l) }} />
                      <Select value={l.subjectId} options={opts.subjects} onChange={v => v && edit(l.id, x => { x.subjectId = v; })} />
                    </td>
                    <td><MultiPicker values={l.classIds} options={opts.classes} quick={opts.classQuick} onChange={v => {
                      if (v.length === 0) return;
                      edit(l.id, x => { x.classIds = v; });
                    }} /></td>
                    <td><MultiPicker values={l.teacherIds} options={opts.teachers} placeholder="先生を選ぶ" onChange={v => edit(l.id, x => { x.teacherIds = v; })} /></td>
                    <td><NumberCell value={l.weeklyCount} min={1} max={20} width={56} onCommit={v => edit(l.id, x => { x.weeklyCount = v; })} /></td>
                    <td>
                      <Select value={String(l.blockLength)} options={BLOCK_OPTS} onChange={v => edit(l.id, x => { x.blockLength = Number(v ?? 1); })} />
                      <Badges l={l} />
                    </td>
                    <td><Select value={l.roomId} options={opts.rooms} placeholder="—" onChange={v => edit(l.id, x => { x.roomId = v; })} /></td>
                    <td><Select value={l.groupId} options={opts.groups} placeholder="—" onChange={v => edit(l.id, x => { x.groupId = v; })} /></td>
                    <td className={`num-cell ${rem === 0 ? 'ok' : ''}`}>{l.weeklyCount - rem}/{l.weeklyCount}</td>
                    <td className="right nowrap">
                      <button className="icon-btn" title="複製" aria-label="複製" onClick={() => update(d => {
                        const i = d.lessons.findIndex(x => x.id === l.id);
                        d.lessons.splice(i + 1, 0, { ...l, id: newId('ls') });
                      })}>⧉</button>
                      <DelButton onClick={() => {
                        if (confirmDelete(`${nm.lessonLabel(l)}${l.weeklyCount - rem ? '（配置済みのコマも外れます）' : ''}`)) {
                          update(d => { d.lessons = d.lessons.filter(x => x.id !== l.id); });
                        }
                      }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {adding && <AddLessons onClose={() => setAdding(false)} defaultClass={classFilter} defaultTeacher={teacherFilter} />}
      {groupsOpen && <GroupsDialog onClose={() => setGroupsOpen(false)} />}
    </div>
  );
}

function AddLessons({ onClose, defaultClass, defaultTeacher }: { onClose: () => void; defaultClass: string | null; defaultTeacher: string | null }) {
  const data = useApp(s => s.data);
  const update = useApp(s => s.update);
  const toast = useApp(s => s.toast);
  const opts = useOptions();
  const [subjectId, setSubject] = useState<string | null>(null);
  const [classIds, setClasses] = useState<string[]>(defaultClass ? [defaultClass] : []);
  const [teacherIds, setTeachers] = useState<string[]>(defaultTeacher ? [defaultTeacher] : []);
  const [count, setCount] = useState(2);
  const [block, setBlock] = useState('1');
  const [roomId, setRoom] = useState<string | null>(null);
  const [mode, setMode] = useState<'each' | 'joint'>('each');

  const clsNames = classIds.map(id => data.classes.find(c => c.id === id)?.name).join('・');
  const subjName = data.subjects.find(s => s.id === subjectId)?.name;
  const ok = subjectId && classIds.length > 0;
  const n = mode === 'each' ? classIds.length : 1;

  const submit = () => {
    if (!ok) return;
    update(d => {
      const base = { subjectId: subjectId!, teacherIds, roomId, weeklyCount: count, blockLength: Number(block), groupId: null };
      if (mode === 'each') classIds.forEach(c => d.lessons.push({ id: newId('ls'), classIds: [c], ...base }));
      else d.lessons.push({ id: newId('ls'), classIds, ...base });
    });
    toast(`授業を${n}件追加しました`);
    onClose();
  };

  return (
    <Modal title="授業をまとめて追加" onClose={onClose} width={620}
      footer={<>
        <button className="btn" onClick={onClose}>キャンセル</button>
        <button className="btn primary" disabled={!ok} onClick={submit}>{n}件追加</button>
      </>}>
      <div className="form">
        <div className="field"><span>科目</span>
          <MultiPicker single values={subjectId ? [subjectId] : []} options={opts.subjects} placeholder="科目を選ぶ" onChange={v => setSubject(v[0] ?? null)} />
        </div>
        <div className="field"><span>クラス（複数選択可）</span>
          <MultiPicker values={classIds} options={opts.classes} quick={opts.classQuick} placeholder="クラスを選ぶ" onChange={setClasses} />
        </div>
        {classIds.length > 1 && (
          <div className="field">
            <span>複数クラスの扱い</span>
            <div className="choice">
              <label className={mode === 'each' ? 'on' : ''}><input type="radio" checked={mode === 'each'} onChange={() => setMode('each')} />
                <div><b>クラスごとに別々の授業</b><div className="muted small">各クラスで別の時間に行う（ふつうはこちら）</div></div></label>
              <label className={mode === 'joint' ? 'on' : ''}><input type="radio" checked={mode === 'joint'} onChange={() => setMode('joint')} />
                <div><b>合同授業（1つの授業）</b><div className="muted small">全クラスが同じ時間に一緒に受ける（体育の男女別など）</div></div></label>
            </div>
          </div>
        )}
        <div className="field"><span>先生（あとで表で設定してもOK）</span>
          <MultiPicker values={teacherIds} options={opts.teachers} placeholder="先生を選ぶ" onChange={setTeachers} />
        </div>
        <div className="row gap wrap">
          <label className="field"><span>週のコマ数</span><NumberCell value={count} min={1} max={20} onCommit={setCount} /></label>
          <label className="field"><span>置き方</span><Select value={block} options={BLOCK_OPTS} onChange={v => setBlock(v ?? '1')} /></label>
          <label className="field"><span>特別教室</span><Select value={roomId} options={opts.rooms} placeholder="なし" onChange={setRoom} /></label>
        </div>
        {ok && (
          <div className="preview">
            {mode === 'each'
              ? <>「{subjName}」週{count}コマを、<b>{clsNames}</b> にそれぞれ作成します（{n}件）。</>
              : <>「{subjName}」週{count}コマを <b>{clsNames}</b> の合同授業として1件作成します。</>}
            {teacherIds.length > 1 && <> 先生{teacherIds.length}人のTTになります。</>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function GroupsDialog({ onClose }: { onClose: () => void }) {
  const { data, nm } = useDerived();
  const update = useApp(s => s.update);
  return (
    <Modal title="選択群" onClose={onClose} width={640}
      footer={<>
        <button className="btn" onClick={() => update(d => { d.groups.push({ id: newId('gp'), name: `選択群${d.groups.length + 1}` }); })}>＋ 新しい選択群</button>
        <button className="btn primary" onClick={onClose}>閉じる</button>
      </>}>
      <p className="muted">
        同じ選択群の授業は、<b>いつも同じ時間に並んで</b>入ります（芸術選択・習熟度別・クラス展開など）。
        授業の表の「選択群」欄で所属を決めてください。群の中ではクラスが重なっても重複扱いになりません。
      </p>
      {data.groups.length === 0 ? <Empty>選択群はまだありません。</Empty> : (
        <table className="table">
          <thead><tr><th>名前</th><th>授業</th><th /></tr></thead>
          <tbody>
            {data.groups.map(g => {
              const ls = data.lessons.filter(l => l.groupId === g.id);
              const counts = new Set(ls.map(l => `${l.weeklyCount}/${l.blockLength}`));
              return (
                <tr key={g.id}>
                  <td><TextCell value={g.name} onCommit={v => update(d => { d.groups.find(x => x.id === g.id)!.name = v; })} /></td>
                  <td className="small">
                    {ls.length === 0 ? <span className="muted">（授業なし）</span> : ls.map(l => <div key={l.id}>{nm.lessonLabel(l)} 週{l.weeklyCount}</div>)}
                    {counts.size > 1 && <div className="warn-text">コマ数・置き方をそろえてください</div>}
                  </td>
                  <td className="right"><DelButton onClick={() => { if (confirmDelete(g.name)) update(d => { d.groups = d.groups.filter(x => x.id !== g.id); }); }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
