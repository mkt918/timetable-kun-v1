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

        // 移動先クラスに既存授業があるかチェック（他教員の授業が消える可能性）
        const classExisting = this.store.getSlot(draggedSlot.classId, toDay, toPeriod);
        if (classExisting.length > 0) {
            if (!this.confirmClassSlotOverwrite(draggedSlot, classExisting[0], toDay, toPeriod)) {
                return;
            }
        } else {
            // 移動先教員のスロットをチェック（クラス競合がない場合のみ）
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
        }

        // 移動実行
        this.executeMove(draggedSlot, toDay, toPeriod);
    }

    /**
     * 移動先クラスに既存授業がある場合の確認ダイアログ
     */
    confirmClassSlotOverwrite(draggedSlot, existing, toDay, toPeriod) {
        const cls = CLASSES.find(c => c.id === draggedSlot.classId);
        const className = cls ? cls.name : '不明';
        const dayName = DAYS[toDay];
        const periodNum = toPeriod + 1;
        const existingSubject = this.store.getSubject(existing.subjectId);
        const existingTeacherNames = (existing.teacherIds || [])
            .map(tid => { const t = this.store.getTeacher(tid); return t ? t.name : '不明'; })
            .join('・');
        const newSubject = this.store.getSubject(draggedSlot.subjectId);
        const newTeacherNames = (draggedSlot.teacherIds || [])
            .map(tid => { const t = this.store.getTeacher(tid); return t ? t.name : '不明'; })
            .join('・');

        if (existing.subjectId === draggedSlot.subjectId) {
            // 同じ科目 → TT確認
            const hasSameTeacher = (draggedSlot.teacherIds || []).some(tid =>
                (existing.teacherIds || []).includes(tid)
            );
            if (hasSameTeacher) return true; // 同一教員なら確認不要
            const message = `【TT（チームティーチング）の確認】\n\n` +
                `${className} ${dayName}${periodNum}限\n\n` +
                `既存の授業:\n  科目: ${existingSubject?.name || '不明'}\n  担当: ${existingTeacherNames}\n\n` +
                `この授業にTTとして追加しますか？`;
            return confirm(message);
        } else {
            // 異なる科目 → 上書き確認
            const message = `【クラスの授業上書き確認】\n\n` +
                `${className} ${dayName}${periodNum}限にすでに授業があります:\n\n` +
                `既存:\n  科目: ${existingSubject?.name || '不明'}\n  担当: ${existingTeacherNames}\n\n` +
                `新規:\n  科目: ${newSubject?.name || '不明'}\n  担当: ${newTeacherNames}\n\n` +
                `既存の授業を削除して移動しますか？`;
            return confirm(message);
        }
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

                    // getSlot が classId を持たないため、各スロットに付与する
                    let enrichedSlots;
                    if (isJoint) {
                        // 合同: 同じ教員・科目を持つ全クラスのスロットを収集
                        enrichedSlots = [];
                        slots.forEach(s => {
                            (s.teacherIds || []).forEach(tid => {
                                CLASSES.forEach(cls => {
                                    const clsSlots = this.store.getSlot(cls.id, day, period);
                                    clsSlots.forEach(cs => {
                                        if (cs.teacherIds?.includes(tid) && cs.subjectId === s.subjectId) {
                                            if (!enrichedSlots.some(es => es.classId === cls.id && es.subjectId === cs.subjectId)) {
                                                enrichedSlots.push({ ...cs, classId: cls.id });
                                            }
                                        }
                                    });
                                });
                            });
                        });
                    } else {
                        enrichedSlots = slots.map(s => ({ ...s, classId }));
                    }

                    this.draggedData = {
                        classId,
                        day,
                        period,
                        isJoint,
                        slots: enrichedSlots,
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
        const slotsToMove = this.draggedData.isJoint ? this.draggedData.slots : [slot];
        const dayName = DAYS[toDay];
        const periodNum = toPeriod + 1;

        // 移動先クラスに既存授業があるか確認
        const overwriteTargets = slotsToMove
            .map(s => ({ s, existing: this.store.getSlot(s.classId, toDay, toPeriod) }))
            .filter(({ existing }) => existing.length > 0);

        if (overwriteTargets.length > 0) {
            const details = overwriteTargets.map(({ s, existing }) => {
                const cls = CLASSES.find(c => c.id === s.classId);
                const existingSubject = this.store.getSubject(existing[0].subjectId);
                const teacherNames = (existing[0].teacherIds || [])
                    .map(tid => { const t = this.store.getTeacher(tid); return t ? t.name : '不明'; })
                    .join('・');
                return `  ${cls?.name || s.classId}: ${existingSubject?.name || '不明'}（${teacherNames}）`;
            }).join('\n');
            if (!confirm(`【上書き確認】\n\n${dayName}${periodNum}限に既存の授業があります:\n\n${details}\n\nこれらを削除して移動しますか？`)) {
                return;
            }
        }

        // 移動先に教員の授業が他クラスにあるか確認（教員重複）
        const teacherConflicts = [];
        const ttCandidates = [];
        slotsToMove.forEach(s => {
            (s.teacherIds || []).forEach(tid => {
                const teacherSlots = this.store.getTeacherTimetable(tid);
                const key = `${toDay}-${toPeriod}`;
                (teacherSlots[key] || []).forEach(ex => {
                    // 移動対象クラス自身の授業（上書き済み確認）は除外
                    if (slotsToMove.some(ms => ms.classId === ex.classId)) return;
                    if (ex.subjectId === s.subjectId) {
                        ttCandidates.push({ tid, ex, s });
                    } else {
                        teacherConflicts.push({ tid, ex, s });
                    }
                });
            });
        });

        if (teacherConflicts.length > 0) {
            const details = [...new Map(teacherConflicts.map(c => [c.tid + c.ex.classId, c])).values()]
                .map(({ tid, ex }) => {
                    const t = this.store.getTeacher(tid);
                    const cls = CLASSES.find(c => c.id === ex.classId);
                    const subj = this.store.getSubject(ex.subjectId);
                    return `  ${t?.name || '不明'}: ${cls?.name || '不明'}で${subj?.name || '不明'}を担当中`;
                }).join('\n');
            if (!confirm(`【教員の重複確認】\n\n${dayName}${periodNum}限に担当教員がすでに他のクラスで授業を持っています:\n\n${details}\n\nそのまま移動しますか？`)) {
                return;
            }
        } else if (ttCandidates.length > 0) {
            const details = [...new Map(ttCandidates.map(c => [c.tid + c.ex.classId, c])).values()]
                .map(({ tid, ex }) => {
                    const t = this.store.getTeacher(tid);
                    const cls = CLASSES.find(c => c.id === ex.classId);
                    const subj = this.store.getSubject(ex.subjectId);
                    return `  ${t?.name || '不明'}: ${cls?.name || '不明'}で${subj?.name || '不明'}（TT）`;
                }).join('\n');
            if (!confirm(`【TT（合同授業）の確認】\n\n${dayName}${periodNum}限に同じ科目の授業があります:\n\n${details}\n\nTTとして配置しますか？`)) {
                return;
            }
        }

        // 移動実行
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
