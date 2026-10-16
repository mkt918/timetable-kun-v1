import { useEffect, useMemo, useState } from 'react';
import { useApp, ViewType } from '../../store';
import { useDerived } from '../derived';
import { TimetableGrid, useTargets } from '../Grid';
import {
  Occupant, checkSwap, groupMates, lessonsFor, movePlacement, placeLesson, remainingHours, removePlacement,
  swapPlacements, toggleLock,
} from '../../core/logic';
import { autoSchedule } from '../../core/scheduler';
import { Id, Lesson } from '../../core/types';
import { Empty, Modal } from '../common';

const TYPE_LABEL: Record<ViewType, string> = { class: 'クラス', teacher: '先生', room: '教室' };

export function useEntities(type: ViewType) {
  const data = useApp(s => s.data);
  return useMemo(() => {
    if (type === 'class') {
      return data.classes.map(c => ({ id: c.id, name: c.name, group: `${c.grade}年` }));
    }
    if (type === 'teacher') {
      const dn = new Map(data.departments.map(d => [d.id, d.name]));
      return data.teachers.map(t => ({ id: t.id, name: t.name, group: dn.get(t.departmentId ?? '') ?? '教科なし' }));
    }
    return data.rooms.map(r => ({ id: r.id, name: r.name, group: '特別教室' }));
  }, [data, type]);
}

