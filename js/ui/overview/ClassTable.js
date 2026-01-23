/**
 * ClassTableRenderer - 全クラスタブの時間割表示
 */
class ClassTableRenderer {
    constructor(store, ui, overview) {
        this.store = store;
        this.ui = ui;
        this.overview = overview;
    }

    render() {
        const table = document.getElementById('main-overview-table');
        if (!table) return;

        this.setupFilter();

        let classes = CLASSES;
        if (this.overview.mainFilterClassId) {
            classes = classes.filter(c => c.id === this.overview.mainFilterClassId);
        }

        let html = this.renderHeader(classes);
        html += this.renderBody(classes);

        table.innerHTML = html;
        this.attachEvents(table);
    }

    setupFilter() {
        const filterSelect = document.getElementById('overview-filter');
        if (filterSelect) {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="">すべてのクラス</option>' +
                CLASSES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

            if (this.overview.mainFilterClassId && filterSelect.querySelector(`option[value="${this.overview.mainFilterClassId}"]`)) {
                filterSelect.value = this.overview.mainFilterClassId;
            } else {
                filterSelect.value = '';
                this.overview.mainFilterClassId = '';
            }

            filterSelect.onchange = (e) => {
                this.overview.mainFilterClassId = e.target.value;
                this.overview.render();
            };
        }
    }

    renderHeader(classes) {
        let html = '<thead><tr><th class="time-header">時限</th>';
        classes.forEach((cls, index) => {
            const isSeparator = index < classes.length - 1 && cls.grade !== classes[index + 1].grade;
            const style = isSeparator ? 'style="border-right: 3px solid #666;"' : '';
            html += `<th ${style}>${cls.name}</th>`;
        });
        html += '</tr></thead>';
        return html;
    }

    renderBody(classes) {
        let html = '<tbody>';

        DAYS.forEach((day, dayIndex) => {
            for (let period = 0; period < PERIODS; period++) {
                const isLastPeriod = period === PERIODS - 1;
                const rowClass = isLastPeriod ? 'day-last' : '';
                html += `<tr class="${rowClass}"><td class="time-header">${day}${period + 1}</td>`;

                classes.forEach((cls, index) => {
                    html += this.renderCell(cls, dayIndex, period, index, classes);
                });

                html += '</tr>';
            }
        });

        html += '</tbody>';
        return html;
    }

    renderCell(cls, dayIndex, period, index, classes) {
        const isSeparator = index < classes.length - 1 && cls.grade !== classes[index + 1].grade;
        const separatorStyle = isSeparator ? 'style="border-right: 3px solid #666;"' : '';

        const slots = this.store.getSlot(cls.id, dayIndex, period);
        const visibleSlots = slots.filter(slot => {
            const subject = this.store.getSubject(slot.subjectId);
            return !subject || !subject.isHidden;
        });

        if (visibleSlots.length > 0) {
            return this.renderLessonCell(cls, dayIndex, period, visibleSlots, separatorStyle);
        } else {
            return `<td ${separatorStyle} data-class-id="${cls.id}" data-day="${dayIndex}" data-period="${period}"></td>`;
        }
    }

    renderLessonCell(cls, dayIndex, period, visibleSlots, separatorStyle) {
        const ttInfo = this.store.isTTSlot(cls.id, dayIndex, period);
        let ttClass = '';
        if (ttInfo.isTT) {
            if (ttInfo.type === 'same_class') ttClass = 'cell-tt cell-tt-same-class';
            else if (ttInfo.type === 'same_teacher') ttClass = 'cell-tt cell-tt-same-teacher';
            else if (ttInfo.type === 'both') ttClass = 'cell-tt';
        }

        const multiWarningClass = visibleSlots.length > 1 ? 'cell-multi-warning' : '';

        let html = `<td class="has-lesson ${ttClass} ${multiWarningClass}"
            ${separatorStyle}
            data-class-id="${cls.id}"
            data-day="${dayIndex}"
            data-period="${period}">`;

        if (visibleSlots.length > 1) {
            html += '<div class="multi-lesson-container">';
        }

        // バッジ
        if (ttInfo.isTT && (ttInfo.type === 'same_teacher' || ttInfo.type === 'both')) {
            html += '<span class="tt-badge">合同</span>';
        }
        if (ttInfo.isTT && (ttInfo.type === 'same_class' || ttInfo.type === 'both')) {
            html += '<span class="tt-badge">TT</span>';
        }

        // 授業内容
        visibleSlots.forEach(slot => {
            const subject = this.store.getSubject(slot.subjectId);
            const subjectName = subject ? subject.shortName : '不明';
            const linkedCount = this.store.getLinkedLessons(cls.id, dayIndex, period).length;
            const linkIndicator = linkedCount > 1 ? `<span class="link-badge" title="連動: ${linkedCount}件">🔗</span>` : '';

            const teacherNames = slot.teacherIds.map(tid => {
                const t = this.store.getTeacher(tid);
                return t ? t.name : '不明';
            }).join('・');

            // 使用教室
            let roomNames = '';
            const roomIds = slot.specialClassroomIds || (slot.specialClassroomId ? [slot.specialClassroomId] : []);
            if (roomIds.length > 0) {
                const names = roomIds.map(rid => {
                    const r = this.store.getSpecialClassroom(rid);
                    return r ? (r.shortName || r.name) : '';
                }).filter(n => n);
                if (names.length > 0) {
                    roomNames = `<span style="font-size:0.8em; color:#007bff;">@${names.join('・')}</span>`;
                }
            }

            html += `<div class="cell-content-multi">
                <span class="cell-subject">${linkIndicator}${subjectName}</span>
                <span class="cell-class">${teacherNames} ${roomNames}</span>
            </div>`;
        });

        if (visibleSlots.length > 1) {
            html += '</div>';
        }

        html += '</td>';
        return html;
    }

    attachEvents(table) {
        table.querySelectorAll('td[data-class-id]').forEach(td => {
            td.addEventListener('click', () => {
                const classId = td.dataset.classId;
                const day = parseInt(td.dataset.day);
                const period = parseInt(td.dataset.period);
                this.ui.openClassLessonModal(classId, day, period);
            });
        });

        this.overview.setupClassDragAndDrop(table);
    }
}

// グローバルに公開
window.ClassTableRenderer = ClassTableRenderer;
