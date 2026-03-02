/**
 * SubjectManager - 科目・教科管理モジュール
 */
class SubjectManager {
    constructor(store, ui, masterData) {
        this.store = store;
        this.ui = ui;
        this.masterData = masterData;
        this.selectedCatId = null;
    }

    render(selectedCatId = null) {
        this.selectedCatId = selectedCatId;
        this.renderCategoryList(selectedCatId);
        this.renderSubjectList(selectedCatId);
    }

    renderCategoryList(selectedCatId) {
        const container = document.getElementById('category-list');
        if (!container) return;

        let html = '';
        this.store.categories.forEach((cat, index) => {
            const isSelected = cat.id === selectedCatId;
            const colorIndex = index % 20;
            const bgColor = cat.color || `var(--category-color-${colorIndex})`;

            html += `
                <div class="category-item ${isSelected ? 'selected' : ''}" 
                     data-id="${cat.id}"
                     style="background: ${bgColor}; border-left: 4px solid ${bgColor};">
                    <div class="category-info">
                        <span class="category-name">${escapeHtml(cat.name)}</span>
                        <span class="category-count">(${this.store.subjects.filter(s => s.categoryId === cat.id).length})</span>
                    </div>
                    <div class="category-actions">
                        <button class="btn-color" data-id="${cat.id}" title="色を変更">🎨</button>
                        <button class="btn-edit" data-id="${cat.id}" title="編集">✏️</button>
                        <button class="btn-delete" data-id="${cat.id}" title="削除">×</button>
                    </div>
                </div>
            `;
        });

        html += `
            <div class="category-add">
                <input type="text" id="new-category-name" placeholder="新しい教科名">
                <button id="btn-add-category" class="btn btn-primary">追加</button>
            </div>
        `;

        container.innerHTML = html;
        this.attachCategoryEvents(container, selectedCatId);
    }

