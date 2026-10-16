// ============================================================
// 共通の部品
// ============================================================
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { parseTable } from '../core/io';
import { slotKey } from '../core/types';

/** 入力が確定したとき（フォーカスが外れた / Enter）だけ保存するテキスト欄 */
export function TextCell({
  value, onCommit, placeholder, width, autoFocus, className,
}: {
  value: string; onCommit: (v: string) => void; placeholder?: string; width?: number | string;
  autoFocus?: boolean; className?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => { if (v.trim() !== value) onCommit(v.trim()); };
  return (
    <input
      className={`cell-input ${className ?? ''}`}
      style={{ width }}
      value={v}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={e => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setV(value); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}

export function NumberCell({
  value, onCommit, min = 0, max = 99, width = 64,
}: { value: number; onCommit: (v: number) => void; min?: number; max?: number; width?: number }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
    setV(String(n));
    if (n !== value) onCommit(n);
  };
  return (
    <input
      className="cell-input num"
      style={{ width }}
      type="number"
      min={min}
      max={max}
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

export function Select<T extends string>({
  value, options, onChange, placeholder, width,
}: {
  value: T | null; options: { value: T; label: string }[]; onChange: (v: T | null) => void;
  placeholder?: string; width?: number | string;
}) {
  return (
    <select
      className="cell-select"
      style={{ width }}
      value={value ?? ''}
      onChange={e => onChange((e.target.value || null) as T | null)}
    >
      <option value="">{placeholder ?? '—'}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** ポップアップ */
export function Popover({
  anchor, onClose, children, width = 280,
}: { anchor: HTMLElement | null; onClose: () => void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const left = Math.min(r.left, window.innerWidth - width - 12);
    const below = r.bottom + 4;
    setPos({ top: below + 320 > window.innerHeight ? Math.max(8, r.top - 324) : below, left: Math.max(8, left) });
  }, [anchor, width]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose();
    };
    // Esc はポップアップだけを閉じる（下のダイアログまで閉じないよう、先に受け取って止める）
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [anchor, onClose]);
  if (!pos) return null;
  return <div ref={ref} className="popover" style={{ top: pos.top, left: pos.left, width }}>{children}</div>;
}

export interface PickOption { value: string; label: string; group?: string; sub?: string }

/** 複数選択（チップ表示 + 検索付きのチェックリスト） */
export function MultiPicker({
  values, options, onChange, placeholder = '選択', quick, single,
}: {
  values: string[]; options: PickOption[]; onChange: (v: string[]) => void; placeholder?: string;
  /** まとめて選ぶボタン（例: 学年ごと） */
  quick?: { label: string; values: string[] }[];
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btn = useRef<HTMLButtonElement>(null);
  const label = new Map(options.map(o => [o.value, o.label]));
  const filtered = options.filter(o => !q || o.label.includes(q) || o.group?.includes(q) || o.sub?.includes(q));
  const groups = useMemo(() => {
    const m = new Map<string, PickOption[]>();
    for (const o of filtered) {
      const g = o.group ?? '';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(o);
    }
    return [...m];
  }, [filtered]);
  const toggle = (v: string) => {
    if (single) { onChange(values.includes(v) ? [] : [v]); setOpen(false); return; }
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  };
  return (
    <>
      <button ref={btn} type="button" className={`picker ${values.length === 0 ? 'empty' : ''}`} onClick={() => setOpen(o => !o)}>
        {values.length === 0
          ? <span className="muted">{placeholder}</span>
          : values.map(v => <span key={v} className="chip">{label.get(v) ?? '?'}</span>)}
      </button>
      {open && (
        <Popover anchor={btn.current} onClose={() => { setOpen(false); setQ(''); }}>
          <input className="pop-search" autoFocus placeholder="絞り込み" value={q} onChange={e => setQ(e.target.value)} />
          {quick && quick.length > 0 && (
            <div className="pop-quick">
              {quick.map(qk => {
                const all = qk.values.length > 0 && qk.values.every(v => values.includes(v));
                return (
                  <button key={qk.label} type="button" className={`mini ${all ? 'on' : ''}`}
                    onClick={() => onChange(all ? values.filter(v => !qk.values.includes(v)) : [...new Set([...values, ...qk.values])])}>
                    {qk.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="pop-list">
            {groups.map(([g, opts]) => (
              <div key={g}>
                {g && <div className="pop-group">{g}</div>}
                {opts.map(o => (
                  <label key={o.value} className="pop-item">
                    <input type={single ? 'radio' : 'checkbox'} checked={values.includes(o.value)} onChange={() => toggle(o.value)} />
                    <span>{o.label}</span>
                    {o.sub && <span className="muted small">{o.sub}</span>}
                  </label>
                ))}
              </div>
            ))}
            {filtered.length === 0 && <div className="muted small pad">該当なし</div>}
          </div>
          {!single && values.length > 0 && (
            <div className="pop-foot"><button type="button" className="link" onClick={() => onChange([])}>すべて外す</button></div>
          )}
        </Popover>
      )}
    </>
  );
}

export function Modal({
  title, onClose, children, footer, width = 560,
}: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width }} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** 曜日×時限のマス目をクリックで切り替える */
export function SlotPicker({
  days, periods, values, onChange, label = '×',
}: { days: string[]; periods: number; values: string[]; onChange: (v: string[]) => void; label?: string }) {
  const set = new Set(values);
  const [drag, setDrag] = useState<null | boolean>(null);
  const apply = (k: string, on: boolean) => {
    const next = new Set(values);
    if (on) next.add(k); else next.delete(k);
    onChange([...next]);
  };
  useEffect(() => {
    const up = () => setDrag(null);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  return (
    <table className="slot-picker" onMouseLeave={() => setDrag(null)}>
      <thead>
        <tr><th />{days.map(d => <th key={d}>{d}</th>)}</tr>
      </thead>
      <tbody>
        {Array.from({ length: periods }, (_, p) => (
          <tr key={p}>
            <th>{p + 1}</th>
            {days.map((_, d) => {
              const k = slotKey(d, p);
              const on = set.has(k);
              return (
                <td key={k}
                  className={on ? 'on' : ''}
                  onMouseDown={() => { setDrag(!on); apply(k, !on); }}
                  onMouseEnter={() => { if (drag !== null && on !== drag) apply(k, drag); }}>
                  {on ? label : ''}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 表計算ソフトから貼り付けて一括登録するダイアログ */
export function PasteImport({
  title, columns, example, onImport, onClose,
}: {
  title: string;
  columns: string[];
  example: string;
  onImport: (rows: string[][]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const rows = useMemo(() => {
    const r = parseTable(text);
    // 1行目が見出しなら外す
    if (r.length > 0 && r[0][0] === columns[0]) return r.slice(1);
    return r;
  }, [text, columns]);
  return (
    <Modal title={title} onClose={onClose} width={680}
      footer={<>
        <button className="btn" onClick={onClose}>キャンセル</button>
        <button className="btn primary" disabled={rows.length === 0} onClick={() => { onImport(rows); onClose(); }}>
          {rows.length}件を追加
        </button>
      </>}>
      <p className="muted">
        Excel やスプレッドシートで範囲をコピーして、下に貼り付けてください（CSVも可）。<br />
        列の順番：<b>{columns.join(' / ')}</b>
      </p>
      <textarea className="paste-area" rows={8} placeholder={example} value={text} onChange={e => setText(e.target.value)} autoFocus />
      <label className="btn small file-btn">
        CSVファイルを選ぶ
        <input type="file" accept=".csv,.tsv,.txt" hidden onChange={async e => {
          const f = e.target.files?.[0];
          if (f) setText(await f.text());
        }} />
      </label>
      {rows.length > 0 && (
        <div className="paste-preview">
          <table className="table compact">
            <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.slice(0, 8).map((r, i) => <tr key={i}>{columns.map((_, j) => <td key={j}>{r[j] ?? ''}</td>)}</tr>)}
            </tbody>
          </table>
          {rows.length > 8 && <div className="muted small">ほか {rows.length - 8} 件</div>}
        </div>
      )}
    </Modal>
  );
}

export function PageHead({ title, desc, actions }: { title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {desc && <p className="muted">{desc}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function DelButton({ onClick, title = '削除' }: { onClick: () => void; title?: string }) {
  return <button className="icon-btn danger" title={title} aria-label={title} onClick={onClick}>×</button>;
}

export function confirmDelete(what: string) {
  return window.confirm(`${what}を削除しますか？\n（「元に戻す」で取り消せます）`);
}
