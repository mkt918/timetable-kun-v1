/**
 * ClassCurriculumManager - クラス別カリキュラム設定モジュール
 * 「クラス起点」で科目・時間数を設定し、後から教員を割り当てる2段階UI
 */
class ClassCurriculumManager {
    constructor(store, ui, masterData) {
        this.store = store;
        this.ui = ui;
        this.masterData = masterData;
        this.selectedGrade = 1;
        this.selectedClassId = null;
    }

    render(selectedClassId = null, selectedGrade = null) {
        if (selectedGrade !== null) this.selectedGrade = selectedGrade;
        if (selectedClassId !== null) this.selectedClassId = selectedClassId;

        // 初期クラスを自動選択
        if (!this.selectedClassId) {
            const firstClass = CLASSES.find(c => c.grade === this.selectedGrade);
            this.selectedClassId = firstClass ? firstClass.id : null;
        }

        this.renderClassList();
        this.renderCurriculumTable();
    }

    // ─── 左パネル：学年タブ + クラスリスト ───────────────────────────

    renderClassList() {
        const panel = document.getElementById('curriculum-class-panel');
        if (!panel) return;

        // 学年タブ
        const grades = [...new Set(CLASSES.map(c => c.grade))].sort();
        const gradeTabs = grades.map(g => `
            <button class="cc-grade-tab" data-grade="${g}"
                style="padding: 4px 10px; border-radius: 12px; border: 2px solid ${this.selectedGrade === g ? '#4a6fa5' : '#ddd'};
                       background: ${this.selectedGrade === g ? '#4a6fa5' : '#f5f5f5'};
                       color: ${this.selectedGrade === g ? '#fff' : '#333'};
                       cursor: pointer; font-size: 0.85em;">
                ${g}年
            </button>
        `).join('');

        // クラスリスト
        const classes = CLASSES.filter(c => c.grade === this.selectedGrade);
        const classItems = classes.map(c => {
            const isSelected = c.id === this.selectedClassId;
            const curriculum = this.store.getClassCurriculum(c.id);
            const subCount = curriculum.length;
            const totalHours = curriculum.reduce((s, cc) => s + (cc.weeklyHours || 0), 0);
            return `
                <div class="cc-class-item" data-class-id="${escapeHtml(c.id)}"
                    style="padding: 8px 10px; margin: 3px 0; border-radius: 6px; cursor: pointer;
                           background: ${isSelected ? '#e8f0fe' : 'transparent'};
                           border-left: 3px solid ${isSelected ? '#4a6fa5' : 'transparent'};
                           font-weight: ${isSelected ? 'bold' : 'normal'};">
                    <div style="font-size: 0.9em;">${escapeHtml(c.name)}</div>
                    ${subCount > 0 ? `<div style="font-size: 0.72em; color: #888; margin-top: 1px;">${subCount}科目・週${totalHours}時間</div>` : ''}
                </div>
            `;
        }).join('');

        panel.innerHTML = `
            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px;">
                ${gradeTabs}
            </div>
            <div id="cc-class-list">
                ${classItems || '<p style="color:#aaa; font-size:0.85em;">クラスがありません</p>'}
            </div>
        `;

        // 学年タブのイベント
        panel.querySelectorAll('.cc-grade-tab').forEach(btn => {
            btn.onclick = () => {
                this.selectedGrade = parseInt(btn.dataset.grade);
                const firstClass = CLASSES.find(c => c.grade === this.selectedGrade);
                this.selectedClassId = firstClass ? firstClass.id : null;
                this.render();
            };
        });

        // クラスアイテムのイベント
        panel.querySelectorAll('.cc-class-item').forEach(item => {
            item.onclick = () => {
                this.selectedClassId = item.dataset.classId;
                this.render();
            };
        });
    }

    // ─── 右パネル：カリキュラムテーブル ─────────────────────────────

