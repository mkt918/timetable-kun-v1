/**
 * TeacherTableRenderer - 全教員タブの時間割表示
 */
class TeacherTableRenderer {
    constructor(store, ui, overview) {
        this.store = store;
        this.ui = ui;
        this.overview = overview;
    }

    render() {
        const table = document.getElementById('main-overview-table');
        if (!table) return;

        // フィルタ設定
        this.setupFilter();

        let teachers = this.store.teachers;
        if (this.overview.mainFilterTeacherId) {
            teachers = teachers.filter(t => t.id === this.overview.mainFilterTeacherId);
        }

        if (teachers.length === 0) {
            table.innerHTML = '<tbody><tr><td style="padding: 40px; text-align: center; color: var(--color-text-muted);">教員がいません。マスター編集から追加してください。</td></tr></tbody>';
            return;
        }

        // 重複チェック
        const conflicts = this.store.checkConflicts();
        const conflictCells = new Set();
        conflicts.forEach(c => {
            conflictCells.add(`${c.teacherId}-${c.day}-${c.period}`);
        });

        // 各教員の時間割を事前に取得
        const teacherTimetables = {};
        teachers.forEach(teacher => {
            teacherTimetables[teacher.id] = this.store.getTeacherTimetable(teacher.id);
        });

        // テーブル生成
        let html = this.renderHeader(teachers, teacherTimetables);
        html += this.renderBody(teachers, teacherTimetables, conflictCells);

        table.innerHTML = html;
        this.attachEvents(table);
    }

    setupFilter() {
        const filterSelect = document.getElementById('overview-filter');
        if (filterSelect) {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="">すべての教員</option>' +
                this.store.teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

            if (this.overview.mainFilterTeacherId) {
                filterSelect.value = this.overview.mainFilterTeacherId;
            } else {
                filterSelect.value = currentVal;
            }

            filterSelect.onchange = (e) => {
                this.overview.mainFilterTeacherId = e.target.value;
                this.overview.render();
            };
        }
    }

    renderHeader(teachers, teacherTimetables) {
        let html = '<thead><tr><th class="time-header">時限</th>';

        teachers.forEach(teacher => {
            const separatorClass = teacher.separator ? 'teacher-separator' : '';
            const lessonData = this.countLessons(teacher, teacherTimetables);

            // 表示形式: 5/18コマ（分母が0の場合は「5コマ」）
            let lessonDisplay = '';
            if (lessonData.total > 0) {
                lessonDisplay = `${lessonData.current}/${lessonData.total}コマ`;
            } else {
                lessonDisplay = `${lessonData.current}コマ`;
            }

            html += `<th class="${separatorClass}" style="cursor: default;">
                <span style="cursor: pointer; text-decoration: underline dotted;" onclick="ui.openTeacherAssignmentModal('${teacher.id}')" title="クリックして担当授業を設定">${teacher.name}</span>
                <span style="cursor: pointer; font-size:0.8em; margin-left:4px;" onclick="ui.openUnavailableSettingsModal('${teacher.id}')" title="勤務不可設定">⚙️</span>
                <div style="font-size: 0.8em; font-weight: normal; color: #666;">${lessonDisplay}</div>
            </th>`;
        });

        html += '</tr></thead>';
        return html;
    }

    countLessons(teacher, teacherTimetables) {
        // 実際に配置されているコマ数（分子）
        let currentCount = 0;
        DAYS.forEach((day, dayIndex) => {
            for (let period = 0; period < PERIODS; period++) {
                const key = `${dayIndex}-${period}`;
                const slots = teacherTimetables[teacher.id][key] || [];

                const hasMeeting = this.store.meetings.some(m =>
                    m.teacherIds.includes(teacher.id) &&
                    m.schedule.some(s => s.dayIndex === dayIndex && s.period === period + 1)
                );
                const isUnavailable = this.store.isUnavailable(teacher.id, dayIndex, period);

                if (slots.length > 0 && !hasMeeting && !isUnavailable) {
                    currentCount++;
                }
            }
        });

        // 担当授業で登録された総コマ数（分母）
        let totalCount = 0;
        const assignments = this.store.assignments.filter(a => a.teacherId === teacher.id);
        assignments.forEach(a => {
            totalCount += a.weeklyHours || 0;
        });

        return { current: currentCount, total: totalCount };
    }

