/**
 * AutoScheduleDialog - 自動時間割配置ダイアログ UI
 *
 * 3ステップ構成:
 *   Step1: 対象クラス・配置モード・オプションを設定
 *   Step2: dryRun でプレビューを確認
 *   Step3: 実行して完了
 */
class AutoScheduleDialog {
    constructor(store, overview) {
        this.store = store;
        this.overview = overview;
        this.scheduler = new AutoScheduler(store);
        this._modal = null;
    }

    open() {
        this._removeModal();
        this._modal = document.createElement('div');
        this._modal.id = 'auto-schedule-modal';
        this._modal.innerHTML = this._step1Html();
        document.body.appendChild(this._modal);
        this._attachStep1Events();
    }

    // ──────────────────────────────────────────────────
    // Step 1: 設定フォーム
    // ──────────────────────────────────────────────────

    _step1Html() {
        const gradeOptions = [1, 2, 3].map(g =>
            `<option value="${g}">${g}年</option>`
        ).join('');

        const classOptions = CLASSES.map(c =>
            `<option value="${c.id}">${c.name}</option>`
        ).join('');

        return `
        <div class="modal-overlay" id="auto-schedule-overlay"></div>
        <div class="modal-content" style="max-width:460px;">
            <div class="modal-header">
                <h3 class="modal-title">🤖 自動時間割配置</h3>
                <button class="modal-close" id="auto-schedule-close">✕</button>
            </div>
            <div class="modal-body" style="padding:20px;">

                <div style="margin-bottom:16px;">
                    <label style="font-weight:600; display:block; margin-bottom:8px;">対象クラス</label>
                    <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                        <input type="radio" name="target" value="all" checked>
                        <span>全クラス</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                        <input type="radio" name="target" value="grade">
                        <span>学年指定:</span>
                        <select id="as-grade-select" style="border:1px solid #d1d5db; border-radius:4px; padding:2px 6px;">
                            ${gradeOptions}
                        </select>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px;">
                        <input type="radio" name="target" value="class">
                        <span>クラス指定:</span>
                        <select id="as-class-select" style="border:1px solid #d1d5db; border-radius:4px; padding:2px 6px;">
                            ${classOptions}
                        </select>
                    </label>
                </div>

                <div style="margin-bottom:16px; padding:12px; background:#f9fafb; border-radius:6px;">
                    <label style="font-weight:600; display:block; margin-bottom:8px;">配置モード</label>
                    <label style="display:flex; align-items:flex-start; gap:8px; margin-bottom:8px; cursor:pointer;">
                        <input type="radio" name="mode" value="append" checked style="margin-top:3px;">
                        <span>
                            <strong>空きコマのみ埋める</strong>
                            <br><small style="color:#6b7280;">既存の授業は保持し、空いているコマに追加配置します</small>
                        </span>
                    </label>
                    <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
                        <input type="radio" name="mode" value="clear" style="margin-top:3px;">
                        <span>
                            <strong>ゼロから配置</strong>
                            <br><small style="color:#ef4444;">対象クラスの既存授業をすべて消去してから配置します</small>
                        </span>
                    </label>
                </div>

                <div style="margin-bottom:20px;">
                    <label style="font-weight:600; display:block; margin-bottom:8px;">オプション</label>
                    <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:pointer;">
                        <input type="checkbox" id="as-distribute" checked>
                        <span>同科目を週内で分散させる（月〜金に均等配置）</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                        <input type="checkbox" id="as-avoid-consecutive" checked>
                        <span>同科目が連続するコマにならないようにする</span>
                    </label>
                </div>

                <div id="as-warning-box" style="display:none; padding:10px; background:#fef3c7; border:1px solid #f59e0b; border-radius:6px; margin-bottom:16px; font-size:0.875rem; color:#92400e;">
                </div>

            </div>
            <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:8px; padding:12px 20px; border-top:1px solid #e5e7eb;">
                <button id="as-cancel" class="btn btn-secondary">キャンセル</button>
                <button id="as-preview" class="btn btn-primary">プレビューを見る →</button>
            </div>
        </div>`;
    }

