class LessonManager {
    constructor(store, ui) {
        this.store = store;
        this.ui = ui;
        this.selectedSlot = null; // { classId, day, period }
    }

    openOverviewAddModal(day, period, teacherId) {
        const modal = document.getElementById('modal-lesson-select');
        const infoContainer = document.getElementById('lesson-select-info');
        const listContainer = document.getElementById('lesson-select-list');
        const btnDelete = document.getElementById('btn-clear-lesson');

        this.selectedSlot = { classId: null, day, period };

        if (btnDelete) btnDelete.classList.add('hidden');

        const teacher = this.store.getTeacher(teacherId);

        // 現在配置されている授業を取得（TT含む）
        const teacherSlots = this.store.getTeacherTimetable(teacherId);
        const key = `${day}-${period}`;
        const currentSlots = teacherSlots[key] || [];

        // 特別教室選択用UI（複数選択可能）
        const rooms = this.store.specialClassrooms || [];

        // 現在配置されている授業から特別教室情報を取得
        let currentRoomIds = [];
        if (currentSlots.length > 0) {
            const slot = currentSlots[0];
            if (slot.specialClassroomIds && Array.isArray(slot.specialClassroomIds)) {
                currentRoomIds = slot.specialClassroomIds;
            } else if (slot.specialClassroomId) {
                currentRoomIds = [slot.specialClassroomId];
            }
        }

        const roomCheckboxesHtml = rooms.map(r => `
            <label style="display: inline-block; margin-right: 10px; cursor: pointer;">
                <input type="checkbox" class="room-checkbox" value="${escapeHtml(r.id)}" ${currentRoomIds.includes(r.id) ? 'checked' : ''}>
                ${escapeHtml(r.name)}
            </label>
        `).join('');

        // 教室が選択済みの場合は展開状態にする
        const hasRoomSelected = currentRoomIds.length > 0;
        const roomSelectHtml = `
            <div style="margin-top: 5px; margin-bottom: 5px;">
                <div id="room-accordion-toggle" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-size: 0.9em; color: #555; user-select: none;">
                    <span id="room-accordion-arrow" style="font-size: 0.8em;">${hasRoomSelected ? '▼' : '▶'}</span>
                    <span>使用教室${hasRoomSelected ? `（${currentRoomIds.length}件選択中）` : ''}</span>
                </div>
                <div id="room-accordion-body" style="display: ${hasRoomSelected ? 'block' : 'none'}; margin-top: 4px; padding: 6px 8px; background: #f8f8f8; border-radius: 4px;">
                    ${rooms.length > 0 ? roomCheckboxesHtml : '<span style="color: #999;">(教室未登録)</span>'}
                </div>
            </div>
        `;

        infoContainer.innerHTML = `<div><strong>${escapeHtml(teacher?.name)}</strong> - ${DAYS[day]}曜 ${period + 1}限に授業を追加</div>` + roomSelectHtml;

        // アコーディオンのトグル処理
        const toggle = document.getElementById('room-accordion-toggle');
        if (toggle) {
            toggle.onclick = () => {
                const body = document.getElementById('room-accordion-body');
                const arrow = document.getElementById('room-accordion-arrow');
                const isOpen = body.style.display !== 'none';
                body.style.display = isOpen ? 'none' : 'block';
                arrow.textContent = isOpen ? '▶' : '▼';
            };
        }

        // クラス別カリキュラムに登録済みの授業のみ表示
        const allAssignments = this.store.getTeacherAssignments(teacherId);
        const assignments = allAssignments.filter(a =>
            this.store.classCurriculum.some(cc => cc.classId === a.classId && cc.subjectId === a.subjectId)
        );

        if (assignments.length === 0) {
            listContainer.innerHTML = '<p class="placeholder-text">担当授業がありません</p>';
        } else {
            // 科目名 → クラス名（1-1〜3-6順）でソート
            const sortedAssignments = [...assignments].sort((a, b) => {
                const subA = this.store.getSubject(a.subjectId)?.name || '';
                const subB = this.store.getSubject(b.subjectId)?.name || '';
                if (subA !== subB) return subA.localeCompare(subB, 'ja');
                const clsA = CLASSES.find(c => c.id === a.classId);
                const clsB = CLASSES.find(c => c.id === b.classId);
                const gradeA = clsA?.grade ?? 99;
                const gradeB = clsB?.grade ?? 99;
                if (gradeA !== gradeB) return gradeA - gradeB;
                return (clsA?.name || '').localeCompare(clsB?.name || '', 'ja');
            });
            const checkboxListHtml = sortedAssignments.map(lesson => {
                const subject = this.store.getSubject(lesson.subjectId);
                const className = CLASSES.find(c => c.id === lesson.classId)?.name || lesson.classId;

                const placedCount = this.store.countPlacedHours(teacherId, lesson.subjectId, lesson.classId);
                const totalHours = lesson.weeklyHours;
                const remaining = totalHours - placedCount;
                const isCompleted = remaining <= 0;
                let hoursText = `残${remaining}/${totalHours}`;
                if (remaining <= 0) hoursText = `✓${hoursText}`;

                // この授業が現在のスロットに配置されているかチェック（クラスIDも含める）
                const isPlaced = currentSlots.some(slot =>
                    slot.subjectId === lesson.subjectId &&
                    slot.teacherIds.includes(teacherId) &&
                    slot.classId === lesson.classId
                );
                const placedBadge = isPlaced ? ' <span style="color: #4CAF50; font-size: 0.8em;">[TT]</span>' : '';

                return `
                    <label class="lesson-checkbox-item ${isCompleted ? 'completed' : ''}" style="display: block; padding: 8px; margin: 4px 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: ${isPlaced ? '#f0f8f0' : 'white'};">
                        <input type="checkbox" class="lesson-checkbox" 
                               data-class-id="${lesson.classId}"
                               data-subject-id="${lesson.subjectId}"
                               ${isPlaced ? 'checked' : ''}
                               style="margin-right: 8px;">
                        <span class="lesson-subject" style="font-weight: 500;">${escapeHtml(subject?.shortName || subject?.name || lesson.subjectId)}</span>
                        <span class="lesson-class" style="margin-left: 8px; color: #666;">${escapeHtml(className)}</span>${placedBadge}
                        <span class="lesson-hours ${isCompleted ? 'done' : ''}" style="float: right; font-size: 0.9em;">
                            ${hoursText}
                        </span>
                    </label>
                `;
            }).join('');

            listContainer.innerHTML = `
                <div style="max-height: 300px; overflow-y: auto; margin-bottom: 10px;">
                    ${checkboxListHtml}
                </div>
                <div style="text-align: right; padding-top: 10px; border-top: 1px solid #ddd;">
                    <button id="btn-register-lessons" class="btn btn-primary">登録</button>
                </div>
            `;
        }

        // 授業チェックボックス変更時：初めてチェックをつけた授業のデフォルト教室を反映
        const applyDefaultRooms = () => {
            // 既にスロットが配置済みなら変更しない
            if (currentSlots.length > 0) return;
            const checkedBoxes = Array.from(document.querySelectorAll('.lesson-checkbox:checked'));
            if (checkedBoxes.length === 0) return;
            // 最初にチェックされた授業のデフォルト教室を取得
            const first = checkedBoxes[0];
            const ccEntry = this.store.classCurriculum.find(
                c => c.classId === first.dataset.classId && c.subjectId === first.dataset.subjectId
            );
            if (!ccEntry || !ccEntry.defaultRoomIds || ccEntry.defaultRoomIds.length === 0) return;
            // 教室チェックボックスにデフォルト値を反映（まだ何も選択されていない場合のみ）
            const roomCheckboxes = Array.from(document.querySelectorAll('.room-checkbox:checked'));
            if (roomCheckboxes.length === 0) {
                ccEntry.defaultRoomIds.forEach(rid => {
                    const cb = document.querySelector(`.room-checkbox[value="${rid}"]`);
                    if (cb) cb.checked = true;
                });
                // アコーディオンを開く
                const body = document.getElementById('room-accordion-body');
                const arrow = document.getElementById('room-accordion-arrow');
                if (body) body.style.display = 'block';
                if (arrow) arrow.textContent = '▼';
            }
        };

        // 登録ボタンのイベント
        const registerBtn = document.getElementById('btn-register-lessons');
        if (registerBtn) {
            registerBtn.onclick = () => {
                const selectedCheckboxes = Array.from(document.querySelectorAll('.lesson-checkbox:checked'));
                // チェックが0件でもregisterMultipleLessonsを呼び出してチェック外れた授業を削除する
                this.registerMultipleLessons(teacherId, day, period, selectedCheckboxes);
            };
        }

        // 授業チェックボックスにchangeイベントを追加
        listContainer.querySelectorAll('.lesson-checkbox').forEach(cb => {
            cb.addEventListener('change', applyDefaultRooms);
        });

        modal.querySelector('.modal-close').onclick = () => this.close();
        modal.classList.remove('hidden');
    }

