/**
 * HomeroomManager - 担任設定タブ
 * クラスごとに担任教員を設定する
 */
class HomeroomManager {
    constructor(store, ui, masterData) {
        this.store = store;
        this.ui = ui;
        this.masterData = masterData;
    }

    render() {
        const panel = document.getElementById('master-homeroom');
        if (!panel) return;

        // 学年ごとにグループ化
        const grades = [...new Set(CLASSES.map(c => c.grade))].sort();

        const gradeLabel = g => {
            const map = { 1: '第1学年', 2: '第2学年', 3: '第3学年', 4: '第4学年', 5: '第5学年', 6: '第6学年' };
            return map[g] || `${g}年`;
        };

        let html = '';
        grades.forEach(grade => {
            const classes = CLASSES.filter(c => c.grade === grade);
            html += `
                <div style="margin-bottom:28px;">
                    <div style="font-size:0.88em; font-weight:700; color:#4a6fa5; margin-bottom:10px; padding-bottom:4px; border-bottom:2px solid #e0e7ff;">
                        ${gradeLabel(grade)}
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px;">
                        ${classes.map(cls => this._renderClassCard(cls)).join('')}
                    </div>
                </div>
            `;
        });

        panel.innerHTML = `
            <div style="padding:4px 0 12px; color:#6b7280; font-size:0.85em;">
                各クラスの担任教員を設定します。ここで設定した学年情報は会議の参加者一括設定で活用できます。
            </div>
            <div id="homeroom-grid">
                ${html || '<p style="color:#aaa; padding:20px;">クラスが設定されていません</p>'}
            </div>
        `;

        this._attachEvents(panel);
    }

    _renderClassCard(cls) {
        const teacherId = this.store.getHomeroomTeacher(cls.id);
        const teacher = teacherId ? this.store.getTeacher(teacherId) : null;

        const teacherOptions = this.store.teachers.map(t =>
            `<option value="${escapeHtml(t.id)}" ${t.id === teacherId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
        ).join('');

        return `
            <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px;
                        box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="font-weight:600; font-size:0.88em; color:#111827; margin-bottom:6px;">
                    ${escapeHtml(cls.name)}
                </div>
                <select class="homeroom-select" data-class-id="${escapeHtml(cls.id)}"
                    style="width:100%; font-size:0.85em; border:1px solid #e5e7eb; border-radius:5px;
                           padding:4px 6px; background:#f9fafb; color:#374151; cursor:pointer;">
                    <option value="">── 未設定 ──</option>
                    ${teacherOptions}
                </select>
                ${teacher ? `<div style="font-size:0.75em; color:#4a6fa5; margin-top:4px;">担任: ${escapeHtml(teacher.name)}</div>` : ''}
            </div>
        `;
    }

    _attachEvents(panel) {
        panel.querySelectorAll('.homeroom-select').forEach(sel => {
            sel.onchange = () => {
                const classId = sel.dataset.classId;
                const teacherId = sel.value || null;
                this.store.setHomeroom(classId, teacherId);
                // カードの担任表示を即時更新（再描画）
                this.render();
                showToast('担任を設定しました', 'success');
            };
        });
    }
}

window.HomeroomManager = HomeroomManager;
