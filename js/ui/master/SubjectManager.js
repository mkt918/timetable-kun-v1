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
                ${this._subjectAddFormHtml()}
            `;
        } else {
            let html = '<div class="subject-items">';
            subjects.forEach(sub => {
                // 学年・クラスのバッジ表示
                let targetBadge = '';
                if (sub.grade || sub.targetClass) {
                    const gradeLabel = sub.grade ? `${sub.grade}年` : '';
                    const clsObj = sub.targetClass ? CLASSES.find(c => c.id === sub.targetClass) : null;
                    const clsLabel = clsObj ? clsObj.name : (sub.targetClass || '');
                    const label = [gradeLabel, clsLabel].filter(Boolean).join(' / ');
                    targetBadge = `<span style="font-size:0.78em; background:#e0f0ff; color:#2563eb; border-radius:10px; padding:1px 7px; margin-left:6px;">${escapeHtml(label)}</span>`;
                }
                html += `
                    <div class="subject-item" data-id="${sub.id}">
                        <span class="subject-name">${escapeHtml(sub.name)}</span>
                        <span class="subject-short">(${escapeHtml(sub.shortName || sub.name)})</span>
                        <span class="subject-credits" style="font-size:0.85em; color:#666; margin-left:6px;">${sub.credits || 1}単位</span>
                        ${targetBadge}
                        <div class="subject-actions">
                            <button class="btn-edit" data-id="${sub.id}">✏️</button>
                            <button class="btn-delete" data-id="${sub.id}">×</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            html += this._subjectAddFormHtml();
            container.innerHTML = html;
        }

        this.attachSubjectEvents(container, catId);
    }

    /** 追加フォームのHTMLを生成 */
    _subjectAddFormHtml() {
        const gradeOptions = ['', '1', '2', '3'].map(g =>
            `<option value="${g}">${g ? g + '年' : '全学年'}</option>`
        ).join('');
        const classOptions = ['<option value="">全クラス</option>'].concat(
            CLASSES.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
        ).join('');
        return `
            <div style="margin-top:16px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <input type="text" id="new-subject-name" placeholder="科目名" style="flex:1; min-width:100px;">
                <input type="number" id="new-subject-credits" min="1" max="20" value="1" style="width:52px;" title="単位数">
                <span style="font-size:0.82em; color:#666;">単位</span>
                <select id="new-subject-grade" style="width:72px;" title="学年">${gradeOptions}</select>
                <select id="new-subject-class" style="width:90px;" title="クラス">${classOptions}</select>
                <button id="btn-add-subject" class="btn btn-primary">追加</button>
            </div>
        `;
    }

    attachSubjectEvents(container, catId) {
        // 編集（ダイアログ形式）
        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = () => {
                const sub = this.store.getSubject(btn.dataset.id);
                if (!sub) return;
                this._openEditDialog(sub, catId);
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
                const nameEl    = document.getElementById('new-subject-name');
                const creditsEl = document.getElementById('new-subject-credits');
                const gradeEl   = document.getElementById('new-subject-grade');
                const classEl   = document.getElementById('new-subject-class');
                const name = nameEl.value.trim();
                const credits = parseInt(creditsEl?.value) || 1;
                const grade = gradeEl?.value || '';
                const targetClass = classEl?.value || '';
                if (name && catId) {
                    this.store.addSubject(`sub_${Date.now()}`, catId, name, name, credits, grade, targetClass);
                    this.render(catId);
                    nameEl.value = '';
                    if (creditsEl) creditsEl.value = '1';
                    if (gradeEl) gradeEl.value = '';
                    if (classEl) classEl.value = '';
                    showToast('追加しました', 'success');
                }
            };
        }
    }

    /** 科目編集ダイアログをモーダルで表示 */
    _openEditDialog(sub, catId) {
        const existing = document.querySelector('.subject-edit-overlay');
        if (existing) existing.remove();

        const gradeOptions = ['', '1', '2', '3'].map(g =>
            `<option value="${g}" ${sub.grade === g ? 'selected' : ''}>${g ? g + '年' : '全学年'}</option>`
        ).join('');
        const classOptions = ['<option value="">全クラス</option>'].concat(
            CLASSES.map(c => `<option value="${escapeHtml(c.id)}" ${sub.targetClass === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
        ).join('');

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay subject-edit-overlay';
        overlay.innerHTML = `
            <div class="dialog-content" style="width:380px;">
                <h3 style="margin-bottom:16px;">科目を編集</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:70px; font-size:0.88em;">科目名</label>
                        <input id="edit-sub-name" type="text" value="${escapeHtml(sub.name)}" style="flex:1;">
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:70px; font-size:0.88em;">略称</label>
                        <input id="edit-sub-short" type="text" value="${escapeHtml(sub.shortName || sub.name)}" style="flex:1;">
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:70px; font-size:0.88em;">単位数</label>
                        <input id="edit-sub-credits" type="number" min="1" max="20" value="${sub.credits || 1}" style="width:60px;">
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:70px; font-size:0.88em;">学年</label>
                        <select id="edit-sub-grade" style="flex:1;">${gradeOptions}</select>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:70px; font-size:0.88em;">クラス</label>
                        <select id="edit-sub-class" style="flex:1;">${classOptions}</select>
                    </div>
                </div>
                <div class="form-actions" style="margin-top:16px;">
                    <button class="btn btn-secondary" id="btn-edit-sub-cancel">キャンセル</button>
                    <button class="btn btn-primary" id="btn-edit-sub-save">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#btn-edit-sub-save').onclick = () => {
            const name  = overlay.querySelector('#edit-sub-name').value.trim();
            const short = overlay.querySelector('#edit-sub-short').value.trim();
            const cred  = parseInt(overlay.querySelector('#edit-sub-credits').value) || 1;
            const grade = overlay.querySelector('#edit-sub-grade').value;
            const tCls  = overlay.querySelector('#edit-sub-class').value;
            if (!name) return;
            this.store.updateSubject(sub.id, { name, shortName: short || name, credits: cred, grade, targetClass: tCls });
            this.render(catId);
            overlay.remove();
        };
        overlay.querySelector('#btn-edit-sub-cancel').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }
}


// グローバルに公開
window.SubjectManager = SubjectManager;
