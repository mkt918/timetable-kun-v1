/**
 * TeacherManager - 教員管理モジュール
 */
class TeacherManager {
    constructor(store, ui, masterData) {
        this.store = store;
        this.ui = ui;
        this.masterData = masterData;
    }

    render() {
        const container = document.getElementById('teacher-cards');
        if (!container) return;

        container.innerHTML = this.store.teachers.map((teacher, index) => {
            const categoryNames = (teacher.categoryIds || [])
                .map(id => this.store.getCategory(id)?.name)
                .filter(name => name)
                .join('・');

            let backgroundColor = '';
            if (teacher.categoryIds && teacher.categoryIds.length > 0) {
                const category = this.store.getCategory(teacher.categoryIds[0]);
                const categoryIndex = this.store.categories.findIndex(c => c.id === teacher.categoryIds[0]);
                if (categoryIndex >= 0) {
                    const colorIndex = categoryIndex % 20;
                    const color = category?.color || `var(--category-color-${colorIndex})`;
                    backgroundColor = `background-color: ${color};`;
                }
            }

            return `
            <div class="card-item teacher-card ${teacher.separator ? 'has-separator' : ''}" 
                 data-id="${teacher.id}" 
                 data-index="${index}"
                 draggable="true"
                 style="${backgroundColor}">
                <div class="card-drag-handle">≡</div>
                <div class="card-content" style="display: flex; flex-direction: column; gap: 2px;">
                    <span class="card-name">${teacher.name}</span>
                    ${categoryNames ? `<span class="card-category" style="font-size: 0.75em; color: #555;">${categoryNames}</span>` : ''}
                </div>
                <div class="card-actions">
                    <button class="card-separator ${teacher.separator ? 'active' : ''}" data-id="${teacher.id}" title="右側に区切り線">|</button>
                    <button class="card-edit" data-id="${teacher.id}" title="編集">✏️</button>
                    <button class="card-delete" data-id="${teacher.id}" title="削除">×</button>
                </div>
            </div>
        `}).join('');

        this.attachEvents(container);
        this.setupButtons();
    }

    setupButtons() {
        const addBtn = document.getElementById('btn-add-teacher');
        if (addBtn) {
            addBtn.onclick = () => this.openDialog();
        }

        const sortBtn = document.getElementById('btn-sort-teachers-by-category');
        if (sortBtn) {
            sortBtn.onclick = () => this.sortByCategory();
        }
    }

    sortByCategory() {
        const categoryOrder = this.store.categories.map(c => c.id);

        this.store.teachers.sort((a, b) => {
            const aCategoryId = a.categoryIds && a.categoryIds.length > 0 ? a.categoryIds[0] : null;
            const bCategoryId = b.categoryIds && b.categoryIds.length > 0 ? b.categoryIds[0] : null;

            if (!aCategoryId && !bCategoryId) return 0;
            if (!aCategoryId) return 1;
            if (!bCategoryId) return -1;

            const aIndex = categoryOrder.indexOf(aCategoryId);
            const bIndex = categoryOrder.indexOf(bCategoryId);

            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;

            return aIndex - bIndex;
        });

        this.store.saveToStorage();
        this.render();
        showToast('教員を教科順に並び替えました', 'success');
    }

    attachEvents(container) {
        let draggedItem = null;

        container.querySelectorAll('.teacher-card').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => item.classList.add('dragging'), 0);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
                container.querySelectorAll('.teacher-card').forEach(c => c.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== item) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (!draggedItem || draggedItem === item) return;

                const fromIndex = parseInt(draggedItem.dataset.index);
                const toIndex = parseInt(item.dataset.index);

                const [moved] = this.store.teachers.splice(fromIndex, 1);
                this.store.teachers.splice(toIndex, 0, moved);
                this.store.saveToStorage();
                this.render();
            });
        });

        // 区切り線ボタン
        container.querySelectorAll('.card-separator').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const teacherId = btn.dataset.id;
                const teacher = this.store.getTeacher(teacherId);
                if (teacher) {
                    teacher.separator = !teacher.separator;
                    this.store.saveToStorage();
                    this.render();
                }
            };
        });

        // 編集ボタン
        container.querySelectorAll('.card-edit').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.openDialog(btn.dataset.id);
            };
        });

        // 削除ボタン
        container.querySelectorAll('.card-delete').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const teacherId = btn.dataset.id;
                const teacher = this.store.getTeacher(teacherId);
                if (teacher && confirm(`「${teacher.name}」を削除しますか？`)) {
                    this.store.deleteTeacher(teacherId);
                    this.render();
                    this.ui.renderMainOverview();
                    showToast('削除しました', 'success');
                }
            };
        });
    }

    openDialog(teacherId = null) {
        const isEdit = !!teacherId;
        const teacher = isEdit ? this.store.getTeacher(teacherId) : null;

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.innerHTML = `
            <div class="dialog-content" style="min-width: 400px;">
                <h3>${isEdit ? '教員を編集' : '教員を追加'}</h3>
                <div class="form-group">
                    <label>名前 <span style="color: red;">*</span></label>
                    <input type="text" id="teacher-name" value="${teacher?.name || ''}" placeholder="例: 山田太郎">
                </div>
                <div class="form-group">
                    <label>短縮名（時間割表示用）</label>
                    <input type="text" id="teacher-short-name" value="${teacher?.shortName || ''}" placeholder="例: 山田">
                </div>
                <div class="form-group">
                    <label>所属教科（複数選択可）</label>
                    <div id="category-checkboxes" style="display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; max-height: 150px; overflow-y: auto;">
                        ${this.store.categories.map(cat => {
            const isChecked = teacher?.categoryIds?.includes(cat.id) ? 'checked' : '';
            return `<label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                <input type="checkbox" class="category-checkbox" value="${cat.id}" ${isChecked}>
                                ${cat.name}
                            </label>`;
        }).join('')}
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" id="dialog-cancel">キャンセル</button>
                    <button class="btn btn-primary" id="dialog-save">${isEdit ? '更新' : '追加'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeDialog = () => overlay.remove();

        overlay.querySelector('#dialog-cancel').onclick = closeDialog;
        overlay.onclick = (e) => { if (e.target === overlay) closeDialog(); };

        overlay.querySelector('#dialog-save').onclick = () => {
            const name = document.getElementById('teacher-name').value.trim();
            const shortName = document.getElementById('teacher-short-name').value.trim();
            const categoryIds = Array.from(document.querySelectorAll('.category-checkbox:checked'))
                .map(cb => cb.value);

            if (!name) {
                showToast('名前を入力してください', 'error');
                return;
            }

            if (isEdit) {
                this.store.updateTeacher(teacherId, { name, shortName, categoryIds });
                showToast('更新しました', 'success');
            } else {
                this.store.addTeacher(`t_${Date.now()}`, name, shortName, categoryIds);
                showToast('追加しました', 'success');
            }

            closeDialog();
            this.render();
            this.ui.renderMainOverview();
        };
    }
}

// グローバルに公開
window.TeacherManager = TeacherManager;
