// ============================================================
// 時間割のマス目（編集画面・印刷で共用）
// ============================================================
import { useMemo } from 'react';
import { Id, TimetableData, slotKey } from '../core/types';
import { Index, Names, Occupant, Reason, checkMove, checkPlace, occupantsFor } from '../core/logic';
import { Selection, ViewType } from '../store';

/** 選択中の授業・配置を各枠に置けるか（slotKey -> 理由。空なら置ける） */
export function useTargets(data: TimetableData, idx: Index, nm: Names, sel: Selection) {
  return useMemo(() => {
    if (sel.kind === 'none') return null;
    const map = new Map<string, Reason[]>();
    for (let d = 0; d < data.settings.days.length; d++) {
      for (let p = 0; p < data.settings.periods; p++) {
        map.set(slotKey(d, p), sel.kind === 'lesson'
          ? checkPlace(data, idx, sel.lessonId, d, p, nm)
          : checkMove(data, idx, sel.placementId, d, p, nm));
      }
    }
    return map;
  }, [data, idx, nm, sel]);
}

export function OccupantCard({
  o, mates, type, nm, slotPeriod, selected, conflict, compact, draggable, onClick, onDragStart,
}: {
  o: Occupant; mates?: Occupant[]; type: ViewType; nm: Names; slotPeriod: number; selected?: boolean; conflict?: boolean;
  compact?: boolean; draggable?: boolean; onClick?: (e: React.MouseEvent) => void; onDragStart?: (e: React.DragEvent) => void;
}) {
  const l = o.lesson;
  if (mates && mates.length > 1) {
    // 選択群：1枚のカードにまとめて表示
    const first = o.placement.period === slotPeriod;
    const last = o.placement.period + o.placement.length - 1 === slotPeriod;
    const gname = nm.group.get(l.groupId!)?.name ?? '選択群';
    const parts = mates.map(m => `${nm.subjectShort(m.lesson.subjectId)}(${m.lesson.teacherIds.map(nm.teacherName).join('・')})`);
    return (
      <div
        className={`occ group-occ ${first ? 'first' : 'cont'} ${last ? 'last' : ''} ${selected ? 'selected' : ''} ${conflict ? 'conflict' : ''} ${compact ? 'compact' : ''}`}
        style={{ '--c': nm.lessonColor(l) } as React.CSSProperties}
        draggable={draggable}
        onDragStart={onDragStart}
        onClick={onClick}
        title={`${gname}\n${mates.map(m => nm.lessonLabel(m.lesson)).join('\n')}`}
      >
        <div className="occ-main">
          <span className="occ-subj">{compact ? mates.map(m => nm.subjectShort(m.lesson.subjectId)).join('') : gname}</span>
          {o.placement.locked && <span className="occ-lock" aria-label="固定">固</span>}
        </div>
        {!compact && <div className="occ-sub">{parts.join(' ')}</div>}
      </div>
    );
  }
  const first = o.placement.period === slotPeriod;
  const last = o.placement.period + o.placement.length - 1 === slotPeriod;
  const sub = type === 'class'
    ? l.teacherIds.map(nm.teacherName).join('・') || '（先生未定）'
    : type === 'teacher'
      ? l.classIds.map(nm.className).join('・')
      : `${l.classIds.map(nm.className).join('・')} ${l.teacherIds.map(nm.teacherName).join('・')}`;
  const room = type !== 'room' && l.roomId ? nm.room.get(l.roomId) : null;
  const group = l.groupId ? nm.group.get(l.groupId) : null;
  return (
    <div
      className={`occ ${first ? 'first' : 'cont'} ${last ? 'last' : ''} ${selected ? 'selected' : ''} ${conflict ? 'conflict' : ''} ${compact ? 'compact' : ''}`}
      style={{ '--c': nm.lessonColor(l) } as React.CSSProperties}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      title={`${nm.lessonLabel(l)}${room ? ` @${room.name}` : ''}${group ? ` [${group.name}]` : ''}${o.placement.locked ? '（固定）' : ''}`}
    >
      <div className="occ-main">
        <span className="occ-subj">{compact ? nm.subjectShort(l.subjectId) : nm.subjectName(l.subjectId)}</span>
        {o.placement.locked && <span className="occ-lock" aria-label="固定">固</span>}
      </div>
      {!compact && <div className="occ-sub">{sub}</div>}
      {!compact && (room || group) && <div className="occ-sub muted">{[room?.shortName || room?.name, group?.name].filter(Boolean).join(' ・ ')}</div>}
      {compact && <div className="occ-sub">{type === 'class' ? l.teacherIds.map(nm.teacherName).join('・') : l.classIds.map(nm.className).join('・')}</div>}
    </div>
  );
}