    openOverviewLessonModal(classId, day, period, teacherId) {
        const modal = document.getElementById('modal-lesson-select');
        const infoContainer = document.getElementById('lesson-select-info');
        const listContainer = document.getElementById('lesson-select-list');
        const btnDelete = document.getElementById('btn-clear-lesson');

        this.selectedSlot = { classId, day, period };

        const teacher = this.store.getTeacher(teacherId);
        const className = CLASSES.find(c => c.id === classId)?.name || classId;
        const currentSlot = this.store.getSlot(classId, day, period);

        // 削除ボタン表示（既存授業がある場合のみ）
        if (btnDelete) {
            if (currentSlot && currentSlot.length > 0) {
                btnDelete.classList.remove('hidden');
            } else {
                btnDelete.classList.add('hidden');
            }
        }

        // 現在の授業情報から使用教室を取得（新形式: specialClassroomIds, 旧形式: specialClassroomId）
        let currentRoomIds = [];
        if (currentSlot && currentSlot.length > 0) {
            const slot = currentSlot[0];
            if (slot.specialClassroomIds && Array.isArray(slot.specialClassroomIds)) {
                currentRoomIds = slot.specialClassroomIds;
            } else if (slot.specialClassroomId) {
                currentRoomIds = [slot.specialClassroomId];
            }
        }
        // スロットに教室未設定の場合、カリキュラムのデフォルト教室を使用
        if (currentRoomIds.length === 0) {
            const ccEntry = this.store.classCurriculum.find(c => c.classId === classId && c.subjectId ===
                (currentSlot && currentSlot.length > 0 ? currentSlot[0].subjectId : null));
            if (ccEntry && ccEntry.defaultRoomIds && ccEntry.defaultRoomIds.length > 0) {
                currentRoomIds = ccEntry.defaultRoomIds;
            }
        }

        // 特別教室選択用UI（複数選択可能）
        const rooms = this.store.specialClassrooms || [];
        const roomCheckboxesHtml = rooms.map(r => `
            <label style="display: inline-block; margin-right: 10px; cursor: pointer;">
                <input type="checkbox" class="room-checkbox" value="${escapeHtml(r.id)}" ${currentRoomIds.includes(r.id) ? 'checked' : ''}>
                ${escapeHtml(r.name)}
            </label>
        `).join('');

        const roomSelectHtml = `
            <div style="margin-top: 5px; margin-bottom: 5px;">
                <label style="font-size: 0.9em; color: #666;">使用教室: </label>
                <div id="room-checkboxes" style="display: inline-block;">
                    ${rooms.length > 0 ? roomCheckboxesHtml : '<span style="color: #999;">(教室未登録)</span>'}
                </div>

            </div>
        `;

        infoContainer.innerHTML = `<div><strong>${escapeHtml(teacher?.name)}</strong> - ${DAYS[day]}曜 ${period + 1}限 - ${escapeHtml(className)}</div>` + roomSelectHtml;

        // クラス別カリキュラムに登録済みの授業のみ表示
        const allAssignments = this.store.getTeacherAssignments(teacherId);
        const assignments = allAssignments.filter(a =>
            this.store.classCurriculum.some(cc => cc.classId === a.classId && cc.subjectId === a.subjectId)
        );

        // 現在配置されている授業を取得（TT含む）
        const teacherSlots = this.store.getTeacherTimetable(teacherId);
        const key = `${day}-${period}`;
        const currentTeacherSlots = teacherSlots[key] || [];

        if (assignments.length === 0) {
            listContainer.innerHTML = '<p class="placeholder-text">担当授業がありません</p>';
        } else {
            const checkboxListHtml = assignments.map(lesson => {
                const subject = this.store.getSubject(lesson.subjectId);
                const clsName = CLASSES.find(c => c.id === lesson.classId)?.name || lesson.classId;

                const placedCount = this.store.countPlacedHours(teacherId, lesson.subjectId, lesson.classId);
                const totalHours = lesson.weeklyHours;
                const remaining = totalHours - placedCount;
                const isCompleted = remaining <= 0;
                let hoursText = `残${remaining}/${totalHours}`;
                if (remaining <= 0) hoursText = `✓${hoursText}`;

                // この授業が現在のスロットに配置されているかチェック（クラスIDも含める）
                const isPlaced = currentTeacherSlots.some(slot =>
                    slot.subjectId === lesson.subjectId &&
                    slot.teacherIds.includes(teacherId) &&
                    slot.classId === lesson.classId
                );
                const placedBadge = isPlaced ? ' <span style="color: #4CAF50; font-size: 0.8em;">[TT]</span>' : '';

                return `
                    <label class="lesson-checkbox-item ${isCompleted ? 'completed' : ''}" style="display: block; padding: 8px; margin: 4px 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: ${isPlaced ? '#f0f8f0' : 'white'};">
                        <input type="checkbox" class="lesson-checkbox" 
                               data-class-id="${lesson.classId}"
                               data-subject-id="${lesson.subjectId}"
                               ${isPlaced ? 'checked' : ''}
                               style="margin-right: 8px;">
                        <span class="lesson-subject" style="font-weight: 500;">${escapeHtml(subject?.shortName || subject?.name || lesson.subjectId)}</span>
                        <span class="lesson-class" style="margin-left: 8px; color: #666;">${escapeHtml(clsName)}</span>${placedBadge}
                        <span class="lesson-hours ${isCompleted ? 'done' : ''}" style="float: right; font-size: 0.9em;">
                            ${hoursText}
                        </span>
                    </label>
                `;
            }).join('');

            // 既存授業があるかチェック
            const hasExisting = currentTeacherSlots.length > 0;

            listContainer.innerHTML = `
                <div style="max-height: 300px; overflow-y: auto; margin-bottom: 10px;">
                    ${checkboxListHtml}
                </div>
                <div style="display: flex; justify-content: space-between; gap: 8px; padding-top: 10px; border-top: 1px solid #ddd;">
                    <div style="display: flex; gap: 8px;">
                        <button id="btn-delete-lesson" class="btn btn-danger" style="${hasExisting ? '' : 'visibility: hidden;'}">
                            <span class="btn-icon">🗑️</span>この授業を削除
                        </button>
                        <button id="btn-move-to-parking" class="btn btn-warning" style="${hasExisting ? '' : 'visibility: hidden;'}">
                            <span class="btn-icon">🅿️</span>パーキングへ移動
                        </button>
                    </div>
                    <button id="btn-register-lessons" class="btn btn-primary">登録</button>
                </div>
            `;
        }

        // 削除ボタンのイベント
        const deleteBtn = document.getElementById('btn-delete-lesson');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                if (confirm('この時限の授業を削除しますか？')) {
                    // 同一時限・同一教員のすべてのクラスのスロットを削除
                    const teacherSlots = this.store.getTeacherTimetable(teacherId);
                    const key = `${day}-${period}`;
                    const slotsAtPeriod = teacherSlots[key] || [];
                    if (slotsAtPeriod.length > 0) {
                        slotsAtPeriod.forEach(slot => this.store.clearSlot(slot.classId, day, period));
                    } else {
                        this.store.clearSlot(classId, day, period);
                    }
                    this.close();
                    this.ui.renderMainOverview();
                    this.ui.checkConflicts();
                    showToast('授業を削除しました', 'success');
                }
            };
        }

        // パーキングへ移動ボタンのイベント
        const parkingBtn = document.getElementById('btn-move-to-parking');
        if (parkingBtn) {
            parkingBtn.onclick = () => {
                // 現在の授業の教員IDを取得
                const slots = this.store.getSlot(classId, day, period);
                if (!slots || slots.length === 0 || !slots[0].teacherIds || slots[0].teacherIds.length === 0) {
                    showToast('教員が設定されていません', 'error');
                    return;
                }

                // 最初の教員IDを使用（複数教員の場合は最初の教員のパーキングエリアに移動）
                const teacherId = slots[0].teacherIds[0];

                const result = this.store.moveToParking(teacherId, classId, day, period);
                if (result.success) {
                    this.close();
                    this.ui.renderMainOverview();
                    this.ui.parkingArea.render();
                    showToast('パーキングエリアに移動しました', 'success');
                } else {
                    showToast(result.message || 'パーキングへの移動に失敗しました', 'error');
                }
            };
        }

        // 登録ボタンのイベント
        const registerBtn = document.getElementById('btn-register-lessons');
        if (registerBtn) {
            registerBtn.onclick = () => {
                const selectedCheckboxes = Array.from(document.querySelectorAll('.lesson-checkbox:checked'));

                // 何も選択されていない場合は授業を削除
                if (selectedCheckboxes.length === 0) {
                    this.store.clearSlot(classId, day, period);
                    this.close();
                    this.ui.renderMainOverview();
                    this.ui.checkConflicts();
                    showToast('授業を削除しました', 'success');
                    return;
                }

                // 選択された授業を配置
                this.registerMultipleLessons(teacherId, day, period, selectedCheckboxes);
            };
        }

        modal.querySelector('.modal-close').onclick = () => this.close();
        modal.classList.remove('hidden');
    }

    assignLesson(teacherId, subjectId, overrideClassId = null) {
        if (!this.selectedSlot && !overrideClassId) return;

        const classId = overrideClassId || this.selectedSlot.classId;
        const { day, period } = this.selectedSlot;

        if (classId === 'non-class-duty') {
            const teacherTimetable = this.store.getTeacherTimetable(teacherId);
            const key = `${day}-${period}`;
            const slots = teacherTimetable[key] || [];
            if (slots.length > 0) {
                if (!confirm('この時間帯には既に予定が入っています。上書き（または追加）しますか？')) {
                    return;
                }
            }
            this.store.snapshot();
            this.ui.updateUndoRedoButtons();

            // 特別教室IDs取得（チェックボックスから）
            const selectedRooms = Array.from(document.querySelectorAll('.room-checkbox:checked')).map(cb => cb.value);
            const specialClassroomIds = selectedRooms.length > 0 ? selectedRooms : null;

            this.store.setSlot(classId, day, period, subjectId, [teacherId], specialClassroomIds, false);
            showToast('業務を追加しました', 'success');
            this.close();
            this.ui.renderMainOverview();
            this.ui.checkConflicts();
            return;
        }

        const conflictClasses = [];
        CLASSES.forEach(cls => {
            if (cls.id !== classId) {
                const otherSlots = this.store.getSlot(cls.id, day, period);
                otherSlots.forEach(slot => {
                    if (slot.teacherIds && slot.teacherIds.includes(teacherId)) {
                        conflictClasses.push(cls.name);
                    }
                });
            }
        });

        if (conflictClasses.length > 0) {
            const teacher = this.store.getTeacher(teacherId);
            const dayName = DAYS[day];
            if (!confirm(`${teacher?.name}は${dayName}${period + 1}限に「${conflictClasses.join('、')}」と重複しますが、よろしいですか？`)) {
                return;
            }
        }

        const existingSlots = this.store.getSlot(classId, day, period);
        const currentSlot = existingSlots.length > 0 ? existingSlots[0] : null; // Checking primary slot
        // logic from ui.js has complex TT handling... duplicating simplified version here.
        // The original logic checks if same subject => confirm TT.

        // Simulating the original logic:
        let teacherIds = [teacherId];

        if (currentSlot && currentSlot.subjectId === subjectId) {
            if (currentSlot.teacherIds.includes(teacherId)) {
                // already there
                teacherIds = currentSlot.teacherIds;
            } else {
                if (confirm('同じ科目が登録されています。担当教員を追加してTT（チームティーチング）にしますか？')) {
                    teacherIds = [...currentSlot.teacherIds, teacherId];
                } else {
                    if (!confirm('上書き（担当教員を変更）しますか？')) return;
                }
            }
        } else if (currentSlot) {
            const currentSubject = this.store.getSubject(currentSlot.subjectId);
            const currentSubjectName = currentSubject ? currentSubject.name : '不明な科目';

            const currentTeacherNames = currentSlot.teacherIds.map(tid => {
                const t = this.store.getTeacher(tid);
                return t ? t.name : '不明';
            }).join('・');

            const cls = CLASSES.find(c => c.id === classId);
            const className = cls ? cls.name : '不明';
            const dayName = DAYS[day];
            const periodNum = period + 1;

            const message = `【上書き確認】\n\n` +
                `既存の授業:\n` +
                `  クラス: ${className}\n` +
                `  時限: ${dayName}${periodNum}\n` +
                `  科目: ${currentSubjectName}\n` +
                `  担当: ${currentTeacherNames}\n\n` +
                `この授業を上書き登録しますか？`;

            if (!confirm(message)) return;
        }

        // 特別教室IDs取得（チェックボックスから）
        const selectedRooms = Array.from(document.querySelectorAll('.room-checkbox:checked')).map(cb => cb.value);
        const specialClassroomIds = selectedRooms.length > 0 ? selectedRooms : null;

        // まず dryRun で衝突チェック（連続コマ・合同クラスが全部空きか確認）
        const check = this.store.placeWithConstraints(classId, day, period, subjectId, teacherIds, specialClassroomIds, { dryRun: true });

        let forcePartial = false;
        if (check.blocked.length > 0) {
            // 衝突しているコマをダイアログで確認
            const lines = check.blocked.map(b => {
                const cls = CLASSES.find(c => c.id === b.classId);
                const clsName = cls ? cls.name : b.classId;
                return `  ${clsName} ${DAYS[b.day]}${b.period + 1}限: ${b.reason}`;
            }).join('\n');
            const msg = `以下のコマに既存の授業があるため、すべての配置ができません:\n\n${lines}\n\n空いているコマのみ配置しますか？（既存の授業は変更されません）`;
            if (!confirm(msg)) return; // キャンセル → 何も置かない
            forcePartial = true;
        }

        // TT設定の場合、自動追加されるTT教員が既に別授業を持っていれば確認を取る
        let skipTT = false;
        if (check.ttConflicts && check.ttConflicts.length > 0) {
            const lines = check.ttConflicts.map(c => {
                return `  ${c.teacherName} ${DAYS[c.day]}${c.period + 1}限: ${c.reason}`;
            }).join('\n');
            const msg = `TT（チームティーチング）設定の教員が以下の時間帯に授業を担当しています:\n\n${lines}\n\n該当教員の時間割には配置しません。主担当のみで配置しますか？`;
            if (!confirm(msg)) return; // キャンセル → 何も置かない
            // 競合していない TT 教員のみ teacherIds に追加し、skipTT=true で再解決を防ぐ
            const conflictTeacherIds = new Set(check.ttConflicts.map(c => c.teacherId));
            const allTtTeachers = this.store.assignments
                .filter(a => a.classId === classId && a.subjectId === subjectId)
                .map(a => a.teacherId);
            teacherIds = [...new Set([...teacherIds, ...allTtTeachers.filter(tid => !conflictTeacherIds.has(tid))])];
            skipTT = true;
        }

        // ★ すべてのユーザー確認が終わった後に snapshot を呼ぶ
        this.store.snapshot();
        this.ui.updateUndoRedoButtons();

        const result = this.store.placeWithConstraints(classId, day, period, subjectId, teacherIds, specialClassroomIds, { forcePartial, skipTT });

        this.close();
        this.ui.renderMainOverview();
        this.ui.checkConflicts();

        // トーストメッセージをカリキュラム設定に合わせて組み立て
        const extras = [];
        if (result.consecutive > 1) extras.push(`${result.consecutive}コマ連続`);
        if (result.lessonType === 'tt' && result.allClassIds.length === 1) extras.push('TT');
        if (result.allClassIds.length > 1) extras.push(`${result.allClassIds.length}クラス合同`);
        const extraStr = extras.length > 0 ? `（${extras.join('・')}）` : '';
        const blockedStr = result.blocked.length > 0 ? `、${result.blocked.length}コマはスキップ` : '';
        showToast(`授業を配置しました${extraStr}${blockedStr}`, result.blocked.length > 0 ? 'warning' : 'success');
    }

    /**
     * TT設定の科目に対して assignments から全担当教員を解決して返す。
     * TT設定でない場合はそのまま teacherIds を返す。
     */
    _resolveTtTeacherIds(classId, subjectId, teacherIds) {
        const cc = this.store.classCurriculum.find(c => c.classId === classId && c.subjectId === subjectId);
        // isTT フラグ優先、後方互換で lessonType === 'tt' も認識
        const isTT = cc && (cc.isTT === true || cc.lessonType === 'tt');
        if (!isTT) return teacherIds;
        const ttTeachers = this.store.assignments
            .filter(a => a.classId === classId && a.subjectId === subjectId)
            .map(a => a.teacherId);
        return [...new Set([...teacherIds, ...ttTeachers])];
    }

    /**
     * 連続コマ設定に従い後続スロットにも授業を展開する（append モード専用）
     * 主スロットは呼び出し元で配置済みであることが前提。
     * TT設定の科目は assignments から全担当教員を解決して配置する。
     */
    _expandConsecutive(classId, day, period, subjectId, teacherIds, specialClassroomIds) {
        const cc = this.store.classCurriculum.find(c => c.classId === classId && c.subjectId === subjectId);
        const consecutive = cc ? (cc.consecutivePeriods || 1) : 1;
        if (consecutive <= 1) return;

        // TT設定なら全担当教員を解決
        const resolvedTeacherIds = this._resolveTtTeacherIds(classId, subjectId, teacherIds);

        for (let p = period + 1; p < period + consecutive && p < PERIODS; p++) {
            const existing = this.store.getSlot(classId, day, p);
            if (existing.length === 0) {
                this.store.setSlot(classId, day, p, subjectId, resolvedTeacherIds, specialClassroomIds);
            }
        }
    }

    registerMultipleLessons(teacherId, day, period, selectedCheckboxes) {
        // 特別教室IDs取得
        const selectedRooms = Array.from(document.querySelectorAll('.room-checkbox:checked')).map(cb => cb.value);
        const specialClassroomIds = selectedRooms.length > 0 ? selectedRooms : null;

        // 現在配置されている授業を取得
        const teacherSlots = this.store.getTeacherTimetable(teacherId);
        const key = `${day}-${period}`;
        const currentSlots = teacherSlots[key] || [];

        // 選択された授業のリスト（classId + subjectId）
        const selectedLessons = selectedCheckboxes.map(cb => ({
            classId: cb.dataset.classId,
            subjectId: cb.dataset.subjectId
        }));

        // 削除前のスロット状態を記録（競合チェックに使用）
        const preDeleteSnapshot = {};
        const affectedClassIds = new Set([
            ...currentSlots.map(s => s.classId),
            ...selectedLessons.map(l => l.classId)
        ]);
        affectedClassIds.forEach(cid => {
            preDeleteSnapshot[cid] = [...this.store.getSlot(cid, day, period)];
        });

        // 学年違い合同授業の警告チェック（操作前に確認を取る）
        if (selectedLessons.length > 1) {
            const grades = new Set();
            selectedLessons.forEach(lesson => {
                const cls = CLASSES.find(c => c.id === lesson.classId);
                if (cls && cls.name) {
                    const match = cls.name.match(/^(\d)/);
                    if (match) grades.add(match[1]);
                }
            });

            if (grades.size > 1) {
                const gradesArray = Array.from(grades).sort();
                const gradeNames = gradesArray.map(g => `${g}年生`).join('、');
                const message = `【学年違いの合同授業の確認】\n\n` +
                    `選択されたクラスに異なる学年（${gradeNames}）が含まれています。\n\n` +
                    `通常、学年が異なるクラスでの合同授業は行われません。\n` +
                    `このまま合同授業を作成しますか？`;

                if (!confirm(message)) return; // キャンセル
            }
        }

        // ★ 全ての確認ダイアログを終えた後に Undo 用スナップショットを保存
        this.store.snapshot();
        this.ui.updateUndoRedoButtons();

        // チェックが外された授業を削除
        currentSlots.forEach(slot => {
            if (slot.teacherIds.includes(teacherId)) {
                const isStillSelected = selectedLessons.some(lesson =>
                    lesson.classId === slot.classId &&
                    lesson.subjectId === slot.subjectId
                );

                if (!isStillSelected) {
                    // この授業のチェックが外されたので、削除処理
                    const newTeacherIds = slot.teacherIds.filter(tid => tid !== teacherId);

                    if (newTeacherIds.length === 0) {
                        // 教員が誰もいなくなったら授業自体を削除
                        this.store.clearSlot(slot.classId, day, period);
                    } else {
                        // TT（複数教員）の場合、確認ダイアログを表示
                        const subject = this.store.getSubject(slot.subjectId);
                        const subjectName = subject ? subject.name : '不明な科目';
                        const cls = CLASSES.find(c => c.id === slot.classId);
                        const className = cls ? cls.name : '不明';
                        const dayName = DAYS[day];
                        const periodNum = period + 1;

                        const allTeacherNames = slot.teacherIds.map(tid => {
                            const t = this.store.getTeacher(tid);
                            return t ? t.name : '不明';
                        }).join('・');

                        const currentTeacher = this.store.getTeacher(teacherId);
                        const currentTeacherName = currentTeacher ? currentTeacher.name : '不明';

                        const message = `【TT（複数教員）の削除確認】\n\n` +
                            `クラス: ${className}\n` +
                            `時限: ${dayName}${periodNum}\n` +
                            `科目: ${subjectName}\n` +
                            `担当: ${allTeacherNames}\n\n` +
                            `削除する範囲を選択してください:\n` +
                            `OK: ${currentTeacherName}のみ削除\n` +
                            `キャンセル: 削除しない`;

                        if (!confirm(message)) {
                            return; // キャンセル - 削除しない
                        }

                        // この教員のみを削除（既存の特別教室情報を保持）
                        const existingRoomIds = slot.specialClassroomIds || (slot.specialClassroomId ? [slot.specialClassroomId] : null);
                        this.store.setSlot(slot.classId, day, period, slot.subjectId, newTeacherIds, existingRoomIds);
                    }
                }
            }
        });

        // 選択された授業を配置（TT処理）
        let registeredCount = 0;

        for (const checkbox of selectedCheckboxes) {
            const classId = checkbox.dataset.classId;
            const subjectId = checkbox.dataset.subjectId;

            const cls = CLASSES.find(c => c.id === classId);
            const className = cls ? cls.name : '不明';
            const dayName = DAYS[day];
            const periodNum = period + 1;
            const newSubject = this.store.getSubject(subjectId);
            const newSubjectName = newSubject ? newSubject.name : '不明な科目';
            const teacher = this.store.getTeacher(teacherId);
            const teacherName = teacher ? teacher.name : '不明';

            // ★ スナップショットを使って競合チェック（削除処理後の状態ではなく削除前の状態で確認）
            const snapshotSlots = preDeleteSnapshot[classId] || [];

            // 異なる科目が既に配置されているかチェック
            // ただし自分が削除予定の授業は競合対象から除外する
            const differentSubjectSlot = snapshotSlots.find(slot => {
                if (slot.subjectId === subjectId) return false;
                // このteacherが担当していて、かつ削除予定（選択されていない）は除外
                const ownedByTeacher = slot.teacherIds.includes(teacherId);
                const beingRemoved = !selectedLessons.some(
                    l => l.classId === classId && l.subjectId === slot.subjectId
                );
                if (ownedByTeacher && beingRemoved) return false;
                return true;
            });

            if (differentSubjectSlot) {
                // 異なる科目が既に配置されている場合、確認ダイアログ
                const existingSubject = this.store.getSubject(differentSubjectSlot.subjectId);
                const existingSubjectName = existingSubject ? existingSubject.name : '不明な科目';
                const existingTeacherNames = differentSubjectSlot.teacherIds.map(tid => {
                    const t = this.store.getTeacher(tid);
                    return t ? t.name : '不明';
                }).join('・');

                const message = `【授業の競合】\n\n` +
                    `クラス: ${className}\n` +
                    `時限: ${dayName}${periodNum}限\n\n` +
                    `既に配置されている授業:\n` +
                    `  科目: ${existingSubjectName}\n` +
                    `  担当: ${existingTeacherNames}\n\n` +
                    `新しく配置する授業:\n` +
                    `  科目: ${newSubjectName}\n` +
                    `  担当: ${teacherName}\n\n` +
                    `既存の授業を削除して新しい授業を配置しますか？`;

                if (!confirm(message)) {
                    continue; // キャンセル → この授業はスキップ
                }

                // 既存の授業を削除してから配置（TT教員解決・連続コマ展開も実施）
                const resolvedForOverwrite = this._resolveTtTeacherIds(classId, subjectId, [teacherId]);
                this.store.clearSlot(classId, day, period);
                this.store.setSlot(classId, day, period, subjectId, resolvedForOverwrite, specialClassroomIds, true);
                this._expandConsecutive(classId, day, period, subjectId, resolvedForOverwrite, specialClassroomIds);
                registeredCount++;
                continue;
            }

            // 現在の実際のスロット状態を取得（削除後の最新状態）
            const currentExistingSlots = this.store.getSlot(classId, day, period);
            const existingSlot = currentExistingSlots.find(slot => slot.subjectId === subjectId);

            if (existingSlot) {
                // 同じ科目が既に配置されている場合
                if (!existingSlot.teacherIds.includes(teacherId)) {
                    // TT（複数教員）として追加 → 確認ダイアログ
                    const existingTeacherNames = existingSlot.teacherIds.map(tid => {
                        const t = this.store.getTeacher(tid);
                        return t ? t.name : '不明';
                    }).join('・');

                    const message = `【TT（ティームティーチング）の確認】\n\n` +
                        `クラス: ${className}\n` +
                        `時限: ${dayName}${periodNum}限\n` +
                        `科目: ${newSubjectName}\n\n` +
                        `既に ${existingTeacherNames} が担当しています。\n` +
                        `${teacherName} をTT教員として追加しますか？`;

                    if (!confirm(message)) {
                        continue; // キャンセル
                    }

                    const newTeacherIds = [...existingSlot.teacherIds, teacherId];
                    this.store.setSlot(classId, day, period, subjectId, newTeacherIds, specialClassroomIds);
                    registeredCount++;
                } else {
                    // 既に同じ教員が配置されている場合でも、特別教室の選択を更新
                    this.store.setSlot(classId, day, period, subjectId, existingSlot.teacherIds, specialClassroomIds);
                }
            } else {
                // 新規配置（TT教員解決・連続コマ設定も反映）
                const resolvedIds = this._resolveTtTeacherIds(classId, subjectId, [teacherId]);
                this.store.setSlot(classId, day, period, subjectId, resolvedIds, specialClassroomIds, true);
                this._expandConsecutive(classId, day, period, subjectId, resolvedIds, specialClassroomIds);
                registeredCount++;
            }
        }

        this.close();
        this.ui.renderMainOverview();
        this.ui.checkConflicts();

        if (registeredCount > 0) {
            showToast(`${registeredCount}件の授業を登録しました`, 'success');
        } else {
            showToast('既に全て登録済みです', 'info');
        }
    }

    clearLesson() {
        if (!this.selectedSlot) return;
        const { classId, day, period } = this.selectedSlot;

        const linkedLessons = this.store.getLinkedLessons(classId, day, period);

        if (linkedLessons.length > 1) {
            if (!confirm(`この授業は他の${linkedLessons.length - 1}件と連動しています。すべて削除しますか？`)) {
                return;
            }
            const result = this.store.clearLinkedLessons(classId, day, period);
            showToast(`連動授業${result.count}件を削除しました`, 'success');
        } else {
            this.store.clearSlot(classId, day, period);
            showToast('授業を削除しました', 'success');
        }

        this.close();
        this.ui.renderMainOverview();
        this.ui.checkConflicts();
    }

    close() {
        const modal = document.getElementById('modal-lesson-select');
        modal.classList.add('hidden');
        this.selectedSlot = null;
    }

    /**
     * クラスタブから授業を追加するモーダルを開く
     * @param {string} classId - クラスID
     * @param {number} day - 曜日インデックス
     * @param {number} period - 時限インデックス
     */
    openClassAddModal(classId, day, period) {
        const modal = document.getElementById('modal-lesson-select');
        const infoContainer = document.getElementById('lesson-select-info');
        const listContainer = document.getElementById('lesson-select-list');

        this.selectedSlot = { classId, day, period };

        const className = CLASSES.find(c => c.id === classId)?.name || classId;
        const currentSlots = this.store.getSlot(classId, day, period);

        // クラス別カリキュラムに登録済みの授業のみ表示
        const classAssignments = this.store.assignments.filter(a =>
            a.classId === classId &&
            this.store.classCurriculum.some(cc => cc.classId === a.classId && cc.subjectId === a.subjectId)
        );
        const teacherIds = [...new Set(classAssignments.map(a => a.teacherId))];

        if (teacherIds.length === 0) {
            infoContainer.innerHTML = `<div><strong>${escapeHtml(className)}</strong> - ${DAYS[day]}曜 ${period + 1}限</div>`;
            listContainer.innerHTML = `
                <p class="placeholder-text">このクラスを担当する教員がいません。</p>
                <p class="placeholder-text">マスター編集の「担当授業」タブで登録してください。</p>
            `;
            modal.querySelector('.modal-close').onclick = () => this.close();
            modal.classList.remove('hidden');
            return;
        }

        // 特別教室選択用UI
        const rooms = this.store.specialClassrooms || [];
        let currentRoomIds = [];
        if (currentSlots && currentSlots.length > 0) {
            const slot = currentSlots[0];
            if (slot.specialClassroomIds && Array.isArray(slot.specialClassroomIds)) {
                currentRoomIds = slot.specialClassroomIds;
            } else if (slot.specialClassroomId) {
                currentRoomIds = [slot.specialClassroomId];
            }
        }

        const roomCheckboxesHtml = rooms.map(r => `
            <label style="display: inline-block; margin-right: 10px; cursor: pointer;">
                <input type="checkbox" class="room-checkbox" value="${escapeHtml(r.id)}" ${currentRoomIds.includes(r.id) ? 'checked' : ''}>
                ${escapeHtml(r.name)}
            </label>
        `).join('');

        const roomSelectHtml = `
            <div style="margin-top: 5px; margin-bottom: 5px;">
                <label style="font-size: 0.9em; color: #666;">使用教室: </label>
                <div id="room-checkboxes" style="display: inline-block;">
                    ${rooms.length > 0 ? roomCheckboxesHtml : '<span style="color: #999;">(教室未登録)</span>'}
                </div>
            </div>
        `;

        infoContainer.innerHTML = `<div><strong>${escapeHtml(className)}</strong> - ${DAYS[day]}曜 ${period + 1}限に授業を追加</div>` + roomSelectHtml;

        // 担当授業リスト（教員ごと）
        let checkboxListHtml = '';
        teacherIds.forEach(teacherId => {
            const teacher = this.store.getTeacher(teacherId);
            const teacherName = teacher ? teacher.name : '不明';
            const teacherAssignments = classAssignments.filter(a => a.teacherId === teacherId);

            teacherAssignments.forEach(lesson => {
                const subject = this.store.getSubject(lesson.subjectId);
                const placedCount = this.store.countPlacedHours(teacherId, lesson.subjectId, classId);
                const totalHours = lesson.weeklyHours;
                const remaining = totalHours - placedCount;
                const isCompleted = remaining <= 0;
                let hoursText = `残${remaining}/${totalHours}`;
                if (remaining <= 0) hoursText = `✓${hoursText}`;

                // この授業が現在のスロットに配置されているかチェック
                const isPlaced = currentSlots.some(slot =>
                    slot.subjectId === lesson.subjectId &&
                    slot.teacherIds.includes(teacherId)
                );
                const placedBadge = isPlaced ? ' <span style="color: #4CAF50; font-size: 0.8em;">[配置済み]</span>' : '';

                checkboxListHtml += `
                    <label class="lesson-checkbox-item ${isCompleted ? 'completed' : ''}" style="display: block; padding: 8px; margin: 4px 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: ${isPlaced ? '#f0f8f0' : 'white'};">
                        <input type="checkbox" class="lesson-checkbox" 
                               data-teacher-id="${teacherId}"
                               data-subject-id="${lesson.subjectId}"
                               ${isPlaced ? 'checked' : ''}
                               style="margin-right: 8px;">
                        <span class="lesson-subject" style="font-weight: 500;">${escapeHtml(subject?.shortName || subject?.name || lesson.subjectId)}</span>
                        <span style="margin-left: 8px; color: #666;">${escapeHtml(teacherName)}</span>${placedBadge}
                        <span class="lesson-hours ${isCompleted ? 'done' : ''}" style="float: right; font-size: 0.9em;">
                            ${hoursText}
                        </span>
                    </label>
                `;
            });
        });

        const hasExisting = currentSlots && currentSlots.length > 0;

        listContainer.innerHTML = `
            <div style="max-height: 300px; overflow-y: auto; margin-bottom: 10px;">
                ${checkboxListHtml}
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 1px solid #ddd;">
                <button id="btn-delete-lesson-class" class="btn btn-danger" style="${hasExisting ? '' : 'visibility: hidden;'}">
                    <span class="btn-icon">🗑️</span>この授業を削除
                </button>
                <button id="btn-register-lessons-class" class="btn btn-primary">登録</button>
            </div>
        `;

        // 削除ボタンのイベント
        const deleteBtn = document.getElementById('btn-delete-lesson-class');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                if (confirm('この時限の授業を削除しますか？')) {
                    this.store.clearSlot(classId, day, period);
                    this.close();
                    this.ui.renderMainOverview();
                    this.ui.checkConflicts();
                    showToast('授業を削除しました', 'success');
                }
            };
        }

        // 登録ボタンのイベント
        const registerBtn = document.getElementById('btn-register-lessons-class');
        if (registerBtn) {
            registerBtn.onclick = () => {
                const selectedCheckboxes = Array.from(document.querySelectorAll('.lesson-checkbox:checked'));

                // 何も選択されていない場合は閉じるだけ
                if (selectedCheckboxes.length === 0) {
                    this.store.clearSlot(classId, day, period);
                    this.close();
                    this.ui.renderMainOverview();
                    this.ui.checkConflicts();
                    showToast('授業を削除しました', 'success');
                    return;
                }

                // 特別教室IDs取得
                const selectedRooms = Array.from(document.querySelectorAll('.room-checkbox:checked')).map(cb => cb.value);
                const specialClassroomIds = selectedRooms.length > 0 ? selectedRooms : null;

                // 選択された授業を登録
                let registeredCount = 0;
                selectedCheckboxes.forEach(cb => {
                    const teacherId = cb.dataset.teacherId;
                    const subjectId = cb.dataset.subjectId;

                    // 既存の授業を確認
                    const existingSlots = this.store.getSlot(classId, day, period);
                    const existingSlot = existingSlots.find(slot => slot.subjectId === subjectId);

                    if (existingSlot) {
                        // 既存授業に教員を追加（TT）
                        if (!existingSlot.teacherIds.includes(teacherId)) {
                            const newTeacherIds = [...existingSlot.teacherIds, teacherId];
                            this.store.setSlot(classId, day, period, subjectId, newTeacherIds, specialClassroomIds);
                            registeredCount++;
                        }
                    } else {
                        // 新規配置
                        this.store.setSlot(classId, day, period, subjectId, [teacherId], specialClassroomIds);
                        registeredCount++;
                    }
                });

                this.close();
                this.ui.renderMainOverview();
                this.ui.checkConflicts();

                if (registeredCount > 0) {
                    showToast(`${registeredCount}件の授業を登録しました`, 'success');
                } else {
                    showToast('既に全て登録済みです', 'info');
                }
            };
        }

        modal.querySelector('.modal-close').onclick = () => this.close();
        modal.classList.remove('hidden');
    }
}
