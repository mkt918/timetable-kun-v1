/**
 * HelpDialog.js - 使い方ダイアログ
 */

function showHelpDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
        <div class="dialog-content" style="max-width: 650px; max-height: 85vh; overflow-y: auto;">
            <h2 style="margin-bottom: 16px;">📖 時間割くん v1.4.1 - 使い方</h2>
            
            <h3>🎯 基本的な使い方</h3>
            <ol style="line-height: 1.8;">
                <li><strong>マスター編集</strong>で教員・教科・科目・担当授業を登録</li>
                <li>全教員の表で授業をドラッグ＆ドロップで配置</li>
                <li>自動保存されるので安心！</li>
            </ol>

            <h3>🔘 ヘッダーボタン</h3>
            <ul style="line-height: 1.8;">
                <li><strong>🔍 チェック</strong>: 時間割の問題点をチェック（重複・未配置など）</li>
                <li><strong>🖨 印刷</strong>: 時間割を印刷・PDF出力</li>
                <li><strong>☰ メニュー</strong>: その他の機能へアクセス</li>
            </ul>

            <h3>✨ 便利な機能</h3>
            <ul style="line-height: 1.8;">
                <li><strong>🎨 色のカスタマイズ</strong>: 教科タブで🎨アイコンから色を変更</li>
                <li><strong>🔗 連動授業</strong>: 複数クラスで同時に行う授業を設定</li>
                <li><strong>📅 会議・業務</strong>: 会議時間を設定して教員の空き時間を管理</li>
                <li><strong>🏫 特別教室</strong>: 教室の使用状況を確認</li>
                <li><strong>⚙️ 勤務不可設定</strong>: 教員名をクリックして設定</li>
            </ul>

            <h3>🔍 時間割チェック機能</h3>
            <ul style="line-height: 1.8;">
                <li><strong>エラー検出</strong>: 教員・クラス・教室の重複、授業の過不足</li>
                <li><strong>警告検出</strong>: 連続授業、勤務不可・会議との重複</li>
                <li><strong>⚙️ 設定</strong>: チェック結果画面から閾値を調整可能</li>
                <li><strong>無効化</strong>: 不要なチェック項目は個別にオフに設定可能</li>
            </ul>

            <h3>💡 ヒント</h3>
            <ul style="line-height: 1.8;">
                <li>教科の並び順で色が決まります（虹順）</li>
                <li>右クリックで授業の削除や連動設定が可能</li>
                <li>全教員・全クラス・特別教室の3つの表示モードを切り替え可能</li>
            </ul>

            <div style="margin-top: 24px; text-align: right;">
                <button class="btn btn-primary btn-close">閉じる</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
    dialog.querySelector('.btn-close').onclick = () => dialog.remove();
    dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
}
