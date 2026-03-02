/**
 * DragDropHandler - ドラッグ&ドロップ処理
 */
class DragDropHandler {
    constructor(store, ui, overview) {
        this.store = store;
        this.ui = ui;
        this.overview = overview;
        this.draggedData = null;
    }

    /**
     * 教員タブのドラッグ&ドロップ設定
     */
    setupTeacherDragDrop(table) {
        // 授業があるセルをドラッグ可能に
        table.querySelectorAll('td.has-lesson, td.conflict').forEach(td => {
            td.setAttribute('draggable', 'true');

            td.addEventListener('dragstart', (e) => {
                const teacherId = td.dataset.teacherId;
                const day = parseInt(td.dataset.day);
                const period = parseInt(td.dataset.period);

                const teacherSlots = this.store.getTeacherTimetable(teacherId);
                const key = `${day}-${period}`;
                const slotArray = teacherSlots[key] || [];

                if (slotArray.length > 0) {
                    const isJoint = slotArray.length > 1;

                    this.draggedData = {
                        teacherId,
                        day,
                        period,
                        isJoint,
                        slots: slotArray,
                        source: 'teacher'
                    };
                    e.dataTransfer.effectAllowed = 'move';
                    td.classList.add('dragging');
                } else {
                    e.preventDefault();
                }
            });

            td.addEventListener('dragend', () => {
                td.classList.remove('dragging');
                this.draggedData = null;
                table.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
            });
        });

        // 全セルをドロップ可能に
        table.querySelectorAll('td[data-day]').forEach(td => {
            td.addEventListener('dragover', (e) => {
                if (!this.draggedData) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                td.classList.add('drag-over');
            });

            td.addEventListener('dragleave', () => {
                td.classList.remove('drag-over');
            });

            td.addEventListener('drop', (e) => {
                e.preventDefault();
                td.classList.remove('drag-over');
                if (!this.draggedData) return;

                const toDay = parseInt(td.dataset.day);
                const toPeriod = parseInt(td.dataset.period);

                if (this.draggedData.day === toDay && this.draggedData.period === toPeriod) return;

                this.handleTeacherDrop(td, toDay, toPeriod);
            });
        });
    }

    handleTeacherDrop(td, toDay, toPeriod) {
        const draggedSlot = this.draggedData.slots[0];

        // 移動先に連動授業があるかチェック
        const linkedLessons = this.store.getLinkedLessons(draggedSlot.classId, toDay, toPeriod);
        if (linkedLessons.length > 1) {
            if (!this.confirmLinkedOverwrite(draggedSlot, linkedLessons, toDay, toPeriod)) {
                return;
            }
            this.store.clearLinkedLessons(draggedSlot.classId, toDay, toPeriod);
        }

        // 移動先に既存の授業があるかチェック
        const toTeacherId = td.dataset.teacherId;
        if (toTeacherId) {
            const toTeacherSlots = this.store.getTeacherTimetable(toTeacherId);
            const toKey = `${toDay}-${toPeriod}`;
            const existingSlots = toTeacherSlots[toKey] || [];

            if (existingSlots.length > 0 && !this.draggedData.isJoint) {
                if (!this.handleExistingSlotConflict(existingSlots, draggedSlot, toDay, toPeriod)) {
                    return;
                }
            }
        }

        // 移動実行
        this.executeMove(draggedSlot, toDay, toPeriod);
    }