/** クラス表示では、同じ枠に並ぶ選択群の授業を1つにまとめる */
export function mergeGroups(occ: Occupant[], type: ViewType): { o: Occupant; mates: Occupant[] }[] {
  if (type !== 'class') return occ.map(o => ({ o, mates: [o] }));
  const out: { o: Occupant; mates: Occupant[] }[] = [];
  for (const o of occ) {
    const g = o.lesson.groupId;
    const hit = g ? out.find(x => x.o.lesson.groupId === g && x.o.placement.day === o.placement.day && x.o.placement.period === o.placement.period) : undefined;
    if (hit) hit.mates.push(o);
    else out.push({ o, mates: [o] });
  }
  return out;
}

/** 対象（クラス・先生・教室）の勤務不可・会議の表示 */
export function blockedLabel(data: TimetableData, idx: Index, type: ViewType, id: Id, key: string): string | null {
  if (type !== 'teacher') return null;
  const t = data.teachers.find(x => x.id === id);
  if (t?.unavailable.includes(key)) return '勤務不可';
  return idx.meetingSlots.get(id)?.get(key) ?? null;
}

export function TimetableGrid({
  data, idx, nm, type, id, selection, targets, conflicts, printMode, onCell, onOccupant, onDragStartOcc, onDrop,
}: {
  data: TimetableData; idx: Index; nm: Names; type: ViewType; id: Id;
  selection?: Selection; targets?: Map<string, Reason[]> | null; conflicts?: Set<string>; printMode?: boolean;
  onCell?: (day: number, period: number) => void;
  onOccupant?: (o: Occupant, day: number, period: number) => void;
  onDragStartOcc?: (o: Occupant, e: React.DragEvent) => void;
  onDrop?: (day: number, period: number) => void;
}) {
  const { days, periods } = data.settings;
  const selectedPl = selection?.kind === 'placement' ? data.placements.find(p => p.id === selection.placementId) : null;
  const selectedLessonId = selection?.kind === 'lesson' ? selection.lessonId : selectedPl?.lessonId;

  return (
    <table className={`tt-grid ${printMode ? 'print' : ''}`} style={{ '--days': days.length } as React.CSSProperties}>
      <thead>
        <tr><th className="corner" />{days.map(d => <th key={d}>{d}</th>)}</tr>
      </thead>
      <tbody>
        {Array.from({ length: periods }, (_, p) => (
          <tr key={p}>
            <th className="period">{p + 1}</th>
            {days.map((_, d) => {
              const key = slotKey(d, p);
              const occ = occupantsFor(idx, type, id, d, p);
              const reasons = targets?.get(key);
              const can = reasons && reasons.length === 0;
              const blocked = blockedLabel(data, idx, type, id, key);
              const conflict = conflicts?.has(`${type}:${id}:${key}`);
              return (
                <td key={key}
                  className={[
                    'slot',
                    reasons ? (can ? 'can' : 'cannot') : '',
                    blocked && occ.length === 0 ? 'blocked' : '',
                  ].join(' ')}
                  title={reasons && !can ? reasons.map(r => r.message).join('\n') : undefined}
                  onClick={() => onCell?.(d, p)}
                  onDragOver={e => { if (can) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                  onDrop={e => { e.preventDefault(); onDrop?.(d, p); }}
                >
                  <div className="slot-inner">
                    {mergeGroups(occ, type).map(({ o, mates }) => (
                      <OccupantCard key={o.placement.id} o={o} mates={mates} type={type} nm={nm} slotPeriod={p}
                        selected={selectedPl ? o.placement.id === selectedPl.id || (selectedPl.day === o.placement.day && selectedPl.period === o.placement.period && !!o.lesson.groupId && o.lesson.groupId === idx.lessonById.get(selectedPl.lessonId)?.groupId) : mates.some(m => m.lesson.id === selectedLessonId)}
                        conflict={conflict}
                        draggable={!printMode}
                        onDragStart={e => onDragStartOcc?.(o, e)}
                        onClick={e => { e.stopPropagation(); onOccupant?.(o, d, p); }} />
                    ))}
                    {occ.length === 0 && blocked && <span className="blocked-label">{blocked}</span>}
                    {occ.length === 0 && can && <span className="drop-hint">ここに置く</span>}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