export function EditorPage() {
  const { data, idx, nm, conflicts, issues } = useDerived();
  const update = useApp(s => s.update);
  const toast = useApp(s => s.toast);
  const view = useApp(s => s.view);
  const setView = useApp(s => s.setView);
  const selection = useApp(s => s.selection);
  const select = useApp(s => s.select);
  const [autoOpen, setAutoOpen] = useState(false);

  const entities = useEntities(view.type);
  const current = entities.find(e => e.id === view.id) ?? entities[0];
  const id = current?.id;
  const targets = useTargets(data, idx, nm, selection);

  // 選択中の授業・配置が消えたら選択解除
  useEffect(() => {
    if (selection.kind === 'lesson' && !idx.lessonById.has(selection.lessonId)) select({ kind: 'none' });
    if (selection.kind === 'placement' && !data.placements.some(p => p.id === selection.placementId)) select({ kind: 'none' });
  }, [data, idx, selection, select]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'Escape') select({ kind: 'none' });
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.kind === 'placement') {
        e.preventDefault();
        update(d => removePlacement(d, selection.placementId));
        select({ kind: 'none' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, select, update]);

  if (!current) {
    return (
      <div className="page">
        <Empty>
          {view.type === 'class' ? 'クラスが登録されていません。「準備」の「クラス」から作成してください。'
            : view.type === 'teacher' ? '先生が登録されていません。' : '特別教室が登録されていません。'}
        </Empty>
        <TypeTabs />
      </div>
    );
  }

  const lessons = lessonsFor(data, view.type, id);
  const pending = lessons.filter(l => remainingHours(idx, l) > 0);
  const done = lessons.filter(l => remainingHours(idx, l) === 0);

  const tryAt = (day: number, period: number) => {
    if (!targets) return;
    const r = targets.get(`${day}-${period}`) ?? [];
    if (r.length > 0) { toast(r[0].message, 'error'); return; }
    if (selection.kind === 'lesson') {
      const lid = selection.lessonId;
      update(d => placeLesson(d, lid, day, period));
      // 残りがなければ選択解除（同じ授業を続けて置けるように、残りがあれば選択を保つ）
      const l = idx.lessonById.get(lid)!;
      if (remainingHours(idx, l) - Math.min(l.blockLength, remainingHours(idx, l)) <= 0) select({ kind: 'none' });
    } else if (selection.kind === 'placement') {
      const pid = selection.placementId;
      update(d => movePlacement(d, pid, day, period));
    }
  };

  const onOccupant = (o: Occupant) => {
    if (selection.kind === 'placement') {
      const sel = data.placements.find(p => p.id === selection.placementId);
      if (sel && groupMates(data, idx, sel).some(p => p.id === o.placement.id)) { select({ kind: 'none' }); return; }
      // 入れ替え（どちらも選択群でなく、同じ長さのとき）
      if (sel && sel.length === o.placement.length && !idx.lessonById.get(sel.lessonId)?.groupId && !o.lesson.groupId) {
        const r = checkSwap(data, sel, o.placement, nm);
        if (r.length === 0) {
          update(d => swapPlacements(d, sel.id, o.placement.id));
          toast('入れ替えました');
          select({ kind: 'none' });
          return;
        }
      }
    }
    select({ kind: 'placement', placementId: o.placement.id });
  };

  const selectedPl = selection.kind === 'placement' ? data.placements.find(p => p.id === selection.placementId) : null;
  const selectedLesson = selection.kind === 'lesson' ? idx.lessonById.get(selection.lessonId)
    : selectedPl ? idx.lessonById.get(selectedPl.lessonId) : undefined;
  const entityErrors = issues.filter(i => i.severity === 'error' && i.target?.type === view.type && i.target.id === id);
  const idxOf = entities.findIndex(e => e.id === id);

  return (
    <div className="editor">
      <aside className="ed-list">
        <TypeTabs />
        <EntityList type={view.type} current={id} />
      </aside>

      <section className="ed-main">
        <div className="ed-toolbar">
          <button className="icon-btn" disabled={idxOf <= 0} onClick={() => setView(view.type, entities[idxOf - 1].id)} aria-label="前へ">‹</button>
          <h2>{current.name}{view.type === 'teacher' ? ' 先生' : ''}</h2>
          <button className="icon-btn" disabled={idxOf >= entities.length - 1} onClick={() => setView(view.type, entities[idxOf + 1].id)} aria-label="次へ">›</button>
          <span className="muted small">
            {view.type === 'class' && (() => {
              const hr = data.classes.find(c => c.id === id)?.homeroomTeacherId;
              return hr ? `担任：${nm.teacherName(hr)}` : '';
            })()}
            {view.type === 'teacher' && `持ちコマ ${lessons.reduce((s, l) => s + l.weeklyCount, 0)}`}
          </span>
          <div className="spacer" />
          <button className="btn" onClick={() => {
            if (!window.confirm(`${current.name}の配置（固定以外）をすべて外しますか？`)) return;
            const ids = new Set(lessons.map(l => l.id));
            update(d => { d.placements = d.placements.filter(p => p.locked || !ids.has(p.lessonId)); });
          }}>このページを外す</button>
          <button className="btn primary" onClick={() => setAutoOpen(true)}>自動配置…</button>
        </div>

        {entityErrors.length > 0 && (
          <div className="notice error">
            {entityErrors.slice(0, 3).map((e, i) => <div key={i}>⚠ {e.message}</div>)}
            {entityErrors.length > 3 && <div>ほか{entityErrors.length - 3}件</div>}
          </div>
        )}

        <div className={`grid-wrap ${selection.kind !== 'none' ? 'selecting' : ''}`}>
          <TimetableGrid data={data} idx={idx} nm={nm} type={view.type} id={id}
            selection={selection} targets={targets} conflicts={conflicts}
            onCell={tryAt}
            onOccupant={onOccupant}
            onDragStartOcc={(o, e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', o.placement.id);
              select({ kind: 'placement', placementId: o.placement.id });
            }}
            onDrop={tryAt} />
        </div>

        <div className="ed-hint muted small">
          {selection.kind === 'none' && '右の「未配置」から授業をクリック（またはドラッグ）→ 緑のマスをクリックで配置。置いた授業をクリックすると移動・入れ替え・削除ができます。'}
          {selection.kind === 'lesson' && '緑のマスをクリックすると配置します。グレーのマスは置けません（マウスを乗せると理由が出ます）。Esc で取り消し。'}
          {selection.kind === 'placement' && '緑のマスをクリックで移動、別の授業をクリックで入れ替え。Delete キーで外します。Esc で取り消し。'}
        </div>
      </section>

      <aside className="ed-side">
        {selectedLesson && (
          <SelectedPanel lesson={selectedLesson} placementId={selectedPl?.id ?? null} />
        )}
        <div className="side-block">
          <h4>未配置 <span className="count">{pending.reduce((s, l) => s + remainingHours(idx, l), 0)}コマ</span></h4>
          {pending.length === 0 && <div className="muted small pad">{lessons.length ? 'すべて配置済みです 🎉' : 'このページに関わる授業がありません。「授業」画面で登録してください。'}</div>}
          {pending.map(l => <LessonCard key={l.id} l={l} type={view.type} />)}
        </div>
        {done.length > 0 && (
          <details className="side-block">
            <summary>配置済み（{done.length}）</summary>
            {done.map(l => <LessonCard key={l.id} l={l} type={view.type} />)}
          </details>
        )}
      </aside>
      {autoOpen && <AutoDialog onClose={() => setAutoOpen(false)} scopeClassIds={view.type === 'class' ? [id] : [...new Set(lessons.flatMap(l => l.classIds))]} scopeName={current.name} />}
    </div>
  );
}

