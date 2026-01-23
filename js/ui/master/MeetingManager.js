/**
 * MeetingManager - 会議管理モジュール
 */
class MeetingManager {
    constructor(store, ui, masterData) {
        this.store = store;
        this.ui = ui;
        this.masterData = masterData;
        this.meetingState = {
            name: '',
            selectedTeacherIds: [],
            schedule: []
        };
    }

    render() {
        this.renderForm();
        this.renderList();
    }

    renderForm() {
        const formContainer = document.getElementById('meeting-form');
        if (!formContainer) return;

        formContainer.innerHTML = `
            <div class="form-group">
                <label>会議名</label>
                <input type="text" id="meeting-name" value="${this.meetingState.name}" placeholder="例: 職員会議">
            </div>
            <div class="form-group">
                <label>参加教員</label>
                <div id="meeting-teachers" style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 150px; overflow-y: auto; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    ${this.store.teachers.map(t => {
            const isChecked = this.meetingState.selectedTeacherIds.includes(t.id);
            return `<label style="display: flex; align-items: center; gap: 4px;">
                            <input type="checkbox" class="meeting-teacher-check" value="${t.id}" ${isChecked ? 'checked' : ''}>
                            ${t.name}
                        </label>`;
        }).join('')}
                </div>
                <div style="margin-top: 8px;">
                    <button id="btn-select-all-teachers" class="btn btn-secondary btn-sm">全選択</button>
                    <button id="btn-deselect-all-teachers" class="btn btn-secondary btn-sm">全解除</button>
                </div>
            </div>
            <div class="form-group">
                <label>スケジュール（クリックで選択）</label>
                <div id="meeting-schedule-grid"></div>
            </div>
            <button id="btn-add-meeting" class="btn btn-primary">会議を追加</button>
        `;

        this.renderScheduleGrid();
        this.attachFormEvents();
    }

