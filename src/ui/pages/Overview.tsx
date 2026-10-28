import { useState } from 'react';
import { useApp, ViewType } from '../../store';
import { useDerived } from '../derived';
import { OccupantCard, blockedLabel, mergeGroups, useTargets } from '../Grid';
import { groupMates, lessonsFor, movePlacement, occupantsFor, remainingHours } from '../../core/logic';
import { slotKey } from '../../core/types';
import { useEntities } from './Editor';
import { Empty, PageHead } from '../common';

export function OverviewPage({ printMode = false, forceType }: { printMode?: boolean; forceType?: ViewType }) {
  const { data, idx, nm, conflicts } = useDerived();
  const update = useApp(s => s.update);
  const toast = useApp(s => s.toast);
  const selection = useApp(s => s.selection);
  const select = useApp(s => s.select);
  const setView = useApp(s => s.setView);
  const setPage = useApp(s => s.setPage);
  const [typeState, setType] = useState<ViewType>('teacher');
  const type = forceType ?? typeState;
  const entities = useEntities(type);
  const targets = useTargets(data, idx, nm, printMode ? { kind: 'none' } : selection);
  const { days, periods } = data.settings;

  const selPl = selection.kind === 'placement' ? data.placements.find(p => p.id === selection.placementId) : null;
  const selLesson = selPl ? idx.lessonById.get(selPl.lessonId) : null;
  const mates = selPl ? groupMates(data, idx, selPl) : [];
  const mateLessons = mates.map(p => idx.lessonById.get(p.lessonId)!);
  const involved = (eid: string) => selLesson && mateLessons.some(l =>
    type === 'class' ? l.classIds.includes(eid) : type === 'teacher' ? l.teacherIds.includes(eid) : l.roomId === eid);

  // 縦：曜日・時限（月1〜月6、火1…）、横：先生（クラス・教室）
  const rem = new Map(entities.map(e => [e.id, lessonsFor(data, type, e.id).reduce((s, l) => s + remainingHours(idx, l), 0)]));
  const table = (
    <div className={`matrix-wrap ${printMode ? 'print' : ''}`}>
      <table className="matrix">
        <thead>
          <tr>
            <th colSpan={2} className="m-corner">{type === 'class' ? 'クラス' : type === 'teacher' ? '先生' : '教室'}</th>
            {entities.map(e => (
              <th key={e.id} className={`m-name ${involved(e.id) ? 'involved' : ''}`}>
                {printMode ? e.name : <button className="link" onClick={() => { setView(type, e.id); setPage('edit'); }}>{e.name}</button>}
                {!printMode && <div className={`m-rem ${rem.get(e.id) ? 'warn-text' : 'ok-text'}`} title="未配置コマ">{rem.get(e.id) ? `残${rem.get(e.id)}` : '✓'}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.flatMap((dayName, d) => Array.from({ length: periods }, (_, p) => {
            const key = slotKey(d, p);
            return (
              <tr key={key} className={p === 0 && d > 0 ? 'day-start' : ''}>
                {p === 0 && <th rowSpan={periods} className="m-day">{dayName}</th>}
                <th className="m-p">{p + 1}</th>
                {entities.map(e => {
                  const inv = involved(e.id);
                  const occ = occupantsFor(idx, type, e.id, d, p);
                  const r = inv ? targets?.get(key) : undefined;
                  const can = r && r.length === 0;
                  const blocked = blockedLabel(data, idx, type, e.id, key);
                  return (
                    <td key={e.id}
                      className={`m-cell ${inv ? 'involved' : ''} ${r ? (can ? 'can' : 'cannot') : ''} ${blocked && occ.length === 0 ? 'blocked' : ''}`}
                      title={r && !can ? r.map(x => x.message).join('\n') : blocked ?? undefined}
                      onClick={() => {
                        if (!selPl || !inv) return;
                        if (!can) { toast(r?.[0]?.message ?? '置けません', 'error'); return; }
                        update(dd => movePlacement(dd, selPl.id, d, p));
                      }}>
                      {mergeGroups(occ, type).map(({ o, mates: ms }) => (
                        <OccupantCard key={o.placement.id} o={o} mates={ms} type={type} nm={nm} slotPeriod={p} compact
                          selected={mates.some(m => m.id === o.placement.id)}
                          conflict={conflicts.has(`${type}:${e.id}:${key}`)}
                          onClick={ev => {
                            if (printMode) return;
                            ev.stopPropagation();
                            select(mates.some(m => m.id === o.placement.id) ? { kind: 'none' } : { kind: 'placement', placementId: o.placement.id });
                          }} />
                      ))}
                    </td>
                  );
                })}
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );

  if (printMode) return table;

  return (
    <div className="page wide">
      <PageHead title="全体一覧"
        desc="全員の時間割を1画面で確認できます。縦が曜日・時限、横が先生です。授業をクリックすると、動かせる枠（関係する列）が緑になります。名前をクリックするとその時間割の編集へ移ります。"
        actions={
          <div className="seg">
            {(['teacher', 'class', 'room'] as ViewType[]).map(t => (
              <button key={t} className={type === t ? 'on' : ''} onClick={() => { setType(t); select({ kind: 'none' }); }}>
                {t === 'class' ? 'クラス' : t === 'teacher' ? '先生' : '教室'}
              </button>
            ))}
          </div>
        } />
      {entities.length === 0 ? <Empty>表示する対象がありません。</Empty> : table}
    </div>
  );
}
