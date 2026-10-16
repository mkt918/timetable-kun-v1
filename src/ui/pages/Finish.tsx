import { useRef, useState } from 'react';
import { useApp, ViewType } from '../../store';
import { useDerived } from '../derived';
import { TimetableGrid } from '../Grid';
import { OverviewPage } from './Overview';
import { useEntities } from './Editor';
import { Issue, Severity } from '../../core/logic';
import { download, parseSaveFile, timetableCsv, today } from '../../core/io';
import { sampleData } from '../../core/sample';
import { emptyData } from '../../core/types';
import { Empty, PageHead } from '../common';

const SEV_LABEL: Record<Severity, string> = { error: 'エラー', warning: '注意', info: 'お知らせ' };

export function CheckPage() {
  const { issues } = useDerived();
  const setView = useApp(s => s.setView);
  const setPage = useApp(s => s.setPage);
  const [show, setShow] = useState<Severity[]>(['error', 'warning']);
  const counts = { error: 0, warning: 0, info: 0 } as Record<Severity, number>;
  issues.forEach(i => counts[i.severity]++);
  const list = issues.filter(i => show.includes(i.severity));
  const categories = [...new Set(list.map(i => i.category))];
  const jump = (i: Issue) => {
    if (!i.target) return;
    setView(i.target.type, i.target.id);
    setPage('edit');
  };
  return (
    <div className="page narrow">
      <PageHead title="チェック" desc="時間割の問題点を一覧にします。項目をクリックすると、その時間割を開きます。" />
      <div className="toggle-row mb">
        {(['error', 'warning', 'info'] as Severity[]).map(s => (
          <button key={s} className={`toggle sev-${s} ${show.includes(s) ? 'on' : ''}`}
            onClick={() => setShow(show.includes(s) ? show.filter(x => x !== s) : [...show, s])}>
            {SEV_LABEL[s]} {counts[s]}
          </button>
        ))}
      </div>
      {counts.error === 0 && counts.warning === 0 && (
        <div className="notice ok">エラー・注意はありません。{counts.info > 0 ? `未配置の授業が${counts.info}件あります。` : '時間割は完成しています 🎉'}</div>
      )}
      {list.length === 0 ? <Empty>表示する項目はありません。</Empty> : categories.map(cat => (
        <div key={cat} className="card">
          <h4>{cat}（{list.filter(i => i.category === cat).length}）</h4>
          <ul className="issue-list">
            {list.filter(i => i.category === cat).map((i, n) => (
              <li key={n} className={`sev-${i.severity}`}>
                <button className="link-row" onClick={() => jump(i)}>{i.message}</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function PrintPage() {
  const { data, idx, nm } = useDerived();
  const [type, setType] = useState<ViewType | 'overview-teacher' | 'overview-class'>('class');
  const [perPage, setPerPage] = useState<1 | 2 | 4>(2);
  const entityType: ViewType = type === 'teacher' || type === 'room' ? type : 'class';
  const entities = useEntities(entityType);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const chosen = entities.filter(e => !picked || picked.has(e.id));
  const isOverview = type === 'overview-teacher' || type === 'overview-class';

  const title = (name: string) => `${name}${entityType === 'teacher' ? ' 先生' : ''}`;
  const pages: typeof chosen[] = [];
  for (let i = 0; i < chosen.length; i += perPage) pages.push(chosen.slice(i, i + perPage));

  return (
    <div className="page wide">
      <div className="no-print">
        <PageHead title="印刷" desc="印刷したい時間割を選んで「印刷する」を押してください。PDFに保存する場合は、印刷画面の送信先で「PDFに保存」を選びます。"
          actions={<button className="btn primary" onClick={() => window.print()}>印刷する</button>} />
        <div className="card row gap wrap">
          <div className="seg">
            {([['class', 'クラス別'], ['teacher', '先生別'], ['room', '教室別'], ['overview-teacher', '一覧表（先生）'], ['overview-class', '一覧表（クラス）']] as const).map(([v, l]) => (
              <button key={v} className={type === v ? 'on' : ''} onClick={() => { setType(v); setPicked(null); }}>{l}</button>
            ))}
          </div>
          {!isOverview && (
            <div className="seg">
              {([1, 2, 4] as const).map(n => <button key={n} className={perPage === n ? 'on' : ''} onClick={() => setPerPage(n)}>1枚に{n}つ</button>)}
            </div>
          )}
        </div>
        {!isOverview && (
          <div className="card">
            <div className="row gap wrap">
              <button className="btn small" onClick={() => setPicked(null)}>すべて</button>
              <button className="btn small" onClick={() => setPicked(new Set())}>すべて外す</button>
              {entities.map(e => (
                <label key={e.id} className="check-chip">
                  <input type="checkbox" checked={!picked || picked.has(e.id)} onChange={() => {
                    const next = new Set(picked ?? entities.map(x => x.id));
                    if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
                    setPicked(next);
                  }} />{e.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <h4 className="muted">プレビュー</h4>
      </div>

      <div className={`print-area ${isOverview ? 'landscape' : ''}`}>
        {isOverview ? (
          <div className="print-page">
            <div className="print-title">{data.settings.schoolName} 時間割一覧（{type === 'overview-teacher' ? '先生' : 'クラス'}）</div>
            <OverviewPage printMode forceType={type === 'overview-teacher' ? 'teacher' : 'class'} />
          </div>
        ) : chosen.length === 0 ? <Empty>印刷する時間割を選んでください。</Empty> : pages.map((pg, i) => (
          <div key={i} className={`print-page per-${perPage}`}>
            {pg.map(e => (
              <div key={e.id} className="print-item">
                <div className="print-title">
                  <span>{data.settings.schoolName}</span>
                  <b>{title(e.name)}</b>
                  {entityType === 'class' && (() => {
                    const hr = data.classes.find(c => c.id === e.id)?.homeroomTeacherId;
                    return hr ? <span>担任 {nm.teacherName(hr)}</span> : <span />;
                  })()}
                </div>
                <TimetableGrid data={data} idx={idx} nm={nm} type={entityType} id={e.id} printMode />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataPage() {
  const data = useApp(s => s.data);
  const replaceAll = useApp(s => s.replaceAll);
  const toast = useApp(s => s.toast);
  const savedAt = useApp(s => s.savedAt);
  const file = useRef<HTMLInputElement>(null);
  const base = `${today()}_時間割`;

  return (
    <div className="page narrow">
      <PageHead title="データ" desc="データはこのブラウザに自動保存されます。別のパソコンで使うときや、バックアップには「ファイルに保存」を使ってください。" />
      <div className="card">
        <h4>保存と読み込み</h4>
        <p className="muted small">ファイルにはすべての設定（教員・科目・授業・会議・時間割など）が入ります。{savedAt && `ブラウザへの最終保存：${new Date(savedAt).toLocaleTimeString()}`}</p>
        <div className="row gap wrap">
          <button className="btn primary" onClick={() => {
            download(`${base}.json`, JSON.stringify(data, null, 1), 'application/json');
            toast('ファイルに保存しました');
          }}>ファイルに保存（.json）</button>
          <button className="btn" onClick={() => file.current?.click()}>ファイルを開く</button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={async e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const d = parseSaveFile(await f.text());
              if (!window.confirm('今のデータを、読み込んだファイルの内容に置き換えます。よろしいですか？')) return;
              replaceAll(d);
              toast('読み込みました');
            } catch (err) {
              toast(`読み込めませんでした：${(err as Error).message}`, 'error');
            }
          }} />
        </div>
      </div>
      <div className="card">
        <h4>表計算ソフト用に書き出す（CSV）</h4>
        <div className="row gap wrap">
          <button className="btn" onClick={() => download(`${base}_クラス別.csv`, timetableCsv(data, 'class'))}>クラス別の時間割</button>
          <button className="btn" onClick={() => download(`${base}_先生別.csv`, timetableCsv(data, 'teacher'))}>先生別の時間割</button>
        </div>
      </div>
      <div className="card">
        <h4>サンプル・初期化</h4>
        <p className="muted small">サンプルは架空の学校（9クラス・先生20人）のデータです。操作を試すのに使ってください。</p>
        <div className="row gap wrap">
          <button className="btn" onClick={() => {
            if (data.lessons.length && !window.confirm('今のデータをサンプルに置き換えます。よろしいですか？')) return;
            replaceAll(sampleData());
            toast('サンプルデータを読み込みました');
          }}>サンプルを読み込む</button>
          <button className="btn danger" onClick={() => {
            if (!window.confirm('すべてのデータを消去します。よろしいですか？\n（「元に戻す」で取り消せます）')) return;
            replaceAll(emptyData());
            toast('初期化しました');
          }}>すべて消去</button>
        </div>
      </div>
    </div>
  );
}