    confirmLinkedOverwrite(draggedSlot, linkedLessons, toDay, toPeriod) {
        const subject = this.store.getSubject(draggedSlot.subjectId);
        const subjectName = subject ? subject.name : '不明な科目';
        const cls = CLASSES.find(c => c.id === draggedSlot.classId);
        const className = cls ? cls.name : '不明';
        const dayName = DAYS[toDay];
        const periodNum = toPeriod + 1;

        const linkedClassList = linkedLessons.map(lesson => {
            const linkedClass = CLASSES.find(c => c.id === lesson.classId);
            const linkedSubject = this.store.getSubject(lesson.subjectId);
            const teacherNames = lesson.teacherIds.map(tid => {
                const t = this.store.getTeacher(tid);
                return t ? t.name : '不明';
            }).join('・');
            return `  ${linkedClass ? linkedClass.name : '不明'}: ${linkedSubject ? linkedSubject.name : '不明'}（${teacherNames}）`;
        }).join('\n');

        const message = `【連動授業の上書き確認】\n\n` +
            `移動先には連動授業が設定されています:\n\n` +
            `時限: ${dayName}${periodNum}\n` +
            `連動授業（${linkedLessons.length}件）:\n${linkedClassList}\n\n` +
            `これらの連動授業を削除して、${className}に${subjectName}を配置しますか？`;

        return confirm(message);
    }

    handleExistingSlotConflict(existingSlots, draggedSlot, toDay, toPeriod) {
        const existingSlot = existingSlots[0];

        if (existingSlot.subjectId === draggedSlot.subjectId) {
            // 同じ科目
            const hasSameTeacher = draggedSlot.teacherIds.some(tid =>
                existingSlot.teacherIds.includes(tid)
            );

            if (!hasSameTeacher) {
                // TT確認
                const subject = this.store.getSubject(draggedSlot.subjectId);
                const subjectName = subject ? subject.name : '不明な科目';
                const existingTeacherNames = existingSlot.teacherIds.map(tid => {
                    const t = this.store.getTeacher(tid);
                    return t ? t.name : '不明';
                }).join('・');

                const cls = CLASSES.find(c => c.id === draggedSlot.classId);
                const className = cls ? cls.name : '不明';
                const dayName = DAYS[toDay];
                const periodNum = toPeriod + 1;

                const message = `【TT（チームティーチング）の確認】\n\n` +
                    `既存の授業:\n` +
                    `  クラス: ${className}\n` +
                    `  時限: ${dayName}${periodNum}\n` +
                    `  科目: ${subjectName}\n` +
                    `  担当: ${existingTeacherNames}\n\n` +
                    `この授業にTT（複数教員）として追加しますか？`;

                return confirm(message);
            }
        } else {
            // 異なる科目 - 上書き確認
            const existingSubject = this.store.getSubject(existingSlot.subjectId);
            const existingSubjectName = existingSubject ? existingSubject.name : '不明な科目';
            const existingTeacherNames = existingSlot.teacherIds.map(tid => {
                const t = this.store.getTeacher(tid);
                return t ? t.name : '不明';
            }).join('・');

            const newSubject = this.store.getSubject(draggedSlot.subjectId);
            const newSubjectName = newSubject ? newSubject.name : '不明な科目';
            const newTeacherNames = draggedSlot.teacherIds.map(tid => {
                const t = this.store.getTeacher(tid);
                return t ? t.name : '不明';
            }).join('・');

            const cls = CLASSES.find(c => c.id === draggedSlot.classId);
            const className = cls ? cls.name : '不明';
            const dayName = DAYS[toDay];
            const periodNum = toPeriod + 1;

            const message = `【科目の重複確認】\n\n` +
                `クラス: ${className}\n` +
                `時限: ${dayName}${periodNum}\n\n` +
                `既存の授業:\n` +
                `  科目: ${existingSubjectName}\n` +
                `  担当: ${existingTeacherNames}\n\n` +
                `新しい授業:\n` +
                `  科目: ${newSubjectName}\n` +
                `  担当: ${newTeacherNames}\n\n` +
                `既存の授業を削除して新しい授業を配置しますか？`;

            return confirm(message);
        }

        return true;
    }

