class MasterDataManager {
    constructor(store, ui) {
        this.store = store;
        this.ui = ui;
        this.assignState = {
            filterCategoryIds: [],  // 教員絞り込み用
            teacherIds: [],
            categoryId: null,
            subjectId: null,
            classIds: [],
            hours: 2,
            editMode: null
        };
        this.selectedForDelete = new Set();

        // 新モジュール初期化
        this._teacherManager = new TeacherManager(store, ui, this);
        this._subjectManager = new SubjectManager(store, ui, this);
        this._roomManager = new RoomManager(store, ui, this);
        this._meetingManager = new MeetingManager(store, ui, this);
        this._curriculumManager = new ClassCurriculumManager(store, ui, this);
        this._homeroomManager = new HomeroomManager(store, ui, this);
        this._divisionManager = new DivisionManager(store, ui, this);
    }

    openModal() {
        const modal = document.getElementById('modal-master-data');
        this.renderTeachers();
        this.switchTab('teachers');

        modal.querySelectorAll('.master-tab').forEach(tab => {
            tab.onclick = () => this.switchTab(tab.dataset.tab);
        });

        modal.querySelector('.modal-close').onclick = () => {
            modal.classList.add('hidden');
            this.ui.renderMainOverview();
        };

        const resetBtn = document.getElementById('btn-master-reset');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm('【注意】すべてのデータを削除し、初期状態に戻します。\nよろしいですか？（この操作は取り消せません）')) {
                    if (confirm('本当によろしいですか？')) {
                        this.store.resetAll();
                        alert('データを初期化しました。画面をリロードします。');
                        location.reload();
                    }
                }
            };
        }

        // CSVインポート/エクスポートボタン
        const csvBtn = document.getElementById('btn-csv-import-master');
        if (csvBtn) {
            csvBtn.onclick = () => {
                this.ui.openCSVUnifiedModal();
            };
        }

        modal.classList.remove('hidden');
    }

    switchTab(tabName) {
        document.querySelectorAll('.master-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        document.querySelectorAll('.master-pane').forEach(pane => {
            pane.classList.toggle('hidden', pane.id !== `master-${tabName}`);
        });

        if (tabName === 'rooms') {
            this.renderSpecialClassrooms();
        } else if (tabName === 'subjects') {
            this.renderSubjects();
        } else if (tabName === 'electives') {
            this.renderElectiveGroups();
        } else if (tabName === 'meetings') {
            this.renderMeetingForm();
            this.renderMeetings();
        } else if (tabName === 'curriculum') {
            this._curriculumManager.render();
        } else if (tabName === 'homeroom') {
            this._homeroomManager.render();
        } else if (tabName === 'divisions') {
            this._divisionManager.render();
        } else if (tabName === 'settings') {
            this.renderSettings();
        }
    }

    renderTeachers() {
        const container = document.getElementById('teacher-cards');
        if (!container) return;

        container.innerHTML = this.store.teachers.map((teacher, index) => {
            // カテゴリ名を取得
            const categoryNames = (teacher.categoryIds || [])
                .map(id => this.store.getCategory(id)?.name)
                .filter(name => name)
                .join('・');

            // 教科に基づく背景色を取得（最初の教科を使用）
            let backgroundColor = '';
            if (teacher.categoryIds && teacher.categoryIds.length > 0) {
                const category = this.store.getCategory(teacher.categoryIds[0]);
                const categoryIndex = this.store.categories.findIndex(c => c.id === teacher.categoryIds[0]);
                if (categoryIndex >= 0) {
                    const colorIndex = categoryIndex % 20;
                    // カスタム色があれば使用、なければCSS変数を使用
                    const color = category?.color || `var(--category-color-${colorIndex})`;
                    backgroundColor = `background-color: ${color};`;
                }
            }

            // 担当授業サマリーを生成（科目ごとにクラスをまとめる）
            const teacherAssignments = this.store.assignments.filter(a => a.teacherId === teacher.id);
            let assignmentSummary = '';
            if (teacherAssignments.length > 0) {
                const bySubject = {};
                teacherAssignments.forEach(a => {
                    const subName = this.store.getSubject(a.subjectId)?.name || '?';
                    if (!bySubject[subName]) bySubject[subName] = [];
                    const cls = CLASSES.find(c => c.id === a.classId);
                    bySubject[subName].push(cls ? cls.name : a.classId);
                });
                const lines = Object.entries(bySubject)
                    .map(([sub, classes]) => `${escapeHtml(sub)}: ${classes.map(escapeHtml).join(', ')}`)
                    .join(' | ');
                assignmentSummary = `<span class="card-assignment-summary">${lines}</span>`;
            }

            return `
            <div class="card-item teacher-card ${teacher.separator ? 'has-separator' : ''}"
                 data-id="${teacher.id}"
                 data-index="${index}"
                 draggable="true"
                 style="${backgroundColor}">
                <div class="card-drag-handle">≡</div>
                <div class="card-content" style="display: flex; flex-direction: column; gap: 2px;">
                    <span class="card-name">${escapeHtml(teacher.name)}</span>
                    ${categoryNames ? `<span class="card-category" style="font-size: 0.75em; color: #555;">${escapeHtml(categoryNames)}</span>` : ''}
                    ${assignmentSummary}
                </div>
                <div class="card-actions">
                    <button class="card-separator ${teacher.separator ? 'active' : ''}" data-id="${teacher.id}" title="右側に区切り線">|</button>
                    <button class="card-assignment" data-id="${teacher.id}" title="担当授業を設定">📚</button>
                    <button class="card-edit" data-id="${teacher.id}" title="編集">✏️</button>
                    <button class="card-delete" data-id="${teacher.id}" title="削除">×</button>
                </div>
            </div>
        `}).join('');

        this.attachTeacherCardEvents(container);
        // 教員追加ボタンのイベントハンドラ
        const addBtn = document.getElementById('btn-add-teacher');
        if (addBtn) {
            addBtn.onclick = () => this.openTeacherDialog();
        }

        // 教科順並び替えボタンのイベントハンドラ
        const sortBtn = document.getElementById('btn-sort-teachers-by-category');
        if (sortBtn) {
            sortBtn.onclick = () => this.sortTeachersByCategory();
        }
    }

    sortTeachersByCategory() {
        // 教科の順序を取得（教科・科目タブの表示順）
        const categoryOrder = this.store.categories.map(c => c.id);

        // 教員を教科順にソート
        this.store.teachers.sort((a, b) => {
            // 教員の最初の教科IDを取得
            const aCategoryId = a.categoryIds && a.categoryIds.length > 0 ? a.categoryIds[0] : null;
            const bCategoryId = b.categoryIds && b.categoryIds.length > 0 ? b.categoryIds[0] : null;

            // 教科がない教員は最後に
            if (!aCategoryId && !bCategoryId) return 0;
            if (!aCategoryId) return 1;
            if (!bCategoryId) return -1;

            // 教科の順序で比較
            const aIndex = categoryOrder.indexOf(aCategoryId);
            const bIndex = categoryOrder.indexOf(bCategoryId);

            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;

            return aIndex - bIndex;
        });

        this.store.saveToStorage();
        this.renderTeachers();
        showToast('教員を教科順に並び替えました', 'success');
    }

    attachTeacherCardEvents(container) {
        let draggedItem = null;

        container.querySelectorAll('.teacher-card').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.dataset.index);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
                container.querySelectorAll('.drag-over').forEach(i => i.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (!draggedItem || draggedItem === item) return;

                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(item.dataset.index);

                if (!isNaN(fromIndex) && !isNaN(toIndex) && fromIndex !== toIndex) {
                    const movedItem = this.store.teachers.splice(fromIndex, 1)[0];
                    this.store.teachers.splice(toIndex, 0, movedItem);
                    this.store.saveToStorage();
                    this.renderTeachers();
                    showToast('並び順を変更しました', 'success');
                }
            });
        });

        // 区切りボタン
        container.querySelectorAll('.card-separator').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                const teacher = this.store.getTeacher(id);
                if (teacher) {
                    teacher.separator = !teacher.separator;
                    this.store.saveToStorage();
                    this.renderTeachers();
                }
            };
        });

        // 担当授業ボタン
        container.querySelectorAll('.card-assignment').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.ui.openTeacherAssignmentModal(e.target.dataset.id);
            };
        });

        // 編集ボタン
        container.querySelectorAll('.card-edit').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.dataset.id;
                this.openTeacherDialog(id);
            };
        });

        // 削除ボタン
        container.querySelectorAll('.card-delete').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.dataset.id;
                if (confirm('削除しますか？')) {
                    this.store.deleteTeacher(id);
                    this.renderTeachers();
                }
            };
        });
    }


    /**
     * 教員追加/編集ダイアログを開く
     * @param {string|null} teacherId - 編集する教員のID（nullの場合は新規追加）
     */
    openTeacherDialog(teacherId = null) {
        const isEdit = teacherId !== null;
        const teacher = isEdit ? this.store.getTeacher(teacherId) : { name: '', categoryIds: [] };

        // モーダルダイアログを動的生成
        const dialogHTML = `
            <div id="teacher-dialog-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 8px; padding: 24px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    <h3 style="margin: 0 0 20px 0;">${isEdit ? '教員情報を編集' : '新しい教員を追加'}</h3>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">教員名</label>
                        <input type="text" id="teacher-dialog-name" value="${teacher.name}" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" 
                               placeholder="例: 山田太郎">
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">担当教科（複数選択可）</label>
                        <div id="teacher-dialog-categories" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 12px;">
                            ${this.store.categories.map(cat => `
                                <label style="display: block; margin-bottom: 8px; cursor: pointer;">
                                    <input type="checkbox" value="${cat.id}" 
                                           ${(teacher.categoryIds || []).includes(cat.id) ? 'checked' : ''} 
                                           style="margin-right: 8px;">
                                    <span>${cat.name}</span>
                                </label>
                            `).join('')}
                            ${this.store.categories.length === 0 ? '<p style="color: #999; margin: 0;">教科が登録されていません</p>' : ''}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button id="teacher-dialog-cancel" class="btn btn-secondary">キャンセル</button>
                        <button id="teacher-dialog-save" class="btn btn-primary">${isEdit ? '保存' : '追加'}</button>
                    </div>
                </div>
            </div>
        `;

        // ダイアログを追加
        const dialogContainer = document.createElement('div');
        dialogContainer.innerHTML = dialogHTML;
        document.body.appendChild(dialogContainer);

        // イベントハンドラ
        const overlay = document.getElementById('teacher-dialog-overlay');
        const nameInput = document.getElementById('teacher-dialog-name');
        const cancelBtn = document.getElementById('teacher-dialog-cancel');
        const saveBtn = document.getElementById('teacher-dialog-save');

        // キャンセル
        const closeDialog = () => {
            dialogContainer.remove();
        };

        cancelBtn.onclick = closeDialog;
        overlay.onclick = (e) => {
            if (e.target === overlay) closeDialog();
        };

        // 保存
        saveBtn.onclick = () => {
            const name = nameInput.value.trim();
            if (!name) {
                alert('教員名を入力してください');
                return;
            }

            // 選択されたカテゴリを取得
            const selectedCategories = Array.from(
                document.querySelectorAll('#teacher-dialog-categories input[type="checkbox"]:checked')
            ).map(cb => cb.value);

            if (isEdit) {
                // 編集
                this.store.updateTeacher(teacherId, name, selectedCategories);
                showToast('教員情報を更新しました', 'success');
            } else {
                // 新規追加
                const newId = `t_${Date.now()}`;
                this.store.addTeacher(newId, name, selectedCategories);
                showToast('教員を追加しました', 'success');
            }

            this.renderTeachers();
            this.ui.renderMainOverview();
            closeDialog();
        };

        // 名前入力欄にフォーカス
        setTimeout(() => nameInput.focus(), 100);
    }

    renderSpecialClassrooms() {
        const container = document.getElementById('room-cards');
        if (!container) return;

        const rooms = this.store.specialClassrooms || [];

        if (rooms.length === 0) {
            container.innerHTML = '<p class="placeholder-text">特別教室が登録されていません。「+ 教室を追加」ボタンから追加してください。</p>';
        } else {
            container.innerHTML = rooms.map((room, index) => `
                <div class="card-item room-card" 
                     data-id="${room.id}" 
                     data-index="${index}"
                     draggable="true">
                    <div class="card-drag-handle">≡</div>
                    <div class="card-content">
                        <span class="card-name">${room.name}</span>
                    </div>
                    <div class="card-actions">
                        <button class="card-edit" data-id="${room.id}" title="編集">✏️</button>
                        <button class="card-delete" data-id="${room.id}" title="削除">×</button>
                    </div>
                </div>
            `).join('');
        }

        this.attachRoomCardEvents(container);

        const addBtn = document.getElementById('btn-add-room');
        if (addBtn) {
            addBtn.onclick = () => {
                const name = prompt('教室名を入力（例：理科室、音楽室）');
                if (name) {
                    this.store.addSpecialClassroom(`r_${Date.now()}`, name, name);
                    this.renderSpecialClassrooms();
                }
            };
        }
    }

    attachRoomCardEvents(container) {
        let draggedItem = null;

        container.querySelectorAll('.room-card').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.dataset.index);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
                container.querySelectorAll('.drag-over').forEach(i => i.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (!draggedItem || draggedItem === item) return;

                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(item.dataset.index);

                if (!isNaN(fromIndex) && !isNaN(toIndex) && fromIndex !== toIndex) {
                    const movedItem = this.store.specialClassrooms.splice(fromIndex, 1)[0];
                    this.store.specialClassrooms.splice(toIndex, 0, movedItem);
                    this.store.saveToStorage();
                    this.renderSpecialClassrooms();
                }
            });
        });

        // 編集ボタン
        container.querySelectorAll('.card-edit').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.dataset.id;
                const room = this.store.getSpecialClassroom(id);
                const name = prompt('教室名を変更', room.name);
                if (name) {
                    this.store.updateSpecialClassroom(id, name, name);
                    this.renderSpecialClassrooms();
                }
            };
        });

        // 削除ボタン
        container.querySelectorAll('.card-delete').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.dataset.id;
                if (confirm('削除しますか？')) {
                    this.store.deleteSpecialClassroom(id);
                    this.renderSpecialClassrooms();
                }
            };
        });
    }

    renderRoomAvailability() {
        const container = document.getElementById('room-availability-table');
        if (!container) return;

        const rooms = this.store.specialClassrooms || [];
        if (rooms.length === 0) {
            container.innerHTML = '<p class="placeholder-text">教室が登録されていません</p>';
            return;
        }

        // 各時限での教室使用状況を集計
        const usage = {}; // { roomId: { 'day-period': [lessons] } }

        // 全クラスの全時限をスキャン
        CLASSES.forEach(cls => {
            DAYS.forEach((day, dayIndex) => {
                for (let period = 0; period < PERIODS; period++) {
                    const slots = this.store.getSlot(cls.id, dayIndex, period);
                    slots.forEach(slot => {
                        const roomIds = slot.specialClassroomIds || (slot.specialClassroomId ? [slot.specialClassroomId] : []);
                        roomIds.forEach(roomId => {
                            if (!usage[roomId]) usage[roomId] = {};
                            const key = `${dayIndex}-${period}`;
                            if (!usage[roomId][key]) usage[roomId][key] = [];
                            usage[roomId][key].push({
                                className: cls.name,
                                subject: this.store.getSubject(slot.subjectId)?.name || '不明',
                                teachers: slot.teacherIds.map(tid =>
                                    this.store.getTeacher(tid)?.name || '不明'
                                ).join('・')
                            });
                        });
                    });
                }
            });
        });

        // テーブル生成
        let html = '<table class="main-overview-table" style="width: 100%; border-collapse: collapse;">';
        html += '<thead><tr><th style="position: sticky; left: 0; background: white; z-index: 2;">教室</th>';

        // ヘッダー行（曜日・時限）
        DAYS.forEach((day, dayIndex) => {
            for (let period = 0; period < PERIODS; period++) {
                html += `<th style="font-size: 0.85em;">${day}${period + 1}</th>`;
            }
        });
        html += '</tr></thead><tbody>';

        // 各教室の行
        rooms.forEach(room => {
            html += `<tr><td style="position: sticky; left: 0; background: white; font-weight: 500; z-index: 1;">${room.name}</td>`;

            DAYS.forEach((day, dayIndex) => {
                for (let period = 0; period < PERIODS; period++) {
                    const key = `${dayIndex}-${period}`;
                    const lessons = usage[room.id]?.[key] || [];

                    if (lessons.length > 0) {
                        const lessonInfo = lessons.map(l => `${l.className}`).join(', ');
                        const tooltip = lessons.map(l =>
                            `${l.className}: ${l.subject} (${l.teachers})`
                        ).join('\n');

                        html += `<td style="background: #e3f2fd; font-size: 0.75em; padding: 2px;" title="${tooltip}">${lessonInfo}</td>`;
                    } else {
                        html += '<td style="background: #f5f5f5;">-</td>';
                    }
                }
            });

            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    renderSubjects(selectedCatId = null) {
        // カテゴリリストと科目リスト
        // selectedCatIdがなければ最初のカテゴリを選択
        if (!selectedCatId && this.store.categories.length > 0) {
            selectedCatId = this.store.categories[0].id;
        }
        this.renderCategoryList(selectedCatId);
        this.renderSubjectList(selectedCatId);
    }

    renderCategoryList(selectedCatId) {
        const container = document.getElementById('category-cards');
        if (!container) return;

        container.innerHTML = this.store.categories.map((cat, index) => {
            // カスタム色があれば使用、なければインデックスベースの色を使用
            const colorIndex = index % 20;
            const defaultColor = `var(--category-color-${colorIndex})`;
            const backgroundColor = cat.color || defaultColor;

            return `
            <div class="card-item category-card ${cat.id === selectedCatId ? 'selected' : ''}" 
                 data-id="${cat.id}" 
                 data-index="${index}"
                 draggable="true"
                 style="padding: 4px 8px; min-height: auto; background-color: ${backgroundColor};">
                <div class="card-drag-handle">≡</div>
                <div class="card-content">
                    <span class="card-name">${cat.name}</span>
                </div>
                <div class="card-actions">
                    <button class="card-color" data-id="${cat.id}" title="色を変更">🎨</button>
                    <button class="card-edit" data-id="${cat.id}">✏️</button>
                    <button class="card-delete" data-id="${cat.id}">×</button>
                </div>
            </div>
        `}).join('');

        // ドラッグ＆ドロップ実装
        let draggedItem = null;

        container.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                draggedItem = card;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.dataset.index);
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', () => {
                draggedItem = null;
                card.classList.remove('dragging');
                container.querySelectorAll('.category-card').forEach(c => c.classList.remove('drag-over'));
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.classList.add('drag-over');
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                if (!draggedItem || draggedItem === card) return;

                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(card.dataset.index);

                if (!isNaN(fromIndex) && !isNaN(toIndex) && fromIndex !== toIndex) {
                    const item = this.store.categories.splice(fromIndex, 1)[0];
                    this.store.categories.splice(toIndex, 0, item);
                    this.store.saveToStorage();
                    this.renderCategoryList(selectedCatId);
                }
            });
        });

        // 選択イベント
        container.querySelectorAll('.card-item').forEach(item => {
            item.onclick = (e) => {
                if (!e.target.closest('button') && !e.target.closest('.card-drag-handle')) {
                    this.renderSubjects(item.dataset.id);
                }
            };
        });

        // 色変更イベント
        container.querySelectorAll('.card-color').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                this.openColorPicker(id, selectedCatId);
            };
        });

        // 編集・削除イベント
        container.querySelectorAll('.card-edit').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.dataset.id;
                const cat = this.store.getCategory(id);
                const name = prompt('カテゴリ名を変更', cat.name);
                if (name) {
                    this.store.updateCategory(id, name);
                    this.renderSubjects(id);
                }
            };
        });
        container.querySelectorAll('.card-delete').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.dataset.id;
                if (confirm('削除しますか？\n（含まれる科目や授業も削除されます）')) {
                    this.store.deleteCategory(id);
                    this.renderSubjects(null);
                }
            };
        });

        const addBtn = document.getElementById('btn-add-category');
        if (addBtn) {
            addBtn.onclick = () => {
                const name = prompt('新しい教科名を入力（例：国語、数学）');
                if (name) {
                    const id = `c_${Date.now()}`;
                    this.store.addCategory(id, name);
                    this.renderSubjects(id);
                }
            };
        }
    }

    openColorPicker(categoryId, selectedCatId) {
        const colors = [
            '#FFB3B3', '#FFCCB3', '#FFE0B3', '#FFEAB3', '#FFFFB3',
            '#E0FFB3', '#C8FFB3', '#B3FFB3', '#B3FFD9', '#B3FFF0',
            '#B3FFFF', '#B3E0FF', '#B3D9FF', '#B3B3FF', '#D9B3FF',
            '#E0B3FF', '#FFB3FF', '#FFB3E0', '#FFB3D9', '#FFD9E0'
        ];

        const dialog = document.createElement('div');
        dialog.className = 'dialog-overlay';
        dialog.innerHTML = `
            <div class="dialog-content" style="max-width: 320px;">
                <h3 style="margin-bottom: 16px;">色を選択</h3>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px;">
                    ${colors.map((color, i) => `
                        <div class="color-option" data-color="${color}" 
                             style="width: 40px; height: 40px; background-color: ${color}; 
                                    border-radius: 8px; cursor: pointer; border: 2px solid #ddd;
                                    transition: transform 0.1s, border-color 0.1s;"
                             onmouseover="this.style.transform='scale(1.1)'"
                             onmouseout="this.style.transform='scale(1)'">
                        </div>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn btn-secondary btn-cancel">キャンセル</button>
                    <button class="btn btn-danger btn-reset">リセット</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // 色選択
        dialog.querySelectorAll('.color-option').forEach(opt => {
            opt.onclick = () => {
                const color = opt.dataset.color;
                const cat = this.store.getCategory(categoryId);
                if (cat) {
                    cat.color = color;
                    this.store.saveToStorage();
                    this.renderCategoryList(selectedCatId);
                    this.renderSubjectList(selectedCatId);
                    this.renderTeachers();
                    this.ui.renderMainOverview();
                }
                dialog.remove();
            };
        });

        // リセット
        dialog.querySelector('.btn-reset').onclick = () => {
            const cat = this.store.getCategory(categoryId);
            if (cat) {
                delete cat.color;
                this.store.saveToStorage();
                this.renderCategoryList(selectedCatId);
                this.renderSubjectList(selectedCatId);
                this.renderTeachers();
                this.ui.renderMainOverview();
            }
            dialog.remove();
        };

        // キャンセル
        dialog.querySelector('.btn-cancel').onclick = () => dialog.remove();
        dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
    }

    renderSubjectList(catId) {
        const container = document.getElementById('subject-cards');
        if (!container) return;

        if (!catId) {
            container.innerHTML = '<div class="empty-state">教科を選択するか、追加してください</div>';
            return;
        }

        const subjects = this.store.getSubjectsByCategory(catId);

        // 親教科の色を取得
        const category = this.store.getCategory(catId);
        const categoryIndex = this.store.categories.findIndex(c => c.id === catId);
        const defaultColor = categoryIndex >= 0 ? `var(--category-color-${categoryIndex % 20})` : '#ffffff';
        const backgroundColor = category?.color || defaultColor;

        container.innerHTML = subjects.map(sub => `
            <div class="card-item subject-card ${sub.isHidden ? 'status-hidden' : ''}" data-id="${sub.id}"
                 style="min-width: 270px; padding: 8px 10px; position: relative; display: flex; flex-direction: column; gap: 2px; background-color: ${backgroundColor};">
                <div class="card-actions" style="position: absolute; top: 4px; right: 4px; display: flex; gap: 3px; flex-shrink: 0;">
                    <button class="card-toggle-hidden" data-id="${sub.id}" title="${sub.isHidden ? 'クラス一覧に表示する' : 'クラス一覧から隠す'}" style="font-size: 1em; padding: 2px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                        ${sub.isHidden ? '👁️‍🗨️' : '👁️'}
                    </button>
                    <button class="card-edit" data-id="${sub.id}" title="編集" style="font-size: 1em; padding: 2px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">✏️</button>
                    <button class="card-delete" data-id="${sub.id}" title="削除" style="font-size: 1em; padding: 2px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">🗑️</button>
                </div>
                <div class="card-content" style="display: flex; flex-direction: column; gap: 2px; padding-right: 80px; overflow: hidden; margin-top: 24px;">
                    <span class="card-name" style="font-size: 1em; font-weight: 500; white-space: nowrap; overflow: visible; text-overflow: clip;">${sub.name}</span>
                    <span class="card-short" style="font-size: 0.6em; color: #555; white-space: nowrap; overflow: visible; text-overflow: clip;">${sub.shortName || ''}</span>
                    <span style="font-size: 0.7em; color: #444; margin-top: 2px;">${sub.credits || 1}単位</span>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.card-toggle-hidden').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.dataset.id;
                const sub = this.store.getSubject(id);
                if (sub) {
                    this.store.updateSubject(sub.id, sub.name, sub.shortName, sub.categoryId, !sub.isHidden);
                    this.renderSubjectList(catId);
                }
            };
        });

        container.querySelectorAll('.card-edit').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.dataset.id;
                const sub = this.store.getSubject(id);
                if (sub) this._openSubjectEditDialog(sub, catId);
            };
        });

        container.querySelectorAll('.card-delete').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.dataset.id;
                if (confirm('削除しますか？')) {
                    this.store.deleteSubject(id);
                    this.renderSubjectList(catId);
                }
            };
        });

        const addBtn = document.getElementById('btn-add-subject');
        if (addBtn) {
            addBtn.onclick = () => {
                if (catId) this._openSubjectAddDialog(catId);
            };
        }
    }

    /** 科目編集ダイアログ */
    _openSubjectEditDialog(sub, catId) {
        const existing = document.querySelector('.subject-edit-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay subject-edit-overlay';
        overlay.innerHTML = `
            <div class="dialog-content" style="width:340px;">
                <h3 style="margin-bottom:16px;">科目を編集</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:60px; font-size:0.88em;">科目名</label>
                        <input id="es-name" type="text" value="${escapeHtml(sub.name)}" style="flex:1;">
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:60px; font-size:0.88em;">略称</label>
                        <input id="es-short" type="text" value="${escapeHtml(sub.shortName || sub.name)}" style="flex:1;">
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:60px; font-size:0.88em;">単位数</label>
                        <input id="es-credits" type="number" min="1" max="20" value="${sub.credits || 1}" style="width:60px;">
                        <span style="font-size:0.85em; color:#666;">単位/週</span>
                    </div>
                </div>
                <div class="form-actions" style="margin-top:16px;">
                    <button class="btn btn-secondary" id="es-cancel">キャンセル</button>
                    <button class="btn btn-primary" id="es-save">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#es-save').onclick = () => {
            const name   = overlay.querySelector('#es-name').value.trim();
            const short  = overlay.querySelector('#es-short').value.trim();
            const credits = parseInt(overlay.querySelector('#es-credits').value) || 1;
            if (!name) return;
            this.store.updateSubject(sub.id, { name, shortName: short || name, credits, categoryId: sub.categoryId, isHidden: sub.isHidden });
            this.renderSubjectList(catId);
            overlay.remove();
        };
        overlay.querySelector('#es-cancel').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }

    /** 科目追加ダイアログ */
    _openSubjectAddDialog(catId) {
        const existing = document.querySelector('.subject-add-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay subject-add-overlay';
        overlay.innerHTML = `
            <div class="dialog-content" style="width:340px;">
                <h3 style="margin-bottom:16px;">科目を追加</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:60px; font-size:0.88em;">科目名</label>
                        <input id="as-name" type="text" placeholder="例: 現代文" style="flex:1;" autofocus>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:60px; font-size:0.88em;">略称</label>
                        <input id="as-short" type="text" placeholder="省略可" style="flex:1;">
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="width:60px; font-size:0.88em;">単位数</label>
                        <input id="as-credits" type="number" min="1" max="20" value="1" style="width:60px;">
                        <span style="font-size:0.85em; color:#666;">単位/週</span>
                    </div>
                </div>
                <div class="form-actions" style="margin-top:16px;">
                    <button class="btn btn-secondary" id="as-cancel">キャンセル</button>
                    <button class="btn btn-primary" id="as-save">追加</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#as-save').onclick = () => {
            const name    = overlay.querySelector('#as-name').value.trim();
            const short   = overlay.querySelector('#as-short').value.trim();
            const credits = parseInt(overlay.querySelector('#as-credits').value) || 1;
            if (!name) return;
            this.store.addSubject(`s_${Date.now()}`, catId, name, short || name.slice(0, 4), credits);
            this.renderSubjectList(catId);
            overlay.remove();
        };
        overlay.querySelector('#as-cancel').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }

    // 省略されていた renderElectiveGroups はいったん枠だけ作るか、もし必要なら補完する。
    // ui.jsの読み込みログには renderMasterElectiveGroups があったので実装する。
    renderElectiveGroups() {
        const container = document.getElementById('elective-groups-list');
        if (!container) return;

        container.innerHTML = this.store.electiveGroups.map(group => `
            <div class="card-item elective-group-card" style="border-left: 5px solid ${group.color}">
                <div class="card-content">
                    <span class="card-name">${group.name}</span>
                    <span class="card-subtitle">
                        対象: ${group.subjectIds.map(sid => this.store.getSubject(sid)?.name || sid).join(', ')}
                    </span>
                </div>
                <div class="card-actions">
                    <button class="card-edit" data-id="${group.id}">✏️</button>
                    <button class="card-delete" data-id="${group.id}">×</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.card-edit').forEach(btn => {
            btn.onclick = (e) => {
                this.openElectiveGroupEditor(e.target.dataset.id);
            };
        });
        container.querySelectorAll('.card-delete').forEach(btn => {
            btn.onclick = (e) => {
                if (confirm('このグループを削除しますか？')) {
                    this.store.deleteElectiveGroup(e.target.dataset.id);
                    this.renderElectiveGroups();
                }
            };
        });

        const addBtn = document.getElementById('btn-add-elective');
        if (addBtn) {
            addBtn.onclick = () => {
                this.openElectiveGroupEditor(null);
            };
        }
    }

    openElectiveGroupEditor(groupId) {
        const editorArea = document.getElementById('elective-group-editor');
        const listArea = document.getElementById('elective-groups-list-area');

        if (!editorArea || !listArea) return;

        listArea.classList.add('hidden');
        editorArea.classList.remove('hidden');

        const group = groupId ? this.store.getElectiveGroup(groupId) : { name: '', color: '#3b82f6', subjectIds: [] };
        const allSubjects = this.store.subjects;

        editorArea.innerHTML = `
            <h3>${groupId ? 'グループ編集' : '新規グループ作成'}</h3>
            <div class="form-group">
                <label>グループ名</label>
                <input type="text" id="elective-name" value="${group.name}" placeholder="例：選択A">
            </div>
            <div class="form-group">
                <label>識別カラー</label>
                <input type="color" id="elective-color" value="${group.color}">
            </div>
            <div class="form-group">
                <label>対象科目（授業連動する科目を選択）</label>
                <div class="checkbox-grid" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
                    ${allSubjects.map(s => `
                        <label style="display:block; margin-bottom:4px;">
                            <input type="checkbox" class="elective-subject-check" value="${s.id}" 
                                ${group.subjectIds.includes(s.id) ? 'checked' : ''}>
                            ${s.name} (${this.store.getCategory(s.categoryId)?.name || ''})
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="form-actions">
                <button id="btn-save-elective" class="btn-primary">保存</button>
                <button id="btn-cancel-elective" class="btn-secondary">キャンセル</button>
            </div>
        `;

        document.getElementById('btn-cancel-elective').onclick = () => {
            editorArea.classList.add('hidden');
            listArea.classList.remove('hidden');
            editorArea.innerHTML = '';
        };

        document.getElementById('btn-save-elective').onclick = () => {
            const name = document.getElementById('elective-name').value;
            const color = document.getElementById('elective-color').value;
            const subjectIds = Array.from(document.querySelectorAll('.elective-subject-check:checked')).map(cb => cb.value);

            if (!name) {
                alert('グループ名を入力してください');
                return;
            }

            if (groupId) {
                this.store.updateElectiveGroup(groupId, name, color, subjectIds);
            } else {
                this.store.addElectiveGroup(`eg_${Date.now()}`, name, color, subjectIds);
            }

            editorArea.classList.add('hidden');
            listArea.classList.remove('hidden');
            this.renderElectiveGroups();
        };
    }

    // 担当授業 
    renderAssignmentForm() {
        this.renderAssignTags('filter-category');
        this.renderAssignTags('teacher');
        this.renderAssignTags('category');
        this.renderAssignTags('subject');
        this.renderAssignTags('class');
        this.renderAssignHours();

        this.updateAssignmentButtonState();

        const addBtn = document.getElementById('btn-add-assignment');
        if (addBtn) {
            addBtn.onclick = () => this.handleAddAssignment();
        }
        const deleteBtn = document.getElementById('btn-delete-selected');
        if (deleteBtn) {
            deleteBtn.onclick = () => this.handleBatchDelete();
        }

        // 教員グループ: 教科フィルター
        const filterTeacherCategory = document.getElementById('assignment-filter-teacher-category');
        if (filterTeacherCategory) {
            filterTeacherCategory.innerHTML = '<option value="">すべての教科</option>' +
                this.store.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        // 教員グループ: 教員フィルター
        const filterTeacher = document.getElementById('assignment-filter-teacher');
        if (filterTeacher) {
            filterTeacher.innerHTML = '<option value="">すべての教員</option>' +
                this.store.teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }

        // 科目グループ: 教科フィルター
        const filterCategory = document.getElementById('assignment-filter-category-select');
        if (filterCategory) {
            filterCategory.innerHTML = '<option value="">すべての教科</option>' +
                this.store.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        // 科目グループ: 科目フィルター
        const filterSubject = document.getElementById('assignment-filter-subject-select');
        if (filterSubject) {
            filterSubject.innerHTML = '<option value="">すべての科目</option>' +
                this.store.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }

        // クラスフィルター
        const filterClass = document.getElementById('assignment-filter-class-select');
        if (filterClass) {
            filterClass.innerHTML = '<option value="">すべてのクラス</option>' +
                CLASSES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    }

    // 教員グループ: 教科フィルター変更時
    handleTeacherCategoryFilter() {
        const categoryId = document.getElementById('assignment-filter-teacher-category')?.value;
        const filterTeacher = document.getElementById('assignment-filter-teacher');

        if (!filterTeacher) return;

        if (categoryId) {
            // 選択された教科に属する教員のみ表示
            const filteredTeachers = this.store.teachers.filter(t =>
                t.categoryIds && t.categoryIds.includes(categoryId)
            );
            filterTeacher.innerHTML = '<option value="">すべての教員</option>' +
                filteredTeachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        } else {
            // すべての教員を表示
            filterTeacher.innerHTML = '<option value="">すべての教員</option>' +
                this.store.teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }

        filterTeacher.value = ''; // 選択をリセット
        this.renderAssignmentList();
    }

    // 科目グループ: 教科フィルター変更時
    handleSubjectCategoryFilter() {
        const categoryId = document.getElementById('assignment-filter-category-select')?.value;
        const filterSubject = document.getElementById('assignment-filter-subject-select');

        if (!filterSubject) return;

        if (categoryId) {
            // 選択された教科に属する科目のみ表示
            const filteredSubjects = this.store.subjects.filter(s => s.categoryId === categoryId);
            filterSubject.innerHTML = '<option value="">すべての科目</option>' +
                filteredSubjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        } else {
            // すべての科目を表示
            filterSubject.innerHTML = '<option value="">すべての科目</option>' +
                this.store.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }

        filterSubject.value = ''; // 選択をリセット
        this.renderAssignmentList();
    }

    renderAssignTags(type) {
        let containerId = `assignment-${type}-tags`;
        let container = document.getElementById(containerId);
        if (!container) return;

        let items = [];
        let selectedIds = [];
        // let isMultiSelect = false; // logic internal

        if (type === 'filter-category') {
            items = this.store.categories;
            selectedIds = this.assignState.filterCategoryIds || [];
        } else if (type === 'teacher') {
            // 教科フィルターが選択されている場合、該当する教員のみ表示
            if (this.assignState.filterCategoryIds && this.assignState.filterCategoryIds.length > 0) {
                items = this.store.teachers.filter(t => {
                    const teacherCats = t.categoryIds || [];
                    return this.assignState.filterCategoryIds.some(catId => teacherCats.includes(catId));
                });
            } else {
                items = this.store.teachers;
            }
            selectedIds = this.assignState.teacherIds || [];
        } else if (type === 'category') {
            items = this.store.categories;
            selectedIds = this.assignState.categoryId ? [this.assignState.categoryId] : [];
        } else if (type === 'subject') {
            if (this.assignState.categoryId) {
                items = this.store.getSubjectsByCategory(this.assignState.categoryId);
            } else {
                items = [];
            }
            selectedIds = this.assignState.subjectId ? [this.assignState.subjectId] : [];
        } else if (type === 'class') {
            items = CLASSES;
            selectedIds = this.assignState.classIds || [];
        }

        if (items.length === 0 && type === 'subject') {
            container.innerHTML = '<span class="text-muted">← 教科を選択してください</span>';
            return;
        }

        if (items.length === 0 && type === 'teacher') {
            container.innerHTML = '<span class="text-muted">← 該当する教員がいません</span>';
            return;
        }

        // クラス選択は学年ごとに改行
        if (type === 'class') {
            let html = '';
            let currentGrade = null;

            // 科目が選択されている場合、classCurriculum に登録済みのクラスIDを取得
            const curriculumClassIds = this.assignState.subjectId
                ? this.store.classCurriculum
                    .filter(c => c.subjectId === this.assignState.subjectId)
                    .map(c => c.classId)
                : null;

            // カリキュラム登録済みクラスを先に、未登録を後に並べる
            const sortedItems = curriculumClassIds
                ? [
                    ...items.filter(c => curriculumClassIds.includes(c.id)),
                    ...items.filter(c => !curriculumClassIds.includes(c.id))
                  ]
                : items;

            let shownUnregisteredHeader = false;

            sortedItems.forEach(item => {
                const inCurriculum = !curriculumClassIds || curriculumClassIds.includes(item.id);

                // 未登録クラスの区切りヘッダー
                if (curriculumClassIds && !inCurriculum && !shownUnregisteredHeader) {
                    shownUnregisteredHeader = true;
                    html += '<div style="flex-basis:100%; margin-top:6px; font-size:11px; color:#9ca3af; padding:2px 0;">── クラス別設定なし ──</div>';
                    currentGrade = null;
                }

                // 学年が変わったら改行（登録済みクラス内のみ）
                if (!shownUnregisteredHeader && currentGrade !== null && item.grade !== currentGrade) {
                    html += '<div style="flex-basis: 100%; height: 8px;"></div>';
                }
                currentGrade = item.grade;

                const dimStyle = !inCurriculum ? 'opacity:0.45;' : '';
                html += `
                    <div class="tag-item ${selectedIds.includes(item.id) ? 'selected' : ''}"
                         data-id="${item.id}"
                         style="${dimStyle}"
                         onclick="ui.masterData.handleAssignTagClick('${type}', '${item.id}')">
                        ${item.name}
                    </div>
                `;
            });

            // クラス指定なし
            const isNoClassSelected = selectedIds.includes('non-class-duty');
            html += `
                <div style="flex-basis: 100%; height: 8px;"></div>
                <div class="tag-item ${isNoClassSelected ? 'selected' : ''}" 
                     data-id="non-class-duty"
                     style="font-style: italic; border-style: dashed;"
                     onclick="ui.masterData.handleAssignTagClick('${type}', 'non-class-duty')">
                    クラス指定なし
                </div>
            `;

            container.innerHTML = html;
            return;
        }

        let html = items.map(item => `
            <div class="tag-item ${selectedIds.includes(item.id) ? 'selected' : ''}" 
                 data-id="${item.id}"
                 onclick="ui.masterData.handleAssignTagClick('${type}', '${item.id}')">
                ${item.name}
            </div>
        `).join('');

        container.innerHTML = html;
    }

    handleAssignTagClick(type, id) {
        if (type === 'filter-category') {
            if (!this.assignState.filterCategoryIds) {
                this.assignState.filterCategoryIds = [];
            }
            const idx = this.assignState.filterCategoryIds.indexOf(id);
            if (idx >= 0) {
                this.assignState.filterCategoryIds.splice(idx, 1);
            } else {
                this.assignState.filterCategoryIds.push(id);
            }
            this.renderAssignTags('filter-category');
            this.renderAssignTags('teacher'); // Re-render teachers to apply filter
            this.renderAssignmentList(); // Also filter the assignment cards
        } else if (type === 'teacher') {
            const idx = this.assignState.teacherIds.indexOf(id);
            if (idx >= 0) {
                this.assignState.teacherIds.splice(idx, 1);
            } else {
                this.assignState.teacherIds.push(id);
            }
        } else if (type === 'category') {
            this.assignState.categoryId = id;
            this.assignState.subjectId = null;
            this.renderAssignTags('subject');
        } else if (type === 'subject') {
            this.assignState.subjectId = id;
        } else if (type === 'class') {
            const idx = this.assignState.classIds.indexOf(id);
            if (idx >= 0) {
                this.assignState.classIds.splice(idx, 1);
            } else {
                this.assignState.classIds.push(id);
            }
        }
        this.renderAssignTags(type);
    }

    renderAssignHours() {
        const blocksContainer = document.getElementById('hours-blocks');
        const label = document.getElementById('hours-label');
        if (blocksContainer) {
            blocksContainer.innerHTML = '';
            for (let i = 0; i < 8; i++) {
                const filled = i < this.assignState.hours;
                blocksContainer.innerHTML += `<div class="hour-block ${filled ? 'filled' : ''}"></div>`;
            }
        }
        if (label) {
            label.textContent = `${this.assignState.hours} 時間`;
        }

        const decBtn = document.getElementById('btn-hours-dec');
        const incBtn = document.getElementById('btn-hours-inc');
        if (decBtn) decBtn.onclick = () => {
            if (this.assignState.hours > 1) {
                this.assignState.hours--;
                this.renderAssignHours();
            }
        };
        if (incBtn) incBtn.onclick = () => {
            if (this.assignState.hours < 8) {
                this.assignState.hours++;
                this.renderAssignHours();
            }
        };
    }

    updateAssignmentButtonState() {
        const btn = document.getElementById('btn-add-assignment');
        if (btn) {
            if (this.assignState.editMode) {
                btn.textContent = '変更を適用';
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-warning');
            } else {
                btn.textContent = '担当授業を追加';
                btn.classList.add('btn-primary');
                btn.classList.remove('btn-warning');
            }
        }
    }

    handleAddAssignment() {
        const { teacherIds, subjectId, classIds, hours, editMode } = this.assignState;
        if (teacherIds.length === 0 || !subjectId || classIds.length === 0) {
            alert('教員、教科、科目、クラスをすべて選択してください');
            return;
        }

        this.store.snapshot();
        this.ui.updateUndoRedoButtons();

        if (editMode) {
            this.store.deleteAssignment(editMode.teacherId, editMode.subjectId, editMode.classId);
        }

        let successCount = 0;
        let failMessages = [];

        teacherIds.forEach(teacherId => {
            classIds.forEach(classId => {
                const exists = this.store.assignments.some(a =>
                    a.teacherId === teacherId && a.subjectId === subjectId && a.classId === classId
                );
                if (exists) {
                    this.store.deleteAssignment(teacherId, subjectId, classId);
                }

                const result = this.store.addAssignment(teacherId, subjectId, classId, hours);
                if (result.success) {
                    successCount++;
                } else {
                    failMessages.push(result.message);
                }
            });
        });

        if (successCount > 0) {
            const msg = editMode ? '担当授業を変更しました' : `${successCount}件の担当授業を追加しました`;
            showToast(msg, 'success');
            this.assignState.editMode = null;
            this.updateAssignmentButtonState();
            this.renderAssignmentList();
        }
        if (failMessages.length > 0) {
            alert(`一部の登録に失敗しました:\n${failMessages.slice(0, 3).join('\n')}`);
        }
    }

    renderAssignmentList() {
        const container = document.getElementById('assignment-list');
        if (!container) return;

        // フィルター値を取得
        const filterTeacher = document.getElementById('assignment-filter-teacher')?.value || '';
        const filterTeacherCategory = document.getElementById('assignment-filter-teacher-category')?.value || '';
        const filterCategory = document.getElementById('assignment-filter-category-select')?.value || '';
        const filterSubject = document.getElementById('assignment-filter-subject-select')?.value || '';
        const filterClass = document.getElementById('assignment-filter-class-select')?.value || '';

        let assignments = this.store.assignments;

        // 教員の教科フィルター（ドロップダウン選択による絞り込み）
        if (filterTeacherCategory) {
            assignments = assignments.filter(a => {
                const teacher = this.store.getTeacher(a.teacherId);
                return teacher?.categoryIds?.includes(filterTeacherCategory);
            });
        }

        // 教員の教科フィルター（タグ選択による絞り込み）
        if (this.assignState.filterCategoryIds && this.assignState.filterCategoryIds.length > 0) {
            assignments = assignments.filter(a => {
                const teacher = this.store.getTeacher(a.teacherId);
                const teacherCats = teacher?.categoryIds || [];
                return this.assignState.filterCategoryIds.some(catId => teacherCats.includes(catId));
            });
        }

        // 教員フィルター
        if (filterTeacher) {
            assignments = assignments.filter(a => a.teacherId === filterTeacher);
        }

        // 教科フィルター
        if (filterCategory) {
            assignments = assignments.filter(a => {
                const subject = this.store.getSubject(a.subjectId);
                return subject && subject.categoryId === filterCategory;
            });
        }

        // 科目フィルター
        if (filterSubject) {
            assignments = assignments.filter(a => a.subjectId === filterSubject);
        }

        // クラスフィルター
        if (filterClass) {
            assignments = assignments.filter(a => a.classId === filterClass);
        }

        const listItems = assignments.map((a) => {
            const teacher = this.store.getTeacher(a.teacherId);
            const subject = this.store.getSubject(a.subjectId);
            const cls = CLASSES.find(c => c.id === a.classId);

            // 教科名を教員データから取得
            let categoryName = '';
            let categoryColor = '';
            if (subject) {
                const cat = this.store.getCategory(subject.categoryId);
                if (cat) {
                    categoryName = cat.name;
                    // 色を取得
                    const catIndex = this.store.categories.findIndex(c => c.id === subject.categoryId);
                    if (catIndex >= 0) {
                        categoryColor = cat.color || `var(--category-color-${catIndex % 20})`;
                    }
                }
            }

            const key = `${a.teacherId}|${a.subjectId}|${a.classId}`;
            return {
                key,
                teacherName: teacher ? teacher.name : '不明',
                categoryName: categoryName,
                categoryColor: categoryColor,
                subjectName: subject ? subject.name : '不明',
                className: cls ? cls.name : (a.classId === 'non-class-duty' ? 'クラス指定なし' : a.classId),
                hours: a.weeklyHours,
                raw: a
            };
        });

        if (listItems.length === 0) {
            container.innerHTML = '<div class="empty-state">担当授業はまだありません</div>';
            this.updateDeleteButtonState();
            return;
        }

        container.innerHTML = listItems.map(item => `
            <div class="assignment-card ${this.selectedForDelete?.has(item.key) ? 'selected' : ''}" 
                 data-key="${item.key}"
                 style="${item.categoryColor ? `background-color: ${item.categoryColor};` : ''}">
                <input type="checkbox" class="assignment-checkbox" 
                       data-key="${item.key}"
                       ${this.selectedForDelete?.has(item.key) ? 'checked' : ''}
                       onclick="event.stopPropagation(); ui.masterData.handleAssignmentCheck('${item.key}')">
                <div class="assignment-card-content">
                    <div class="assignment-card-line1" style="font-size: 0.6em; color: #888; margin-bottom: 2px;">
                        ${item.categoryName}・${item.teacherName}
                    </div>
                    <div class="assignment-card-line2" style="font-size: 1em; font-weight: 500;">
                        ${item.className}　${item.subjectName}　<span style="color: var(--color-accent-primary);">${item.hours}コマ</span>
                    </div>
                </div>
                <div class="assignment-card-actions">
                    <button class="btn-icon-small" title="編集" 
                            onclick="event.stopPropagation(); ui.masterData.openEditAssignmentDialog('${item.raw.teacherId}', '${item.raw.subjectId}', '${item.raw.classId}')">
                        ✏️
                    </button>
                    <button class="btn-icon-small btn-danger" title="削除" 
                            onclick="event.stopPropagation(); ui.masterData.handleDeleteAssignment('${item.raw.teacherId}', '${item.raw.subjectId}', '${item.raw.classId}')">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');

        this.updateDeleteButtonState();
    }

    openEditAssignmentDialog(teacherId, subjectId, classId) {
        const assignment = this.store.assignments.find(
            a => a.teacherId === teacherId && a.subjectId === subjectId && a.classId === classId
        );
        if (!assignment) return;

        const teacher = this.store.getTeacher(teacherId);
        const subject = this.store.getSubject(subjectId);
        const cls = CLASSES.find(c => c.id === classId);

        // 教科名を教員データから取得
        let categoryName = '';
        if (teacher && teacher.categoryIds && teacher.categoryIds.length > 0) {
            const categories = teacher.categoryIds
                .map(cid => this.store.getCategory(cid))
                .filter(c => c);
            categoryName = categories.map(c => c.name).join('・');
        } else if (subject) {
            const cat = this.store.getCategory(subject.categoryId);
            if (cat) categoryName = cat.name;
        }

        const dialog = document.createElement('div');
        dialog.className = 'dialog-overlay';
        dialog.id = 'edit-assignment-dialog';
        dialog.innerHTML = `
            <div class="dialog-content" style="min-width: 400px;">
                <h2>担当授業を編集</h2>
                
                <div style="margin-bottom: 16px; padding: 12px; background: var(--color-bg-secondary); border-radius: 8px;">
                    <div style="font-size: 0.85em; color: #888;">${categoryName}・${teacher?.name || ''}</div>
                    <div style="font-size: 1.1em; font-weight: 500;">
                        ${cls?.name || classId}　${subject?.name || ''}
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 16px;">
                    <label>週時間数</label>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button class="btn btn-secondary" id="edit-hours-dec" style="font-size: 1.5em; width: 40px;">−</button>
                        <span id="edit-hours-value" style="font-size: 2em; font-weight: bold; min-width: 60px; text-align: center;">
                            ${assignment.weeklyHours}
                        </span>
                        <button class="btn btn-secondary" id="edit-hours-inc" style="font-size: 1.5em; width: 40px;">+</button>
                    </div>
                </div>

                <div class="dialog-actions">
                    <button id="dialog-cancel" class="btn btn-secondary">キャンセル</button>
                    <button id="dialog-save" class="btn btn-primary">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        let currentHours = assignment.weeklyHours;
        const hoursValue = dialog.querySelector('#edit-hours-value');

        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        dialog.onclick = (e) => {
            if (e.target === dialog) closeDialog();
        };
        dialog.querySelector('#dialog-cancel').onclick = closeDialog;

        dialog.querySelector('#edit-hours-dec').onclick = () => {
            if (currentHours > 1) {
                currentHours--;
                hoursValue.textContent = currentHours;
            }
        };

        dialog.querySelector('#edit-hours-inc').onclick = () => {
            if (currentHours < 20) {
                currentHours++;
                hoursValue.textContent = currentHours;
            }
        };

        dialog.querySelector('#dialog-save').onclick = () => {
            assignment.weeklyHours = currentHours;
            this.store.saveToStorage();
            closeDialog();
            this.renderAssignmentList();
            showToast('担当授業を更新しました', 'success');
        };
    }

    handleBatchDelete() {
        if (!this.selectedForDelete || this.selectedForDelete.size === 0) {
            showToast('削除する担当授業を選択してください', 'warning');
            return;
        }

        if (!confirm(`${this.selectedForDelete.size}件の担当授業を削除しますか？`)) {
            return;
        }

        this.selectedForDelete.forEach(key => {
            const [teacherId, subjectId, classId] = key.split('|');
            this.store.deleteAssignment(teacherId, subjectId, classId);
        });

        this.selectedForDelete.clear();
        this.renderAssignmentList();
        showToast(`担当授業を削除しました`, 'success');
    }

    handleBatchEdit() {
        if (!this.selectedForDelete || this.selectedForDelete.size === 0) {
            showToast('編集する担当授業を選択してください', 'warning');
            return;
        }

        const dialog = document.createElement('div');
        dialog.className = 'dialog-overlay';
        dialog.id = 'batch-edit-dialog';
        dialog.innerHTML = `
            <div class="dialog-content" style="min-width: 400px;">
                <h2>${this.selectedForDelete.size}件の時間数を一括編集</h2>
                
                <div class="form-group" style="margin-bottom: 16px;">
                    <label>週時間数を変更</label>
                    <div style="display: flex; align-items: center; gap: 12px; justify-content: center;">
                        <button class="btn btn-secondary" id="batch-hours-dec" style="font-size: 1.5em; width: 48px; height: 48px;">−</button>
                        <span id="batch-hours-value" style="font-size: 2.5em; font-weight: bold; min-width: 80px; text-align: center;">
                            2
                        </span>
                        <button class="btn btn-secondary" id="batch-hours-inc" style="font-size: 1.5em; width: 48px; height: 48px;">+</button>
                    </div>
                </div>

                <div class="dialog-actions">
                    <button id="dialog-cancel" class="btn btn-secondary">キャンセル</button>
                    <button id="dialog-save" class="btn btn-primary">一括適用</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        let currentHours = 2;
        const hoursValue = dialog.querySelector('#batch-hours-value');

        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        dialog.onclick = (e) => {
            if (e.target === dialog) closeDialog();
        };
        dialog.querySelector('#dialog-cancel').onclick = closeDialog;

        dialog.querySelector('#batch-hours-dec').onclick = () => {
            if (currentHours > 1) {
                currentHours--;
                hoursValue.textContent = currentHours;
            }
        };

        dialog.querySelector('#batch-hours-inc').onclick = () => {
            if (currentHours < 20) {
                currentHours++;
                hoursValue.textContent = currentHours;
            }
        };

        dialog.querySelector('#dialog-save').onclick = () => {
            let count = 0;
            this.selectedForDelete.forEach(key => {
                const [teacherId, subjectId, classId] = key.split('|');
                const assignment = this.store.assignments.find(
                    a => a.teacherId === teacherId && a.subjectId === subjectId && a.classId === classId
                );
                if (assignment) {
                    assignment.weeklyHours = currentHours;
                    count++;
                }
            });

            this.store.saveToStorage();
            this.selectedForDelete.clear();
            closeDialog();
            this.renderAssignmentList();
            showToast(`${count}件を更新しました`, 'success');
        };
    }

    handleSelectAllAssignments() {
        if (!this.selectedForDelete) this.selectedForDelete = new Set();

        // 現在のフィルター状態を取得
        const filterTeacher = document.getElementById('assignment-filter-teacher')?.value || '';
        const filterCategory = document.getElementById('assignment-filter-category-select')?.value || '';
        const filterSubject = document.getElementById('assignment-filter-subject-select')?.value || '';
        const filterClass = document.getElementById('assignment-filter-class-select')?.value || '';

        let targetAssignments = this.store.assignments;

        // フィルター適用
        if (filterTeacher) {
            targetAssignments = targetAssignments.filter(a => a.teacherId === filterTeacher);
        }
        if (filterCategory) {
            targetAssignments = targetAssignments.filter(a => {
                const subject = this.store.getSubject(a.subjectId);
                return subject && subject.categoryId === filterCategory;
            });
        }
        if (filterSubject) {
            targetAssignments = targetAssignments.filter(a => a.subjectId === filterSubject);
        }
        if (filterClass) {
            targetAssignments = targetAssignments.filter(a => a.classId === filterClass);
        }

        if (targetAssignments.length === 0) {
            showToast('選択対象がありません', 'warning');
            return;
        }

        // 全て選択済みかチェック
        const allSelected = targetAssignments.every(a => {
            const key = `${a.teacherId}|${a.subjectId}|${a.classId}`;
            return this.selectedForDelete.has(key);
        });

        if (allSelected) {
            // 全解除
            targetAssignments.forEach(a => {
                const key = `${a.teacherId}|${a.subjectId}|${a.classId}`;
                this.selectedForDelete.delete(key);
            });
            showToast('選択を解除しました', 'info');
        } else {
            // 全選択
            targetAssignments.forEach(a => {
                const key = `${a.teacherId}|${a.subjectId}|${a.classId}`;
                this.selectedForDelete.add(key);
            });
            showToast(`${targetAssignments.length}件を選択しました`, 'info');
        }

        this.renderAssignmentList();
    }

    handleAssignmentCheck(key) {
        if (!this.selectedForDelete) this.selectedForDelete = new Set();
        if (this.selectedForDelete.has(key)) {
            this.selectedForDelete.delete(key);
        } else {
            this.selectedForDelete.add(key);
        }
        this.renderAssignmentList();
    }

    updateDeleteButtonState() {
        const btn = document.getElementById('btn-delete-selected');
        if (btn) {
            const count = this.selectedForDelete?.size || 0;
            btn.disabled = count === 0;
            btn.textContent = count > 0 ? `選択削除 (${count})` : '選択削除';
        }
    }

    handleDeleteSelected() {
        const count = this.selectedForDelete?.size || 0;
        if (count === 0) return;
        if (!confirm(`選択した${count}件の担当授業を削除しますか？`)) return;

        this.selectedForDelete.forEach(key => {
            const [teacherId, subjectId, classId] = key.split('|');
            this.store.deleteAssignment(teacherId, subjectId, classId);
        });

        this.selectedForDelete.clear();
        showToast(`${count}件の担当授業を削除しました`, 'success');
        this.renderAssignmentList();
    }

    handleEditAssignment(teacherId, subjectId, classId) {
        const assignment = this.store.assignments.find(
            a => a.teacherId === teacherId && a.subjectId === subjectId && a.classId === classId
        );
        if (!assignment) return;

        const subject = this.store.getSubject(subjectId);

        this.assignState.teacherIds = [teacherId];
        this.assignState.categoryId = subject?.categoryId || null;
        this.assignState.subjectId = subjectId;
        this.assignState.classIds = [classId];
        this.assignState.hours = assignment.weeklyHours;
        this.assignState.editMode = { teacherId, subjectId, classId };

        this.renderAssignTags('teacher');
        this.renderAssignTags('category');
        this.renderAssignTags('subject');
        this.renderAssignTags('class');
        this.renderAssignHours();

        this.updateAssignmentButtonState();

        showToast('変更内容を選択し、「変更を適用」ボタンを押してください', 'info');
        document.querySelector('.assignment-form').scrollIntoView({ behavior: 'smooth' });
    }

    handleDeleteAssignment(teacherId, subjectId, classId) {
        if (confirm('この担当授業を削除しますか？')) {
            this.store.snapshot();
            this.ui.updateUndoRedoButtons();
            this.store.deleteAssignment(teacherId, subjectId, classId);
            this.renderAssignmentList();
        }
    }

    /**
     * 閾値設定アイテムをレンダリング
     */
    renderThresholdItem(key, title, description) {
        const thresholds = this.store.settings.validationThresholds || {
            teacherConsecutive: 4,
            classConsecutive: 4,
            sameSubject: 2,
            freePeriods: 3
        };
        const value = thresholds[key] || 4;
        const isDisabled = value >= 99;

        const containerStyle = isDisabled
            ? 'background: #f5f5f5; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 2px solid #ddd; opacity: 0.7;'
            : 'background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 2px solid var(--color-border);';

        const titleStyle = isDisabled
            ? 'font-weight: 600; margin-bottom: 4px; text-decoration: line-through; color: #999;'
            : 'font-weight: 600; margin-bottom: 4px;';

        const valueDisplay = isDisabled ? '無効' : value;
        const valueStyle = isDisabled
            ? 'font-size: 1.5em; font-weight: bold; color: #999; min-width: 60px; text-align: center;'
            : 'font-size: 2em; font-weight: bold; color: var(--color-accent-primary); min-width: 60px; text-align: center;';

        const keyMap = {
            teacherConsecutive: 'teacher-consecutive',
            classConsecutive: 'class-consecutive',
            sameSubject: 'same-subject',
            freePeriods: 'free-periods'
        };
        const idPrefix = keyMap[key];

        return `
            <div id="threshold-${idPrefix}-container" style="${containerStyle}">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="flex: 1;">
                        <div style="${titleStyle}">${title}</div>
                        <div style="font-size: 0.85em; color: #666;">${description}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="btn btn-secondary" id="btn-${idPrefix}-dec" style="font-size: 1.3em; width: 40px; height: 40px;" ${isDisabled ? 'disabled' : ''}>−</button>
                        <span id="${idPrefix}-value" style="${valueStyle}">${valueDisplay}</span>
                        <button class="btn btn-secondary" id="btn-${idPrefix}-inc" style="font-size: 1.3em; width: 40px; height: 40px;" ${isDisabled ? 'disabled' : ''}>+</button>
                        <span style="font-size: 1.1em; margin-left: 8px; ${isDisabled ? 'color: #999;' : ''}">${isDisabled ? '' : 'コマ'}</span>
                    </div>
                    <button class="btn ${isDisabled ? 'btn-accent' : 'btn-secondary'}" id="btn-${idPrefix}-toggle" style="font-size: 0.9em; padding: 8px 12px;">
                        ${isDisabled ? '有効化' : '無効化'}
                    </button>
                </div>
            </div>
        `;
    }

    renderSettings() {
        const container = document.getElementById('master-settings');
        if (!container) return;
        const { periods, classConfig } = this.store.settings;

        let html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                <!-- 左カラム: 基本設定 -->
                <div>
                    <!-- コマ数設定カード -->
                    <div class="settings-card" style="background: var(--color-bg-secondary); border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: var(--shadow-sm);">
                        <h3 style="margin: 0 0 20px 0; font-size: 1.4em; color: var(--color-text-primary);">📅 1日の時限数</h3>
                        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 16px;">
                            <div style="font-size: 3em; font-weight: bold; color: var(--color-accent-primary); min-width: 80px; text-align: center;">
                                ${periods}
                            </div>
                            <div style="flex: 1;">
                                <input type="range" id="setting-periods-slider" min="4" max="10" value="${periods}" 
                                       style="width: 100%; height: 8px; border-radius: 4px; background: linear-gradient(to right, var(--color-accent-primary) 0%, var(--color-accent-primary) ${(periods - 4) / 6 * 100}%, #ddd ${(periods - 4) / 6 * 100}%, #ddd 100%);">
                                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.9em; color: var(--color-text-muted);">
                                    <span>4コマ</span>
                                    <span>10コマ</span>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary" id="btn-periods-dec" style="font-size: 1.5em; width: 48px; height: 48px;">−</button>
                                <button class="btn btn-secondary" id="btn-periods-inc" style="font-size: 1.5em; width: 48px; height: 48px;">+</button>
                            </div>
                        </div>
                        <p class="text-muted" style="font-size: 0.9em; margin: 0;">
                            ⚠️ 変更すると時間割データに影響する可能性があります
                        </p>
                    </div>

                    <!-- クラス数設定カード -->
                    <div class="settings-card" style="background: var(--color-bg-secondary); border-radius: 12px; padding: 24px; box-shadow: var(--shadow-sm);">
                        <h3 style="margin: 0 0 20px 0; font-size: 1.4em; color: var(--color-text-primary);">🏫 クラス数設定</h3>
        `;

        for (let grade = 1; grade <= 3; grade++) {
            const classCount = classConfig[grade] || 0;
            const blocks = '■'.repeat(classCount) + '□'.repeat(Math.max(0, 10 - classCount));
            html += `
                        <div class="grade-setting" style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 2px solid var(--color-border);">
                            <div style="display: flex; align-items: center; gap: 16px;">
                                <div style="font-size: 1.3em; font-weight: bold; min-width: 60px;">${grade}年生</div>
                                <div style="font-size: 2em; font-weight: bold; color: var(--color-accent-primary); min-width: 60px; text-align: center;">
                                    ${classCount}
                                </div>
                                <div style="flex: 1; font-size: 1.2em; letter-spacing: 2px; color: var(--color-accent-primary);">
                                    ${blocks}
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn btn-secondary grade-dec" data-grade="${grade}" style="font-size: 1.3em; width: 40px; height: 40px;">−</button>
                                    <button class="btn btn-secondary grade-inc" data-grade="${grade}" style="font-size: 1.3em; width: 40px; height: 40px;">+</button>
                                </div>
                            </div>
                        </div>
            `;
        }
        html += `
                        <p class="text-muted" style="font-size: 0.9em; margin: 16px 0 0 0;">
                            ⚠️ 変更するとクラスデータに影響する可能性があります
                        </p>
                    </div>
                </div>

                <!-- 右カラム: バリデーション設定 -->
                <div>
                    <!-- バリデーション閾値設定カード -->
                    <div class="settings-card" style="background: var(--color-bg-secondary); border-radius: 12px; padding: 24px; box-shadow: var(--shadow-sm);">
                <h3 style="margin: 0 0 20px 0; font-size: 1.4em; color: var(--color-text-primary);">🔍 時間割チェック設定</h3>
                
                ${this.renderThresholdItem('teacherConsecutive', '教員の連続授業制限', '教員が連続で授業を行う場合に警告を表示する閾値')}
                ${this.renderThresholdItem('classConsecutive', 'クラスの連続授業制限', 'クラスが連続で授業を受ける場合に警告を表示する閾値')}
                ${this.renderThresholdItem('sameSubject', '連続同一科目の警告', '同じ科目が連続する場合に警告を表示する閾値')}
                ${this.renderThresholdItem('freePeriods', '空きコマの多さ', '教員の1日の空きコマ数が多い場合に情報を表示する閾値')}

                <p class="text-muted" style="font-size: 0.9em; margin: 16px 0 0 0;">
                    💡 これらの設定は時間割チェック機能で使用されます
                </p>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.attachSettingsEvents();
    }

    attachSettingsEvents() {
        const { periods, classConfig } = this.store.settings;

        // コマ数スライダー
        const slider = document.getElementById('setting-periods-slider');
        if (slider) {
            slider.oninput = (e) => {
                const value = parseInt(e.target.value);
                e.target.style.background = `linear-gradient(to right, var(--color-accent-primary) 0%, var(--color-accent-primary) ${(value - 4) / 6 * 100}%, #ddd ${(value - 4) / 6 * 100}%, #ddd 100%)`;
                e.target.previousElementSibling.textContent = value;
            };
            slider.onchange = (e) => {
                this.confirmSettingChange('periods', parseInt(e.target.value));
            };
        }

        // コマ数±ボタン
        const decBtn = document.getElementById('btn-periods-dec');
        const incBtn = document.getElementById('btn-periods-inc');
        if (decBtn) {
            decBtn.onclick = () => {
                if (periods > 4) this.confirmSettingChange('periods', periods - 1);
            };
        }
        if (incBtn) {
            incBtn.onclick = () => {
                if (periods < 10) this.confirmSettingChange('periods', periods + 1);
            };
        }

        // クラス数±ボタン
        document.querySelectorAll('.grade-dec').forEach(btn => {
            btn.onclick = (e) => {
                const grade = parseInt(e.target.dataset.grade);
                const current = classConfig[grade] || 0;
                if (current > 1) this.confirmSettingChange('class', { grade, count: current - 1 });
            };
        });

        document.querySelectorAll('.grade-inc').forEach(btn => {
            btn.onclick = (e) => {
                const grade = parseInt(e.target.dataset.grade);
                const current = classConfig[grade] || 0;
                if (current < 10) this.confirmSettingChange('class', { grade, count: current + 1 });
            };
        });

        // バリデーション閾値設定
        // 教員の連続授業制限
        const teacherConsecDec = document.getElementById('btn-teacher-consecutive-dec');
        const teacherConsecInc = document.getElementById('btn-teacher-consecutive-inc');
        const teacherConsecValue = document.getElementById('teacher-consecutive-value');

        const getThresholds = () => this.store.settings.validationThresholds || {
            teacherConsecutive: 4,
            classConsecutive: 4,
            sameSubject: 2,
            freePeriods: 3
        };

        if (teacherConsecValue) teacherConsecValue.textContent = getThresholds().teacherConsecutive;
        if (teacherConsecDec) {
            teacherConsecDec.onclick = () => {
                const current = getThresholds().teacherConsecutive;
                if (current > 2) {
                    this.confirmThresholdChange('teacherConsecutive', current - 1);
                }
            };
        }
        if (teacherConsecInc) {
            teacherConsecInc.onclick = () => {
                const current = getThresholds().teacherConsecutive;
                if (current < 10) {
                    this.confirmThresholdChange('teacherConsecutive', current + 1);
                }
            };
        }

        // クラスの連続授業制限
        const classConsecDec = document.getElementById('btn-class-consecutive-dec');
        const classConsecInc = document.getElementById('btn-class-consecutive-inc');
        const classConsecValue = document.getElementById('class-consecutive-value');
        if (classConsecValue) classConsecValue.textContent = getThresholds().classConsecutive;
        if (classConsecDec) {
            classConsecDec.onclick = () => {
                const current = getThresholds().classConsecutive;
                if (current > 2) {
                    this.confirmThresholdChange('classConsecutive', current - 1);
                }
            };
        }
        if (classConsecInc) {
            classConsecInc.onclick = () => {
                const current = getThresholds().classConsecutive;
                if (current < 10) {
                    this.confirmThresholdChange('classConsecutive', current + 1);
                }
            };
        }

        // 連続同一科目の警告
        const sameSubjectDec = document.getElementById('btn-same-subject-dec');
        const sameSubjectInc = document.getElementById('btn-same-subject-inc');
        const sameSubjectValue = document.getElementById('same-subject-value');
        if (sameSubjectValue) sameSubjectValue.textContent = getThresholds().sameSubject;
        if (sameSubjectDec) {
            sameSubjectDec.onclick = () => {
                const current = getThresholds().sameSubject;
                if (current > 2) {
                    this.confirmThresholdChange('sameSubject', current - 1);
                }
            };
        }
        if (sameSubjectInc) {
            sameSubjectInc.onclick = () => {
                const current = getThresholds().sameSubject;
                if (current < 10) {
                    this.confirmThresholdChange('sameSubject', current + 1);
                }
            };
        }

        // 空きコマの多さ
        const freePeriodsDec = document.getElementById('btn-free-periods-dec');
        const freePeriodsInc = document.getElementById('btn-free-periods-inc');
        const freePeriodsValue = document.getElementById('free-periods-value');
        if (freePeriodsValue) freePeriodsValue.textContent = getThresholds().freePeriods;
        if (freePeriodsDec) {
            freePeriodsDec.onclick = () => {
                const current = getThresholds().freePeriods;
                if (current > 1) {
                    this.confirmThresholdChange('freePeriods', current - 1);
                }
            };
        }
        if (freePeriodsInc) {
            freePeriodsInc.onclick = () => {
                const current = getThresholds().freePeriods;
                if (current < 10) {
                    this.confirmThresholdChange('freePeriods', current + 1);
                }
            };
        }

        // 無効化/有効化トグルボタン
        const toggleButtons = [
            { id: 'btn-teacher-consecutive-toggle', key: 'teacherConsecutive', defaultValue: 4 },
            { id: 'btn-class-consecutive-toggle', key: 'classConsecutive', defaultValue: 4 },
            { id: 'btn-same-subject-toggle', key: 'sameSubject', defaultValue: 2 },
            { id: 'btn-free-periods-toggle', key: 'freePeriods', defaultValue: 3 }
        ];

        toggleButtons.forEach(({ id, key, defaultValue }) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.onclick = () => {
                    const current = getThresholds()[key];
                    const isDisabled = current >= 99;
                    if (isDisabled) {
                        // 有効化（デフォルト値に戻す）
                        this.confirmThresholdToggle(key, defaultValue, true);
                    } else {
                        // 無効化（99に設定）
                        this.confirmThresholdToggle(key, 99, false);
                    }
                };
            }
        });
    }

    confirmThresholdChange(type, value) {
        const thresholds = this.store.settings.validationThresholds || {
            teacherConsecutive: 4,
            classConsecutive: 4,
            sameSubject: 2,
            freePeriods: 3
        };

        const labels = {
            teacherConsecutive: '教員の連続授業制限',
            classConsecutive: 'クラスの連続授業制限',
            sameSubject: '連続同一科目の警告',
            freePeriods: '空きコマの多さ'
        };

        const oldValue = `${thresholds[type]}コマ`;
        const newValue = `${value}コマ`;
        const message = `${labels[type]}を変更しますか?\n\n${oldValue} → ${newValue}`;

        if (confirm(message)) {
            const newThresholds = { ...thresholds, [type]: value };
            this.store.settings.validationThresholds = newThresholds;
            this.store.saveToStorage();
            this.renderSettings();
            showToast('設定を保存しました', 'success');
        } else {
            this.renderSettings();
        }
    }

    confirmThresholdToggle(type, value, isEnabling) {
        const thresholds = this.store.settings.validationThresholds || {
            teacherConsecutive: 4,
            classConsecutive: 4,
            sameSubject: 2,
            freePeriods: 3
        };

        const labels = {
            teacherConsecutive: '教員の連続授業制限',
            classConsecutive: 'クラスの連続授業制限',
            sameSubject: '連続同一科目の警告',
            freePeriods: '空きコマの多さ'
        };

        const action = isEnabling ? '有効化' : '無効化';
        const message = `${labels[type]}を${action}しますか?`;

        if (confirm(message)) {
            const newThresholds = { ...thresholds, [type]: value };
            this.store.settings.validationThresholds = newThresholds;
            this.store.saveToStorage();
            this.renderSettings();
            showToast(`${labels[type]}を${action}しました`, 'success');
        }
    }

    confirmSettingChange(type, value) {
        const { periods, classConfig } = this.store.settings;
        let message = '';
        let oldValue = '';
        let newValue = '';

        if (type === 'periods') {
            oldValue = `${periods}コマ`;
            newValue = `${value}コマ`;
            message = `1日の時限数を変更しますか？\n\n${oldValue} → ${newValue}\n\n※この変更により時間割データに影響が出る可能性があります`;
        } else if (type === 'class') {
            const { grade, count } = value;
            oldValue = `${classConfig[grade] || 0}クラス`;
            newValue = `${count}クラス`;
            message = `${grade}年生のクラス数を変更しますか？\n\n${oldValue} → ${newValue}\n\n※この変更によりクラスデータに影響が出る可能性があります`;
        }

        if (confirm(message)) {
            if (type === 'periods') {
                this.store.saveSettings(value, classConfig);
                location.reload();
            } else if (type === 'class') {
                const { grade, count } = value;
                const newConfig = { ...classConfig, [grade]: count };
                this.store.saveSettings(periods, newConfig);
                this.renderSettings();
            }
        } else {
            // キャンセル時は元に戻す
            this.renderSettings();
        }
    }

    applyChanges() {
        const activeTab = document.querySelector('.master-tab.active');
        if (activeTab && activeTab.dataset.tab === 'settings') {
            const periods = parseInt(document.getElementById('setting-periods').value);
            const classConfig = {};
            for (let grade = 1; grade <= 3; grade++) {
                classConfig[grade] = parseInt(document.getElementById(`setting-grade-${grade}`).value);
            }

            if (confirm('設定を変更しますか？\n変更を適用するには画面のリロードが必要です。')) {
                this.store.saveSettings(periods, classConfig);
                location.reload();
            }
        } else {
            if (this.store.saveToStorage()) {
                showToast('保存しました', 'success');
                this.ui.renderMainOverview();
            }
        }
    }

    // ============================================
    // 会議管理
    // ============================================

    renderMeetingForm() {
        // 会議用ステートの初期化
        if (!this.meetingState) {
            this.meetingState = {
                filterCategoryIds: [],
                teacherIds: [],
                schedule: []  // [{dayIndex, period}, ...]
            };
        }

        // 教科フィルタータグ
        const categoryContainer = document.getElementById('meeting-category-filter-tags');
        if (categoryContainer) {
            categoryContainer.innerHTML = this.store.categories.map(c => `
                <div class="tag-item ${this.meetingState.filterCategoryIds.includes(c.id) ? 'selected' : ''}"
                     data-id="${c.id}"
                     onclick="ui.masterData.handleMeetingCategoryFilter('${c.id}')">
                    ${c.name}
                </div>
            `).join('');
        }

        // 教員タグ
        this.renderMeetingTeacherTags();

        // スケジュールグリッド
        this.renderMeetingScheduleGrid();

        // 新規登録ボタン
        const addBtn = document.getElementById('btn-add-meeting');
        if (addBtn) {
            addBtn.onclick = () => this.addMeeting();
        }

        // 更新ボタン
        const updateBtn = document.getElementById('btn-update-meeting');
        if (updateBtn) {
            updateBtn.onclick = () => this.updateMeeting();
        }

        // キャンセルボタン
        const cancelBtn = document.getElementById('btn-cancel-edit-meeting');
        if (cancelBtn) {
            cancelBtn.onclick = () => this.cancelEditMeeting();
        }

        // 全選択ボタン
        const selectAllBtn = document.getElementById('btn-select-all-teachers');
        if (selectAllBtn) {
            selectAllBtn.onclick = () => this.selectAllTeachers();
        }

        // 削除ボタン
        const deleteBtn = document.getElementById('btn-delete-selected-meetings');
        if (deleteBtn) {
            deleteBtn.onclick = () => this.deleteSelectedMeetings();
        }
    }

    selectAllTeachers() {
        let teachers = this.store.teachers;

        // 教科で絞り込み
        if (this.meetingState.filterCategoryIds.length > 0) {
            teachers = teachers.filter(t =>
                t.categoryIds && t.categoryIds.some(cid =>
                    this.meetingState.filterCategoryIds.includes(cid)
                )
            );
        }

        // 全て選択済みかチェック
        const allSelected = teachers.every(t => this.meetingState.teacherIds.includes(t.id));

        if (allSelected) {
            // 全解除
            teachers.forEach(t => {
                const idx = this.meetingState.teacherIds.indexOf(t.id);
                if (idx >= 0) {
                    this.meetingState.teacherIds.splice(idx, 1);
                }
            });
        } else {
            // 全選択
            teachers.forEach(t => {
                if (!this.meetingState.teacherIds.includes(t.id)) {
                    this.meetingState.teacherIds.push(t.id);
                }
            });
        }

        this.renderMeetingTeacherTags();
    }

    cancelEditMeeting() {
        // 編集モード終了
        this.editingMeetingId = null;

        // フォームをリセット
        const nameInput = document.getElementById('meeting-name-input');
        if (nameInput) nameInput.value = '';

        this.meetingState.filterCategoryIds = [];
        this.meetingState.teacherIds = [];
        this.meetingState.schedule = [];

        // ボタン表示を切り替え
        const addBtn = document.getElementById('btn-add-meeting');
        const updateBtn = document.getElementById('btn-update-meeting');
        const cancelBtn = document.getElementById('btn-cancel-edit-meeting');

        if (addBtn) addBtn.style.display = 'block';
        if (updateBtn) updateBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';

        this.renderMeetingForm();
    }

    handleMeetingCategoryFilter(categoryId) {
        const idx = this.meetingState.filterCategoryIds.indexOf(categoryId);
        if (idx >= 0) {
            this.meetingState.filterCategoryIds.splice(idx, 1);
        } else {
            this.meetingState.filterCategoryIds.push(categoryId);
        }
        this.renderMeetingForm();
    }

    renderMeetingTeacherTags() {
        const container = document.getElementById('meeting-teacher-tags');
        if (!container) return;

        let teachers = this.store.teachers;

        // 教科で絞り込み
        if (this.meetingState.filterCategoryIds.length > 0) {
            teachers = teachers.filter(t =>
                t.categoryIds && t.categoryIds.some(cid =>
                    this.meetingState.filterCategoryIds.includes(cid)
                )
            );
        }

        container.innerHTML = teachers.map(t => `
            <div class="tag-item ${this.meetingState.teacherIds.includes(t.id) ? 'selected' : ''}"
                 data-id="${t.id}"
                 onclick="ui.masterData.handleMeetingTeacherSelect('${t.id}')">
                ${t.name}
            </div>
        `).join('');
    }

    handleMeetingTeacherSelect(teacherId) {
        const idx = this.meetingState.teacherIds.indexOf(teacherId);
        if (idx >= 0) {
            this.meetingState.teacherIds.splice(idx, 1);
        } else {
            this.meetingState.teacherIds.push(teacherId);
        }
        this.renderMeetingTeacherTags();
    }

    renderMeetingScheduleGrid() {
        const container = document.getElementById('meeting-schedule-grid');
        if (!container) return;

        const days = ['月', '火', '水', '木', '金'];
        const periods = this.store.settings.periods || 7;

        let html = '<table class="schedule-table" style="width: 100%; border-collapse: collapse;">';
        html += '<thead><tr><th style="padding: 4px; border: 1px solid #ddd;"></th>';
        for (let d = 0; d < days.length; d++) {
            html += `<th style="padding: 4px; border: 1px solid #ddd;">${days[d]}</th>`;
        }
        html += '</tr></thead><tbody>';

        for (let p = 1; p <= periods; p++) {
            html += `<tr><td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${p}</td>`;
            for (let d = 0; d < days.length; d++) {
                const isSelected = this.meetingState.schedule.some(
                    s => s.dayIndex === d && s.period === p
                );
                html += `<td class="schedule-cell ${isSelected ? 'selected' : ''}" 
                            style="padding: 8px; border: 1px solid #ddd; text-align: center; cursor: pointer; ${isSelected ? 'background: var(--color-accent-primary); color: white;' : ''}"
                            onclick="ui.masterData.handleMeetingScheduleClick(${d}, ${p})">
                    ${isSelected ? '●' : ''}
                </td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';

        container.innerHTML = html;
    }

    handleMeetingScheduleClick(dayIndex, period) {
        const idx = this.meetingState.schedule.findIndex(
            s => s.dayIndex === dayIndex && s.period === period
        );
        if (idx >= 0) {
            this.meetingState.schedule.splice(idx, 1);
        } else {
            this.meetingState.schedule.push({ dayIndex, period });
        }
        this.renderMeetingScheduleGrid();
    }

    addMeeting() {
        const nameInput = document.getElementById('meeting-name-input');
        const name = nameInput?.value.trim();

        if (!name) {
            showToast('会議名を入力してください', 'warning');
            return;
        }
        if (this.meetingState.teacherIds.length === 0) {
            showToast('参加教員を選択してください', 'warning');
            return;
        }
        if (this.meetingState.schedule.length === 0) {
            showToast('開催スケジュールを選択してください', 'warning');
            return;
        }

        const meeting = {
            id: 'meeting-' + Date.now(),
            name: name,
            teacherIds: [...this.meetingState.teacherIds],
            schedule: [...this.meetingState.schedule]
        };

        this.store.meetings.push(meeting);
        this.store.saveToStorage();

        // フォームをリセット
        nameInput.value = '';
        this.meetingState.filterCategoryIds = [];
        this.meetingState.teacherIds = [];
        this.meetingState.schedule = [];

        this.renderMeetingForm();
        this.renderMeetings();
        showToast('会議を登録しました', 'success');
    }

    renderMeetings() {
        const container = document.getElementById('meeting-cards');
        if (!container) return;

        if (!this.selectedMeetings) {
            this.selectedMeetings = new Set();
        }

        const days = ['月', '火', '水', '木', '金'];

        if (this.store.meetings.length === 0) {
            container.innerHTML = '<div class="empty-state">会議はまだ登録されていません</div>';
            return;
        }

        container.innerHTML = this.store.meetings.map(meeting => {
            const teacherNames = meeting.teacherIds
                .map(id => this.store.getTeacher(id)?.name)
                .filter(n => n)
                .join('・');

            const scheduleText = meeting.schedule
                .sort((a, b) => a.dayIndex * 10 + a.period - (b.dayIndex * 10 + b.period))
                .map(s => `${days[s.dayIndex]}${s.period}`)
                .join('、');

            return `
                <div class="meeting-card ${this.selectedMeetings.has(meeting.id) ? 'selected' : ''}"
                     style="padding: 12px; background: white; border: 1px solid var(--color-border); border-radius: 8px; ${this.selectedMeetings.has(meeting.id) ? 'border-color: var(--color-accent-primary); background: rgba(59, 130, 246, 0.1);' : ''}">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <input type="checkbox" 
                               ${this.selectedMeetings.has(meeting.id) ? 'checked' : ''}
                               onclick="event.stopPropagation(); ui.masterData.handleMeetingCheck('${meeting.id}')">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 1.1em;">${escapeHtml(meeting.name)}</div>
                            <div style="font-size: 0.85em; color: #666; margin-top: 4px;">${escapeHtml(teacherNames)}</div>
                            <div style="font-size: 0.85em; color: var(--color-accent-primary); margin-top: 4px;">📅 ${escapeHtml(scheduleText)}</div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn-icon-small" title="編集" onclick="event.stopPropagation(); ui.masterData.editMeeting('${meeting.id}')">✏️</button>
                            <button class="btn-icon-small btn-danger" title="削除" onclick="event.stopPropagation(); ui.masterData.deleteMeeting('${meeting.id}')">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    handleMeetingCheck(meetingId) {
        if (this.selectedMeetings.has(meetingId)) {
            this.selectedMeetings.delete(meetingId);
        } else {
            this.selectedMeetings.add(meetingId);
        }
        this.renderMeetings();
    }

    deleteMeeting(meetingId) {
        if (!confirm('この会議を削除しますか？')) return;

        const idx = this.store.meetings.findIndex(m => m.id === meetingId);
        if (idx >= 0) {
            this.store.meetings.splice(idx, 1);
            this.store.saveToStorage();
            this.renderMeetings();
            showToast('会議を削除しました', 'success');
        }
    }

    deleteSelectedMeetings() {
        if (!this.selectedMeetings || this.selectedMeetings.size === 0) {
            showToast('削除する会議を選択してください', 'warning');
            return;
        }

        if (!confirm(`${this.selectedMeetings.size}件の会議を削除しますか？`)) return;

        this.selectedMeetings.forEach(id => {
            const idx = this.store.meetings.findIndex(m => m.id === id);
            if (idx >= 0) {
                this.store.meetings.splice(idx, 1);
            }
        });

        this.store.saveToStorage();
        this.selectedMeetings.clear();
        this.renderMeetings();
        showToast('会議を削除しました', 'success');
    }

    editMeeting(meetingId) {
        const meeting = this.store.meetings.find(m => m.id === meetingId);
        if (!meeting) return;

        // 編集用ステートにロード
        this.meetingState.filterCategoryIds = [];
        this.meetingState.teacherIds = [...meeting.teacherIds];
        this.meetingState.schedule = [...meeting.schedule];

        // 名前入力欄に設定
        const nameInput = document.getElementById('meeting-name-input');
        if (nameInput) nameInput.value = meeting.name;

        // 編集モードを記録
        this.editingMeetingId = meetingId;

        // ボタン表示を切り替え
        const addBtn = document.getElementById('btn-add-meeting');
        const updateBtn = document.getElementById('btn-update-meeting');
        const cancelBtn = document.getElementById('btn-cancel-edit-meeting');

        if (addBtn) addBtn.style.display = 'none';
        if (updateBtn) updateBtn.style.display = 'block';
        if (cancelBtn) cancelBtn.style.display = 'block';

        this.renderMeetingForm();
    }

    updateMeeting() {
        if (!this.editingMeetingId) return;

        const nameInput = document.getElementById('meeting-name-input');
        const name = nameInput?.value.trim();

        if (!name) {
            showToast('会議名を入力してください', 'warning');
            return;
        }

        const meeting = this.store.meetings.find(m => m.id === this.editingMeetingId);
        if (meeting) {
            meeting.name = name;
            meeting.teacherIds = [...this.meetingState.teacherIds];
            meeting.schedule = [...this.meetingState.schedule];

            this.store.saveToStorage();
        }

        // 編集モード終了
        this.editingMeetingId = null;
        nameInput.value = '';
        this.meetingState.filterCategoryIds = [];
        this.meetingState.teacherIds = [];
        this.meetingState.schedule = [];

        // ボタン表示を切り替え
        const addBtn = document.getElementById('btn-add-meeting');
        const updateBtn = document.getElementById('btn-update-meeting');
        const cancelBtn = document.getElementById('btn-cancel-edit-meeting');

        if (addBtn) addBtn.style.display = 'block';
        if (updateBtn) updateBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';

        this.renderMeetingForm();
        this.renderMeetings();
        showToast('会議を更新しました', 'success');
    }
}
