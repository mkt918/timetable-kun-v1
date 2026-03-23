class OverviewRenderer {
    constructor(store, ui) {
        this.store = store;
        this.ui = ui; // Reference to main UI coordinator
        this.viewMode = 'teacher'; // 'teacher' or 'class'
        this.mainFilterTeacherId = '';
        this.mainFilterClassId = '';
        this.draggedData = null;

        // 新モジュール初期化
        this._teacherTable = new TeacherTableRenderer(store, ui, this);
        this._classTable = new ClassTableRenderer(store, ui, this);
        this._dragDrop = new DragDropHandler(store, ui, this);
    }

    init() {
        this.setupViewToggle();
        // フィルタ変更イベント
        const filter = document.getElementById('overview-filter-teacher');
        if (filter) {
            filter.addEventListener('change', (e) => {
                this.mainFilterTeacherId = e.target.value;
                this.render();
            });
        }
    }

    render() {
        if (!this.viewMode) {
            this.viewMode = 'teacher';
            this.setupViewToggle();
        }

        // パーキングエリアコンテナの表示/非表示
        const parkingContainer = document.getElementById('parking-area-container');

        if (this.viewMode === 'class') {
            this.renderClassTimetable();
            if (parkingContainer) parkingContainer.style.display = 'none';
        } else if (this.viewMode === 'room') {
            this.renderSpecialClassroomTimetable();
            if (parkingContainer) parkingContainer.style.display = 'none';
        } else {
            this.renderTeacherTimetable();
            // 全教員タブではパーキングエリアを表示
            this.ui.parkingArea.render();
            if (parkingContainer) parkingContainer.style.display = 'block';
        }
    }

    setupViewToggle() {
        const toolbarLeft = document.querySelector('.toolbar-left');
        if (toolbarLeft && !document.getElementById('btn-view-teacher')) {
            toolbarLeft.innerHTML = `
                <div class="view-toggle">
                    <button id="btn-view-teacher" class="btn-toggle active">全教員</button>
                    <button id="btn-view-class" class="btn-toggle">全クラス</button>
                    <button id="btn-view-room" class="btn-toggle">特別教室</button>
                </div>
            `;
            document.getElementById('btn-view-teacher').onclick = () => this.switchViewMode('teacher');
            document.getElementById('btn-view-class').onclick = () => this.switchViewMode('class');
            document.getElementById('btn-view-room').onclick = () => this.switchViewMode('room');
        }
    }

    switchViewMode(mode) {
        if (this.viewMode === mode) return;
        this.viewMode = mode;
        document.getElementById('btn-view-teacher')?.classList.toggle('active', mode === 'teacher');
        document.getElementById('btn-view-class')?.classList.toggle('active', mode === 'class');
        document.getElementById('btn-view-room')?.classList.toggle('active', mode === 'room');

        this.render();
    }

    renderTeacherTimetable() {
        const table = document.getElementById('main-overview-table');
        if (!table) return;

        // フィルタ設定
        const filterSelect = document.getElementById('overview-filter');
        if (filterSelect) {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="">すべての教員</option>' +
                this.store.teachers.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');

            if (this.mainFilterTeacherId) {
                filterSelect.value = this.mainFilterTeacherId;
            } else {
                filterSelect.value = currentVal;
            }

            filterSelect.onchange = (e) => {
                this.mainFilterTeacherId = e.target.value;
                this.render();
            };
        }

        let teachers = this.store.teachers;
        if (this.mainFilterTeacherId) {
            teachers = teachers.filter(t => t.id === this.mainFilterTeacherId);
        }

        if (teachers.length === 0) {
            table.innerHTML = '<tbody><tr><td style="padding: 40px; text-align: center; color: var(--color-text-muted);">教員がいません。マスター編集から追加してください。</td></tr></tbody>';
            return;
        }

        // 重複チェック
        const conflicts = this.store.checkConflicts();
        const conflictCells = new Set();
        conflicts.forEach(c => {
            // 教員ベースの重複
            conflictCells.add(`${c.teacherId}-${c.day}-${c.period}`);
        });

        // 各教員の時間割を事前に取得
        const teacherTimetables = {};
        teachers.forEach(teacher => {
            teacherTimetables[teacher.id] = this.store.getTeacherTimetable(teacher.id);
        });

        // ヘッダー行
        let html = '<thead><tr><th class="time-header">時限</th>';
        teachers.forEach(teacher => {
            const separatorClass = teacher.separator ? 'teacher-separator' : '';
            // クリックで設定モーダルを開く
            // ui.unavailableSettings.open(...) を呼ぶ形にするが、HTML onclickだとglobal scopeが必要
            // 暫定的に ui.unavailableSettings.open... が動くように index.js で調整するか、
            // ここで addEventListener を使う形に書き換えるのがベストだが、行数が多いので
            // ここでは `ui.openUnavailableSettingsModal` がまだ使える前提（Facadeパターン）でいく。

            // 授業コマ数をカウント（合同は1コマ、会議・勤務不可は除外）
            let lessonCount = 0;
            DAYS.forEach((day, dayIndex) => {
                for (let period = 0; period < PERIODS; period++) {
                    const key = `${dayIndex}-${period}`;
                    const slots = teacherTimetables[teacher.id][key] || [];

                    // 会議チェック
                    const hasMeeting = this.store.meetings.some(m =>
                        m.teacherIds.includes(teacher.id) &&
                        m.schedule.some(s => s.dayIndex === dayIndex && s.period === period + 1)
                    );

                    // 勤務不可チェック
                    const isUnavailable = this.store.isUnavailable(teacher.id, dayIndex, period);

                    // 授業があり、会議でも勤務不可でもない場合にカウント
                    if (slots.length > 0 && !hasMeeting && !isUnavailable) {
                        lessonCount++;
                    }
                }
            });

            // 担当授業で登録された総コマ数（分母）
            let totalCount = 0;
            const assignments = this.store.assignments.filter(a => a.teacherId === teacher.id);
            assignments.forEach(a => {
                totalCount += a.weeklyHours || 0;
            });

            // 表示形式: 5/18コマ（分母が0の場合は「5コマ」）
            let lessonDisplay = '';
            if (totalCount > 0) {
                lessonDisplay = `${lessonCount}/${totalCount}コマ`;
            } else {
                lessonDisplay = `${lessonCount}コマ`;
            }

            html += `<th class="${separatorClass}" style="cursor: default;">
                <span style="cursor: pointer; text-decoration: underline dotted;" onclick="ui.openTeacherAssignmentModal('${escapeHtml(teacher.id)}')" title="クリックして担当授業を設定">${escapeHtml(teacher.name)}</span>
                <span style="cursor: pointer; font-size:0.8em; margin-left:4px;" onclick="ui.openUnavailableSettingsModal('${escapeHtml(teacher.id)}')" title="勤務不可設定">⚙️</span>
                <div style="font-size: 0.8em; font-weight: normal; color: #666;">${lessonDisplay}</div>
            </th>`;
        });
        html += '</tr></thead><tbody>';

        // 各曜日・時限の行
        DAYS.forEach((day, dayIndex) => {
            for (let period = 0; period < PERIODS; period++) {
                const isLastPeriod = period === PERIODS - 1;
                const rowClass = isLastPeriod ? 'day-last' : '';
                html += `<tr class="${rowClass}"><td class="time-header">${day}${period + 1}</td>`;

                teachers.forEach(teacher => {
                    const key = `${dayIndex}-${period}`;
                    const slots = teacherTimetables[teacher.id][key] || [];
                    const isConflict = conflictCells.has(`${teacher.id}-${dayIndex}-${period}`);
                    const separatorClass = teacher.separator ? 'teacher-separator' : '';

                    // 勤務不可チェック
                    const isUnavailable = this.store.isUnavailable(teacher.id, dayIndex, period);
                    const unavailableClass = isUnavailable ? 'cell-unavailable' : '';
                    let titleText = isUnavailable ? '勤務不可設定あり' : '';

                    // 会議チェック
                    const meetings = this.store.meetings.filter(m =>
                        m.teacherIds.includes(teacher.id) &&
                        m.schedule.some(s => s.dayIndex === dayIndex && s.period === period + 1)
                    );
                    const hasMeeting = meetings.length > 0;
                    const meetingClass = hasMeeting ? 'cell-meeting' : '';
                    if (hasMeeting) {
                        const meetingNames = meetings.map(m => escapeHtml(m.name)).join('、');
                        titleText = titleText ? `${titleText} / 会議: ${meetingNames}` : `会議: ${meetingNames}`;
                    }

                    if (slots.length > 0) {
                        const conflictClass = isConflict ? 'conflict' : 'has-lesson';

                        // TT判定
                        let ttClass = '';
                        if (slots.length > 1) {
                            ttClass = 'cell-tt cell-tt-same-teacher';
                        }

                        // 教科に基づく背景色を取得（最初のスロットの教科を使用）
                        let categoryColor = '';
                        if (slots[0] && slots[0].subjectId) {
                            const subject = this.store.getSubject(slots[0].subjectId);
                            if (subject && subject.categoryId) {
                                const category = this.store.getCategory(subject.categoryId);
                                const categoryIndex = this.store.categories.findIndex(c => c.id === subject.categoryId);
                                if (categoryIndex >= 0) {
                                    const colorIndex = categoryIndex % 20;
                                    // カスタム色があれば使用、なければCSS変数を使用
                                    const color = category?.color || `var(--category-color-${colorIndex})`;
                                    categoryColor = `background-color: ${color};`;
                                }
                            }
                        }

                        html += `
                            <td class="${conflictClass} ${separatorClass} ${unavailableClass} ${meetingClass} ${ttClass}"
                                data-teacher-id="${teacher.id}"
                                data-day="${dayIndex}"
                                data-period="${period}"
                                title="${titleText}"
                                style="${categoryColor}">`;

                        // 会議表示（授業の前に）
                        if (hasMeeting) {
                            html += `<div class="meeting-indicator" style="font-size: 0.75em; color: #666; margin-bottom: 2px;">${meetings.map(m => escapeHtml(m.name)).join('、')}</div>`;
                        }

                        // 合同授業（複数クラス）のチェック
                        const isJoint = slots.length > 1;
                        // TT（複数教員）のチェック
                        const isTT = slots.some(slot => slot.teacherIds && slot.teacherIds.length > 1);

                        if (isJoint) {
                            html += '<div class="multi-lesson-container">';
                            html += '<span class="tt-badge">合同</span>';
                        }

                        // TTバッジ表示
                        if (isTT) {
                            html += '<span class="tt-badge">TT</span>';
                        }

                        slots.forEach(slot => {
                            const subjectName = slot.subjectName;

                            // 連動授業チェック
                            const linkedCount = this.store.getLinkedLessons(slot.classId, dayIndex, period).length;
                            const linkIndicator = linkedCount > 1
                                ? `<span class="link-badge" title="連動: ${linkedCount}件">🔗</span>`
                                : '';

                            // 使用教室表示
                            let roomNames = '';
                            if (slot.specialClassroomIds && slot.specialClassroomIds.length > 0) {
                                const names = slot.specialClassroomIds.map(rid => {
                                    const r = this.store.getSpecialClassroom(rid);
                                    return r ? (r.shortName || r.name) : '';
                                }).filter(n => n);
                                if (names.length > 0) {
                                    roomNames = `<span style="font-size:0.8em; color:#007bff;">@${names.join('・')}</span>`;
                                }
                            }

                            html += `
                                <div class="cell-content-multi">
                                    <span class="cell-subject">${linkIndicator}${escapeHtml(subjectName)}</span>
                                    <span class="cell-class">${escapeHtml(slot.className)} ${roomNames}</span>
                                </div>
                            `;
                        });

                        if (slots.length > 1) {
                            html += '</div>';
                        }

                        html += `</td>`;
                    } else {
                        // 空セル
                        html += `
                            <td class="${separatorClass} ${unavailableClass} ${meetingClass}"
                                data-teacher-id="${teacher.id}"
                                data-day="${dayIndex}"
                                data-period="${period}"
                                title="${titleText}">`;

                        // 会議のみの場合
                        if (hasMeeting) {
                            html += `<div class="meeting-only" style="font-size: 0.85em; color: #666;">${meetings.map(m => escapeHtml(m.name)).join('、')}</div>`;
                        }

                        html += `</td>
                        `;
                    }
                });

                html += '</tr>';
            }
        });

        html += '</tbody>';
        table.innerHTML = html;

        this.attachTeacherTableEvents(table);
    }

    attachTeacherTableEvents(table) {
        // セルクリックイベント
        table.querySelectorAll('td[data-teacher-id]').forEach(td => {
            td.addEventListener('click', () => {
                const teacherId = td.dataset.teacherId;
                const day = parseInt(td.dataset.day);
                const period = parseInt(td.dataset.period);

                const hasLesson = td.classList.contains('has-lesson') || td.classList.contains('conflict');

                if (hasLesson) {
                    const teacherSlots = this.store.getTeacherTimetable(teacherId);
                    const key = `${day}-${period}`;
                    const slotArray = teacherSlots[key] || [];
                    const slot = slotArray[0];
                    const classId = slot?.classId || null;

                    if (classId) {
                        this.ui.openOverviewLessonModal(classId, day, period, teacherId);
                    } else {
                        // classIdが取れない場合はaddモーダルを開く
                        this.ui.openOverviewAddModal(day, period, teacherId);
                    }
                } else {
                    this.ui.openOverviewAddModal(day, period, teacherId);
                }
            });
        });

        // ドラッグ＆ドロップ
        this.setupDragAndDrop(table);
    }

    setupDragAndDrop(table) {
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
                        slots: slotArray
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

                // 移動先に連動授業があるかチェック
                const draggedSlot = this.draggedData.slots[0];
                const linkedLessons = this.store.getLinkedLessons(draggedSlot.classId, toDay, toPeriod);

                if (linkedLessons.length > 1) {
                    // 連動授業がある場合、詳細を表示して確認
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

                    if (!confirm(message)) {
                        return;
                    }

                    // 連動授業を全て削除
                    this.store.clearLinkedLessons(draggedSlot.classId, toDay, toPeriod);
                }

                // 移動先に既存の授業があるかチェック
                const toTeacherId = td.dataset.teacherId;
                if (toTeacherId) {
                    const toTeacherSlots = this.store.getTeacherTimetable(toTeacherId);
                    const toKey = `${toDay}-${toPeriod}`;
                    const existingSlots = toTeacherSlots[toKey] || [];

                    if (existingSlots.length > 0 && !this.draggedData.isJoint) {
                        // 移動しようとしている授業と既存の授業を比較
                        const existingSlot = existingSlots[0];

                        // 同じ科目かチェック
                        if (existingSlot.subjectId === draggedSlot.subjectId) {
                            // 同じ教員かチェック（TTは異なる教員の場合のみ）
                            const hasSameTeacher = draggedSlot.teacherIds.some(tid =>
                                existingSlot.teacherIds.includes(tid)
                            );

                            if (!hasSameTeacher) {
                                // 異なる教員 → 同一クラス内TTになる
                                const subject = this.store.getSubject(draggedSlot.subjectId);
                                const subjectName = subject ? subject.name : '不明な科目';

                                // 既存の授業の情報を取得
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

                                if (!confirm(message)) {
                                    return;
                                }
                            }
                            // 同じ教員の場合は確認なし（単なる移動）
                        } else {
                            // 異なる科目 - 詳細情報を表示して上書き確認
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
                                `同じ時限に異なる科目を配置することはできません。\n` +
                                `既存の授業を削除して新しい授業を配置しますか？`;

                            if (!confirm(message)) {
                                return;
                            }

                            // 異なる科目の上書きの場合、移動先をクリア
                            this.store.clearSlot(draggedSlot.classId, toDay, toPeriod);
                        }
                    }
                }

                // 合同授業（複数クラス）になるかチェック
                if (!this.draggedData.isJoint) {
                    const draggedSlot = this.draggedData.slots[0];
                    const draggedTeacherIds = draggedSlot.teacherIds;
                    const draggedSubjectId = draggedSlot.subjectId;

                    // 他のクラスで同じ教員が同じ科目を同じ時限に担当しているかチェック
                    const jointClasses = [];
                    CLASSES.forEach(cls => {
                        if (cls.id === draggedSlot.classId) return; // 自分のクラスは除外

                        const otherSlots = this.store.getSlot(cls.id, toDay, toPeriod);
                        otherSlots.forEach(otherSlot => {
                            // 同じ科目で、同じ教員が含まれているか
                            if (otherSlot.subjectId === draggedSubjectId) {
                                const hasCommonTeacher = draggedTeacherIds.some(tid =>
                                    otherSlot.teacherIds.includes(tid)
                                );
                                if (hasCommonTeacher) {
                                    const teacherNames = otherSlot.teacherIds.map(tid => {
                                        const t = this.store.getTeacher(tid);
                                        return t ? t.name : '不明';
                                    }).join('・');
                                    jointClasses.push({
                                        className: cls.name,
                                        teacherNames: teacherNames
                                    });
                                }
                            }
                        });
                    });

                    if (jointClasses.length > 0) {
                        const subject = this.store.getSubject(draggedSubjectId);
                        const subjectName = subject ? subject.name : '不明な科目';
                        const draggedClass = CLASSES.find(c => c.id === draggedSlot.classId);
                        const draggedClassName = draggedClass ? draggedClass.name : '不明';
                        const dayName = DAYS[toDay];
                        const periodNum = toPeriod + 1;

                        const jointClassList = jointClasses.map(jc =>
                            `  ${jc.className}（担当: ${jc.teacherNames}）`
                        ).join('\n');

                        const message = `【合同授業の確認】\n\n` +
                            `移動先の時限で以下のクラスと合同授業になります:\n\n` +
                            `移動する授業: ${draggedClassName}\n` +
                            `時限: ${dayName}${periodNum}\n` +
                            `科目: ${subjectName}\n\n` +
                            `合同先:\n${jointClassList}\n\n` +
                            `合同授業として設定しますか？`;

                        if (!confirm(message)) {
                            return;
                        }
                    }
                }

                // 履歴保存
                this.store.snapshot();
                this.ui.updateUndoRedoButtons();

                if (this.draggedData.isJoint) {
                    let movedCount = 0;
                    this.draggedData.slots.forEach(slot => {
                        const result = this.store.moveSingleLesson(
                            slot.classId,
                            this.draggedData.day,
                            this.draggedData.period,
                            slot.subjectId,
                            slot.teacherIds,
                            toDay,
                            toPeriod
                        );
                        if (result.success) movedCount++;
                    });
                    showToast(`合同授業${movedCount}件を移動しました`, 'success');
                    this.ui.renderMainOverview();
                    this.ui.checkConflicts();
                } else {
                    const slot = this.draggedData.slots[0];
                    const result = this.store.moveLesson(
                        slot.classId,
                        this.draggedData.day,
                        this.draggedData.period,
                        slot.subjectId,
                        slot.teacherIds,
                        toDay,
                        toPeriod
                    );

                    if (result.success) {
                        const msg = result.count ? `${result.count}件の授業を連動移動しました` : '移動しました';
                        showToast(msg, 'success');
                        this.ui.renderMainOverview();
                        this.ui.checkConflicts();
                    } else {
                        showToast(result.message || '移動に失敗しました', 'error');
                    }
                }
            });
        });
    }

    renderClassTimetable() {
        const table = document.getElementById('main-overview-table');
        if (!table) return;

        // フィルタ設定
        const filterSelect = document.getElementById('overview-filter');
        if (filterSelect) {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="">すべてのクラス</option>' +
                CLASSES.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');

            if (this.mainFilterClassId && filterSelect.querySelector(`option[value="${this.mainFilterClassId}"]`)) {
                filterSelect.value = this.mainFilterClassId;
            } else {
                filterSelect.value = '';
                this.mainFilterClassId = '';
            }

            filterSelect.onchange = (e) => {
                this.mainFilterClassId = e.target.value;
                this.render(); // re-render
            };
        }

        let classes = CLASSES;
        if (this.mainFilterClassId) {
            classes = classes.filter(c => c.id === this.mainFilterClassId);
        }

        // ヘッダー行
        let html = '<thead><tr><th class="time-header">時限</th>';
        classes.forEach((cls, index) => {
            const isSeparator = index < classes.length - 1 && cls.grade !== classes[index + 1].grade;
            const style = isSeparator ? 'style="border-right: 3px solid #666;"' : '';
            html += `<th ${style}>${escapeHtml(cls.name)}</th>`;
        });
        html += '</tr></thead><tbody>';

        // 行生成
        DAYS.forEach((day, dayIndex) => {
            for (let period = 0; period < PERIODS; period++) {
                const isLastPeriod = period === PERIODS - 1;
                const rowClass = isLastPeriod ? 'day-last' : '';
                html += `<tr class="${rowClass}"><td class="time-header">${day}${period + 1}</td>`;

                classes.forEach((cls, index) => {
                    const isSeparator = index < classes.length - 1 && cls.grade !== classes[index + 1].grade;
                    const separatorStyle = isSeparator ? 'style="border-right: 3px solid #666;"' : '';

                    const slots = this.store.getSlot(cls.id, dayIndex, period);

                    // 表示すべき授業を抽出
                    const visibleSlots = slots.filter(slot => {
                        const subject = this.store.getSubject(slot.subjectId);
                        return !subject || !subject.isHidden;
                    });

                    if (visibleSlots.length > 0) {
                        const ttInfo = this.store.isTTSlot(cls.id, dayIndex, period);
                        let ttClass = '';
                        if (ttInfo.isTT) {
                            if (ttInfo.type === 'same_class') {
                                ttClass = 'cell-tt cell-tt-same-class';
                            } else if (ttInfo.type === 'same_teacher') {
                                ttClass = 'cell-tt cell-tt-same-teacher';
                            } else if (ttInfo.type === 'both') {
                                ttClass = 'cell-tt';
                            }
                        }

                        const multiWarningClass = visibleSlots.length > 1 ? 'cell-multi-warning' : '';

                        html += `<td class="has-lesson ${ttClass} ${multiWarningClass}"
                                     ${separatorStyle}
                                     data-class-id="${cls.id}"
                                     data-day="${dayIndex}"
                                     data-period="${period}">`;

                        if (visibleSlots.length > 1) {
                            html += '<div class="multi-lesson-container">';
                        }

                        if (ttInfo.isTT && (ttInfo.type === 'same_teacher' || ttInfo.type === 'both')) {
                            html += '<span class="tt-badge">合同</span>';
                        }

                        // 同一クラス内TT（複数教員）のバッジ表示
                        if (ttInfo.isTT && (ttInfo.type === 'same_class' || ttInfo.type === 'both')) {
                            html += '<span class="tt-badge">TT</span>';
                        }

                        visibleSlots.forEach(slot => {
                            const subject = this.store.getSubject(slot.subjectId);
                            const subjectName = subject ? subject.shortName : '不明';
                            const linkedCount = this.store.getLinkedLessons(cls.id, dayIndex, period).length;
                            const linkIndicator = linkedCount > 1
                                ? `<span class="link-badge" title="連動: ${linkedCount}件">🔗</span>`
                                : '';
                            const teacherNames = slot.teacherIds.map(tid => {
                                const t = this.store.getTeacher(tid);
                                return t ? t.name : '不明';
                            }).join('・');

                            // 使用教室表示（新形式: specialClassroomIds, 旧形式: specialClassroomId）
                            let roomNames = '';
                            const roomIds = slot.specialClassroomIds || (slot.specialClassroomId ? [slot.specialClassroomId] : []);
                            if (roomIds.length > 0) {
                                const names = roomIds.map(rid => {
                                    const r = this.store.getSpecialClassroom(rid);
                                    return r ? (r.shortName || r.name) : '';
                                }).filter(n => n);
                                if (names.length > 0) {
                                    roomNames = `<span style="font-size:0.8em; color:#007bff;">@${escapeHtml(names.join('・'))}</span>`;
                                }
                            }

                            html += `
                                <div class="cell-content-multi">
                                    <span class="cell-subject">${linkIndicator}${escapeHtml(subjectName)}</span>
                                    <span class="cell-class">${escapeHtml(teacherNames)} ${roomNames}</span>
                                </div>
                            `;
                        });

                        if (visibleSlots.length > 1) {
                            html += '</div>';
                        }

                        html += `</td>`;
                    } else {
                        html += `
                             <td ${separatorStyle}
                                 data-class-id="${cls.id}"
                                 data-day="${dayIndex}"
                                 data-period="${period}">
                             </td>
                         `;
                    }
                });
                html += '</tr>';
            }
        });
        html += '</tbody>';
        table.innerHTML = html;

        this.attachClassTableEvents(table);
    }



    renderSpecialClassroomTimetable() {
        const table = document.getElementById('main-overview-table');
        if (!table) return;

        // フィルタ（必要なら実装するが、特別教室は数が少ないので不要かも？）
        // 一応フィルタエリアをクリアするか、既存のフィルタを非表示にする
        const filterSelect = document.getElementById('overview-filter');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">(フィルタなし)</option>';
            filterSelect.disabled = true;
        }

        const rooms = this.store.specialClassrooms || [];

        if (rooms.length === 0) {
            table.innerHTML = '<tbody><tr><td style="padding: 40px; text-align: center; color: var(--color-text-muted);">特別教室が登録されていません。マスター編集から追加してください。</td></tr></tbody>';
            return;
        }

        // ヘッダー行
        let html = '<thead><tr><th class="time-header">時限</th>';
        rooms.forEach(room => {
            html += `<th>${escapeHtml(room.name)}</th>`;
        });
        html += '</tr></thead><tbody>';

        // 行生成
        DAYS.forEach((day, dayIndex) => {
            for (let period = 0; period < PERIODS; period++) {
                const isLastPeriod = period === PERIODS - 1;
                const rowClass = isLastPeriod ? 'day-last' : '';
                html += `<tr class="${rowClass}"><td class="time-header">${day}${period + 1}</td>`;

                rooms.forEach(room => {
                    // この教室・この時間の授業を探す
                    // ※データ構造が Class -> Time なので、全クラスを走査する必要がある
                    // data.js に逆引きメソッドを作るのが効率的だが、ここではループで処理する
                    const assignedLessons = [];

                    CLASSES.forEach(cls => {
                        const slots = this.store.getSlot(cls.id, dayIndex, period);
                        slots.forEach(slot => {
                            // 新形式: specialClassroomIds (配列), 旧形式: specialClassroomId (単一)
                            const roomIds = slot.specialClassroomIds || (slot.specialClassroomId ? [slot.specialClassroomId] : []);
                            if (roomIds.includes(room.id)) {
                                assignedLessons.push({
                                    classId: cls.id,
                                    className: cls.name,
                                    subjectId: slot.subjectId,
                                    teacherIds: slot.teacherIds
                                });
                            }
                        });
                    });

                    // non-class-duty (授業外業務) もチェック
                    const nonClassSlots = this.store.getSlot('non-class-duty', dayIndex, period);
                    nonClassSlots.forEach(slot => {
                        const roomIds = slot.specialClassroomIds || (slot.specialClassroomId ? [slot.specialClassroomId] : []);
                        if (roomIds.includes(room.id)) {
                            assignedLessons.push({
                                classId: 'non-class-duty',
                                className: '業務',
                                subjectId: slot.subjectId,
                                teacherIds: slot.teacherIds
                            });
                        }
                    });

                    // 表示
                    if (assignedLessons.length > 0) {
                        // 複数クラスが同じ教室を使うことは物理的にありえない（重複警告対象）が、
                        // データ上はありえるので表示する
                        const isConflict = assignedLessons.length > 1;
                        const cellClass = isConflict ? 'conflict' : 'has-lesson';

                        html += `<td class="${cellClass}"
                                    data-room-id="${room.id}"
                                    data-day="${dayIndex}"
                                    data-period="${period}">`;

                        assignedLessons.forEach(lesson => {
                            const subject = this.store.getSubject(lesson.subjectId);
                            const subjectName = subject ? subject.shortName : '不明';
                            const teacherNames = lesson.teacherIds.map(tid => {
                                const t = this.store.getTeacher(tid);
                                return t ? t.name : '不明';
                            }).join('・');

                            html += `
                                <div class="cell-content-multi">
                                    <span class="cell-subject">${escapeHtml(lesson.className)}</span>
                                    <span class="cell-class">${escapeHtml(subjectName)} / ${escapeHtml(teacherNames)}</span>
                                </div>
                            `;
                        });
                        html += '</td>';
                    } else {
                        html += `<td data-room-id="${room.id}" data-day="${dayIndex}" data-period="${period}"></td>`;
                    }
                });
                html += '</tr>';
            }
        });
        html += '</tbody>';
        table.innerHTML = html;

        // イベントリスナー（現在は表示のみ、ドラッグ移動は未実装）
        // 要望があればここに追加
    }
    attachClassTableEvents(table) {
        // Class View DnD can be complex, for now copy same logic but adapted
        let draggedData = null;

        table.querySelectorAll('.has-lesson').forEach(td => {
            td.setAttribute('draggable', 'true');
            td.style.cursor = 'grab';

            td.addEventListener('dragstart', (e) => {
                const classId = td.dataset.classId;
                const day = td.dataset.day;
                const period = td.dataset.period;

                const slots = this.store.getSlot(classId, day, period);
                const visibleSlots = slots.filter(s => !this.store.getSubject(s.subjectId)?.isHidden);

                if (visibleSlots.length > 0) {
                    const target = visibleSlots[0];
                    draggedData = {
                        classId,
                        day: parseInt(day),
                        period: parseInt(period),
                        subjectId: target.subjectId,
                        teacherIds: target.teacherIds
                    };
                    e.dataTransfer.effectAllowed = 'move';
                    td.classList.add('dragging');
                } else {
                    e.preventDefault();
                }
            });

            td.addEventListener('dragend', () => {
                td.classList.remove('dragging');
                draggedData = null;
                table.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
            });
        });

        table.querySelectorAll('td[data-day]').forEach(td => {
            td.addEventListener('dragover', (e) => {
                if (!draggedData) return;
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
                if (!draggedData) return;

                const toClassId = td.dataset.classId; // class table has this
                if (!toClassId) return; // safety

                const toDay = parseInt(td.dataset.day);
                const toPeriod = parseInt(td.dataset.period);

                if (draggedData.day === toDay && draggedData.period === toPeriod) return;

                // Move logic (simplified from ui.js for class view)
                // Class view drop implies moving to a different time, potentially same class? 
                // Using dataset.classId of drop target.

                // If dropping to different class, checking constraints is hard.
                // Assuming move within same class for now if ID matches?
                // The original code in ui.js used `td.dataset.classId` for toClassId.
                // But `store.moveLesson` takes classId. 
                // If I drag from 1-1 to 1-2, it moves the lesson to 1-2? No, `moveLesson` takes `classId` as WHERE the lesson is.
                // It moves the time. It does NOT change the class ID of the assignment usually in `moveLesson`.
                // Actually `moveSingleLesson` updates `timetable[classId]`.
                // So if I drop on a different class's cell, it currently won't change the class ID of the lesson, it just moves the time for the ORIGINAL class.
                // Wait, `ui.js` logic for `renderClassTimetable` drop listener:
                // `const toClassId = td.dataset.classId;`
                // But it didn't use `toClassId` in `moveLesson`.
                // It uses `draggedData.classId`. 
                // So dragging on Class View ONLY changes time, even if you drop on another class's column?
                // Visual confusion? Yes. But strictly following original logic.

                const ttInfo = this.store.isTTSlot(draggedData.classId, draggedData.day, draggedData.period);
                const isJoint = ttInfo.isTT && (ttInfo.type === 'same_teacher' || ttInfo.type === 'both');

                this.store.snapshot();
                this.ui.updateUndoRedoButtons(); // Call helper on main UI

                if (isJoint) {
                    const teacherId = draggedData.teacherIds[0];
                    const jointSlots = [];
                    CLASSES.forEach(cls => {
                        const slots = this.store.getSlot(cls.id, draggedData.day, draggedData.period);
                        slots.forEach(slot => {
                            if (slot.teacherIds && slot.teacherIds.includes(teacherId)) {
                                jointSlots.push({
                                    classId: cls.id,
                                    subjectId: slot.subjectId,
                                    teacherIds: slot.teacherIds
                                });
                            }
                        });
                    });

                    jointSlots.forEach(slot => {
                        this.store.moveSingleLesson(
                            slot.classId,
                            draggedData.day,
                            draggedData.period,
                            slot.subjectId,
                            slot.teacherIds,
                            toDay,
                            toPeriod
                        );
                    });
                    showToast(`合同授業${jointSlots.length}件を移動しました`, 'success');
                } else {
                    const result = this.store.moveLesson(
                        draggedData.classId,
                        draggedData.day,
                        draggedData.period,
                        draggedData.subjectId,
                        draggedData.teacherIds,
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
            });
        });

        // Click event
        table.querySelectorAll('td[data-class-id]').forEach(td => {
            td.addEventListener('click', (e) => {
                if (td.classList.contains('dragging')) return;

                const day = parseInt(td.dataset.day);
                const period = parseInt(td.dataset.period);
                const classId = td.dataset.classId;

                const slots = this.store.getSlot(classId, day, period);
                const hasLesson = slots.length > 0;

                if (hasLesson) {
                    const firstSlot = slots[0];
                    const tid = firstSlot.teacherIds[0];
                    this.ui.openOverviewLessonModal(classId, day, period, tid);
                } else {
                    // 空セルクリック時もモーダルを開く（クラスタブ用）
                    this.ui.openClassAddModal(classId, day, period);
                }
            });
        });
    }

    checkConflicts() {
        const multiWarnings = [];
        CLASSES.forEach(cls => {
            for (let day = 0; day < DAYS.length; day++) {
                for (let period = 0; period < PERIODS; period++) {
                    const slots = this.store.getSlot(cls.id, day, period);
                    const visibleSlots = slots.filter(s => !this.store.getSubject(s.subjectId)?.isHidden);
                    if (visibleSlots.length > 1) {
                        multiWarnings.push({
                            className: cls.name,
                            day: day,
                            period: period
                        });
                    }
                }
            }
        });

        const warningBadge = document.getElementById('multi-warning-badge');
        if (warningBadge) {
            if (multiWarnings.length > 0) {
                const warningText = multiWarnings.map(w =>
                    `${w.className}${DAYS[w.day]}${w.period + 1}`
                ).join('、');
                warningBadge.textContent = `⚠️ 複数授業: ${warningText}`;
                warningBadge.classList.remove('hidden');
            } else {
                warningBadge.classList.add('hidden');
            }
        }
    }

    /**
     * 教員の担当授業管理モーダル（教科→科目→クラスの3段階タグUI）
     * 教科タグで絞り込み → 科目タグ選択 → クラスタグでON/OFF
     * 教員の担当教科（categoryIds）を初期選択
     */
    openTeacherAssignmentModal(teacherId) {
        const teacher = this.store.getTeacher(teacherId);
        if (!teacher) return;

        document.querySelectorAll('.asgn-modal-overlay').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay asgn-modal-overlay';

        // 教科ごとの色
        const catColorMap = {};
        this.store.categories.forEach((cat, i) => {
            catColorMap[cat.id] = cat.color || `hsl(${(i * 47) % 360}, 60%, 88%)`;
        });

        // 教員の担当教科の最初のIDを初期選択
        const teacherCatIds = teacher.categoryIds || [];
        let selectedCategoryId = teacherCatIds.length > 0 ? teacherCatIds[0] : (this.store.categories[0]?.id || null);
        let selectedSubjectId = null;

        // ── 教科タグ ──
        const renderCategoryTags = () => {
            return this.store.categories.map(cat => {
                const isSelected = cat.id === selectedCategoryId;
                const isTeacherCat = teacherCatIds.includes(cat.id);
                const bg = isSelected ? (catColorMap[cat.id] || '#e0e7ff') : '#f5f5f5';
                const border = isSelected ? '2px solid #4a6fa5' : (isTeacherCat ? `2px solid ${catColorMap[cat.id] || '#ccc'}` : '2px solid #ddd');
                const fw = isTeacherCat ? 'bold' : 'normal';
                return `
                    <span class="asgn-cat-tag" data-cat-id="${escapeHtml(cat.id)}"
                          style="padding:4px 12px; border-radius:20px; cursor:pointer; font-size:0.88em;
                                 user-select:none; font-weight:${fw};
                                 background:${bg}; border:${border};">
                        ${escapeHtml(cat.name)}
                    </span>
                `;
            }).join('');
        };

        // ── 科目タグ（選択教科でフィルタ） ──
        const renderSubjectTags = () => {
            if (!selectedCategoryId) return '<p style="color:#aaa; font-size:0.9em;">教科を選択してください</p>';
            const subjects = this.store.subjects.filter(s => s.categoryId === selectedCategoryId && !s.isHidden);
            if (subjects.length === 0) return '<p style="color:#aaa; font-size:0.9em;">この教科に科目がありません</p>';
            return subjects.map(s => {
                const count = this.store.assignments.filter(a => a.teacherId === teacherId && a.subjectId === s.id).length;
                const isSelected = s.id === selectedSubjectId;
                const bg = isSelected ? (catColorMap[s.categoryId] || '#e0e7ff') : (count > 0 ? (catColorMap[s.categoryId] || '#f0f0f0') : '#f5f5f5');
                const border = isSelected ? '2px solid #4a6fa5' : (count > 0 ? '2px solid transparent' : '2px solid #ddd');
                const opacity = count === 0 && !isSelected ? '0.6' : '1';
                return `
                    <span class="asgn-subject-tag" data-subject-id="${escapeHtml(s.id)}"
                          style="display:inline-flex; align-items:center; gap:4px; padding:5px 10px; border-radius:20px;
                                 cursor:pointer; font-size:0.88em; user-select:none;
                                 background:${bg}; border:${border}; opacity:${opacity};">
                        ${escapeHtml(s.name)}
                        ${count > 0 ? `<span style="background:#4a6fa5; color:#fff; border-radius:50%; width:18px; height:18px; font-size:0.75em; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">${count}</span>` : ''}
                    </span>
                `;
            }).join('');
        };

        // ── クラスタグ（科目の学年・クラス属性でフィルタ） ──
        const renderClassPanel = () => {
            if (!selectedSubjectId) return '<p style="color:#aaa; font-size:0.9em;">← 科目を選択してください</p>';
            const sub = this.store.getSubject(selectedSubjectId);
            if (!sub) return '';

            // 科目の学年・クラス属性で表示クラスを絞り込む
            let filteredClasses = CLASSES;
            if (sub.targetClass) {
                filteredClasses = CLASSES.filter(c => c.id === sub.targetClass);
            } else if (sub.grade) {
                filteredClasses = CLASSES.filter(c => String(c.grade) === String(sub.grade));
            }

            const assignedClassIds = new Set(
                this.store.assignments.filter(a => a.teacherId === teacherId && a.subjectId === selectedSubjectId).map(a => a.classId)
            );
            const filterNote = sub.targetClass ? '（クラス指定）' : sub.grade ? `（${sub.grade}年生対象）` : '';
            const tags = filteredClasses.map(c => {
                const isActive = assignedClassIds.has(c.id);
                return `
                    <span class="asgn-class-tag" data-class-id="${escapeHtml(c.id)}"
                          style="padding:5px 12px; border-radius:16px; cursor:pointer; font-size:0.88em; user-select:none;
                                 background:${isActive ? '#4a6fa5' : '#f0f0f0'};
                                 color:${isActive ? '#fff' : '#333'};
                                 border:2px solid ${isActive ? '#3a5f95' : '#ddd'};">
                        ${escapeHtml(c.name)}${isActive ? ' ✓' : ''}
                    </span>
                `;
            }).join('');
            return `
                <div style="font-size:0.85em; color:#555; margin-bottom:8px;">
                    <strong>${escapeHtml(sub.name)}</strong>（${sub.credits || 1}単位/週）${escapeHtml(filterNote)} のクラスをクリックで担当設定:
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">${tags || '<span style="color:#aaa;">対象クラスがありません</span>'}</div>
            `;
        };

        overlay.innerHTML = `
            <div class="dialog-content" style="width:640px; max-width:92vw; max-height:85vh; display:flex; flex-direction:column; gap:0; padding:24px;">
                <h3 style="margin:0 0 14px;">${escapeHtml(teacher.name)} の担当授業</h3>

                <div style="font-size:0.78em; color:#888; margin-bottom:4px;">① 教科</div>
                <div id="asgn-cat-area" style="display:flex; flex-wrap:wrap; gap:6px; padding-bottom:12px; border-bottom:1px solid #e5e7eb;">
                    ${renderCategoryTags()}
                </div>

                <div style="font-size:0.78em; color:#888; margin:10px 0 4px;">② 科目</div>
                <div id="asgn-subject-area" style="display:flex; flex-wrap:wrap; gap:6px; padding-bottom:12px; border-bottom:1px solid #e5e7eb; min-height:36px;">
                    ${renderSubjectTags()}
                </div>

                <div style="font-size:0.78em; color:#888; margin:10px 0 4px;">③ クラス（クリックで担当ON/OFF）</div>
                <div id="asgn-class-area" style="min-height:60px; padding-bottom:12px; border-bottom:1px solid #e5e7eb;">
                    ${renderClassPanel()}
                </div>

                <div style="padding-top:14px; text-align:right;">
                    <button class="btn btn-secondary" id="btn-close-asgn-modal">閉じる</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const catArea     = overlay.querySelector('#asgn-cat-area');
        const subjectArea = overlay.querySelector('#asgn-subject-area');
        const classArea   = overlay.querySelector('#asgn-class-area');

        const redrawAll = () => {
            catArea.innerHTML     = renderCategoryTags();
            subjectArea.innerHTML = renderSubjectTags();
            classArea.innerHTML   = renderClassPanel();
            attachCatEvents();
            attachSubjectEvents();
            attachClassEvents();
        };

        const attachCatEvents = () => {
            catArea.querySelectorAll('.asgn-cat-tag').forEach(tag => {
                tag.onclick = () => {
                    selectedCategoryId = tag.dataset.catId;
                    selectedSubjectId = null;  // 教科変更で科目選択リセット
                    redrawAll();
                };
            });
        };

        const attachSubjectEvents = () => {
            subjectArea.querySelectorAll('.asgn-subject-tag').forEach(tag => {
                tag.onclick = () => {
                    selectedSubjectId = tag.dataset.subjectId === selectedSubjectId ? null : tag.dataset.subjectId;
                    subjectArea.innerHTML = renderSubjectTags();
                    classArea.innerHTML   = renderClassPanel();
                    attachSubjectEvents();
                    attachClassEvents();
                };
            });
        };

        const attachClassEvents = () => {
            classArea.querySelectorAll('.asgn-class-tag').forEach(tag => {
                tag.onclick = () => {
                    if (!selectedSubjectId) return;
                    const classId = tag.dataset.classId;
                    const sub = this.store.getSubject(selectedSubjectId);
                    const existing = this.store.assignments.find(
                        a => a.teacherId === teacherId && a.subjectId === selectedSubjectId && a.classId === classId
                    );
                    if (existing) {
                        this.store.deleteAssignment(teacherId, selectedSubjectId, classId);
                    } else {
                        this.store.addAssignment(teacherId, selectedSubjectId, classId, sub ? (sub.credits || 1) : 1);
                    }
                    subjectArea.innerHTML = renderSubjectTags();
                    classArea.innerHTML   = renderClassPanel();
                    attachSubjectEvents();
                    attachClassEvents();
                    this.render();
                };
            });
        };

        attachCatEvents();
        attachSubjectEvents();
        attachClassEvents();

        overlay.querySelector('#btn-close-asgn-modal').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }
}
