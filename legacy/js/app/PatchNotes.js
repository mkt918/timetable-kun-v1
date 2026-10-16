/**
 * PatchNotes.js - パッチノートダイアログ
 */

function showPatchNotesDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
        <div class="dialog-content" style="max-width: 700px; max-height: 85vh; overflow-y: auto;">
            <h2 style="margin-bottom: 24px;">📋 パッチノート</h2>
            
            <style>
                .accordion-item {
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    margin-bottom: 12px;
                    overflow: hidden;
                }
                .accordion-header {
                    background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
                    color: #333;
                    padding: 16px 20px;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    user-select: none;
                    transition: background 0.3s;
                }
                .accordion-header:hover {
                    background: linear-gradient(135deg, #dee2e6 0%, #ced4da 100%);
                }
                /* Major version colors */
                .accordion-header.v1-3-0 {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .accordion-header.v1-3-0:hover {
                    background: linear-gradient(135deg, #5568d3 0%, #653a8b 100%);
                }
                .accordion-header.v1-2-0 {
                    background: linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%);
                    color: white;
                }
                .accordion-header.v1-2-0:hover {
                    background: linear-gradient(135deg, #37b5de 0%, #5e75c5 100%);
                }
                .accordion-header.v1-1-0 {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                }
                .accordion-header.v1-1-0:hover {
                    background: linear-gradient(135deg, #df82ea 0%, #e4465b 100%);
                }
                .accordion-header.v1-0-0 {
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                    color: white;
                }
                .accordion-header.v1-0-0:hover {
                    background: linear-gradient(135deg, #3e9bed 0%, #00e1ed 100%);
                }
                .accordion-header.v1-4-0 {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .accordion-header.v1-4-0:hover {
                    background: linear-gradient(135deg, #5570d9 0%, #653991 100%);
                }
                .accordion-header.v1-4-1 {
                    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                    color: white;
                }
                .accordion-header.v1-4-1:hover {
                    background: linear-gradient(135deg, #0f887e 0%, #2fde6c 100%);
                }
                .accordion-title {
                    font-size: 1.1em;
                    font-weight: 600;
                }
                .accordion-icon {
                    font-size: 1.2em;
                    transition: transform 0.3s;
                }
                .accordion-icon.open {
                    transform: rotate(180deg);
                }
                .accordion-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease-out;
                    background: white;
                }
                .accordion-content.open {
                    max-height: 2000px;
                    transition: max-height 0.5s ease-in;
                }
                .accordion-body {
                    padding: 20px;
                }
            </style>
            
            <!-- v1.4.1 -->
            <div class="accordion-item">
                <div class="accordion-header v1-4-1" onclick="toggleAccordion(this)">
                    <div>
                        <div class="accordion-title">🚀 v1.4.1 - チェック機能強化 & UI改善</div>
                        <div style="font-size: 0.85em; opacity: 0.9; margin-top: 4px;">2026年1月7日</div>
                    </div>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content open">
                    <div class="accordion-body">
                        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; margin-bottom: 5px;">🔍 より確実なチェック機能</div>
                            <div style="opacity: 0.9;">ミスを見逃さない、強力なバリデーション</div>
                        </div>
                        
                        <h3>🎯 ヘッダーUIの改善</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>「チェック」「印刷」ボタンを独立配置</strong>
                                <ul>
                                    <li>よく使う機能をワンクリックでアクセス可能に</li>
                                    <li>ハンバーガーメニューを開く手間を省略</li>
                                </ul>
                            </li>
                            <li><strong>「データ管理」→「保存/読込」に名称変更</strong>
                                <ul>
                                    <li>より直感的で分かりやすい名前に</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3 style="margin-top: 24px;">🔍 新しいバリデーションチェック</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>勤務不可時間との重複チェック</strong>
                                <ul>
                                    <li>勤務不可設定のコマに授業が入っている場合に警告</li>
                                </ul>
                            </li>
                            <li><strong>会議時間との重複チェック</strong>
                                <ul>
                                    <li>会議コマに授業が入っている場合に警告（会議名も表示）</li>
                                </ul>
                            </li>
                            <li><strong>授業コマ数の過不足チェック</strong>
                                <ul>
                                    <li>配置不足だけでなく、配置しすぎもエラーとして検出</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3 style="margin-top: 24px;">⚙️ 設定への導線改善</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>チェック結果画面に「設定」ボタン追加</strong>
                                <ul>
                                    <li>チェック結果から直接閾値設定へ移動可能</li>
                                </ul>
                            </li>
                            <li><strong>閾値設定の無効化機能</strong>
                                <ul>
                                    <li>各チェック項目を個別にオン/オフ切り替え可能</li>
                                    <li>使わないチェックは無効化して非表示に</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3 style="margin-top: 24px;">🐛 バグ修正</h3>
                        <ul style="line-height: 2.0;">
                            <li>アイコンが「?」になる問題を修正</li>
                            <li>連続同一科目チェックでエラーが発生する問題を修正</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- v1.4.0 -->
            <div class="accordion-item">
                <div class="accordion-header v1-4-0" onclick="toggleAccordion(this)">
                    <div>
                        <div class="accordion-title">✨ v1.4.0 - UI/UX改善 & バリデーション機能強化</div>
                        <div style="font-size: 0.85em; opacity: 0.9; margin-top: 4px;">2026年1月7日</div>
                    </div>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-body">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; margin-bottom: 5px;">🎨 操作性向上アップデート</div>
                            <div style="opacity: 0.9;">より使いやすく、より分かりやすく</div>
                        </div>
                        
                        <h3>🍔 ハンバーガーメニューの実装</h3>
                        <p style="color: #555; line-height: 1.7; margin-bottom: 16px;">
                            ヘッダーがすっきり！全ての機能をハンバーガーメニューに統合しました。
                        </p>
                        <ul style="line-height: 2.0;">
                            <li><strong>メニューの統合</strong>
                                <ul>
                                    <li>データ管理、印刷、マスター編集、時間割チェックなど全機能を1つのメニューに</li>
                                    <li>画面がすっきりして見やすくなりました</li>
                                </ul>
                            </li>
                            <li><strong>データ管理サブメニュー</strong>
                                <ul>
                                    <li>エクスポート（すべて/マスターのみ/時間割のみ）</li>
                                    <li>ファイルからインポート</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3 style="margin-top: 24px;">📊 表示の改善</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>教員名の固定表示</strong>
                                <ul>
                                    <li>全教員タブで上下スクロール時に教員名が画面上部に固定されます</li>
                                    <li>左右スクロール時に時限列が画面左側に固定されます</li>
                                    <li>大きな時間割でも見やすくなりました</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3 style="margin-top: 24px;">⚙️ バリデーション閾値設定（新機能）</h3>
                        <p style="color: #555; line-height: 1.7; margin-bottom: 16px;">
                            時間割チェックの基準を自由にカスタマイズできるようになりました！
                        </p>
                        <ul style="line-height: 2.0;">
                            <li><strong>カスタマイズ可能な項目</strong>
                                <ul>
                                    <li>教員の連続授業制限（デフォルト: 4コマ）</li>
                                    <li>クラスの連続授業制限（デフォルト: 4コマ）</li>
                                    <li>連続同一科目の警告（デフォルト: 2コマ）</li>
                                    <li>空きコマの多さ（デフォルト: 3コマ）</li>
                                </ul>
                            </li>
                            <li><strong>設定方法</strong>
                                <ul>
                                    <li>マスター編集 → 設定タブ → 時間割チェック設定</li>
                                    <li>+/-ボタンで簡単に調整できます</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3 style="margin-top: 24px;">📋 バリデーションルール説明（新機能）</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>アコーディオン形式で表示</strong>
                                <ul>
                                    <li>時間割チェックモーダルに「📋 チェック項目の説明」を追加</li>
                                    <li>エラー・警告・情報の各判定条件を詳しく説明</li>
                                    <li>どの項目が何をチェックしているか一目で分かります</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3 style="margin-top: 24px;">🐛 バグ修正</h3>
                        <ul style="line-height: 2.0;">
                            <li>バリデーションモーダルの重複表示バグを修正</li>
                            <li>バリデーションモーダルがテーブルヘッダーの下に隠れる問題を修正</li>
                            <li>データ管理サブメニューが表示されない問題を修正</li>
                            <li>マスター編集内のCSVインポート・エクスポートボタンが機能しない問題を修正</li>
                        </ul>
                        
                        <div style="background: linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%); padding: 16px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #4a90d9;">
                            💡 <strong>閾値設定のヒント</strong><br>
                            学校の実情に合わせて閾値を調整することで、より実用的な時間割チェックが可能になります。<br>
                            例：体育の先生は連続5コマでも問題ない場合は、教員の連続授業制限を5に設定できます。
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- v1.3.0 -->
            <div class="accordion-item">
                <div class="accordion-header v1-3-0" onclick="toggleAccordion(this)">
                    <div>
                        <div class="accordion-title">🎉 v1.3.0 - 大型アップデート</div>
                        <div style="font-size: 0.85em; opacity: 0.9; margin-top: 4px;">2026年1月6日</div>
                    </div>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-body">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; margin-bottom: 5px;">🚀 メジャーアップデート</div>
                            <div style="opacity: 0.9;">操作性を大幅に向上！新機能「パーキングエリア」登場</div>
                        </div>
                        
                        <h3>🅿️ パーキングエリア（新機能）</h3>
                        <p style="color: #555; line-height: 1.7; margin-bottom: 16px;">
                            授業を一時的に「駐車」しておける新機能です。<br>
                            時間割の大幅な組み替え作業がグッと楽になります！
                        </p>
                        <ul style="line-height: 2.0;">
                            <li><strong>一括移動</strong>
                                <ul>
                                    <li>特定の曜日・時限の授業をまとめてパーキングへ移動</li>
                                    <li>例：「月曜日の授業を全てパーキングへ」がワンクリック</li>
                                </ul>
                            </li>
                            <li><strong>元の位置を記憶</strong>
                                <ul>
                                    <li>各授業がどこから来たか（元の曜日・時限）を記憶</li>
                                    <li>「すべて復元」で元通りに戻せます</li>
                                </ul>
                            </li>
                            <li><strong>教員別に管理</strong>
                                <ul>
                                    <li>教員ごとに最大20件まで保管可能</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3 style="margin-top: 24px;">📚 全クラスタブ機能強化</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>空セルから授業追加が可能に</strong>
                                <ul>
                                    <li>「全クラス」タブでも空セルをクリックして授業を追加できます</li>
                                    <li>そのクラスの担当授業リストから選択して登録</li>
                                    <li>「全教員」タブと同じ操作感に統一されました</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <div style="background: linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%); padding: 16px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #4a90d9;">
                            💡 <strong>パーキングエリアの使い方</strong><br>
                            1. 全教員タブで「🅿️ パーキングエリア」をクリックして展開<br>
                            2. 教員を選択<br>
                            3. 「一括移動」で曜日や時限を選択して「パーキングへ移動」<br>
                            4. 必要に応じて「すべて復元」で元の位置に戻す
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- v1.2.3 -->
            <div class="accordion-item">
                <div class="accordion-header" onclick="toggleAccordion(this)">
                    <div>
                        <div class="accordion-title">v1.2.3 - 全クラスタブ機能強化</div>
                        <div style="font-size: 0.85em; opacity: 0.9; margin-top: 4px;">2026年1月6日</div>
                    </div>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-body">
                        <h3 style="margin-top: 0;">✨ 新機能</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>全クラスタブから授業追加が可能に</strong>
                                <ul>
                                    <li>「全クラス」タブで空セルをクリックすると、授業追加モーダルが開きます</li>
                                    <li>そのクラスに登録されている担当授業のリストから選択可能</li>
                                    <li>「全教員」タブと同じ操作感で編集できます</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <div style="background: linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%); padding: 16px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #4a90d9;">
                            💡 <strong>使い方のヒント</strong><br>
                            「全教員」タブは教員中心の編集に、「全クラス」タブはクラス中心の編集に便利です。<br>
                            状況に応じてタブを切り替えてお使いください！
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- v1.2.2 -->
            <div class="accordion-item">
                <div class="accordion-header" onclick="toggleAccordion(this)">
                    <div>
                        <div class="accordion-title">v1.2.2 - 表示改善 & 印刷機能</div>
                        <div style="font-size: 0.85em; opacity: 0.9; margin-top: 4px;">2026年1月6日</div>
                    </div>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-body">
                        <h3 style="margin-top: 0;">✨ 新機能</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>印刷機能を追加</strong>
                                <ul>
                                    <li>ヘッダーに「🖨️ 印刷」ボタンを追加</li>
                                    <li>全教員表・全クラス表・特別教室表を印刷可能</li>
                                    <li>A3横・A4横など複数の印刷様式に対応</li>
                                    <li>PDF出力・画像保存に対応</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3>📊 表示の改善</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>コマ数表示を改善</strong>
                                <ul>
                                    <li>【変更前】「5コマ」のように配置済みのコマ数のみ表示</li>
                                    <li>【変更後】「5/18コマ」のように、担当授業の登録数（分母）も表示</li>
                                    <li>一目で「あと何コマ配置すべきか」がわかるようになりました</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3>🔧 操作性の改善</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>授業削除ボタンを復活</strong>
                                <ul>
                                    <li>授業があるセルをクリックすると「この授業を削除」ボタンが表示されます</li>
                                </ul>
                            </li>
                            <li><strong>学年違いの合同授業で警告表示</strong>
                                <ul>
                                    <li>異なる学年のクラスで合同授業を作成しようとすると、確認ダイアログが表示されます</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- v1.2.1 -->
            <div class="accordion-item">
                <div class="accordion-header" onclick="toggleAccordion(this)">
                    <div>
                        <div class="accordion-title">v1.2.1 - システム改善 & バグ修正</div>
                        <div style="font-size: 0.85em; opacity: 0.9; margin-top: 4px;">2026年1月6日</div>
                    </div>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-body">
                        <h3 style="margin-top: 0;">🔧 システムの大規模整理</h3>
                        <p style="margin-bottom: 16px; color: #555; line-height: 1.7;">
                            アプリの「中身」を大掃除しました！<br>
                            使い方は何も変わりませんが、裏側のプログラムを整理整頓したことで、<br>
                            今後の新機能追加やバグ修正がずっとスムーズになります。
                        </p>
                        <ul style="line-height: 2.0;">
                            <li><strong>プログラムを機能別に整理</strong>
                                <ul>
                                    <li>5,000行以上あった大きなファイルを、10個のわかりやすい部品に分割しました</li>
                                    <li>「教員管理」「科目管理」「会議管理」など、役割ごとに分けて整理しています</li>
                                </ul>
                            </li>
                            <li><strong>今後のメリット</strong>
                                <ul>
                                    <li>問題が起きた時に原因を特定しやすくなります</li>
                                    <li>新しい機能をより早く、安全に追加できます</li>
                                    <li>一部を修正しても他の機能に影響しにくくなります</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3>🐛 不具合の修正</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>担当授業タブの絞り込み機能を修正</strong>
                                <ul>
                                    <li>【修正前】「教員で絞り込み」で教科を選ぶと、教員リストだけが絞り込まれ、下の担当授業カードは全て表示されたままでした</li>
                                    <li>【修正後】教科で絞り込むと、教員リストと担当授業カードの両方が連動して絞り込まれるようになりました</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <div style="background: linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%); padding: 16px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #4a90d9;">
                            💡 <strong>ご安心ください</strong><br>
                            今回の変更は「裏側」の改善です。画面の見た目や操作方法は一切変わっておりません。<br>
                            いつも通りお使いいただけます！
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- v1.2.0 -->
            <div class="accordion-item">
                <div class="accordion-header v1-2-0" onclick="toggleAccordion(this)">
                    <div>
                        <div class="accordion-title">v1.2.0 - 授業選択画面をリニューアル</div>
                        <div style="font-size: 0.85em; opacity: 0.9; margin-top: 4px;">2026年1月6日</div>
                    </div>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-body">
                        <div style="background: linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; margin-bottom: 5px;">🚀 メジャーアップデート</div>
                            <div style="opacity: 0.9;">授業選択画面を全面リニューアル</div>
                        </div>
                        <h3 style="margin-top: 0;">🎉 新機能・改善</h3>
                        <ul style="line-height: 2.0;">
                            <li><strong>授業選択画面が使いやすくなりました</strong>
                                <ul>
                                    <li>空欄をクリックした時も、既存の授業をクリックした時も、同じチェックボックス形式で操作できるようになりました</li>
                                    <li>授業を削除したい時は、チェックを全て外して「登録」を押すだけでOKです（「削除」ボタンは廃止しました）</li>
                                    <li>同じ科目を選んでも、クラスが違えば別の授業として認識されるようになりました</li>
                                    <li>TT（チームティーチング）の授業から、特定の先生だけを外すことができるようになりました</li>
                                </ul>
                            </li>
                            <li><strong>特別教室の管理がより便利に</strong>
                                <ul>
                                    <li>特別教室がまだ登録されていない場合、案内メッセージが表示されるようになりました</li>
                                    <li>授業を編集する際、選択していた特別教室がきちんと保持されるようになりました</li>
                                </ul>
                            </li>
                            <li><strong>全教員表がもっと見やすく</strong>
                                <ul>
                                    <li>各先生の名前の下に、その先生が担当している授業のコマ数が表示されるようになりました</li>
                                    <li>合同授業とTT授業の両方に該当する場合、両方のバッジが表示されるようになりました</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- v1.1.0 -->
            <div class="accordion-item">
                <div class="accordion-header v1-1-0" onclick="toggleAccordion(this)">
                    <div>
                        <div class="accordion-title">v1.1.0 - 合同授業・TT授業機能強化</div>
                        <div style="font-size: 0.85em; opacity: 0.9; margin-top: 4px;">2026年1月5日</div>
                    </div>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-body">
                        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; margin-bottom: 5px;">🚀 メジャーアップデート</div>
                            <div style="opacity: 0.9;">合同授業・TT授業機能を追加</div>
                        </div>
                        <h3 style="margin-top: 0;">🎉 新機能</h3>
                        <ul style="line-height: 1.8;">
                            <li><strong>合同授業システム</strong>
                                <ul>
                                    <li>同じ教員が複数クラスで同時に授業を行う機能</li>
                                    <li>「合同」バッジで視覚的に識別</li>
                                    <li>ドラッグ&ドロップで合同授業を作成</li>
                                </ul>
                            </li>
                            <li><strong>TT（チームティーチング）授業</strong>
                                <ul>
                                    <li>複数教員で1つの授業を担当する機能</li>
                                    <li>「TT」バッジで視覚的に識別</li>
                                    <li>教員の追加・削除が可能</li>
                                </ul>
                            </li>
                            <li><strong>合同＋TT授業</strong>
                                <ul>
                                    <li>合同授業とTT授業の組み合わせに対応</li>
                                    <li>両方のバッジを同時表示</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3>🎨 UI/UX改善</h3>
                        <ul style="line-height: 1.8;">
                            <li>授業移動・削除時の確認ダイアログを詳細化</li>
                            <li>連動授業の一括操作に対応</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- v1.0.0 -->
            <div class="accordion-item">
                <div class="accordion-header v1-0-0" onclick="toggleAccordion(this)">
                    <div>
                        <div class="accordion-title">v1.0.0 - 初回リリース</div>
                        <div style="font-size: 0.85em; opacity: 0.9; margin-top: 4px;">2026年1月4日</div>
                    </div>
                    <span class="accordion-icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-body">
                        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                            <div style="font-size: 1.5em; font-weight: bold; margin-bottom: 5px;">🎉 初回リリース</div>
                            <div style="opacity: 0.9;">時間割くん v1.0.0</div>
                        </div>
                        <h3 style="margin-top: 0;">🎉 初期機能</h3>
                        <ul style="line-height: 1.8;">
                            <li><strong>教科別カラーシステム</strong>
                                <ul>
                                    <li>20色の虹順パステルカラーパレット</li>
                                    <li>🎨アイコンから自由に色をカスタマイズ可能</li>
                                    <li>教科・科目・教員・授業カードすべてに色が適用</li>
                                </ul>
                            </li>
                            <li><strong>会議・業務管理機能</strong>
                                <ul>
                                    <li>会議時間の登録と可視化</li>
                                    <li>参加教員の選択（教科で絞り込み可能）</li>
                                    <li>全教員表に灰色で表示</li>
                                </ul>
                            </li>
                            <li><strong>特別教室管理</strong>
                                <ul>
                                    <li>特別教室の登録・編集・削除</li>
                                    <li>授業への教室割り当て機能</li>
                                </ul>
                            </li>
                            <li><strong>勤務不可時間設定</strong>
                                <ul>
                                    <li>教員ごとに勤務不可時間を設定</li>
                                    <li>斜線パターンで表示</li>
                                </ul>
                            </li>
                        </ul>
                        
                        <h3>🎨 UI/UX</h3>
                        <ul style="line-height: 1.8;">
                            <li>固定ヘッダー（時限列・教員名）でスクロール時も見やすく</li>
                            <li>ドラッグ&ドロップで直感的な操作</li>
                            <li>教科順ソート機能</li>
                            <li>フィルター機能（教科・科目・クラス・教員）</li>
                        </ul>
                        
                        <h3>💾 データ管理</h3>
                        <ul style="line-height: 1.8;">
                            <li>自動保存（LocalStorage）</li>
                            <li>CSV入出力対応</li>
                            <li>Undo/Redo機能（最大5回）</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 24px; text-align: right;">
                <button class="btn btn-primary btn-close">閉じる</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // アコーディオン切り替え関数をグローバルに定義
    window.toggleAccordion = function (header) {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.accordion-icon');

        content.classList.toggle('open');
        icon.classList.toggle('open');
    };

    dialog.querySelector('.btn-close').onclick = () => {
        delete window.toggleAccordion;
        dialog.remove();
    };
    dialog.onclick = (e) => {
        if (e.target === dialog) {
            delete window.toggleAccordion;
            dialog.remove();
        }
    };
}