function TypeTabs() {
  const view = useApp(s => s.view);
  const setView = useApp(s => s.setView);
  return (
    <div className="seg">
      {(['class', 'teacher', 'room'] as ViewType[]).map(t => (
        <button key={t} className={view.type === t ? 'on' : ''} onClick={() => setView(t, null)}>{TYPE_LABEL[t]}</button>
      ))}
    </div>
  );
}

function EntityList({ type, current }: { type: ViewType; current: Id }) {
  const { data, idx, issues } = useDerived();
  const setView = useApp(s => s.setView);
  const entities = useEntities(type);
  const groups = [...new Set(entities.map(e => e.group))];
  const errorIds = new Set(issues.filter(i => i.severity === 'error' && i.target?.type === type).map(i => i.target!.id));
  return (
    <div className="entity-list">
      {groups.map(g => (
        <div key={g}>
          <div className="el-group">{g}</div>
          {entities.filter(e => e.group === g).map(e => {
            const rem = lessonsFor(data, type, e.id).reduce((s, l) => s + remainingHours(idx, l), 0);
            return (
              <button key={e.id} className={`el-item ${e.id === current ? 'on' : ''}`} onClick={() => setView(type, e.id)}>
                <span>{e.name}</span>
                {errorIds.has(e.id) && <span className="el-err" title="エラーあり">!</span>}
                {rem > 0 ? <span className="el-rem" title="未配置コマ">{rem}</span> : <span className="el-done">✓</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function LessonCard({ l, type }: { l: Lesson; type: ViewType }) {
  const { idx, nm } = useDerived();
  const selection = useApp(s => s.selection);
  const select = useApp(s => s.select);
  const rem = remainingHours(idx, l);
  const on = selection.kind === 'lesson' && selection.lessonId === l.id;
  const sub = type === 'class' ? l.teacherIds.map(nm.teacherName).join('・') || '先生未定'
    : type === 'teacher' ? l.classIds.map(nm.className).join('・')
      : `${l.classIds.map(nm.className).join('・')}／${l.teacherIds.map(nm.teacherName).join('・')}`;
  return (
    <div
      className={`lesson-card ${on ? 'on' : ''} ${rem === 0 ? 'done' : ''}`}
      style={{ '--c': nm.lessonColor(l) } as React.CSSProperties}
      draggable={rem > 0}
      onDragStart={e => { e.dataTransfer.setData('text/plain', l.id); select({ kind: 'lesson', lessonId: l.id }); }}
      onClick={() => rem > 0 && select(on ? { kind: 'none' } : { kind: 'lesson', lessonId: l.id })}
    >
      <div className="lc-top">
        <b>{nm.subjectName(l.subjectId)}</b>
        <span className="lc-rem">{rem > 0 ? `あと${rem}` : '済'}</span>
      </div>
      <div className="lc-sub">
        {sub}
        {l.classIds.length > 1 && <span className="badge joint">合同</span>}
        {l.teacherIds.length > 1 && <span className="badge tt">TT</span>}
        {l.blockLength > 1 && <span className="badge block">{l.blockLength}連</span>}
        {l.groupId && <span className="badge group">{nm.group.get(l.groupId)?.name}</span>}
      </div>
    </div>
  );
}

function SelectedPanel({ lesson, placementId }: { lesson: Lesson; placementId: Id | null }) {
  const { data, idx, nm } = useDerived();
  const update = useApp(s => s.update);
  const select = useApp(s => s.select);
  const pl = placementId ? data.placements.find(p => p.id === placementId) : null;
  const mates = pl ? groupMates(data, idx, pl) : [];
  const where = data.placements.filter(p => p.lessonId === lesson.id)
    .sort((a, b) => a.day - b.day || a.period - b.period)
    .map(p => `${data.settings.days[p.day]}${p.period + 1}${p.length > 1 ? `-${p.period + p.length}` : ''}`);
  return (
    <div className="side-block selected-panel" style={{ '--c': nm.lessonColor(lesson) } as React.CSSProperties}>
      <div className="sp-head">
        <b>{nm.subjectName(lesson.subjectId)}</b>
        <button className="icon-btn" onClick={() => select({ kind: 'none' })} aria-label="選択解除">×</button>
      </div>
      <dl className="sp-dl">
        <dt>クラス</dt><dd>{lesson.classIds.map(nm.className).join('・')}</dd>
        <dt>先生</dt><dd>{lesson.teacherIds.map(nm.teacherName).join('・') || '（未設定）'}</dd>
        {lesson.roomId && <><dt>教室</dt><dd>{nm.roomName(lesson.roomId)}</dd></>}
        <dt>配置</dt><dd>{where.join('、') || 'なし'}（{lesson.weeklyCount - remainingHours(idx, lesson)}/{lesson.weeklyCount}）</dd>
        {mates.length > 1 && <><dt>選択群</dt><dd>{mates.length}授業が一緒に動きます</dd></>}
      </dl>
      {pl && (
        <div className="row gap">
          <button className="btn small" onClick={() => update(d => toggleLock(d, pl.id))}>{pl.locked ? '固定を解除' : '固定する'}</button>
          <button className="btn small danger" onClick={() => { update(d => removePlacement(d, pl.id)); select({ kind: 'none' }); }}>外す</button>
        </div>
      )}
    </div>
  );
}

function AutoDialog({ onClose, scopeClassIds, scopeName }: { onClose: () => void; scopeClassIds: Id[]; scopeName: string }) {
  const data = useApp(s => s.data);
  const update = useApp(s => s.update);
  const toast = useApp(s => s.toast);
  const [scope, setScope] = useState<'this' | 'all'>('all');
  const [rebuild, setRebuild] = useState(false);
  const [result, setResult] = useState<null | { placed: number; unplaced: { label: string; hours: number }[] }>(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    // 描画を先に反映させてから計算する
    setTimeout(() => {
      const r = autoSchedule(data, { classIds: scope === 'this' ? scopeClassIds : undefined, rebuild });
      update(d => { d.placements = r.placements; });
      const nm = new Map(data.lessons.map(l => [l.id, l]));
      const subj = new Map(data.subjects.map(s => [s.id, s.name]));
      const cls = new Map(data.classes.map(c => [c.id, c.name]));
      setResult({
        placed: r.placedHours,
        unplaced: r.unplaced.map(u => {
          const l = nm.get(u.lessonId)!;
          return { label: `${subj.get(l.subjectId)}（${l.classIds.map(c => cls.get(c)).join('・')}）`, hours: u.hours };
        }),
      });
      setBusy(false);
      toast(`${r.placedHours}コマを配置しました`);
    }, 30);
  };

  return (
    <Modal title="自動配置" onClose={onClose} width={520}
      footer={result
        ? <button className="btn primary" onClick={onClose}>閉じる</button>
        : <>
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className="btn primary" disabled={busy} onClick={run}>{busy ? '計算中…' : '実行'}</button>
        </>}>
      {!result ? (
        <div className="form">
          <div className="field"><span>対象</span>
            <div className="choice">
              <label className={scope === 'all' ? 'on' : ''}><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} /><div><b>全クラス</b></div></label>
              <label className={scope === 'this' ? 'on' : ''}><input type="radio" checked={scope === 'this'} onChange={() => setScope('this')} /><div><b>{scopeName}に関わるクラスだけ</b></div></label>
            </div>
          </div>
          <div className="field"><span>方法</span>
            <div className="choice">
              <label className={!rebuild ? 'on' : ''}><input type="radio" checked={!rebuild} onChange={() => setRebuild(false)} />
                <div><b>空いている所に追加</b><div className="muted small">今の配置はそのままで、未配置の授業だけ置きます</div></div></label>
              <label className={rebuild ? 'on' : ''}><input type="radio" checked={rebuild} onChange={() => setRebuild(true)} />
                <div><b>組み直す</b><div className="muted small">「固定」以外の配置をいったん外して最初から組みます</div></div></label>
            </div>
          </div>
          <p className="muted small">勤務不可・会議・教室の重なり・1日の上限を守り、同じ授業はなるべく別の日に分けます。実行後に「元に戻す」で取り消せます。</p>
        </div>
      ) : (
        <div>
          <p><b>{result.placed}コマ</b>を配置しました。</p>
          {result.unplaced.length === 0 ? <p className="ok-text">すべての授業を配置できました。</p> : (
            <>
              <p className="warn-text">次の授業は置ける場所が見つかりませんでした。勤務不可・会議の設定や、先生の持ちコマを見直すか、手動で入れ替えてください。</p>
              <ul className="small">{result.unplaced.map((u, i) => <li key={i}>{u.label}：{u.hours}コマ</li>)}</ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