    attachCategoryEvents(container, selectedCatId) {
        // カテゴリ選択
        container.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.category-actions')) return;
                this.render(item.dataset.id);
            });
        });

        // 色変更
        container.querySelectorAll('.btn-color').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.openColorPicker(btn.dataset.id, selectedCatId);
            };
        });

        // 編集
        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const cat = this.store.getCategory(btn.dataset.id);
                if (cat) {
                    const newName = prompt('教科名を編集', cat.name);
                    if (newName && newName.trim()) {
                        this.store.updateCategory(btn.dataset.id, { name: newName.trim() });
                        this.render(selectedCatId);
                    }
                }
            };
        });

        // 削除
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const cat = this.store.getCategory(btn.dataset.id);
                if (cat && confirm(`「${cat.name}」を削除しますか？関連する科目も削除されます。`)) {
                    this.store.deleteCategory(btn.dataset.id);
                    this.render(null);
                    showToast('削除しました', 'success');
                }
            };
        });

        // 追加
        const addBtn = document.getElementById('btn-add-category');
        if (addBtn) {
            addBtn.onclick = () => {
                const input = document.getElementById('new-category-name');
                const name = input.value.trim();
                if (name) {
                    this.store.addCategory(`cat_${Date.now()}`, name);
                    this.render(null);
                    input.value = '';
                    showToast('追加しました', 'success');
                }
            };
        }
    }

    openColorPicker(categoryId, selectedCatId) {
        const category = this.store.getCategory(categoryId);
        if (!category) return;

        const colors = [
            '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff',
            '#f8b4d9', '#e8d4f8', '#d4e8f8', '#f8f8d4', '#d4f8e8',
            '#ffc9b3', '#e8ffb3', '#b3ffec', '#b3d4ff', '#ecb3ff',
            '#ffe0cc', '#e0ffcc', '#ccffe0', '#cce0ff', '#ffcce0'
        ];

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.innerHTML = `
            <div class="dialog-content" style="width: 300px;">
                <h3>${category.name}の色を選択</h3>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 16px 0;">
                    ${colors.map(color => `
                        <div class="color-option ${category.color === color ? 'selected' : ''}" 
                             data-color="${color}"
                             style="background: ${color}; width: 40px; height: 40px; border-radius: 4px; cursor: pointer; border: 2px solid ${category.color === color ? '#333' : 'transparent'};">
                        </div>
                    `).join('')}
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" id="btn-reset-color">リセット</button>
                    <button class="btn btn-secondary" id="btn-cancel-color">キャンセル</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelectorAll('.color-option').forEach(opt => {
            opt.onclick = () => {
                this.store.updateCategory(categoryId, { color: opt.dataset.color });
                this.render(selectedCatId);
                this.ui.renderMainOverview();
                overlay.remove();
            };
        });

        overlay.querySelector('#btn-reset-color').onclick = () => {
            this.store.updateCategory(categoryId, { color: null });
            this.render(selectedCatId);
            this.ui.renderMainOverview();
            overlay.remove();
        };

        overlay.querySelector('#btn-cancel-color').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }

    renderSubjectList(catId) {
        const container = document.getElementById('subject-list');
        if (!container) return;

        if (!catId) {
            container.innerHTML = '<p class="placeholder-text">左から教科を選択してください</p>';
            return;
        }

        const subjects = this.store.subjects.filter(s => s.categoryId === catId);

        if (subjects.length === 0) {
            container.innerHTML = `
                <p class="placeholder-text">この教科に科目がありません</p>
                <div style="margin-top: 16px;">
                    <input type="text" id="new-subject-name" placeholder="新しい科目名">
                    <button id="btn-add-subject" class="btn btn-primary">追加</button>
                </div>
            `;
        } else {
            let html = '<div class="subject-items">';
            subjects.forEach(sub => {
                html += `
                    <div class="subject-item" data-id="${sub.id}">
                        <span class="subject-name">${escapeHtml(sub.name)}</span>
                        <span class="subject-short">(${escapeHtml(sub.shortName || sub.name)})</span>
                        <div class="subject-actions">
                            <button class="btn-edit" data-id="${sub.id}">✏️</button>
                            <button class="btn-delete" data-id="${sub.id}">×</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            html += `
                <div style="margin-top: 16px;">
                    <input type="text" id="new-subject-name" placeholder="新しい科目名">
                    <button id="btn-add-subject" class="btn btn-primary">追加</button>
                </div>
            `;
            container.innerHTML = html;
        }

        this.attachSubjectEvents(container, catId);
    }

    attachSubjectEvents(container, catId) {
        // 編集
        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = () => {
                const sub = this.store.getSubject(btn.dataset.id);
                if (sub) {
                    const newName = prompt('科目名を編集', sub.name);
                    if (newName && newName.trim()) {
                        const shortName = prompt('短縮名を編集', sub.shortName || newName.trim());
                        this.store.updateSubject(btn.dataset.id, {
                            name: newName.trim(),
                            shortName: shortName?.trim() || newName.trim()
                        });
                        this.render(catId);
                    }
                }
            };
        });

        // 削除
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = () => {
                const sub = this.store.getSubject(btn.dataset.id);
                if (sub && confirm(`「${sub.name}」を削除しますか？`)) {
                    this.store.deleteSubject(btn.dataset.id);
                    this.render(catId);
                    showToast('削除しました', 'success');
                }
            };
        });

        // 追加
        const addBtn = document.getElementById('btn-add-subject');
        if (addBtn) {
            addBtn.onclick = () => {
                const input = document.getElementById('new-subject-name');
                const name = input.value.trim();
                if (name && catId) {
                    this.store.addSubject(`sub_${Date.now()}`, name, name, catId);
                    this.render(catId);
                    input.value = '';
                    showToast('追加しました', 'success');
                }
            };
        }
    }
}

// グローバルに公開
window.SubjectManager = SubjectManager;