    renderBody(teachers, teacherTimetables, conflictCells) {
        let html = '<tbody>';

        DAYS.forEach((day, dayIndex) => {
            for (let period = 0; period < PERIODS; period++) {
                const isLastPeriod = period === PERIODS - 1;
                const rowClass = isLastPeriod ? 'day-last' : '';
                html += `<tr class="${rowClass}"><td class="time-header">${day}${period + 1}</td>`;

                teachers.forEach(teacher => {
                    html += this.renderCell(teacher, dayIndex, period, teacherTimetables, conflictCells);
                });

                html += '</tr>';
            }
        });

        html += '</tbody>';
        return html;
    }

    renderCell(teacher, dayIndex, period, teacherTimetables, conflictCells) {
        const key = `${dayIndex}-${period}`;
        const slots = teacherTimetables[teacher.id][key] || [];
        const isConflict = conflictCells.has(`${teacher.id}-${dayIndex}-${period}`);
        const separatorClass = teacher.separator ? 'teacher-separator' : '';

        // 状態チェック
        const isUnavailable = this.store.isUnavailable(teacher.id, dayIndex, period);
        const unavailableClass = isUnavailable ? 'cell-unavailable' : '';
        let titleText = isUnavailable ? '勤務不可設定あり' : '';

        const meetings = this.store.meetings.filter(m =>
            m.teacherIds.includes(teacher.id) &&
            m.schedule.some(s => s.dayIndex === dayIndex && s.period === period + 1)
        );
        const hasMeeting = meetings.length > 0;
        const meetingClass = hasMeeting ? 'cell-meeting' : '';
        if (hasMeeting) {
            const meetingNames = meetings.map(m => m.name).join('、');
            titleText = titleText ? `${titleText} / 会議: ${meetingNames}` : `会議: ${meetingNames}`;
        }

        if (slots.length > 0) {
            return this.renderLessonCell(teacher, dayIndex, period, slots, isConflict, separatorClass, unavailableClass, meetingClass, titleText, hasMeeting, meetings);
        } else {
            return this.renderEmptyCell(teacher, dayIndex, period, separatorClass, unavailableClass, meetingClass, titleText, hasMeeting, meetings);
        }
    }

