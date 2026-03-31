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

    // ─── 右パネル：カリキュラム（カードグリッド） ────────────────────

    // 教科ごとのカラーパレット
    static get CATEGORY_COLORS() {
        return ['#4a6fa5', '#e05252', '#e09d33', '#3a9e6f', '#7c52a8', '#1aada4', '#c7623e', '#3580b1', '#a84c7a', '#6a7b2a'];
    }

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
        const totalHours = curriculum.reduce((s, cc) => s + (cc.weeklyHours || 0), 0);
        const assignedCount = curriculum.filter(cc =>
            this.store.assignments.some(a => a.classId === this.selectedClassId && a.subjectId === cc.subjectId)
        ).length;

        // ─── カードセクション生成 ───────────────────────────────────
        let cardsHtml = '';

        if (curriculum.length === 0) {
            cardsHtml = `
                <div style="text-align:center; padding:48px 20px; color:#9ca3af;">
                    <div style="font-size:2.5rem; margin-bottom:12px;">📋</div>
                    <div style="font-size:0.95em; font-weight:500;">科目が登録されていません</div>
                    <div style="font-size:0.82em; margin-top:6px;">「＋ 科目を追加」から登録してください</div>
                </div>`;
        } else {
            // 教科でグループ化（登録順を維持）
            const catOrder = [];
            const grouped = {};
            curriculum.forEach(cc => {
                const sub = this.store.getSubject(cc.subjectId);
                const catId = sub ? sub.categoryId : '__unknown__';
                if (!grouped[catId]) {
                    const cat = this.store.categories.find(c => c.id === catId);
                    grouped[catId] = { catName: cat ? cat.name : '未分類', items: [] };
                    catOrder.push(catId);
                }
                grouped[catId].items.push(cc);
            });

            const COLORS = ClassCurriculumManager.CATEGORY_COLORS;

            cardsHtml = catOrder.map((catId, catIdx) => {
                const { catName, items } = grouped[catId];
                const color = COLORS[catIdx % COLORS.length];
                const catHours = items.reduce((s, cc) => s + (cc.weeklyHours || 0), 0);

                const cards = items.map(cc => {
                    const sub = this.store.getSubject(cc.subjectId);
                    const subName = sub ? sub.name : '不明な科目';

                    const teacherAssignments = this.store.assignments.filter(
                        a => a.classId === this.selectedClassId && a.subjectId === cc.subjectId
                    );
                    const hasTeacher = teacherAssignments.length > 0;

                    const teacherChips = hasTeacher
                        ? teacherAssignments.map(a => {
                            const t = this.store.getTeacher(a.teacherId);
                            return `<span style="background:#dbeafe; color:#1d4ed8; padding:2px 9px; border-radius:20px; font-size:0.8em; font-weight:500; white-space:nowrap;">${escapeHtml(t ? t.name : '?')}</span>`;
                        }).join('')
                        : `<span style="color:#ef4444; font-size:0.82em; font-weight:600;">未設定</span>`;

                    const assignBtnStyle = hasTeacher
                        ? 'background:#f3f4f6; color:#374151; border:1px solid #e5e7eb;'
                        : 'background:#ef4444; color:#fff; border:none;';
                    const assignBtnLabel = hasTeacher ? '教員を変更' : '教員を設定';

                    // 授業形態オプション（デフォルト値を補完）
                    const consecutive = cc.consecutivePeriods || 1;
                    const lessonType = cc.lessonType || 'normal';
                    // isTT: 独立TTフラグ（lessonType === 'tt' は後方互換として扱う）
                    const isTT = cc.isTT === true || lessonType === 'tt';
                    // 表示用 lessonType（tt は normal として扱い isTT チェックで表現）
                    const displayLessonType = (lessonType === 'tt') ? 'normal' : lessonType;
                    const jointIds = cc.jointClassIds || [];

                    // 連続バッジ
                    const consBadge = consecutive > 1
                        ? `<span style="background:#fef3c7; color:#92400e; font-size:0.72em; font-weight:700; padding:1px 6px; border-radius:4px; margin-left:4px;">${consecutive}連</span>`
                        : '';

                    // バッジ：TT と 合同 は独立して表示
                    const ttBadge = isTT
                        ? `<span style="background:#f3e8ff; color:#6b21a8; font-size:0.72em; font-weight:700; padding:1px 6px; border-radius:4px; margin-left:4px;">TT</span>`
                        : '';
                    const jointBadge = displayLessonType === 'joint'
                        ? `<span style="background:#d1fae5; color:#065f46; font-size:0.72em; font-weight:700; padding:1px 6px; border-radius:4px; margin-left:4px;">合同</span>`
                        : '';

                    // 連続コマ選択肢
                    const consOptions = [1,2,3,4].map(n =>
                        `<option value="${n}" ${consecutive === n ? 'selected' : ''}>${n === 1 ? '連続なし' : `${n}コマ連続`}</option>`
                    ).join('');

                    // 授業形態選択肢（TT は独立チェックボックスに分離）
                    const typeOptions = [
                        ['normal', '通常'],
                        ['joint', '合同（複数クラス）']
                    ].map(([v, l]) =>
                        `<option value="${v}" ${displayLessonType === v ? 'selected' : ''}>${l}</option>`
                    ).join('');

                    // 合同クラスチップ
                    const jointChips = displayLessonType === 'joint'
                        ? `<div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:4px; align-items:center;">
                            <span style="font-size:0.72em; color:#9ca3af; flex-shrink:0;">合同:</span>
                            ${jointIds.length > 0
                                ? jointIds.map(jid => {
                                    const jcls = CLASSES.find(c => c.id === jid);
                                    return `<span style="background:#d1fae5; color:#065f46; font-size:0.75em; padding:1px 7px; border-radius:12px; font-weight:500;">${escapeHtml(jcls ? jcls.name : jid)}</span>`;
                                }).join('')
                                : '<span style="color:#f59e0b; font-size:0.78em; font-weight:600;">未選択</span>'
                            }
                            <button class="cc-btn-joint" data-id="${escapeHtml(cc.id)}"
                                style="font-size:0.72em; padding:1px 7px; background:#ecfdf5; color:#059669; border:1px solid #6ee7b7; border-radius:4px; cursor:pointer;">
                                設定
                            </button>
                           </div>`
                        : '';

                    // デフォルト特別教室
                    const defaultRoomIds = cc.defaultRoomIds || [];
                    const allRooms = this.store.specialClassrooms || [];
                    const roomBadges = defaultRoomIds.length > 0
                        ? defaultRoomIds.map(rid => {
                            const r = this.store.getSpecialClassroom(rid);
                            return r ? `<span style="background:#eff6ff; color:#1d4ed8; font-size:0.72em; padding:1px 7px; border-radius:12px; font-weight:500;">${escapeHtml(r.shortName || r.name)}</span>` : '';
                        }).filter(s => s).join('')
                        : `<span style="color:#9ca3af; font-size:0.72em;">なし</span>`;

                    const selectStyle = 'font-size:0.75em; border:1px solid #e5e7eb; border-radius:5px; padding:2px 4px; background:#f9fafb; color:#374151; cursor:pointer; max-width:100%;';

                    return `
                        <div class="cc-card" style="
                            background:#fff;
                            border:1px solid #e5e7eb;
                            border-top:3px solid ${color};
                            border-radius:10px;
                            padding:12px 14px;
                            box-shadow:0 1px 4px rgba(0,0,0,0.06);
                            display:flex;
                            flex-direction:column;
                            gap:7px;
                        ">
                            <!-- 科目名 + 週時間 + バッジ -->
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                                <div style="flex:1; min-width:0;">
                                    <span style="font-weight:700; font-size:0.9em; color:#111827; line-height:1.35;">${escapeHtml(subName)}</span>
                                    ${consBadge}${ttBadge}${jointBadge}
                                </div>
                                <div style="display:flex; align-items:center; gap:2px; background:#f3f4f6; border-radius:8px; padding:3px 8px; flex-shrink:0;">
                                    <input type="number" class="cc-hours-input" data-id="${escapeHtml(cc.id)}"
                                        value="${cc.weeklyHours}" min="1" max="20"
                                        style="width:28px; text-align:center; border:none; background:transparent; font-weight:700; font-size:0.88em; color:#111827; padding:0; outline:none; -moz-appearance:textfield;">
                                    <span style="font-size:0.75em; color:#6b7280; font-weight:500;">時間</span>
                                </div>
                            </div>

                            <!-- 担当教員 -->
                            <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center; min-height:20px;">
                                <span style="font-size:0.73em; color:#9ca3af; margin-right:2px; flex-shrink:0;">担当:</span>
                                ${teacherChips}
                            </div>

                            <!-- 授業形態設定 -->
                            <div style="display:flex; flex-direction:column; gap:4px; padding:6px 0; border-top:1px solid #f3f4f6; border-bottom:1px solid #f3f4f6;">
                                <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                                    <select class="cc-consecutive-select" data-id="${escapeHtml(cc.id)}" style="${selectStyle}">
                                        ${consOptions}
                                    </select>
                                    <select class="cc-lesson-type-select" data-id="${escapeHtml(cc.id)}" style="${selectStyle}">
                                        ${typeOptions}
                                    </select>
                                    <label style="display:flex; align-items:center; gap:3px; font-size:0.75em; color:#6b21a8; cursor:pointer; user-select:none;">
                                        <input type="checkbox" class="cc-tt-check" data-id="${escapeHtml(cc.id)}"
                                            ${isTT ? 'checked' : ''}
                                            style="accent-color:#6b21a8; width:13px; height:13px; cursor:pointer;">
                                        TT
                                    </label>
                                </div>
                                ${jointChips}
                                <!-- デフォルト特別教室 -->
                                ${allRooms.length > 0 ? `
                                <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-top:2px;">
                                    <span style="font-size:0.72em; color:#9ca3af; flex-shrink:0;">教室:</span>
                                    ${roomBadges}
                                    <button class="cc-btn-room" data-id="${escapeHtml(cc.id)}"
                                        style="font-size:0.7em; padding:1px 7px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:4px; cursor:pointer; flex-shrink:0;">
                                        設定
                                    </button>
                                </div>` : ''}
                            </div>

                            <!-- アクションボタン -->
                            <div style="display:flex; gap:5px;">
                                <button class="cc-btn-assign" data-id="${escapeHtml(cc.id)}"
                                    style="flex:1; font-size:0.78em; padding:5px 6px; border-radius:6px; cursor:pointer; font-weight:500; ${assignBtnStyle}">
                                    ${assignBtnLabel}
                                </button>
                                <button class="cc-btn-delete" data-id="${escapeHtml(cc.id)}"
                                    style="font-size:0.78em; padding:5px 10px; background:transparent; color:#9ca3af; border:1px solid #e5e7eb; border-radius:6px; cursor:pointer;">
                                    削除
                                </button>
                            </div>
                        </div>`;
                }).join('');

                return `
                    <div style="margin-bottom:22px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid ${color}20;">
                            <div style="width:10px; height:10px; border-radius:3px; background:${color}; flex-shrink:0;"></div>
                            <span style="font-weight:700; font-size:0.85em; color:#1f2937;">${escapeHtml(catName)}</span>
                            <span style="font-size:0.78em; color:#9ca3af; margin-left:2px;">${items.length}科目・週${catHours}時間</span>
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
                            ${cards}
                        </div>
                    </div>`;
            }).join('');
        }

        // ─── 合計バー ────────────────────────────────────────────────
        const assignBadgeColor = curriculum.length === 0 ? '#6b7280'
            : assignedCount === curriculum.length ? '#16a34a' : '#ef4444';

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                <div>
                    <h4 style="margin:0 0 3px; font-size:1em; font-weight:700; color:#111827;">${escapeHtml(className)} のカリキュラム</h4>
                    <div style="display:flex; align-items:center; gap:10px; font-size:0.8em; flex-wrap:wrap;">
                        <span style="color:#6b7280;">${curriculum.length} 科目</span>
                        <span style="color:#6b7280;">週合計
                            <strong style="color:#111827; font-size:1.05em;">${totalHours}</strong>
                            <span style="font-size:0.9em;">時間</span>
                        </span>
                        <span style="color:${assignBadgeColor}; font-weight:600;">
                            教員設定 ${assignedCount}/${curriculum.length}
                        </span>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button id="cc-btn-bulk" class="btn btn-secondary" style="font-size:0.82em;">
                        📋 ${this.selectedGrade}年一括設定
                    </button>
                    <button id="cc-btn-add" class="btn btn-accent" style="font-size:0.82em;">
                        ＋ 科目を追加
                    </button>
                </div>
            </div>

            <div id="cc-table-body" style="overflow-y:auto;">
                ${cardsHtml}
            </div>
        `;

        // ─── イベント接続 ─────────────────────────────────────────────

        document.getElementById('cc-btn-add')?.addEventListener('click', () => {
            this.openAddDialog(this.selectedClassId);
        });

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
                    this.renderClassList();
                } else {
                    const cc = this.store.classCurriculum.find(c => c.id === id);
                    if (cc) input.value = cc.weeklyHours;
                }
            };
        });

        // 教員設定ボタン
        panel.querySelectorAll('.cc-btn-assign').forEach(btn => {
            btn.onclick = () => {
                const cc = this.store.classCurriculum.find(c => c.id === btn.dataset.id);
                if (!cc) { showToast('カリキュラムデータが見つかりません', 'error'); return; }
                this.openTeacherAssignDialog(cc.classId, cc.subjectId, cc.weeklyHours);
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

        // 連続コマ変更
        panel.querySelectorAll('.cc-consecutive-select').forEach(sel => {
            sel.onchange = () => {
                this.store.updateClassCurriculumOptions(sel.dataset.id, {
                    consecutivePeriods: parseInt(sel.value)
                });
                this.renderCurriculumTable();
            };
        });

        // 授業形態変更（normal / joint の切替）
        panel.querySelectorAll('.cc-lesson-type-select').forEach(sel => {
            sel.onchange = () => {
                const newType = sel.value;
                const cc = this.store.classCurriculum.find(c => c.id === sel.dataset.id);
                if (!cc) return;
                // 合同以外に切り替えたら jointClassIds をリセット
                const jointClassIds = newType === 'joint' ? (cc.jointClassIds || []) : [];
                this.store.updateClassCurriculumOptions(sel.dataset.id, {
                    lessonType: newType,
                    jointClassIds
                });
                this.renderCurriculumTable();
                // 合同に切り替えたら即ダイアログを開く
                if (newType === 'joint') {
                    const updated = this.store.classCurriculum.find(c => c.id === sel.dataset.id);
                    if (updated) this.openJointClassDialog(updated);
                }
                if (newType !== 'normal') {
                    showToast('設定を変更しました。既に配置済みの授業への反映は手動で再配置が必要です。', 'info');
                }
            };
        });

        // TTチェックボックス変更
        panel.querySelectorAll('.cc-tt-check').forEach(cb => {
            cb.onchange = () => {
                const cc = this.store.classCurriculum.find(c => c.id === cb.dataset.id);
                if (!cc) return;
                this.store.updateClassCurriculumOptions(cb.dataset.id, { isTT: cb.checked });
                this.renderCurriculumTable();
                if (cb.checked) {
                    showToast('TT（複数教員）を設定しました。既に配置済みの授業への反映は手動で再配置が必要です。', 'info');
                }
            };
        });

        // 合同クラス設定ボタン
        panel.querySelectorAll('.cc-btn-joint').forEach(btn => {
            btn.onclick = () => {
                const cc = this.store.classCurriculum.find(c => c.id === btn.dataset.id);
                if (cc) this.openJointClassDialog(cc);
            };
        });

        // 特別教室設定ボタン
        panel.querySelectorAll('.cc-btn-room').forEach(btn => {
            btn.onclick = () => {
                const cc = this.store.classCurriculum.find(c => c.id === btn.dataset.id);
                if (cc) this.openRoomSelectDialog(cc);
            };
        });
    }

    // ─── 特別教室選択ダイアログ ──────────────────────────────────────

    openRoomSelectDialog(cc) {
        const cls = CLASSES.find(c => c.id === cc.classId);
        const sub = this.store.getSubject(cc.subjectId);
        const className = cls ? cls.name : cc.classId;
        const subName = sub ? sub.name : '不明';
        const allRooms = this.store.specialClassrooms || [];

        const currentIds = new Set(cc.defaultRoomIds || []);

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const renderContent = () => {
            const items = allRooms.map(r => {
                const checked = currentIds.has(r.id);
                return `
                    <label class="cc-room-row" data-room-id="${escapeHtml(r.id)}"
                        style="display:flex; align-items:center; gap:10px; padding:8px 12px; margin:2px 0;
                               border-radius:7px; cursor:pointer;
                               border:1px solid ${checked ? '#bfdbfe' : '#e5e7eb'};
                               background:${checked ? '#eff6ff' : '#fff'};">
                        <input type="checkbox" ${checked ? 'checked' : ''}
                            style="accent-color:#1d4ed8; width:16px; height:16px; cursor:pointer;">
                        <span style="font-size:0.9em; font-weight:${checked ? '600' : '400'}; color:${checked ? '#1d4ed8' : '#374151'};">
                            ${escapeHtml(r.name)}${r.shortName && r.shortName !== r.name ? `<span style="color:#6b7280; font-size:0.85em; margin-left:5px;">(${escapeHtml(r.shortName)})</span>` : ''}
                        </span>
                    </label>
                `;
            }).join('') || '<p style="color:#aaa; text-align:center; padding:16px;">特別教室が登録されていません</p>';

            overlay.innerHTML = `
                <div class="dialog-content" style="width:360px; max-width:90vw;">
                    <h3 style="margin:0 0 4px; font-size:1em; font-weight:700;">デフォルト特別教室を設定</h3>
                    <p style="margin:0 0 12px; font-size:0.82em; color:#6b7280;">
                        <strong>${escapeHtml(className)}</strong> の「${escapeHtml(subName)}」で使用する教室を選択してください<br>
                        <span style="font-size:0.9em; color:#9ca3af;">授業配置時のデフォルト値になります（個別変更も可能）</span>
                    </p>
                    <div style="border:1px solid #e5e7eb; border-radius:8px; padding:6px; max-height:300px; overflow-y:auto;">
                        ${items}
                    </div>
                    <div style="margin-top:14px; display:flex; justify-content:flex-end; gap:8px;">
                        <button id="cc-room-cancel" class="btn btn-secondary">キャンセル</button>
                        <button id="cc-room-ok" class="btn btn-primary">保存</button>
                    </div>
                </div>
            `;

            overlay.querySelectorAll('.cc-room-row').forEach(row => {
                row.onclick = (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    const cb = row.querySelector('input[type=checkbox]');
                    const rid = row.dataset.roomId;
                    if (cb.checked) {
                        cb.checked = false;
                        currentIds.delete(rid);
                    } else {
                        cb.checked = true;
                        currentIds.add(rid);
                    }
                    renderContent();
                };
                const cb = row.querySelector('input[type=checkbox]');
                cb.onchange = () => {
                    const rid = row.dataset.roomId;
                    if (cb.checked) {
                        currentIds.add(rid);
                    } else {
                        currentIds.delete(rid);
                    }
                    renderContent();
                };
            });

            overlay.querySelector('#cc-room-cancel').onclick = () => overlay.remove();
            overlay.querySelector('#cc-room-ok').onclick = () => {
                this.store.updateClassCurriculumOptions(cc.id, { defaultRoomIds: [...currentIds] });
                overlay.remove();
                this.renderCurriculumTable();
                showToast('特別教室のデフォルト設定を保存しました', 'success');
            };
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        };

        renderContent();
        document.body.appendChild(overlay);
    }

    // ─── 合同クラス選択ダイアログ ────────────────────────────────────

    openJointClassDialog(cc) {
        const cls = CLASSES.find(c => c.id === cc.classId);
        const sub = this.store.getSubject(cc.subjectId);
        const className = cls ? cls.name : cc.classId;
        const subName = sub ? sub.name : '不明';

        if (!cls) {
            showToast(`クラス情報が見つかりません（ID: ${cc.classId}）`, 'error');
            return;
        }

        // 同じ学年の他クラスが候補
        const candidates = CLASSES.filter(c => c.grade === cls.grade && c.id !== cc.classId);
        const currentIds = new Set(cc.jointClassIds || []);
        const MAX_JOINT = 5; // 自クラス含め最大6クラス → 他クラスは最大5

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const render = () => {
            const selectedCount = currentIds.size;
            const atLimit = selectedCount >= MAX_JOINT;

            const items = candidates.map(c => {
                const checked = currentIds.has(c.id);
                // 相手クラスの同科目カリキュラム設定を確認
                const peerCc = this.store.classCurriculum.find(x => x.classId === c.id && x.subjectId === cc.subjectId);
                const peerHasCurriculum = !!peerCc;
                // 双方向リンク確認: 相手も自クラスを jointClassIds に含んでいるか
                const peerLinksBack = peerCc && (peerCc.jointClassIds || []).includes(cc.classId);
                // 双方向リンク済み = 自→相手 かつ 相手→自 の両方が成立
                const fullyLinked = checked && peerLinksBack;
                // 片側リンク = 自→相手 または 相手→自 の一方のみ
                const oneWayLinked = (checked && !peerLinksBack) || (!checked && peerLinksBack);

                const statusBadge = (() => {
                    if (!peerHasCurriculum) return '<span style="margin-left:auto; font-size:0.72em; color:#ef4444; background:#fef2f2; padding:1px 6px; border-radius:4px;">科目未設定</span>';
                    if (fullyLinked) return '<span style="margin-left:auto; font-size:0.72em; color:#059669; font-weight:600; background:#ecfdf5; padding:1px 6px; border-radius:4px;">合同リンク済</span>';
                    if (oneWayLinked) return '<span style="margin-left:auto; font-size:0.72em; color:#d97706; background:#fffbeb; padding:1px 6px; border-radius:4px;">片側リンク中</span>';
                    return '';
                })();

                // 科目未設定クラスは選択不可（already-checked なら解除のため許可）
                const disabledByLimit = !checked && atLimit;
                const disabledByNoCurriculum = !checked && !peerHasCurriculum;
                const disabled = disabledByLimit || disabledByNoCurriculum;

                const bgColor = checked ? '#ecfdf5' : disabled ? '#f9fafb' : '#fff';
                const borderColor = checked ? '#6ee7b7' : disabledByNoCurriculum ? '#fca5a5' : '#e5e7eb';
                const cursor = disabled ? 'not-allowed' : 'pointer';
                return `
                    <label class="cc-joint-row" data-class-id="${escapeHtml(c.id)}"
                        style="display:flex; align-items:center; gap:10px; padding:8px 12px; margin:2px 0;
                               border-radius:7px; cursor:${cursor};
                               border:1px solid ${borderColor};
                               background:${bgColor};
                               opacity:${disabled ? '0.5' : '1'};">
                        <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}
                            style="accent-color:#059669; width:16px; height:16px; cursor:${cursor};">
                        <span style="font-size:0.9em; font-weight:${checked ? '600' : '400'}; color:${checked ? '#065f46' : '#374151'};">${escapeHtml(c.name)}</span>
                        ${statusBadge}
                    </label>
                `;
            }).join('') || '<p style="color:#aaa; text-align:center; padding:16px;">同学年の他クラスがありません</p>';

            const limitMsg = atLimit
                ? `<p style="margin:8px 0 0; font-size:0.78em; color:#ef4444; text-align:right;">最大${MAX_JOINT}クラス（自クラス含め6クラス）まで選択可能です</p>`
                : '';

            overlay.innerHTML = `
                <div class="dialog-content" style="width:360px; max-width:90vw;">
                    <h3 style="margin:0 0 4px; font-size:1em; font-weight:700;">合同クラスを選択</h3>
                    <p style="margin:0 0 4px; font-size:0.82em; color:#6b7280;">
                        <strong>${escapeHtml(className)}</strong> の「${escapeHtml(subName)}」に合同参加するクラスを選んでください
                    </p>
                    <p style="margin:0 0 12px; font-size:0.78em; color:#9ca3af;">
                        選択すると相手クラスの同科目カリキュラムにも自動でリンクされます
                    </p>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-size:0.78em; color:#6b7280;">選択中: <strong>${selectedCount}</strong> クラス（自クラス含め <strong>${selectedCount + 1}</strong> / 6）</span>
                    </div>
                    <div style="border:1px solid #e5e7eb; border-radius:8px; padding:6px; max-height:280px; overflow-y:auto;">
                        ${items}
                    </div>
                    ${limitMsg}
                    <div style="margin-top:14px; display:flex; justify-content:flex-end; gap:8px;">
                        <button id="cc-joint-cancel" class="btn btn-secondary">キャンセル</button>
                        <button id="cc-joint-ok" class="btn btn-primary">保存してリンク</button>
                    </div>
                </div>
            `;

            overlay.querySelectorAll('.cc-joint-row').forEach(row => {
                row.onclick = (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    const cb = row.querySelector('input[type=checkbox]');
                    if (cb.disabled) return;
                    const cid = row.dataset.classId;
                    if (cb.checked) {
                        cb.checked = false;
                        currentIds.delete(cid);
                    } else {
                        if (currentIds.size >= MAX_JOINT) return;
                        cb.checked = true;
                        currentIds.add(cid);
                    }
                    render();
                };
                const cb = row.querySelector('input[type=checkbox]');
                cb.onchange = () => {
                    const cid = row.dataset.classId;
                    if (cb.checked) {
                        if (currentIds.size >= MAX_JOINT) { cb.checked = false; return; }
                        currentIds.add(cid);
                    } else {
                        currentIds.delete(cid);
                    }
                    render();
                };
            });

            overlay.querySelector('#cc-joint-cancel').onclick = () => overlay.remove();
            overlay.querySelector('#cc-joint-ok').onclick = () => {
                this.store.updateClassCurriculumOptions(cc.id, {
                    jointClassIds: [...currentIds]
                });
                overlay.remove();
                this.renderCurriculumTable();
                const count = currentIds.size;
                showToast(count > 0
                    ? `合同グループを設定しました（${count + 1}クラス・双方向リンク済）`
                    : '合同設定を解除しました', 'success');
            };
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        };

        render();
        document.body.appendChild(overlay);
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

                    // 担当者数に応じて isTT を自動切替
                    const cc = this.store.classCurriculum.find(c => c.classId === classId && c.subjectId === subjectId);
                    if (cc) {
                        const teacherCount = currentTeacherIds.size;
                        const currentIsTT = cc.isTT === true || cc.lessonType === 'tt';
                        if (teacherCount >= 2 && !currentIsTT) {
                            // 2人以上 → 自動的にTT設定（lessonType は変えない）
                            this.store.updateClassCurriculumOptions(cc.id, { isTT: true });
                            showToast(`担当が${teacherCount}名になりました。TT（複数教員）に自動設定しました`, 'info');
                        } else if (teacherCount <= 1 && currentIsTT) {
                            // 1人以下に戻ったらTTを解除
                            this.store.updateClassCurriculumOptions(cc.id, { isTT: false });
                        }
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
