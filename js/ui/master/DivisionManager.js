/**
 * DivisionManager - 分掌設定タブ
 * 分掌の登録・編集・削除と教員への割当を管理する
 */
class DivisionManager {
    constructor(store, ui, masterData) {
        this.store = store;
        this.ui = ui;
        this.masterData = masterData;
    }

    render() {
        const panel = document.getElementById('master-divisions');
        if (!panel) return;

        panel.innerHTML = `
            <div style="display:flex; gap:20px; height:100%; overflow:hidden;">
                <!-- 左: 分掌リスト -->
                <div style="width:260px; flex-shrink:0; display:flex; flex-direction:column; gap:12px;">
                    <div style="font-size:0.82em; color:#6b7280;">
                        分掌を登録・編集できます。選択すると右側で担当教員を設定できます。
                    </div>
                    <div id="division-list" style="display:flex; flex-direction:column; gap:6px; overflow-y:auto; flex:1;">
                        ${this._renderDivisionList()}
                    </div>
                    <!-- 新規追加フォーム -->
                    <div style="border-top:1px solid #e5e7eb; padding-top:10px; display:flex; gap:6px;">
                        <input type="text" id="division-new-name" placeholder="新しい分掌名"
                            style="flex:1; font-size:0.85em; border:1px solid #e5e7eb; border-radius:5px; padding:5px 8px;">
                        <button id="btn-division-add" class="btn btn-accent" style="font-size:0.82em; padding:5px 10px;">追加</button>
                    </div>
                </div>

                <!-- 右: 教員割当 -->
                <div style="flex:1; overflow-y:auto;">
                    <div id="division-teacher-panel">
                        <p style="color:#aaa; font-size:0.9em; padding:20px 0;">左から分掌を選択してください</p>
                    </div>
                </div>
            </div>
        `;

        this._attachEvents(panel);
    }

    _renderDivisionList() {
        if (this.store.divisions.length === 0) {
            return '<p style="color:#aaa; font-size:0.85em;">分掌が登録されていません</p>';
        }
        return this.store.divisions.map(div => `
            <div class="division-row" data-div-id="${escapeHtml(div.id)}"
                style="display:flex; align-items:center; gap:6px; padding:7px 10px; border:1px solid #e5e7eb;
                       border-radius:7px; background:#fff; cursor:pointer;">
                <!-- 分掌名（クリックで編集） -->
                <div class="div-name-display" style="flex:1; font-size:0.88em; font-weight:500; color:#111827;">
                    ${escapeHtml(div.name)}
                </div>
                <input class="div-name-input" type="text" value="${escapeHtml(div.name)}"
                    style="flex:1; font-size:0.85em; border:1px solid #93c5fd; border-radius:4px; padding:2px 6px; display:none;">
                <!-- 教員数バッジ -->
                <span style="font-size:0.72em; background:#e0e7ff; color:#4a6fa5; padding:1px 7px; border-radius:10px; flex-shrink:0;">
                    ${this.store.getTeachersByDivision(div.id).length}名
                </span>
                <!-- 編集ボタン -->
                <button class="btn-div-edit" data-div-id="${escapeHtml(div.id)}"
                    style="font-size:0.75em; padding:2px 7px; background:#f3f4f6; color:#374151; border:1px solid #e5e7eb; border-radius:4px; cursor:pointer; flex-shrink:0;">
                    編集
                </button>
                <!-- 削除ボタン -->
                <button class="btn-div-delete" data-div-id="${escapeHtml(div.id)}"
                    style="font-size:0.75em; padding:2px 7px; background:transparent; color:#ef4444; border:1px solid #fca5a5; border-radius:4px; cursor:pointer; flex-shrink:0;">
                    削除
                </button>
            </div>
        `).join('');
    }