    _attachStep1Events() {
        document.getElementById('auto-schedule-close')?.addEventListener('click', () => this._removeModal());
        document.getElementById('auto-schedule-overlay')?.addEventListener('click', () => this._removeModal());
        document.getElementById('as-cancel')?.addEventListener('click', () => this._removeModal());
        document.getElementById('as-preview')?.addEventListener('click', () => this._runPreview());

        // 「ゼロから配置」選択時に警告表示
        this._modal.querySelectorAll('input[name="mode"]').forEach(r => {
            r.addEventListener('change', () => {
                const box = document.getElementById('as-warning-box');
                if (r.value === 'clear' && r.checked) {
                    box.style.display = 'block';
                    box.textContent = '⚠️ 対象クラスの既存の授業がすべて削除されます。この操作はUndo（元に戻す）で取り消せます。';
                } else {
                    box.style.display = 'none';
                }
            });
        });
    }

    _getStep1Options() {
        const targetVal = this._modal.querySelector('input[name="target"]:checked')?.value || 'all';
        let targetClasses;
        if (targetVal === 'all') {
            targetClasses = CLASSES.map(c => c.id);
        } else if (targetVal === 'grade') {
            const grade = parseInt(document.getElementById('as-grade-select').value);
            targetClasses = CLASSES.filter(c => c.grade === grade).map(c => c.id);
        } else {
            targetClasses = [document.getElementById('as-class-select').value];
        }

        const clearFirst = this._modal.querySelector('input[name="mode"]:checked')?.value === 'clear';
        const distribute = document.getElementById('as-distribute').checked;
        const avoidConsecutive = document.getElementById('as-avoid-consecutive').checked;

        return { targetClasses, clearFirst, distribute, avoidConsecutive };
    }

    // ──────────────────────────────────────────────────
    // Step 2: プレビュー
    // ──────────────────────────────────────────────────

    _runPreview() {
        const options = this._getStep1Options();
        const result = this.scheduler.run({ ...options, dryRun: true });
        this._showStep2(result, options);
    }

