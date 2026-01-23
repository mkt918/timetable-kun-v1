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
                <input type="checkbox" class="room-checkbox" value="${r.id}" ${currentRoomIds.includes(r.id) ? 'checked' : ''}>
                ${r.name}
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

        infoContainer.innerHTML = `<div><strong>${teacher?.name}</strong> - ${DAYS[day]}曜 ${period + 1}限に授業を追加</div>` + roomSelectHtml;

        const assignments = this.store.getTeacherAssignments(teacherId);

        if (assignments.length === 0) {
            listContainer.innerHTML = '<p class="placeholder-text">担当授業がありません</p>';
        } else {
            const checkboxListHtml = assignments.map(lesson => {
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
                        <span class="lesson-subject" style="font-weight: 500;">${subject?.shortName || subject?.name || lesson.subjectId}</span>
                        <span class="lesson-class" style="margin-left: 8px; color: #666;">${className}</span>${placedBadge}
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

        // 登録ボタンのイベント
        const registerBtn = document.getElementById('btn-register-lessons');
        if (registerBtn) {
            registerBtn.onclick = () => {
                const selectedCheckboxes = Array.from(document.querySelectorAll('.lesson-checkbox:checked'));
                if (selectedCheckboxes.length === 0) {
                    // 何も選択されていない場合は閉じる
                    this.close();
                    return;
                }

                // 選択された授業を配置
                this.registerMultipleLessons(teacherId, day, period, selectedCheckboxes);
            };
        }

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

        // 特別教室選択用UI（複数選択可能）
        const rooms = this.store.specialClassrooms || [];
        const roomCheckboxesHtml = rooms.map(r => `
            <label style="display: inline-block; margin-right: 10px; cursor: pointer;">
                <input type="checkbox" class="room-checkbox" value="${r.id}" ${currentRoomIds.includes(r.id) ? 'checked' : ''}>
                ${r.name}
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

        infoContainer.innerHTML = `<div><strong>${teacher?.name}</strong> - ${DAYS[day]}曜 ${period + 1}限 - ${className}</div>` + roomSelectHtml;

        const assignments = this.store.getTeacherAssignments(teacherId);

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
                        <span class="lesson-subject" style="font-weight: 500;">${subject?.shortName || subject?.name || lesson.subjectId}</span>
                        <span class="lesson-class" style="margin-left: 8px; color: #666;">${clsName}</span>${placedBadge}
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
                    this.store.clearSlot(classId, day, period);
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

        this.store.setSlot(classId, day, period, subjectId, teacherIds, specialClassroomIds);

        this.close();
        this.ui.renderMainOverview();
        this.ui.checkConflicts();
        showToast('授業を配置しました', 'success');
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

        // 学年違い合同授業の警告チェック
        if (selectedLessons.length > 1) {
            const grades = new Set();
            selectedLessons.forEach(lesson => {
                // クラスIDから学年を抽出（例: "1-A" → "1", "2-B" → "2"）
                const cls = CLASSES.find(c => c.id === lesson.classId);
                if (cls && cls.name) {
                    const match = cls.name.match(/^(\d)/);
                    if (match) {
                        grades.add(match[1]);
                    }
                }
            });

            if (grades.size > 1) {
                const gradesArray = Array.from(grades).sort();
                const gradeNames = gradesArray.map(g => `${g}年生`).join('、');
                const message = `【学年違いの合同授業の確認】\n\n` +
                    `選択されたクラスに異なる学年（${gradeNames}）が含まれています。\n\n` +
                    `通常、学年が異なるクラスでの合同授業は行われません。\n` +
                    `このまま合同授業を作成しますか？`;

                if (!confirm(message)) {
                    return; // キャンセル
                }
            }
        }

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

            // 既存の授業を取得
            const existingSlots = this.store.getSlot(classId, day, period);

            // 同じ科目が既に配置されているかチェック
            const existingSlot = existingSlots.find(slot => slot.subjectId === subjectId);

            // 異なる科目が既に配置されているかチェック
            const differentSubjectSlot = existingSlots.find(slot => slot.subjectId !== subjectId);

            if (differentSubjectSlot) {
                // 異なる科目が既に配置されている場合、確認ダイアログ
                const existingSubject = this.store.getSubject(differentSubjectSlot.subjectId);
                const existingSubjectName = existingSubject ? existingSubject.name : '不明な科目';
                const existingTeacherNames = differentSubjectSlot.teacherIds.map(tid => {
                    const t = this.store.getTeacher(tid);
                    return t ? t.name : '不明';
                }).join('・');

                const newSubject = this.store.getSubject(subjectId);
                const newSubjectName = newSubject ? newSubject.name : '不明な科目';
                const teacher = this.store.getTeacher(teacherId);
                const teacherName = teacher ? teacher.name : '不明';

                const cls = CLASSES.find(c => c.id === classId);
                const className = cls ? cls.name : '不明';
                const dayName = DAYS[day];
                const periodNum = period + 1;

                const message = `【科目の重複確認】\n\n` +
                    `クラス: ${className}\n` +
                    `時限: ${dayName}${periodNum}\n\n` +
                    `既存の授業:\n` +
                    `  科目: ${existingSubjectName}\n` +
                    `  担当: ${existingTeacherNames}\n\n` +
                    `新しい授業:\n` +
                    `  科目: ${newSubjectName}\n` +
                    `  担当: ${teacherName}\n\n` +
                    `同じ時限に異なる科目を配置することはできません。\n` +
                    `既存の授業を削除して新しい授業を配置しますか？`;

                if (!confirm(message)) {
                    continue; // この授業はスキップ
                }

                // 既存の授業を削除
                this.store.clearSlot(classId, day, period);
            }

            if (existingSlot) {
                // 既に配置されている場合、教員を追加（TT）
                if (!existingSlot.teacherIds.includes(teacherId)) {
                    const newTeacherIds = [...existingSlot.teacherIds, teacherId];
                    // 特別教室は新しく選択されたものを使用（ユーザーが変更した可能性があるため）
                    this.store.setSlot(classId, day, period, subjectId, newTeacherIds, specialClassroomIds);
                    registeredCount++;
                } else {
                    // 既に同じ教員が配置されている場合でも、特別教室の選択を更新
                    this.store.setSlot(classId, day, period, subjectId, existingSlot.teacherIds, specialClassroomIds);
                }
                // 既に同じ教員が配置されている場合は何もしない
            } else {
                // 新規配置
                this.store.setSlot(classId, day, period, subjectId, [teacherId], specialClassroomIds, true);
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

        // このクラスを担当している授業を持つ教員リストを取得
        const classAssignments = this.store.assignments.filter(a => a.classId === classId);
        const teacherIds = [...new Set(classAssignments.map(a => a.teacherId))];

        if (teacherIds.length === 0) {
            infoContainer.innerHTML = `<div><strong>${className}</strong> - ${DAYS[day]}曜 ${period + 1}限</div>`;
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
                <input type="checkbox" class="room-checkbox" value="${r.id}" ${currentRoomIds.includes(r.id) ? 'checked' : ''}>
                ${r.name}
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

        infoContainer.innerHTML = `<div><strong>${className}</strong> - ${DAYS[day]}曜 ${period + 1}限に授業を追加</div>` + roomSelectHtml;

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
                        <span class="lesson-subject" style="font-weight: 500;">${subject?.shortName || subject?.name || lesson.subjectId}</span>
                        <span style="margin-left: 8px; color: #666;">${teacherName}</span>${placedBadge}
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