    _renderTeacherPanel(divId) {
        const div = this.store.divisions.find(d => d.id === divId);
        if (!div) return;

        const assignedIds = new Set(this.store.getTeachersByDivision(divId));

        const panel = document.getElementById('division-teacher-panel');
        if (!panel) return;

        const teacherItems = this.store.teachers.map(t => {
            const isAssigned = assignedIds.has(t.id);
            const catNames = (t.categoryIds || [])
                .map(cid => this.store.getCategory(cid)?.name)
                .filter(n => n).join('・');
            return `
                <div class="div-teacher-row" data-teacher-id="${escapeHtml(t.id)}" data-div-id="${escapeHtml(divId)}"
                    style="display:flex; align-items:center; gap:10px; padding:8px 12px; margin:2px 0;
                           border-radius:7px; cursor:pointer;
                           border:1px solid ${isAssigned ? '#bfdbfe' : '#e5e7eb'};
                           background:${isAssigned ? '#eff6ff' : '#fff'};">
                    <input type="checkbox" ${isAssigned ? 'checked' : ''}
                        style="accent-color:#4a6fa5; width:16px; height:16px; cursor:pointer; flex-shrink:0;">
                    <div style="flex:1;">
                        <div style="font-size:0.88em; font-weight:${isAssigned ? '600' : '400'}; color:${isAssigned ? '#1d4ed8' : '#374151'};">
                            ${escapeHtml(t.name)}
                        </div>
                        ${catNames ? `<div style="font-size:0.75em; color:#9ca3af;">${escapeHtml(catNames)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('') || '<p style="color:#aaa; font-size:0.85em;">教員が登録されていません</p>';

        panel.innerHTML = `
            <div style="font-weight:600; font-size:0.92em; color:#111827; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #e0e7ff;">
                「${escapeHtml(div.name)}」の担当教員
            </div>
            <div style="font-size:0.8em; color:#6b7280; margin-bottom:8px;">クリックで担当ON/OFFを切り替えます</div>
            <div style="max-height:calc(100% - 80px); overflow-y:auto;">
                ${teacherItems}
            </div>
        `;

        // 教員クリックイベント
        panel.querySelectorAll('.div-teacher-row').forEach(row => {
            row.onclick = (e) => {
                if (e.target.tagName === 'INPUT') return;
                const cb = row.querySelector('input[type=checkbox]');
                cb.checked = !cb.checked;
                this._toggleTeacherDivision(row.dataset.teacherId, divId, cb.checked);
            };
            const cb = row.querySelector('input[type=checkbox]');
            cb.onchange = () => {
                this._toggleTeacherDivision(row.dataset.teacherId, divId, cb.checked);
            };
        });
    }

    _toggleTeacherDivision(teacherId, divId, assign) {
        const teacher = this.store.getTeacher(teacherId);
        if (!teacher) return;
        const current = teacher.divisions || [];
        let updated;
        if (assign) {
            updated = current.includes(divId) ? current : [...current, divId];
        } else {
            updated = current.filter(d => d !== divId);
        }
        this.store.setTeacherDivisions(teacherId, updated);
        // 教員パネルを再描画
        this._renderTeacherPanel(divId);
        // 左リストのバッジ更新
        const list = document.getElementById('division-list');
        if (list) list.innerHTML = this._renderDivisionList();
        this._reattachListEvents(document.getElementById('master-divisions'));
    }

    _attachEvents(panel) {
        // 分掌行クリック → 右パネルに教員一覧
        this._reattachListEvents(panel);

        // 追加ボタン
        panel.querySelector('#btn-division-add').onclick = () => {
            const input = panel.querySelector('#division-new-name');
            const name = input.value.trim();
            if (!name) { showToast('分掌名を入力してください', 'error'); return; }
            if (this.store.divisions.some(d => d.name === name)) {
                showToast('同じ名前の分掌が既にあります', 'error'); return;
            }
            this.store.addDivision(name);
            input.value = '';
            this.render();
            showToast(`「${name}」を追加しました`, 'success');
        };

        // Enterキーで追加
        panel.querySelector('#division-new-name').onkeydown = (e) => {
            if (e.key === 'Enter') panel.querySelector('#btn-division-add').click();
        };
    }

    _reattachListEvents(panel) {
        if (!panel) return;

        // 分掌行クリック
        panel.querySelectorAll('.division-row').forEach(row => {
            row.onclick = (e) => {
                if (e.target.classList.contains('btn-div-edit') ||
                    e.target.classList.contains('btn-div-delete') ||
                    e.target.classList.contains('div-name-input')) return;
                // 選択ハイライト
                panel.querySelectorAll('.division-row').forEach(r => {
                    r.style.background = '#fff';
                    r.style.borderColor = '#e5e7eb';
                });
                row.style.background = '#eff6ff';
                row.style.borderColor = '#93c5fd';
                this._renderTeacherPanel(row.dataset.divId);
            };
        });

        // 編集ボタン
        panel.querySelectorAll('.btn-div-edit').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const row = btn.closest('.division-row');
                const display = row.querySelector('.div-name-display');
                const input = row.querySelector('.div-name-input');
                const isEditing = input.style.display !== 'none';

                if (isEditing) {
                    // 保存
                    const newName = input.value.trim();
                    if (!newName) { showToast('分掌名を入力してください', 'error'); return; }
                    this.store.updateDivision(btn.dataset.divId, newName);
                    display.textContent = newName;
                    display.style.display = '';
                    input.style.display = 'none';
                    btn.textContent = '編集';
                    showToast('分掌名を変更しました', 'success');
                } else {
                    // 編集モードに
                    display.style.display = 'none';
                    input.style.display = '';
                    input.focus();
                    input.select();
                    btn.textContent = '保存';
                }
            };
        });

        // 削除ボタン
        panel.querySelectorAll('.btn-div-delete').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const div = this.store.divisions.find(d => d.id === btn.dataset.divId);
                if (!div) return;
                const memberCount = this.store.getTeachersByDivision(div.id).length;
                const msg = memberCount > 0
                    ? `「${div.name}」を削除しますか？（${memberCount}名の割当が解除されます）`
                    : `「${div.name}」を削除しますか？`;
                if (!confirm(msg)) return;
                this.store.deleteDivision(btn.dataset.divId);
                this.render();
                showToast('削除しました', 'success');
            };
        });
    }
}

window.DivisionManager = DivisionManager;