    renderCurriculumTable() {
        const panel = document.getElementById('curriculum-main-panel');
        if (!panel) return;

        if (!this.selectedClassId) {
            panel.innerHTML = '<p style="color:#aaa; padding:20px;">左からクラスを選択してください</p>';
            return;
        }

        const cls = CLASSES.find(c => c.id === this.selectedClassId);
        const className = cls ? cls.name : this.selectedClassId;
        const curriculum = this.store.getClassCurriculum(this.selectedClassId);

        // カリキュラムを教科でグループ化して表示
        let tableHtml = '';
        if (curriculum.length === 0) {
            tableHtml = '<p style="color:#aaa; margin: 12px 0;">科目が登録されていません。「＋ 科目を追加」から追加してください。</p>';
        } else {
            // 教科でグループ化
            const grouped = {};
            curriculum.forEach(cc => {
                const sub = this.store.getSubject(cc.subjectId);
                const catId = sub ? sub.categoryId : '__unknown__';
                const cat = this.store.categories.find(c => c.id === catId);
                const catName = cat ? cat.name : '不明';
                if (!grouped[catName]) grouped[catName] = [];
                grouped[catName].push(cc);
            });

            tableHtml = Object.entries(grouped).map(([catName, items]) => {
                const rows = items.map(cc => {
                    const sub = this.store.getSubject(cc.subjectId);
                    const subName = sub ? sub.name : '不明な科目';
                    // 担当教員（assignments から取得）
                    const teacherAssignments = this.store.assignments.filter(
                        a => a.classId === this.selectedClassId && a.subjectId === cc.subjectId
                    );
                    let teacherHtml = '';
                    if (teacherAssignments.length === 0) {
                        teacherHtml = `<span style="color:#e67e22; font-size:0.85em;">未設定</span>`;
                    } else {
                        teacherHtml = teacherAssignments.map(a => {
                            const t = this.store.getTeacher(a.teacherId);
                            return `<span style="background:#e8f4e8; color:#2d6a2d; padding:1px 6px; border-radius:8px; font-size:0.82em; margin-right:3px;">${escapeHtml(t ? t.name : '?')}</span>`;
                        }).join('');
                    }

                    const assignedLabel = teacherAssignments.length === 0
                        ? `<button class="cc-btn-assign" data-id="${escapeHtml(cc.id)}" style="font-size:0.8em; padding:2px 8px; background:#e67e22; color:#fff; border:none; border-radius:4px; cursor:pointer;">教員を設定</button>`
                        : `<button class="cc-btn-assign" data-id="${escapeHtml(cc.id)}" style="font-size:0.8em; padding:2px 8px; background:#4a6fa5; color:#fff; border:none; border-radius:4px; cursor:pointer;">変更</button>`;

                    return `
                        <tr style="border-bottom: 1px solid #f0f0f0;">
                            <td style="padding: 8px 10px; font-size:0.9em;">${escapeHtml(subName)}</td>
                            <td style="padding: 8px 6px; text-align:center;">
                                <input type="number" class="cc-hours-input" data-id="${escapeHtml(cc.id)}"
                                    value="${cc.weeklyHours}" min="1" max="20"
                                    style="width:46px; text-align:center; border:1px solid #ddd; border-radius:4px; padding:2px;">
                                <span style="font-size:0.8em; color:#666;">時間</span>
                            </td>
                            <td style="padding: 8px 6px;">${teacherHtml} ${assignedLabel}</td>
                            <td style="padding: 8px 6px; text-align:right;">
                                <button class="cc-btn-delete" data-id="${escapeHtml(cc.id)}"
                                    style="font-size:0.8em; padding:2px 8px; background:#e74c3c; color:#fff; border:none; border-radius:4px; cursor:pointer;">削除</button>
                            </td>
                        </tr>
                    `;
                }).join('');

                return `
                    <div style="margin-bottom: 12px;">
                        <div style="font-size:0.78em; font-weight:bold; color:#888; margin-bottom:4px; padding-bottom:2px; border-bottom:1px solid #e5e7eb;">${escapeHtml(catName)}</div>
                        <table style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8f9fa; font-size:0.8em; color:#666;">
                                    <th style="padding:4px 10px; text-align:left; font-weight:normal;">科目</th>
                                    <th style="padding:4px 6px; text-align:center; font-weight:normal;">週時間</th>
                                    <th style="padding:4px 6px; text-align:left; font-weight:normal;">担当教員</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;
            }).join('');
        }

        const totalHours = curriculum.reduce((s, cc) => s + (cc.weeklyHours || 0), 0);
        const assignedCount = curriculum.filter(cc =>
            this.store.assignments.some(a => a.classId === this.selectedClassId && a.subjectId === cc.subjectId)
        ).length;

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <h4 style="margin:0; font-size:1em;">${escapeHtml(className)} のカリキュラム</h4>
                <div style="display:flex; gap:8px;">
                    <button id="cc-btn-bulk" class="btn btn-secondary" style="font-size:0.85em;">
                        📋 ${this.selectedGrade}年一括設定
                    </button>
                    <button id="cc-btn-add" class="btn btn-accent" style="font-size:0.85em;">
                        ＋ 科目を追加
                    </button>
                </div>
            </div>
            <div style="font-size:0.82em; color:#555; margin-bottom:12px; display:flex; gap:16px;">
                <span>登録科目: <strong>${curriculum.length}件</strong></span>
                <span>週合計: <strong>${totalHours}時間</strong></span>
                <span>教員割当済: <strong>${assignedCount}/${curriculum.length}件</strong></span>
            </div>
            <div id="cc-table-body">
                ${tableHtml}
            </div>
        `;

        // ＋科目追加ボタン
        document.getElementById('cc-btn-add')?.addEventListener('click', () => {
            this.openAddDialog(this.selectedClassId);
        });

        // 学年一括設定ボタン
        document.getElementById('cc-btn-bulk')?.addEventListener('click', () => {
            this.openGradeBulkDialog(this.selectedGrade);
        });

        // 週時間数変更
        panel.querySelectorAll('.cc-hours-input').forEach(input => {
            input.onchange = () => {
                const id = input.dataset.id;
                const val = parseInt(input.value);
                if (val >= 1 && val <= 20) {
                    this.store.updateClassCurriculum(id, val);
                    this.renderClassList(); // サマリー更新
                } else {
                    // 範囲外は元に戻す
                    const cc = this.store.classCurriculum.find(c => c.id === id);
                    if (cc) input.value = cc.weeklyHours;
                }
            };
        });

        // 教員設定ボタン
        panel.querySelectorAll('.cc-btn-assign').forEach(btn => {
            btn.onclick = () => {
                const cc = this.store.classCurriculum.find(c => c.id === btn.dataset.id);
                if (cc) this.openTeacherAssignDialog(cc.classId, cc.subjectId, cc.weeklyHours);
            };
        });

        // 削除ボタン
        panel.querySelectorAll('.cc-btn-delete').forEach(btn => {
            btn.onclick = () => {
                const cc = this.store.classCurriculum.find(c => c.id === btn.dataset.id);
                if (!cc) return;
                const sub = this.store.getSubject(cc.subjectId);
                const subName = sub ? sub.name : '不明';
                if (!confirm(`「${subName}」をカリキュラムから削除しますか？\n※担当教員の割当も削除されます。`)) return;
                this.store.deleteClassCurriculum(cc.id);
                this.render();
                showToast('削除しました', 'success');
            };
        });
    }

    // ─── 科目追加ダイアログ ──────────────────────────────────────────

    openAddDialog(classId) {
        const cls = CLASSES.find(c => c.id === classId);
        const className = cls ? cls.name : classId;

        let selectedCatId = this.store.categories[0]?.id || null;
        let selectedSubjectId = null;

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay cc-add-overlay';

        const renderContent = () => {
            const catTags = this.store.categories.map(cat => {
                const isSelected = cat.id === selectedCatId;
                return `
                    <span class="cc-cat-tag" data-cat-id="${escapeHtml(cat.id)}"
                        style="padding:4px 12px; border-radius:20px; cursor:pointer; font-size:0.88em; user-select:none;
                               background:${isSelected ? '#4a6fa5' : '#f5f5f5'};
                               color:${isSelected ? '#fff' : '#333'};
                               border:2px solid ${isSelected ? '#4a6fa5' : '#ddd'};">
                        ${escapeHtml(cat.name)}
                    </span>
                `;
            }).join('');

            // 既に登録済みの科目IDを除外
            const registeredSubjectIds = new Set(
                this.store.getClassCurriculum(classId).map(cc => cc.subjectId)
            );
            const subjects = this.store.subjects.filter(
                s => s.categoryId === selectedCatId && !s.isHidden && !registeredSubjectIds.has(s.id)
            );
            const subTags = subjects.length > 0
                ? subjects.map(s => {
                    const isSelected = s.id === selectedSubjectId;
                    return `
                        <span class="cc-sub-tag" data-sub-id="${escapeHtml(s.id)}" data-credits="${s.credits || 1}"
                            style="padding:5px 12px; border-radius:20px; cursor:pointer; font-size:0.88em; user-select:none;
                                   background:${isSelected ? '#4a6fa5' : '#f0f0f0'};
                                   color:${isSelected ? '#fff' : '#333'};
                                   border:2px solid ${isSelected ? '#3a5f95' : '#ddd'};">
                            ${escapeHtml(s.name)}
                        </span>
                    `;
                }).join('')
                : '<span style="color:#aaa; font-size:0.85em;">（未登録または全科目登録済み）</span>';

            const selectedSub = selectedSubjectId ? this.store.getSubject(selectedSubjectId) : null;
            const defaultHours = selectedSub ? (selectedSub.credits || 1) : 1;

            overlay.innerHTML = `
                <div class="dialog-content" style="width:480px; max-width:92vw;">
                    <h3 style="margin:0 0 14px; font-size:1em;">${escapeHtml(className)} に科目を追加</h3>
                    <div style="font-size:0.78em; color:#888; margin-bottom:4px;">① 教科</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; padding-bottom:12px; border-bottom:1px solid #e5e7eb; margin-bottom:10px;">
                        ${catTags}
                    </div>
                    <div style="font-size:0.78em; color:#888; margin-bottom:4px;">② 科目</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; padding-bottom:12px; border-bottom:1px solid #e5e7eb; margin-bottom:10px; min-height:36px;">
                        ${subTags}
                    </div>
                    <div style="font-size:0.78em; color:#888; margin-bottom:4px;">③ 週時間数</div>
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                        <input type="number" id="cc-add-hours" value="${defaultHours}" min="1" max="20"
                            style="width:60px; text-align:center; border:1px solid #ddd; border-radius:4px; padding:4px 6px;">
                        <span style="font-size:0.9em; color:#555;">時間/週</span>
                        ${selectedSub ? `<span style="font-size:0.8em; color:#888;">（科目設定値: ${selectedSub.credits || 1}時間）</span>` : ''}
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button class="btn btn-secondary" id="cc-add-cancel">キャンセル</button>
                        <button class="btn btn-primary" id="cc-add-ok" ${!selectedSubjectId ? 'disabled' : ''}>追加</button>
                    </div>
                </div>
            `;

            // イベント再設定
            overlay.querySelectorAll('.cc-cat-tag').forEach(tag => {
                tag.onclick = () => {
                    selectedCatId = tag.dataset.catId;
                    selectedSubjectId = null;
                    renderContent();
                };
            });
            overlay.querySelectorAll('.cc-sub-tag').forEach(tag => {
                tag.onclick = () => {
                    selectedSubjectId = tag.dataset.subId;
                    // クレジット数をデフォルトにセット
                    renderContent();
                };
            });
            overlay.querySelector('#cc-add-cancel').onclick = () => overlay.remove();
            overlay.querySelector('#cc-add-ok').onclick = () => {
                if (!selectedSubjectId) return;
                const hours = parseInt(overlay.querySelector('#cc-add-hours').value) || 1;
                const result = this.store.addClassCurriculum(classId, selectedSubjectId, hours);
                if (result.success) {
                    overlay.remove();
                    this.render();
                    showToast('追加しました', 'success');
                } else {
                    showToast(result.message || '追加できませんでした', 'error');
                }
            };
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        };

        renderContent();
        document.body.appendChild(overlay);
    }

    // ─── 教員割当ダイアログ ──────────────────────────────────────────

    openTeacherAssignDialog(classId, subjectId, weeklyHours) {
        const cls = CLASSES.find(c => c.id === classId);
        const sub = this.store.getSubject(subjectId);
        const className = cls ? cls.name : classId;
        const subName = sub ? sub.name : '不明';

        // 現在の担当教員（複数可）
        const currentAssignments = this.store.assignments.filter(
            a => a.classId === classId && a.subjectId === subjectId
        );
        const currentTeacherIds = new Set(currentAssignments.map(a => a.teacherId));

        // 担当可能な教員（科目の教科に関連する教員を優先表示）
        const subCatId = sub ? sub.categoryId : null;
        const teachers = [...this.store.teachers].sort((a, b) => {
            const aHasCat = subCatId && (a.categoryIds || []).includes(subCatId);
            const bHasCat = subCatId && (b.categoryIds || []).includes(subCatId);
            if (aHasCat && !bHasCat) return -1;
            if (!aHasCat && bHasCat) return 1;
            return (a.name || '').localeCompare(b.name || '', 'ja');
        });

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay cc-assign-overlay';

        const renderTeacherList = () => {
            const teacherItems = teachers.map(t => {
                const isAssigned = currentTeacherIds.has(t.id);
                const hasCat = subCatId && (t.categoryIds || []).includes(subCatId);
                return `
                    <div class="cc-teacher-row" data-teacher-id="${escapeHtml(t.id)}"
                        style="display:flex; align-items:center; gap:10px; padding:8px 10px; margin:2px 0;
                               border-radius:6px; cursor:pointer;
                               background:${isAssigned ? '#e8f4e8' : 'transparent'};
                               border:1px solid ${isAssigned ? '#4caf50' : '#eee'};">
                        <div style="flex:1;">
                            <span style="font-size:0.9em;">${escapeHtml(t.name)}</span>
                            ${hasCat ? `<span style="font-size:0.72em; color:#4a6fa5; margin-left:6px;">関連教科</span>` : ''}
                        </div>
                        <div style="font-size:0.82em; color:${isAssigned ? '#2d6a2d' : '#aaa'};">
                            ${isAssigned ? '✓ 割当済' : '割当なし'}
                        </div>
                    </div>
                `;
            }).join('');

            overlay.innerHTML = `
                <div class="dialog-content" style="width:400px; max-width:92vw; max-height:85vh; display:flex; flex-direction:column;">
                    <h3 style="margin:0 0 6px; font-size:1em;">${escapeHtml(className)} / ${escapeHtml(subName)} の担当教員</h3>
                    <p style="margin:0 0 10px; font-size:0.82em; color:#666;">クリックで割当ON/OFF（複数選択可）</p>
                    <div style="flex:1; overflow-y:auto; max-height:400px; border:1px solid #e5e7eb; border-radius:6px; padding:6px;">
                        ${teacherItems || '<p style="color:#aaa; text-align:center; padding:20px;">教員が登録されていません</p>'}
                    </div>
                    <div style="padding-top:12px; text-align:right;">
                        <button class="btn btn-primary" id="cc-assign-close">閉じる</button>
                    </div>
                </div>
            `;

            overlay.querySelectorAll('.cc-teacher-row').forEach(row => {
                row.onclick = () => {
                    const tid = row.dataset.teacherId;
                    if (currentTeacherIds.has(tid)) {
                        this.store.deleteAssignment(tid, subjectId, classId);
                        currentTeacherIds.delete(tid);
                    } else {
                        this.store.addAssignment(tid, subjectId, classId, weeklyHours);
                        currentTeacherIds.add(tid);
                    }
                    renderTeacherList();
                    // 右パネルのみ更新（左パネルも更新してサマリーを反映しない）
                    this.renderCurriculumTable();
                    // 教員カードのサマリーも更新
                    this.masterData.renderTeachers();
                };
            });

            overlay.querySelector('#cc-assign-close').onclick = () => overlay.remove();
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        };

        renderTeacherList();
        document.body.appendChild(overlay);
    }

    // ─── 学年一括設定ダイアログ ──────────────────────────────────────

    openGradeBulkDialog(grade) {
        const gradeClasses = CLASSES.filter(c => c.grade === grade);
        const gradeLabel = `${grade}年生`;

        let selectedCatId = this.store.categories[0]?.id || null;
        let selectedSubjectId = null;

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay cc-bulk-overlay';

        const renderContent = () => {
            const catTags = this.store.categories.map(cat => {
                const isSelected = cat.id === selectedCatId;
                return `
                    <span class="cc-bulk-cat-tag" data-cat-id="${escapeHtml(cat.id)}"
                        style="padding:4px 12px; border-radius:20px; cursor:pointer; font-size:0.88em; user-select:none;
                               background:${isSelected ? '#4a6fa5' : '#f5f5f5'};
                               color:${isSelected ? '#fff' : '#333'};
                               border:2px solid ${isSelected ? '#4a6fa5' : '#ddd'};">
                        ${escapeHtml(cat.name)}
                    </span>
                `;
            }).join('');

            const subjects = selectedCatId
                ? this.store.subjects.filter(s => s.categoryId === selectedCatId && !s.isHidden)
                : [];
            const subTags = subjects.length > 0
                ? subjects.map(s => {
                    const isSelected = s.id === selectedSubjectId;
                    return `
                        <span class="cc-bulk-sub-tag" data-sub-id="${escapeHtml(s.id)}" data-credits="${s.credits || 1}"
                            style="padding:5px 12px; border-radius:20px; cursor:pointer; font-size:0.88em; user-select:none;
                                   background:${isSelected ? '#4a6fa5' : '#f0f0f0'};
                                   color:${isSelected ? '#fff' : '#333'};
                                   border:2px solid ${isSelected ? '#3a5f95' : '#ddd'};">
                            ${escapeHtml(s.name)}
                        </span>
                    `;
                }).join('')
                : '<span style="color:#aaa; font-size:0.85em;">（科目を選択してください）</span>';

            const selectedSub = selectedSubjectId ? this.store.getSubject(selectedSubjectId) : null;
            const defaultHours = selectedSub ? (selectedSub.credits || 1) : 1;

            // 各クラスの登録状況確認
            const statusRows = gradeClasses.map(c => {
                const hasEntry = selectedSubjectId
                    ? this.store.classCurriculum.some(cc => cc.classId === c.id && cc.subjectId === selectedSubjectId)
                    : false;
                return `<span style="font-size:0.8em; padding:2px 8px; border-radius:10px; background:${hasEntry ? '#e8f4e8' : '#f0f0f0'}; color:${hasEntry ? '#2d6a2d' : '#666'}; margin:2px;">${escapeHtml(c.name)}${hasEntry ? ' ✓' : ''}</span>`;
            }).join('');

            overlay.innerHTML = `
                <div class="dialog-content" style="width:500px; max-width:92vw;">
                    <h3 style="margin:0 0 6px; font-size:1em;">📋 ${escapeHtml(gradeLabel)} 一括設定</h3>
                    <p style="margin:0 0 14px; font-size:0.82em; color:#666;">${escapeHtml(gradeLabel)}の全クラスに同じ科目・時間数を一括登録します</p>
                    <div style="font-size:0.78em; color:#888; margin-bottom:4px;">① 教科</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; padding-bottom:12px; border-bottom:1px solid #e5e7eb; margin-bottom:10px;">
                        ${catTags}
                    </div>
                    <div style="font-size:0.78em; color:#888; margin-bottom:4px;">② 科目</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; padding-bottom:12px; border-bottom:1px solid #e5e7eb; margin-bottom:10px; min-height:36px;">
                        ${subTags}
                    </div>
                    <div style="font-size:0.78em; color:#888; margin-bottom:4px;">③ 週時間数</div>
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                        <input type="number" id="cc-bulk-hours" value="${defaultHours}" min="1" max="20"
                            style="width:60px; text-align:center; border:1px solid #ddd; border-radius:4px; padding:4px 6px;">
                        <span style="font-size:0.9em; color:#555;">時間/週</span>
                    </div>
                    <div style="font-size:0.78em; color:#888; margin-bottom:4px;">対象クラス</div>
                    <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:16px; padding:8px; background:#f8f8f8; border-radius:6px;">
                        ${statusRows}
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button class="btn btn-secondary" id="cc-bulk-cancel">キャンセル</button>
                        <button class="btn btn-primary" id="cc-bulk-ok" ${!selectedSubjectId ? 'disabled' : ''}>全クラスに適用</button>
                    </div>
                </div>
            `;

            // イベント設定
            overlay.querySelectorAll('.cc-bulk-cat-tag').forEach(tag => {
                tag.onclick = () => {
                    selectedCatId = tag.dataset.catId;
                    selectedSubjectId = null;
                    renderContent();
                };
            });
            overlay.querySelectorAll('.cc-bulk-sub-tag').forEach(tag => {
                tag.onclick = () => {
                    selectedSubjectId = tag.dataset.subId;
                    renderContent();
                };
            });
            overlay.querySelector('#cc-bulk-cancel').onclick = () => overlay.remove();
            overlay.querySelector('#cc-bulk-ok').onclick = () => {
                if (!selectedSubjectId) return;
                const hours = parseInt(overlay.querySelector('#cc-bulk-hours').value) || 1;
                const sub = this.store.getSubject(selectedSubjectId);
                const subName = sub ? sub.name : '?';

                // 既存エントリがあるクラスを確認
                const existingClasses = gradeClasses.filter(c =>
                    this.store.classCurriculum.some(cc => cc.classId === c.id && cc.subjectId === selectedSubjectId)
                );
                if (existingClasses.length > 0) {
                    const existNames = existingClasses.map(c => c.name).join('、');
                    if (!confirm(`${existNames} には既に「${subName}」が登録されています。\n週時間数を ${hours}時間 に上書きしますか？`)) return;
                    existingClasses.forEach(c => {
                        const entry = this.store.classCurriculum.find(cc => cc.classId === c.id && cc.subjectId === selectedSubjectId);
                        if (entry) this.store.updateClassCurriculum(entry.id, hours);
                    });
                }

                // 未登録のクラスに一括追加
                const newClasses = gradeClasses.filter(c =>
                    !this.store.classCurriculum.some(cc => cc.classId === c.id && cc.subjectId === selectedSubjectId)
                );
                newClasses.forEach(c => this.store.addClassCurriculum(c.id, selectedSubjectId, hours));

                overlay.remove();
                this.render();
                showToast(`${gradeLabel}全クラスに「${subName}」を設定しました`, 'success');
            };
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        };

        renderContent();
        document.body.appendChild(overlay);
    }
}

// グローバルに公開
window.ClassCurriculumManager = ClassCurriculumManager;
