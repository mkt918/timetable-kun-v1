/**
 * バリデーション結果表示モーダル
 */
class ValidationModal {
    constructor(store, ui) {
        this.store = store;
        this.ui = ui;
        this.engine = new ValidationEngine(store);
    }

    /**
     * バリデーションを実行して結果を表示
     */
    open() {
        // 既存のモーダルを閉じる
        this.close();

        // バリデーション実行
        const results = this.engine.validate();
        const summary = this.engine.getSummary(results);

        // モーダルHTML生成
        const modalHtml = `
            <div class="modal-overlay" id="validation-modal-overlay" onclick="ui.validationModal.close()" style="z-index: 10000;">
                <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 700px; max-height: 80vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <h2 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                            <span>🔍</span>
                            <span>時間割チェック結果</span>
                        </h2>
                        <button class="modal-close" onclick="ui.validationModal.close()">×</button>
                    </div>
                    <div class="modal-body" style="overflow-y: auto; flex: 1;">
                        <!-- ルール説明アコーディオン -->
                        <details style="margin: 15px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 8px; padding: 12px;">
                            <summary style="cursor: pointer; font-weight: 600; font-size: 1.1em; color: var(--color-text-primary); user-select: none;">
                                📋 チェック項目の説明
                            </summary>
                            <div style="margin-top: 12px; padding: 12px; background: white; border-radius: 6px;">
                                <h4 style="margin: 0 0 8px 0; color: #dc2626;">🔴 エラー（重大な問題）</h4>
                                <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 0.9em;">
                                    <li><strong>教員の重複:</strong> 同じ教員が同じ時間に複数の授業を担当</li>
                                    <li><strong>クラスの重複:</strong> 同じクラスが同じ時間に複数の授業</li>
                                    <li><strong>特別教室の重複:</strong> 同じ特別教室が同じ時間に複数使用</li>
                                    <li><strong>授業コマ数の過不足:</strong> 登録された担当授業が時間割に配置されていない、または多すぎる</li>
                                </ul>
                                
                                <h4 style="margin: 12px 0 8px 0; color: #f59e0b;">⚠️ 警告（注意が必要）</h4>
                                <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 0.9em;">
                                    <li><strong>連続コマ数:</strong> 教員が設定した閾値以上連続で授業（設定タブで変更可能）</li>
                                    <li><strong>会議時間との重複:</strong> 教員の会議時間に授業が入っている</li>
                                    <li><strong>勤務不可時間との重複:</strong> 教員の勤務不可時間に授業が入っている</li>
                                    <li><strong>クラスの連続授業制限:</strong> クラスが設定した閾値以上連続で授業を受ける（設定タブで変更可能）</li>
                                    <li><strong>連続同一科目:</strong> 同じ科目が設定した閾値以上連続（設定タブで変更可能）</li>
                                </ul>
                                
                                <h4 style="margin: 12px 0 8px 0; color: #3b82f6;">ℹ️ 情報（参考情報）</h4>
                                <ul style="margin: 0; padding-left: 20px; font-size: 0.9em;">
                                    <li><strong>空きコマの多さ:</strong> 教員の1日の空きコマ数が多い（設定タブで変更可能）</li>
                                    <li><strong>授業配置率:</strong> 全体の授業配置率（配置数 / 必要数）</li>
                                </ul>
                                
                                <p style="margin: 12px 0 0 0; padding: 8px; background: #f3f4f6; border-radius: 4px; font-size: 0.85em;">
                                    💡 <strong>ヒント:</strong> 閾値はマスター編集→設定タブ→時間割チェック設定で変更できます
                                </p>
                            </div>
                        </details>
                        
                        <!-- サマリー -->
                        <div style="padding: 15px; background: ${results.errors.length > 0 ? '#fff3cd' : '#d1ecf1'}; border-radius: 8px; margin: 0 15px 20px 15px; border-left: 4px solid ${results.errors.length > 0 ? '#ffc107' : '#17a2b8'};">
                            <div style="font-size: 1.1em; font-weight: 600;">${summary}</div>
                        </div>

                        ${this.renderIssueSection('エラー', '🔴', results.errors, '#dc3545')}
                        ${this.renderIssueSection('警告', '⚠️', results.warnings, '#ffc107')}
                        ${this.renderIssueSection('情報', 'ℹ️', results.info, '#17a2b8')}

                        ${results.errors.length === 0 && results.warnings.length === 0 && results.info.length === 0 ? `
                            <div style="text-align: center; padding: 40px; color: #6c757d;">
                                <div style="font-size: 3em; margin-bottom: 10px;">✅</div>
                                <div style="font-size: 1.2em;">問題は見つかりませんでした</div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: space-between;">
                        <button class="btn btn-secondary" onclick="ui.validationModal.openSettings()">⚙️ 設定</button>
                        <button class="btn btn-secondary" onclick="ui.validationModal.close()">閉じる</button>
                    </div>
                </div>
            </div>
        `;

        // モーダルを表示
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    /**
     * 問題セクションをレンダリング
     * @param {string} title - セクションタイトル
     * @param {string} icon - アイコン
     * @param {Array} issues - 問題リスト
     * @param {string} color - セクションカラー
     * @returns {string} HTML文字列
     */
    renderIssueSection(title, icon, issues, color) {
        if (issues.length === 0) return '';

        const issuesHtml = issues.map(issue => `
            <div style="
                padding: 10px 12px;
                margin: 6px 0;
                background: white;
                border-left: 3px solid ${color};
                border-radius: 4px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            ">
                <div style="font-size: 0.95em; color: #333;">
                    ${this.escapeHtml(issue.message)}
                </div>
                ${issue.location ? `
                    <div style="font-size: 0.8em; color: #6c757d; margin-top: 4px;">
                        ${this.formatLocation(issue.location)}
                    </div>
                ` : ''}
            </div>
        `).join('');

        return `
            <div style="margin-bottom: 25px;">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 0;
                    border-bottom: 2px solid ${color};
                    margin-bottom: 10px;
                ">
                    <span style="font-size: 1.3em;">${icon}</span>
                    <span style="font-size: 1.1em; font-weight: 600; color: ${color};">
                        ${title} (${issues.length}件)
                    </span>
                </div>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${issuesHtml}
                </div>
            </div>
        `;
    }

    /**
     * ロケーション情報をフォーマット
     * @param {Object} location - ロケーション情報
     * @returns {string} フォーマットされた文字列
     */
    formatLocation(location) {
        const parts = [];

        if (location.teacherId) {
            const teacher = this.store.getTeacher(location.teacherId);
            if (teacher) parts.push(`教員: ${teacher.name}`);
        }

        if (location.classId) {
            const cls = CLASSES.find(c => c.id === location.classId);
            if (cls) parts.push(`クラス: ${cls.name}`);
        }

        if (location.day !== undefined && location.period !== undefined) {
            parts.push(`位置: ${DAYS[location.day]}曜${location.period + 1}限`);
        }

        if (location.roomId) {
            const room = this.store.getSpecialClassroom(location.roomId);
            if (room) parts.push(`教室: ${room.name}`);
        }

        return parts.join(' / ');
    }

    /**
     * HTMLエスケープ
     * @param {string} text - エスケープするテキスト
     * @returns {string} エスケープされたテキスト
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * モーダルを閉じる
     */
    close() {
        const overlay = document.getElementById('validation-modal-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * 設定タブを開く
     */
    openSettings() {
        this.close();
        // マスターデータ編集モーダルを開いて設定タブに切り替え
        this.ui.openMasterDataModal();
        setTimeout(() => {
            this.ui.masterData.switchTab('settings');
        }, 100);
    }
}