    _showStep2(result, options) {
        // 合同授業は複数クラスに同じコマが置かれるが、ユニークな (classId,day,period) で数える
        const uniquePlaced = new Set(result.placed.map(p => `${p.classId}-${p.day}-${p.period}`));
        const placedCount = uniquePlaced.size;
        const unplacedCount = result.unplaced.reduce((s, u) => s + u.remaining, 0);

        let warningHtml = '';
        if (result.unplaced.length > 0) {
            const items = result.unplaced.map(u => {
                const cls = CLASSES.find(c => c.id === u.classId);
                const sub = this.store.getSubject(u.subjectId);
                const teacher = u.teacherId ? this.store.getTeacher(u.teacherId) : null;
                const clsName = cls ? cls.name : u.classId;
                const subName = sub ? (sub.shortName || sub.name) : u.subjectId;
                const teacherName = teacher ? teacher.name : '教員未設定';
                return `<li>${clsName} ${subName}（${teacherName}）: ${u.reason} ×${u.remaining}コマ</li>`;
            }).join('');
            warningHtml = `
                <div style="margin-bottom:16px; padding:12px; background:#fef3c7; border:1px solid #f59e0b; border-radius:6px;">
                    <div style="font-weight:600; color:#92400e; margin-bottom:6px;">⚠️ 配置できないコマ（${unplacedCount}コマ）</div>
                    <ul style="margin:0; padding-left:16px; font-size:0.875rem; color:#92400e;">${items}</ul>
                </div>`;
        }

        const targetDesc = this._targetDescription(options.targetClasses);

        this._modal.innerHTML = `
        <div class="modal-overlay" id="auto-schedule-overlay"></div>
        <div class="modal-content" style="max-width:460px;">
            <div class="modal-header">
                <h3 class="modal-title">🤖 配置プレビュー</h3>
                <button class="modal-close" id="auto-schedule-close">✕</button>
            </div>
            <div class="modal-body" style="padding:20px;">

                <div style="margin-bottom:16px; padding:12px; background:#f0fdf4; border:1px solid #86efac; border-radius:6px;">
                    <div style="font-size:1.5rem; font-weight:700; color:#166534;">${placedCount}コマ</div>
                    <div style="font-size:0.875rem; color:#166534;">配置予定</div>
                </div>

                <div style="margin-bottom:16px; font-size:0.875rem; color:#6b7280;">
                    <span style="font-weight:600;">対象:</span> ${targetDesc}<br>
                    <span style="font-weight:600;">モード:</span> ${options.clearFirst ? 'ゼロから配置（既存消去）' : '空きコマのみ埋める'}<br>
                    <span style="font-weight:600;">分散配置:</span> ${options.distribute ? 'あり' : 'なし'} ／
                    <span style="font-weight:600;">連続回避:</span> ${options.avoidConsecutive ? 'あり' : 'なし'}
                </div>

                ${warningHtml}

                ${result.warnings.length > 0 ? `
                <details style="margin-bottom:16px;">
                    <summary style="font-size:0.875rem; color:#6b7280; cursor:pointer;">詳細ログ（${result.warnings.length}件）</summary>
                    <ul style="margin:8px 0 0; padding-left:16px; font-size:0.8rem; color:#9ca3af;">
                        ${result.warnings.map(w => `<li>${w}</li>`).join('')}
                    </ul>
                </details>` : ''}

                <div style="font-size:0.78rem; color:#9ca3af; margin-top:4px;">
                    ※ このプレビューは現在の時間割状態に基づいています。プレビュー後に手動で授業を追加・変更した場合、実行結果が異なることがあります。
                </div>

            </div>
            <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:8px; padding:12px 20px; border-top:1px solid #e5e7eb;">
                <button id="as-back" class="btn btn-secondary">← 戻る</button>
                <button id="as-execute" class="btn btn-primary" ${placedCount === 0 ? 'disabled' : ''}>この内容で実行する</button>
            </div>
        </div>`;

        document.getElementById('auto-schedule-close')?.addEventListener('click', () => this._removeModal());
        document.getElementById('auto-schedule-overlay')?.addEventListener('click', () => this._removeModal());
        document.getElementById('as-back')?.addEventListener('click', () => {
            this._modal.innerHTML = this._step1Html();
            this._attachStep1Events();
        });
        document.getElementById('as-execute')?.addEventListener('click', () => this._execute(options));
    }

    // ──────────────────────────────────────────────────
    // Step 3: 実行
    // ──────────────────────────────────────────────────

    _execute(options) {
        const result = this.scheduler.run({ ...options, dryRun: false });

        this._removeModal();

        // 時間割を再描画
        this.overview.render();

        // 結果トースト
        const unplacedCount = result.unplaced.reduce((s, u) => s + u.remaining, 0);
        const msg = unplacedCount > 0
            ? `✅ ${result.placed.length}コマを配置しました（${unplacedCount}コマ配置不可）`
            : `✅ ${result.placed.length}コマを配置しました`;
        showToast(msg, unplacedCount > 0 ? 'warning' : 'success');
    }

    // ──────────────────────────────────────────────────
    // ヘルパー
    // ──────────────────────────────────────────────────

    _targetDescription(targetClasses) {
        if (targetClasses.length === CLASSES.length) return '全クラス';
        if (targetClasses.length === 1) {
            const cls = CLASSES.find(c => c.id === targetClasses[0]);
            return cls ? cls.name : targetClasses[0];
        }
        // 学年判定
        const grades = [...new Set(targetClasses.map(id => {
            const cls = CLASSES.find(c => c.id === id);
            return cls ? cls.grade : null;
        }).filter(g => g !== null))];
        if (grades.length === 1) return `${grades[0]}年生（${targetClasses.length}クラス）`;
        return `${targetClasses.length}クラス`;
    }

    _removeModal() {
        if (this._modal) {
            this._modal.remove();
            this._modal = null;
        }
    }
}

// グローバルに公開
window.AutoScheduleDialog = AutoScheduleDialog;