    renderScheduleGrid() {
        const grid = document.getElementById('meeting-schedule-grid');
        if (!grid) return;

        let html = '<table class="schedule-grid" style="width: 100%; border-collapse: collapse;">';
        html += '<thead><tr><th style="width: 40px;"></th>';
        DAYS.forEach(day => {
            html += `<th style="padding: 4px; text-align: center;">${day}</th>`;
        });
        html += '</tr></thead><tbody>';

        for (let period = 0; period < PERIODS; period++) {
            html += `<tr><td style="text-align: center; font-weight: bold;">${period + 1}</td>`;
            DAYS.forEach((day, dayIndex) => {
                const isSelected = this.meetingState.schedule.some(
                    s => s.dayIndex === dayIndex && s.period === period + 1
                );
                html += `<td class="schedule-cell ${isSelected ? 'selected' : ''}" 
                         data-day="${dayIndex}" data-period="${period + 1}"
                         style="padding: 8px; text-align: center; cursor: pointer; border: 1px solid #ddd; background: ${isSelected ? '#4CAF50' : '#fff'};">
                    ${isSelected ? '✓' : ''}
                </td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table>';
        grid.innerHTML = html;
    }

    attachFormEvents() {
        // 名前入力
        const nameInput = document.getElementById('meeting-name');
        if (nameInput) {
            nameInput.oninput = () => {
                this.meetingState.name = nameInput.value;
            };
        }

        // 教員チェックボックス
        document.querySelectorAll('.meeting-teacher-check').forEach(cb => {
            cb.onchange = () => {
                if (cb.checked) {
                    if (!this.meetingState.selectedTeacherIds.includes(cb.value)) {
                        this.meetingState.selectedTeacherIds.push(cb.value);
                    }
                } else {
                    this.meetingState.selectedTeacherIds = this.meetingState.selectedTeacherIds.filter(id => id !== cb.value);
                }
            };
        });

        // 全選択/全解除
        const selectAllBtn = document.getElementById('btn-select-all-teachers');
        if (selectAllBtn) {
            selectAllBtn.onclick = () => {
                this.meetingState.selectedTeacherIds = this.store.teachers.map(t => t.id);
                this.renderForm();
            };
        }

        const deselectAllBtn = document.getElementById('btn-deselect-all-teachers');
        if (deselectAllBtn) {
            deselectAllBtn.onclick = () => {
                this.meetingState.selectedTeacherIds = [];
                this.renderForm();
            };
        }

        // スケジュールクリック
        document.querySelectorAll('.schedule-cell').forEach(cell => {
            cell.onclick = () => {
                const dayIndex = parseInt(cell.dataset.day);
                const period = parseInt(cell.dataset.period);

                const existingIndex = this.meetingState.schedule.findIndex(
                    s => s.dayIndex === dayIndex && s.period === period
                );

                if (existingIndex >= 0) {
                    this.meetingState.schedule.splice(existingIndex, 1);
                } else {
                    this.meetingState.schedule.push({ dayIndex, period });
                }

                this.renderScheduleGrid();
            };
        });

        // 追加ボタン
        const addBtn = document.getElementById('btn-add-meeting');
        if (addBtn) {
            addBtn.onclick = () => this.addMeeting();
        }
    }

    addMeeting() {
        if (!this.meetingState.name.trim()) {
            showToast('会議名を入力してください', 'error');
            return;
        }
        if (this.meetingState.selectedTeacherIds.length === 0) {
            showToast('参加教員を選択してください', 'error');
            return;
        }
        if (this.meetingState.schedule.length === 0) {
            showToast('スケジュールを選択してください', 'error');
            return;
        }

        this.store.addMeeting(`m_${Date.now()}`, this.meetingState.name.trim(),
            this.meetingState.selectedTeacherIds, this.meetingState.schedule);

        // 状態リセット
        this.meetingState = {
            name: '',
            selectedTeacherIds: [],
            schedule: []
        };

        this.render();
        this.ui.renderMainOverview();
        showToast('会議を追加しました', 'success');
    }

    renderList() {
        const container = document.getElementById('meeting-list');
        if (!container) return;

        if (this.store.meetings.length === 0) {
            container.innerHTML = '<p class="placeholder-text">登録された会議はありません</p>';
            return;
        }

        let html = '<div class="meeting-items">';
        this.store.meetings.forEach(meeting => {
            const teacherNames = meeting.teacherIds.map(tid => {
                const t = this.store.getTeacher(tid);
                return t ? t.name : '不明';
            }).slice(0, 3).join('、');
            const moreCount = meeting.teacherIds.length > 3 ? ` 他${meeting.teacherIds.length - 3}名` : '';

            const scheduleText = meeting.schedule.map(s =>
                `${DAYS[s.dayIndex]}${s.period}`
            ).join('、');

            html += `
                <div class="meeting-item" data-id="${meeting.id}">
                    <div class="meeting-info">
                        <span class="meeting-name">${meeting.name}</span>
                        <span class="meeting-teachers" style="font-size: 0.85em; color: #666;">${teacherNames}${moreCount}</span>
                        <span class="meeting-schedule" style="font-size: 0.85em; color: #888;">${scheduleText}</span>
                    </div>
                    <div class="meeting-actions">
                        <button class="btn-edit" data-id="${meeting.id}">✏️</button>
                        <button class="btn-delete" data-id="${meeting.id}">×</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;

        this.attachListEvents(container);
    }

    attachListEvents(container) {
        // 編集
        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = () => {
                const meeting = this.store.getMeeting(btn.dataset.id);
                if (meeting) {
                    this.meetingState = {
                        name: meeting.name,
                        selectedTeacherIds: [...meeting.teacherIds],
                        schedule: [...meeting.schedule],
                        editingId: meeting.id
                    };
                    this.renderForm();

                    // ボタンを「更新」に変更
                    const addBtn = document.getElementById('btn-add-meeting');
                    if (addBtn) {
                        addBtn.textContent = '会議を更新';
                        addBtn.onclick = () => this.updateMeeting(meeting.id);
                    }
                }
            };
        });

        // 削除
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = () => {
                const meeting = this.store.getMeeting(btn.dataset.id);
                if (meeting && confirm(`「${meeting.name}」を削除しますか？`)) {
                    this.store.deleteMeeting(btn.dataset.id);
                    this.render();
                    this.ui.renderMainOverview();
                    showToast('削除しました', 'success');
                }
            };
        });
    }

    updateMeeting(meetingId) {
        if (!this.meetingState.name.trim()) {
            showToast('会議名を入力してください', 'error');
            return;
        }

        this.store.updateMeeting(meetingId, {
            name: this.meetingState.name.trim(),
            teacherIds: this.meetingState.selectedTeacherIds,
            schedule: this.meetingState.schedule
        });

        this.meetingState = {
            name: '',
            selectedTeacherIds: [],
            schedule: []
        };

        this.render();
        this.ui.renderMainOverview();
        showToast('更新しました', 'success');
    }
}

// グローバルに公開
window.MeetingManager = MeetingManager;
