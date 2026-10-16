import { useState } from 'react';
import { useApp } from '../../store';
import { Teacher, newId } from '../../core/types';
import {
  DelButton, Empty, Modal, MultiPicker, NumberCell, PageHead, PasteImport, Select, SlotPicker, TextCell, confirmDelete,
} from '../common';

export function TeachersPage() {
  const data = useApp(s => s.data);
  const update = useApp(s => s.update);
  const toast = useApp(s => s.toast);
  const [paste, setPaste] = useState(false);
  const [slotsFor, setSlotsFor] = useState<Teacher | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const deptOpts = data.departments.map(d => ({ value: d.id, label: d.name }));
  const divOpts = data.divisions.map(d => ({ value: d.id, label: d.name }));
  const hours = new Map<string, number>();
  for (const l of data.lessons) for (const t of l.teacherIds) hours.set(t, (hours.get(t) ?? 0) + l.weeklyCount);
  const list = data.teachers.filter(t => !filter || t.departmentId === filter);

  const edit = (id: string, fn: (t: Teacher) => void) => update(d => { fn(d.teachers.find(x => x.id === id)!); });
  const current = slotsFor && data.teachers.find(t => t.id === slotsFor.id);

  return (
    <div className="page">
      <PageHead title="先生"
        desc="「勤務不可」は授業を入れられない時間（非常勤の出勤日以外など）です。会議は「会議・分掌」で設定します。"
        actions={<>
          <button className="btn" onClick={() => setPaste(true)}>表から貼り付け</button>
          <button className="btn primary" onClick={() => update(d => {
            d.teachers.push({ id: newId('tc'), name: '新しい先生', departmentId: filter ?? null, divisionIds: [], unavailable: [], maxPerDay: 0 });
          })}>＋ 追加</button>
        </>} />
      {data.departments.length > 0 && (
        <div className="toggle-row mb">
          <button className={`toggle ${!filter ? 'on' : ''}`} onClick={() => setFilter(null)}>すべて（{data.teachers.length}）</button>
          {data.departments.map(d => (
            <button key={d.id} className={`toggle ${filter === d.id ? 'on' : ''}`} onClick={() => setFilter(d.id)}>
              <span className="dot" style={{ background: d.color }} />{d.name}（{data.teachers.filter(t => t.departmentId === d.id).length}）
            </button>
          ))}
        </div>
      )}
      <div className="card">
        {list.length === 0 ? <Empty>教員を追加してください。Excel の名簿から貼り付けると早いです。</Empty> : (
          <table className="table">
            <thead><tr><th>氏名</th><th>教科</th><th>分掌</th><th>持ちコマ</th><th>1日の上限</th><th>勤務不可</th><th /></tr></thead>
            <tbody>
              {list.map(t => (
                <tr key={t.id}>
                  <td><TextCell value={t.name} onCommit={v => edit(t.id, x => { x.name = v; })} width={140} /></td>
                  <td><Select value={t.departmentId} options={deptOpts} onChange={v => edit(t.id, x => { x.departmentId = v; })} /></td>
                  <td><MultiPicker values={t.divisionIds} options={divOpts} placeholder="—" onChange={v => edit(t.id, x => { x.divisionIds = v; })} /></td>
                  <td className="num-cell">{hours.get(t.id) ?? 0}</td>
                  <td><NumberCell value={t.maxPerDay} min={0} max={10} width={56} onCommit={v => edit(t.id, x => { x.maxPerDay = v; })} /><span className="muted small"> {t.maxPerDay ? 'コマ' : '制限なし'}</span></td>
                  <td>
                    <button className="btn small" onClick={() => setSlotsFor(t)}>
                      {t.unavailable.length ? `${t.unavailable.length}コマ` : '設定'}
                    </button>
                  </td>
                  <td className="right"><DelButton onClick={() => {
                    if (confirmDelete(`${t.name}先生`)) update(d => { d.teachers = d.teachers.filter(x => x.id !== t.id); });
                  }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {current && (
        <Modal title={`${current.name}先生の勤務不可の時間`} onClose={() => setSlotsFor(null)} width={460}
          footer={<>
            <button className="btn" onClick={() => edit(current.id, x => { x.unavailable = []; })}>すべて解除</button>
            <button className="btn primary" onClick={() => setSlotsFor(null)}>閉じる</button>
          </>}>
          <p className="muted small">マスをクリック（ドラッグでまとめて）すると「×」が付き、その時間は授業を入れられなくなります。</p>
          <SlotPicker days={data.settings.days} periods={data.settings.periods} values={current.unavailable}
            onChange={v => edit(current.id, x => { x.unavailable = v; })} />
          <div className="row gap mt">
            {data.settings.days.map((dn, di) => (
              <button key={dn} className="btn small" onClick={() => edit(current.id, x => {
                const all = Array.from({ length: data.settings.periods }, (_, p) => `${di}-${p}`);
                const full = all.every(k => x.unavailable.includes(k));
                x.unavailable = full ? x.unavailable.filter(k => !all.includes(k)) : [...new Set([...x.unavailable, ...all])];
              })}>{dn}曜まるごと</button>
            ))}
          </div>
        </Modal>
      )}
      {paste && (
        <PasteImport title="教員を貼り付けで追加" columns={['氏名', '教科', '分掌']} example={'教員A\t数学\t教務部\n教員B\t国語'}
          onClose={() => setPaste(false)}
          onImport={rows => {
            update(d => {
              for (const [name, dept, divs] of rows) {
                if (!name) continue;
                let dp = dept ? d.departments.find(x => x.name === dept) : undefined;
                if (dept && !dp) { dp = { id: newId('dp'), name: dept, color: '#64748b' }; d.departments.push(dp); }
                const divisionIds = (divs ?? '').split(/[・、,，\s]+/).filter(Boolean).map(n => {
                  let dv = d.divisions.find(x => x.name === n);
                  if (!dv) { dv = { id: newId('dv'), name: n }; d.divisions.push(dv); }
                  return dv.id;
                });
                d.teachers.push({ id: newId('tc'), name, departmentId: dp?.id ?? null, divisionIds, unavailable: [], maxPerDay: 0 });
              }
            });
            toast('教員を追加しました');
          }} />
      )}
    </div>
  );
}

export function MeetingsPage() {
  const data = useApp(s => s.data);
  const update = useApp(s => s.update);
  const [slotsFor, setSlotsFor] = useState<string | null>(null);
  const teacherOpts = data.teachers.map(t => ({
    value: t.id, label: t.name, group: data.departments.find(d => d.id === t.departmentId)?.name ?? '教科なし',
  }));
  const quick = [
    { label: '全員', values: data.teachers.map(t => t.id) },
    ...data.divisions.map(dv => ({ label: dv.name, values: data.teachers.filter(t => t.divisionIds.includes(dv.id)).map(t => t.id) })),
    ...[...new Set(data.classes.map(c => c.grade))].map(g => ({
      label: `${g}年担任`, values: data.classes.filter(c => c.grade === g && c.homeroomTeacherId).map(c => c.homeroomTeacherId!) })),
  ];
  const meeting = slotsFor ? data.meetings.find(m => m.id === slotsFor) : null;
  const slotLabel = (k: string) => {
    const [d, p] = k.split('-').map(Number);
    return `${data.settings.days[d]}${p + 1}`;
  };

  return (
    <div className="page">
      <PageHead title="会議・分掌" desc="会議の時間は、参加する先生に授業が入らないようになります。参加者は分掌や学年担任でまとめて選べます。" />
      <div className="two-col wide-right">
        <div className="card">
          <div className="card-head">
            <h4>分掌</h4>
            <button className="btn small" onClick={() => update(d => { d.divisions.push({ id: newId('dv'), name: '新しい分掌' }); })}>＋ 追加</button>
          </div>
          {data.divisions.length === 0 ? <Empty>例：教務部、生徒指導部…</Empty> : (
            <table className="table">
              <tbody>
                {data.divisions.map(dv => (
                  <tr key={dv.id}>
                    <td><TextCell value={dv.name} onCommit={v => update(d => { d.divisions.find(x => x.id === dv.id)!.name = v; })} /></td>
                    <td className="muted small">{data.teachers.filter(t => t.divisionIds.includes(dv.id)).length}人</td>
                    <td className="right"><DelButton onClick={() => { if (confirmDelete(dv.name)) update(d => { d.divisions = d.divisions.filter(x => x.id !== dv.id); }); }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted small">所属は「教員」画面で設定します。</p>
        </div>
        <div className="card">
          <div className="card-head">
            <h4>会議・固定業務</h4>
            <button className="btn small" onClick={() => update(d => { d.meetings.push({ id: newId('mt'), name: '新しい会議', slots: [], teacherIds: [] }); })}>＋ 追加</button>
          </div>
          {data.meetings.length === 0 ? <Empty>例：職員会議（水6）、学年会…</Empty> : (
            <table className="table">
              <thead><tr><th>名前</th><th>時間</th><th>参加者</th><th /></tr></thead>
              <tbody>
                {data.meetings.map(m => (
                  <tr key={m.id}>
                    <td><TextCell value={m.name} width={140} onCommit={v => update(d => { d.meetings.find(x => x.id === m.id)!.name = v; })} /></td>
                    <td><button className="btn small" onClick={() => setSlotsFor(m.id)}>{m.slots.length ? m.slots.map(slotLabel).join('・') : '時間を選ぶ'}</button></td>
                    <td><MultiPicker values={m.teacherIds} options={teacherOpts} quick={quick} placeholder="参加者を選ぶ"
                      onChange={v => update(d => { d.meetings.find(x => x.id === m.id)!.teacherIds = v; })} /></td>
                    <td className="right"><DelButton onClick={() => { if (confirmDelete(m.name)) update(d => { d.meetings = d.meetings.filter(x => x.id !== m.id); }); }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {meeting && (
        <Modal title={`「${meeting.name}」の時間`} onClose={() => setSlotsFor(null)} width={460}
          footer={<button className="btn primary" onClick={() => setSlotsFor(null)}>閉じる</button>}>
          <SlotPicker days={data.settings.days} periods={data.settings.periods} values={meeting.slots} label="●"
            onChange={v => update(d => { d.meetings.find(x => x.id === meeting.id)!.slots = v; })} />
        </Modal>
      )}
    </div>
  );
}
