/**
 * 時間割くん - メインアプリケーション
 */

document.addEventListener('DOMContentLoaded', () => {
    try {
        // UIインスタンスを作成
        ui = new TimetableUI(dataStore);

        // 初期化
        ui.init();
    } catch (e) {
        console.error(e);
        alert('初期化エラーが発生しました: ' + e.message + '\n' + e.stack);
    }

    // ==========================================
    // ハンバーガーメニュー
    // ==========================================
    const hamburgerBtn = document.getElementById('btn-hamburger');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const dataDropdownMenu = document.getElementById('data-dropdown-menu');

    // ハンバーガーメニューの開閉
    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hamburgerMenu.classList.toggle('show');
        dataDropdownMenu.style.display = 'none';
    });

    // メニュー外をクリックで閉じる
    document.addEventListener('click', () => {
        hamburgerMenu.classList.remove('show');
        dataDropdownMenu.style.display = 'none';
    });

    // データ管理メニュー
    document.getElementById('menu-data').addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dataDropdownMenu.style.display === 'none' || !dataDropdownMenu.style.display;
        if (isHidden) {
            dataDropdownMenu.style.display = 'block';
            dataDropdownMenu.style.visibility = 'visible';
            dataDropdownMenu.style.opacity = '1';
        } else {
            dataDropdownMenu.style.display = 'none';
            dataDropdownMenu.style.visibility = 'hidden';
            dataDropdownMenu.style.opacity = '0';
        }
    });

    // 印刷 (スタンドアロンボタン)
    document.getElementById('btn-print').addEventListener('click', () => {
        if (!window.printManager) {
            window.printManager = new PrintManager(dataStore, ui);
        }
        window.printManager.openDialog();
    });

    // マスター編集
    document.getElementById('menu-master').addEventListener('click', () => {
        hamburgerMenu.classList.remove('show');
        ui.openMasterDataModal();
    });

    // 時間割チェック (スタンドアロンボタン)
    document.getElementById('btn-validation').addEventListener('click', () => {
        ui.validationModal.open();
    });

    // 使い方
    document.getElementById('menu-help').addEventListener('click', () => {
        hamburgerMenu.classList.remove('show');
        showHelpDialog();
    });

    // パッチノート
    document.getElementById('menu-patch-notes').addEventListener('click', () => {
        hamburgerMenu.classList.remove('show');
        showPatchNotesDialog();
    });

    // ==========================================
    // データ管理（インポート/エクスポート）
    // ==========================================

    // TimetableIOインスタンスを作成
    const timetableIO = new TimetableIO(dataStore);

    // すべてエクスポート
    document.getElementById('btn-export-all').addEventListener('click', () => {
        timetableIO.downloadAll();
        showToast('全データをエクスポートしました', 'success');
        dataDropdown.classList.remove('show');
    });

    // マスターのみエクスポート
    document.getElementById('btn-export-master').addEventListener('click', () => {
        timetableIO.downloadMasterData();
        showToast('マスターデータをエクスポートしました', 'success');
        dataDropdown.classList.remove('show');
    });

    // 時間割のみエクスポート
    document.getElementById('btn-export-timetable').addEventListener('click', () => {
        timetableIO.downloadTimetable();
        showToast('時間割データをエクスポートしました', 'success');
        dataDropdown.classList.remove('show');
    });

    // ファイルからインポート（ファイル選択ダイアログを開く）
    document.getElementById('btn-import-file').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
        dataDropdown.classList.remove('show');
    });

    // ファイル選択後のインポート処理
    document.getElementById('import-file-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const data = await timetableIO.readJsonFile(file);

            // データタイプに応じてインポート方法を選択
            let result;
            if (data.type === 'full') {
                if (confirm('すべてのデータをインポートします。現在のデータは上書きされます。よろしいですか？')) {
                    result = timetableIO.importAll(data);
                } else {
                    return;
                }
            } else if (data.type === 'master') {
                const merge = confirm('マスターデータをインポートします。\n\n' +
                    '【OK】既存データとマージ（追加のみ）\n' +
                    '【キャンセル】既存データを上書き');
                result = timetableIO.importMasterData(data, merge);
            } else if (data.type === 'timetable') {
                if (confirm('時間割データをインポートします。現在の時間割は上書きされます。よろしいですか？')) {
                    result = timetableIO.importTimetable(data);
                } else {
                    return;
                }
            } else {
                showToast('不明なデータ形式です', 'error');
                return;
            }

            if (result.success) {
                showToast(result.message, 'success');
                ui.renderMainOverview();
                ui.checkConflicts();
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast(`インポートエラー: ${error.message}`, 'error');
        }

        // ファイル選択をリセット
        e.target.value = '';
    });

    // ==========================================
    // モーダルの共通イベント
    // ==========================================

    // モーダルを閉じる（オーバーレイクリック）
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            overlay.closest('.modal').classList.add('hidden');
        });
    });

    // モーダルを閉じる（×ボタン）
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.add('hidden');
        });
    });

    // ==========================================
    // 授業選択モーダル
    // ==========================================

    // 授業削除ボタン
    document.getElementById('btn-clear-lesson').addEventListener('click', () => {
        ui.clearLesson();
    });

    // ==========================================
    // マスターデータ編集モーダル
    // ==========================================

    // タブ切り替え
    document.querySelectorAll('.master-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            ui.switchMasterTab(tab.dataset.tab);
        });
    });

    // 教員追加ボタン
    document.getElementById('btn-add-teacher').addEventListener('click', () => {
        ui.addMasterTeacher();
    });

    // 教科カテゴリ追加・科目追加ボタンは master_data.js で設定されるためここでは不要

    // 担当授業追加ボタン
    document.getElementById('btn-add-assignment').addEventListener('click', () => {
        ui.addMasterAssignment();
    });

    // 時間数増減ボタン
    document.getElementById('btn-hours-dec').addEventListener('click', () => {
        ui.adjustHours(-1);
    });

    document.getElementById('btn-hours-inc').addEventListener('click', () => {
        ui.adjustHours(1);
    });

    // 教科カテゴリ追加・科目追加ボタンは master_data.js で設定されるためここでは不要


    // CSVインポート/エクスポートボタン（モーダルを開く）
    const csvBtn = document.getElementById('btn-csv-import-master');
    if (csvBtn) {
        csvBtn.addEventListener('click', () => {
            ui.openCSVUnifiedModal();
        });
    }

    // ==========================================
    // キーボードショートカット
    // ==========================================

    document.addEventListener('keydown', (e) => {
        // Escでモーダルを閉じる
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
                modal.classList.add('hidden');
            });
            // コンテキストメニューも閉じる
            document.getElementById('context-menu').classList.add('hidden');
        }

        // Ctrl+S で保存
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (dataStore.saveToStorage()) {
                showToast('保存しました', 'success');
            }
        }
    });

    // ==========================================
    // 右クリックコンテキストメニュー
    // ==========================================

    const contextMenu = document.getElementById('context-menu');
    let contextMenuTarget = null; // 右クリックされたセルの情報

    // メニューを閉じる
    function hideContextMenu() {
        contextMenu.classList.add('hidden');
        contextMenuTarget = null;
    }

    // クリックでメニューを閉じる
    document.addEventListener('click', hideContextMenu);

    // 概要テーブルで右クリック
    document.getElementById('main-overview-table').addEventListener('contextmenu', (e) => {
        const cell = e.target.closest('td[data-day]');
        if (!cell) return;

        e.preventDefault();

        // セル情報を取得
        const classId = cell.dataset.classId;
        const teacherId = cell.dataset.teacherId;
        const day = parseInt(cell.dataset.day);
        const period = parseInt(cell.dataset.period);

        // 授業があるかチェック
        let hasLesson = false;
        let subjectName = '';

        if (classId) {
            const slots = dataStore.getSlot(classId, day, period);
            hasLesson = slots.length > 0;
            if (hasLesson) {
                const subject = dataStore.getSubject(slots[0].subjectId);
                subjectName = subject ? subject.name : '不明';
            }
        } else if (teacherId) {
            const timetable = dataStore.getTeacherTimetable(teacherId);
            const key = `${day}-${period}`;
            const slots = timetable[key] || [];
            hasLesson = slots.length > 0;
            if (hasLesson) {
                subjectName = slots[0].subjectName || '不明';
            }
        }

        if (!hasLesson) {
            // 授業がない場合はメニューを表示しない
            return;
        }

        // ターゲット情報を保存
        contextMenuTarget = {
            classId: classId || (teacherId ? dataStore.getTeacherTimetable(teacherId)[`${day}-${period}`]?.[0]?.classId : null),
            teacherId,
            day,
            period
        };

        // ヘッダーを更新
        document.getElementById('context-menu-header').textContent =
            `${DAYS[day]}曜${period + 1}限 - ${subjectName}`;

        // 連動グループに含まれているか確認
        const linkedLessons = dataStore.getLinkedLessons(contextMenuTarget.classId, day, period);
        const isLinked = linkedLessons.length > 1;

        // ボタンの有効/無効を設定
        document.getElementById('ctx-add-to-link').disabled = !pendingLinkGroup;
        document.getElementById('ctx-create-link').disabled = isLinked;
        document.getElementById('ctx-remove-from-link').disabled = !isLinked;

        // メニューを表示
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.classList.remove('hidden');

        // 画面外にはみ出さないよう調整
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
    });

    // 保留中の連動グループ作成
    let pendingLinkGroup = null;

    // 新規連動グループ作成
    document.getElementById('ctx-create-link').addEventListener('click', () => {
        if (!contextMenuTarget) return;

        pendingLinkGroup = {
            id: `link_${Date.now()}`,
            slots: [{
                classId: contextMenuTarget.classId,
                day: contextMenuTarget.day,
                period: contextMenuTarget.period
            }]
        };

        showToast('連動グループを開始しました。追加するセルを右クリックして「連動グループに追加」を選択してください。', 'info');
        hideContextMenu();
    });

    // 連動グループに追加
    document.getElementById('ctx-add-to-link').addEventListener('click', () => {
        if (!contextMenuTarget || !pendingLinkGroup) return;

        pendingLinkGroup.slots.push({
            classId: contextMenuTarget.classId,
            day: contextMenuTarget.day,
            period: contextMenuTarget.period
        });

        // 連動グループを保存
        dataStore.linkedGroups.push(pendingLinkGroup);
        dataStore.saveToStorage();

        showToast(`連動グループを作成しました（${pendingLinkGroup.slots.length}件）`, 'success');
        pendingLinkGroup = null;
        hideContextMenu();
        ui.renderMainOverview();
    });

    // 連動から外す
    document.getElementById('ctx-remove-from-link').addEventListener('click', () => {
        if (!contextMenuTarget) return;

        const { classId, day, period } = contextMenuTarget;

        // 手動連動グループから削除
        dataStore.linkedGroups = dataStore.linkedGroups.filter(group => {
            group.slots = group.slots.filter(s =>
                !(s.classId === classId && s.day === day && s.period === period)
            );
            return group.slots.length > 0;
        });

        dataStore.saveToStorage();
        showToast('連動から外しました', 'success');
        hideContextMenu();
        ui.renderMainOverview();
    });

    // 授業を削除
    document.getElementById('ctx-delete').addEventListener('click', () => {
        if (!contextMenuTarget) return;

        const { classId, day, period } = contextMenuTarget;
        const linkedLessons = dataStore.getLinkedLessons(classId, day, period);

        if (linkedLessons.length > 1) {
            if (!confirm(`この授業は他の${linkedLessons.length - 1}件と連動しています。すべて削除しますか？`)) {
                hideContextMenu();
                return;
            }
            const result = dataStore.clearLinkedLessons(classId, day, period);
            showToast(`連動授業${result.count}件を削除しました`, 'success');
        } else {
            dataStore.clearSlot(classId, day, period);
            showToast('授業を削除しました', 'success');
        }

        hideContextMenu();
        ui.renderMainOverview();
        ui.checkConflicts();
    });
});