    renderLessonCell(teacher, dayIndex, period, slots, isConflict, separatorClass, unavailableClass, meetingClass, titleText, hasMeeting, meetings) {
        const conflictClass = isConflict ? 'conflict' : 'has-lesson';
        let ttClass = slots.length > 1 ? 'cell-tt cell-tt-same-teacher' : '';

        // 教科色
        let categoryColor = '';
        if (slots[0] && slots[0].subjectId) {
            const subject = this.store.getSubject(slots[0].subjectId);
            if (subject && subject.categoryId) {
                const category = this.store.getCategory(subject.categoryId);
                const categoryIndex = this.store.categories.findIndex(c => c.id === subject.categoryId);
                if (categoryIndex >= 0) {
                    const colorIndex = categoryIndex % 20;
                    const color = category?.color || `var(--category-color-${colorIndex})`;
                    categoryColor = `background-color: ${color};`;
                }
            }
        }

        let html = `<td class="${conflictClass} ${separatorClass} ${unavailableClass} ${meetingClass} ${ttClass}"
            data-teacher-id="${teacher.id}"
            data-day="${dayIndex}"
            data-period="${period}"
            title="${titleText}"
            style="${categoryColor}">`;

        // 会議表示
        if (hasMeeting) {
            html += `<div class="meeting-indicator" style="font-size: 0.75em; color: #666; margin-bottom: 2px;">${meetings.map(m => m.name).join('、')}</div>`;
        }

        // バッジ
        const isJoint = slots.length > 1;
        const isTT = slots.some(slot => slot.teacherIds && slot.teacherIds.length > 1);

        if (isJoint) {
            html += '<div class="multi-lesson-container">';
            html += '<span class="tt-badge">合同</span>';
        }
        if (isTT) {
            html += '<span class="tt-badge">TT</span>';
        }

        // 同一科目でグループ化して表示（合同授業は科目名を省略しクラスをまとめる）
        const subjectGroups = {};
        const subjectOrder = [];
        slots.forEach(slot => {
            const key = slot.subjectId || '__unknown__';
            if (!subjectGroups[key]) {
                subjectGroups[key] = { subjectName: slot.subjectName, slots: [] };
                subjectOrder.push(key);
            }
            subjectGroups[key].slots.push(slot);
        });

        subjectOrder.forEach(subjectId => {
            const group = subjectGroups[subjectId];
            const groupSlots = group.slots;

            // 最初のスロットから連動バッジ取得
            const firstSlot = groupSlots[0];
            const linkedCount = this.store.getLinkedLessons(firstSlot.classId, dayIndex, period).length;
            const linkIndicator = linkedCount > 1 ? `<span class="link-badge" title="連動: ${linkedCount}件">🔗</span>` : '';

            // 教室名（全スロット共通として最初から取得）
            let roomNames = '';
            if (firstSlot.specialClassroomIds && firstSlot.specialClassroomIds.length > 0) {
                const names = firstSlot.specialClassroomIds.map(rid => {
                    const r = this.store.getSpecialClassroom(rid);
                    return r ? (r.shortName || r.name) : '';
                }).filter(n => n);
                if (names.length > 0) {
                    roomNames = `<span style="font-size:0.8em; color:#007bff;">@${names.join('・')}</span>`;
                }
            }

            if (groupSlots.length > 1) {
                // 同一科目・複数クラス → 科目名1回 + クラスを圧縮表示（例: 3-1234）
                const classLabel = formatJointClassNames(groupSlots.map(s => s.className));
                html += `<div class="cell-content-multi">
                    <span class="cell-subject">${linkIndicator}${group.subjectName}</span>
                    <span class="cell-class">${classLabel} ${roomNames}</span>
                </div>`;
            } else {
                // 単独科目はそのまま短縮表示（例: 3-1）
                const classLabel = toShortClassName(firstSlot.className);
                html += `<div class="cell-content-multi">
                    <span class="cell-subject">${linkIndicator}${group.subjectName}</span>
                    <span class="cell-class">${classLabel} ${roomNames}</span>
                </div>`;
            }
        });

        if (isJoint) {
            html += '</div>';
        }

        html += '</td>';
        return html;
    }

    renderEmptyCell(teacher, dayIndex, period, separatorClass, unavailableClass, meetingClass, titleText, hasMeeting, meetings) {
        let html = `<td class="${separatorClass} ${unavailableClass} ${meetingClass}"
            data-teacher-id="${teacher.id}"
            data-day="${dayIndex}"
            data-period="${period}"
            title="${titleText}">`;

        if (hasMeeting) {
            html += `<div class="meeting-only" style="font-size: 0.85em; color: #666;">${meetings.map(m => m.name).join('、')}</div>`;
        }

        html += '</td>';
        return html;
    }

    attachEvents(table) {
        // セルクリック
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
                        this.ui.openOverviewAddModal(day, period, teacherId);
                    }
                } else {
                    this.ui.openOverviewAddModal(day, period, teacherId);
                }
            });
        });

        // ドラッグ&ドロップはoverviewに委譲
        this.overview.setupDragAndDrop(table);
    }
}

// グローバルに公開
window.TeacherTableRenderer = TeacherTableRenderer;
