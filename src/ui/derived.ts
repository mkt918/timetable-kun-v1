import { useMemo } from 'react';
import { useApp } from '../store';
import { buildIndex, conflictCells, findIssues, names } from '../core/logic';

/** データから計算する値（インデックス・名前・チェック結果）をまとめて返す */
export function useDerived() {
  const data = useApp(s => s.data);
  return useMemo(() => {
    const idx = buildIndex(data);
    const nm = names(data);
    const issues = findIssues(data);
    return { data, idx, nm, issues, conflicts: conflictCells(issues) };
  }, [data]);
}