    executeMove(draggedSlot, toDay, toPeriod) {
        if (this.draggedData.isJoint) {
            // 合同授業の一括移動
            this.draggedData.slots.forEach(slot => {
                this.store.snapshot();
                this.store.clearSlot(slot.classId, this.draggedData.day, this.draggedData.period);
                this.store.setSlot(
                    slot.classId, toDay, toPeriod,
                    slot.subjectId, slot.teacherIds, slot.specialClassroomIds
                );
            });
            showToast(`${this.draggedData.slots.length}件の授業を連動移動しました`, 'success');
        } else {
            // 単一授業の移動
            const result = this.store.moveLesson(
                draggedSlot.classId,
                this.draggedData.day,
                this.draggedData.period,
                draggedSlot.subjectId,
                draggedSlot.teacherIds,
                toDay,
                toPeriod
            );

            if (result.success) {
                const msg = result.count ? `${result.count}件の授業を連動移動しました` : '移動しました';
                showToast(msg, 'success');
            } else {
                showToast(result.message || '移動に失敗しました', 'error');
            }
        }

        this.ui.renderMainOverview();
        this.ui.checkConflicts();
        this.ui.updateUndoRedoButtons();
    }

    /**
     * クラスタブのドラッグ&ドロップ設定
     */
    setupClassDragDrop(table) {
        table.querySelectorAll('td.has-lesson').forEach(td => {
            td.setAttribute('draggable', 'true');

            td.addEventListener('dragstart', (e) => {
                const classId = td.dataset.classId;
                const day = parseInt(td.dataset.day);
                const period = parseInt(td.dataset.period);

                const slots = this.store.getSlot(classId, day, period);
                if (slots.length > 0) {
                    const ttInfo = this.store.isTTSlot(classId, day, period);
                    const isJoint = ttInfo.isTT && (ttInfo.type === 'same_teacher' || ttInfo.type === 'both');

                    this.draggedData = {
                        classId,
                        day,
                        period,
                        isJoint,
                        slots: isJoint ? ttInfo.slots : slots,
                        source: 'class'
                    };
                    e.dataTransfer.effectAllowed = 'move';
                    td.classList.add('dragging');
                } else {
                    e.preventDefault();
                }
            });

            td.addEventListener('dragend', () => {
                td.classList.remove('dragging');
                this.draggedData = null;
                table.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
            });
        });

        table.querySelectorAll('td[data-class-id]').forEach(td => {
            td.addEventListener('dragover', (e) => {
                if (!this.draggedData) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                td.classList.add('drag-over');
            });

            td.addEventListener('dragleave', () => {
                td.classList.remove('drag-over');
            });

            td.addEventListener('drop', (e) => {
                e.preventDefault();
                td.classList.remove('drag-over');
                if (!this.draggedData) return;

                const toDay = parseInt(td.dataset.day);
                const toPeriod = parseInt(td.dataset.period);
                const toClassId = td.dataset.classId;

                if (this.draggedData.day === toDay && this.draggedData.period === toPeriod) return;

                this.handleClassDrop(toClassId, toDay, toPeriod);
            });
        });
    }

    handleClassDrop(toClassId, toDay, toPeriod) {
        const slot = this.draggedData.slots[0];

        if (this.draggedData.isJoint) {
            // 合同授業の一括移動
            this.draggedData.slots.forEach(s => {
                this.store.snapshot();
                this.store.clearSlot(s.classId, this.draggedData.day, this.draggedData.period);
                this.store.setSlot(
                    s.classId, toDay, toPeriod,
                    s.subjectId, s.teacherIds, s.specialClassroomIds
                );
            });
            showToast(`${this.draggedData.slots.length}件の授業を連動移動しました`, 'success');
        } else {
            // 単一授業の移動
            this.store.snapshot();
            this.store.clearSlot(this.draggedData.classId, this.draggedData.day, this.draggedData.period);
            this.store.setSlot(
                this.draggedData.classId, toDay, toPeriod,
                slot.subjectId, slot.teacherIds, slot.specialClassroomIds
            );
            showToast('移動しました', 'success');
        }

        this.ui.renderMainOverview();
        this.ui.checkConflicts();
        this.ui.updateUndoRedoButtons();
    }
}

// グローバルに公開
window.DragDropHandler = DragDropHandler;
