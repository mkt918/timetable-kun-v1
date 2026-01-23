class UnavailableSettingsManager {
    constructor(store, ui) {
        this.store = store;
        this.ui = ui;
        this.editingUnavailableTeacherId = null;
    }

    open(teacherId) {
        this.editingUnavailableTeacherId = teacherId;
        const teacher = this.store.getTeacher(teacherId);
        if (!teacher) return;

        const modal = document.getElementById('modal-unavailable-settings');
        document.getElementById('unavailable-settings-title').textContent = `勤務不可時間設定 - ${teacher.name}`;

        const grid = document.getElementById('unavailable-settings-grid');
        grid.innerHTML = '';

        // Header
        grid.innerHTML += '<div class="unavailable-header"></div>';
        DAYS.forEach((day, i) => {
            grid.innerHTML += `
                <div class="unavailable-header">
                    ${day}
                    <button class="btn-bulk-toggle" onclick="ui.unavailableSettings.toggleBulk('day', ${i})">↓</button>
                </div>`;
        });

        // Grid
        for (let p = 0; p < PERIODS; p++) {
            grid.innerHTML += `
                <div class="unavailable-header">
                    ${p + 1}
                    <button class="btn-bulk-toggle" onclick="ui.unavailableSettings.toggleBulk('period', ${p})">→</button>
                </div>`;

            DAYS.forEach((day, dayIndex) => {
                const isUnavailable = this.store.isUnavailable(teacherId, dayIndex, p);
                grid.innerHTML += `
                    <div class="unavailable-settings-cell ${isUnavailable ? 'selected' : ''}"
                         data-day="${dayIndex}"
                         data-period="${p}"
                         onclick="this.classList.toggle('selected')">
                         ${isUnavailable ? '✕' : ''}
                    </div>`;
            });
        }

        document.getElementById('btn-save-unavailable').onclick = () => this.save();

        const closeBtns = modal.querySelectorAll('.modal-close');
        closeBtns.forEach(btn => btn.onclick = () => modal.classList.add('hidden'));

        modal.classList.remove('hidden');
    }

    toggleBulk(type, index) {
        const grid = document.getElementById('unavailable-settings-grid');
        let cells = [];
        if (type === 'day') {
            cells = grid.querySelectorAll(`.unavailable-settings-cell[data-day="${index}"]`);
        } else {
            cells = grid.querySelectorAll(`.unavailable-settings-cell[data-period="${index}"]`);
        }

        const allSelected = Array.from(cells).every(c => c.classList.contains('selected'));

        cells.forEach(c => {
            if (allSelected) {
                c.classList.remove('selected');
                c.textContent = '';
            } else {
                c.classList.add('selected');
                c.textContent = '✕';
            }
        });
    }

    save() {
        const teacherId = this.editingUnavailableTeacherId;
        const grid = document.getElementById('unavailable-settings-grid');
        const cells = grid.querySelectorAll('.unavailable-settings-cell.selected');

        // Reset for this teacher
        this.store.settings.unavailableSlots[teacherId] = [];

        cells.forEach(cell => {
            const d = parseInt(cell.dataset.day);
            const p = parseInt(cell.dataset.period);
            const key = `${d}-${p}`;
            if (!this.store.settings.unavailableSlots[teacherId].includes(key)) {
                this.store.settings.unavailableSlots[teacherId].push(key);
            }
        });

        this.store.saveToStorage();
        // save just settings object again to be safe/consistent with original logic
        this.store.saveSettings(this.store.settings.periods, this.store.settings.classConfig, this.store.settings.unavailableSlots);

        document.getElementById('modal-unavailable-settings').classList.add('hidden');
        showToast('勤務不可設定を保存しました', 'success');
        this.ui.renderMainOverview();
    }
}
