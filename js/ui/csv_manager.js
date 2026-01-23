class CSVManager {
    constructor(store, ui) {
        this.store = store;
        this.ui = ui;
    }

    openUnifiedModal() {
        const modal = document.getElementById('modal-csv-unified');
        if (modal) {
            modal.classList.remove('hidden');
            // デフォルトで教員タブを選択
            this.switchCSVTab('teachers');

            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
        }
    }

    switchCSVTab(tabName) {
        // タブボタンの状態更新
        document.querySelectorAll('.csv-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        // パネルの表示切替
        document.querySelectorAll('.csv-pane').forEach(pane => {
            pane.classList.toggle('hidden', pane.id !== `csv-${tabName}`);
        });
    }

    // ============================================
    // 教員 CSV
    // ============================================
    exportTeachers() {
        const rows = [['教科', '名前']];
        this.store.teachers.forEach(t => {
            // 教科名を取得（複数の場合は・で結合）
            let categoryNames = '';
            if (t.categoryIds && t.categoryIds.length > 0) {
                const categories = t.categoryIds
                    .map(cid => this.store.getCategory(cid))
                    .filter(c => c);
                categoryNames = categories.map(c => c.name).join('・');
            }
            rows.push([categoryNames, t.name]);
        });

        // ファイル名: yymmdd_教員マスタ.csv
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const filename = `${yy}${mm}${dd}_教員マスタ.csv`;

        this.downloadCSV(rows, filename);
        showToast('教員一覧をエクスポートしました', 'success');
    }

    importTeachers(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split(/\r\n|\n/);
                let count = 0;

                // ヘッダースキップ判定（教科,名前 形式を想定）
                const startIndex = (lines[0].trim() === '教科,名前' || lines[0].trim() === '名前') ? 1 : 0;

                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    // CSV解析（教科,名前 形式）
                    const parts = line.split(',').map(p => p.trim());
                    let categoryNames = '';
                    let name = '';

                    if (parts.length >= 2) {
                        // 教科,名前 形式
                        categoryNames = parts[0];
                        name = parts[1];
                    } else if (parts.length === 1) {
                        // 名前のみ
                        name = parts[0];
                    }

                    if (!name) continue;

                    // 既存チェック（名前で判定）
                    const existing = this.store.teachers.find(t => t.name === name);
                    if (!existing) {
                        const newId = `t_${Date.now()}_${i}`;

                        // 教科IDを取得
                        let categoryIds = [];
                        if (categoryNames) {
                            const catNames = categoryNames.split('・').map(n => n.trim());
                            catNames.forEach(catName => {
                                const category = this.store.categories.find(c => c.name === catName);
                                if (category) {
                                    categoryIds.push(category.id);
                                }
                            });
                        }

                        this.store.addTeacher(newId, name, categoryIds);
                        count++;
                    }
                }

                this.store.saveToStorage();
                this.showImportResult('teachers', count);
                this.refreshUI();
            } catch (err) {
                this.showImportError('teachers', err);
            }
        };
        reader.readAsText(file);
    }

    // ============================================
    // 教科・科目 CSV
    // ============================================
    exportSubjects() {
        const rows = [['教科名', '科目名', '略称', '非表示']];
        this.store.subjects.forEach(s => {
            const category = this.store.getCategory(s.categoryId);
            rows.push([
                category?.name || '',
                s.name,
                s.shortName || '',
                s.isHidden ? 'true' : 'false'
            ]);
        });
        // ファイル名: yymmdd_教科科目マスタ.csv
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const filename = `${yy}${mm}${dd}_教科科目マスタ.csv`;

        this.downloadCSV(rows, filename);
        showToast('教科・科目をエクスポートしました', 'success');
    }

    importSubjects(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split(/\r\n|\n/);
                let count = 0;

                // ヘッダースキップ判定
                const firstLine = lines[0].trim();
                const startIndex = firstLine.startsWith('教科名') ? 1 : 0;

                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const cols = this.parseCSVLine(line);
                    const categoryName = cols[0]?.trim();
                    const subjectName = cols[1]?.trim();
                    const shortName = cols[2]?.trim() || subjectName?.slice(0, 4);
                    const isHidden = cols[3]?.trim().toLowerCase() === 'true';

                    if (!categoryName || !subjectName) continue;

                    // 教科を取得または作成
                    let category = this.store.categories.find(c => c.name === categoryName);
                    if (!category) {
                        const catId = `c_${Date.now()}_${i}`;
                        this.store.addCategory(catId, categoryName);
                        category = { id: catId, name: categoryName };
                    }

                    // 科目を追加（既存チェック）
                    const existing = this.store.subjects.find(
                        s => s.name === subjectName && s.categoryId === category.id
                    );
                    if (!existing) {
                        this.store.addSubject(`s_${Date.now()}_${i}`, category.id, subjectName, shortName);
                        // isHidden設定
                        if (isHidden) {
                            const newSubject = this.store.subjects[this.store.subjects.length - 1];
                            this.store.updateSubject(newSubject.id, subjectName, shortName, category.id, true);
                        }
                        count++;
                    }
                }

                this.store.saveToStorage();
                this.showImportResult('subjects', count);
                this.refreshUI();
            } catch (err) {
                this.showImportError('subjects', err);
            }
        };
        reader.readAsText(file);
    }

    // ============================================
    // 特別教室 CSV
    // ============================================
    exportRooms() {
        const rows = [['教室名']];
        this.store.specialClassrooms.forEach(r => {
            rows.push([r.name]);
        });
        // ファイル名: yymmdd_特別教室マスタ.csv
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const filename = `${yy}${mm}${dd}_特別教室マスタ.csv`;

        this.downloadCSV(rows, filename);
        showToast('特別教室をエクスポートしました', 'success');
    }

    importRooms(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split(/\r\n|\n/);
                let count = 0;

                // ヘッダースキップ判定
                const startIndex = lines[0].trim() === '教室名' ? 1 : 0;

                for (let i = startIndex; i < lines.length; i++) {
                    const name = lines[i].trim();
                    if (!name) continue;

                    // 既存チェック
                    const existing = this.store.specialClassrooms.find(r => r.name === name);
                    if (!existing) {
                        this.store.addSpecialClassroom(`r_${Date.now()}_${i}`, name);
                        count++;
                    }
                }

                this.store.saveToStorage();
                this.showImportResult('rooms', count);
                this.refreshUI();
            } catch (err) {
                this.showImportError('rooms', err);
            }
        };
        reader.readAsText(file);
    }

    // ============================================
    // ユーティリティ
    // ============================================
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    downloadCSV(rows, filename) {
        const csvContent = rows.map(e => e.map(field => {
            if (typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
                return `"${field.replace(/"/g, '""')}"`;
            }
            return field;
        }).join(',')).join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    showImportResult(type, count) {
        const statusEl = document.getElementById(`csv-${type}-status`);
        if (statusEl) {
            statusEl.textContent = `✓ ${count}件インポートしました`;
            statusEl.className = 'import-status success';
        }
        showToast(`${count}件のデータをインポートしました`, 'success');
    }

    showImportError(type, err) {
        console.error(err);
        const statusEl = document.getElementById(`csv-${type}-status`);
        if (statusEl) {
            statusEl.textContent = `エラー: ${err.message}`;
            statusEl.className = 'import-status error';
        }
    }

    refreshUI() {
        if (this.ui.masterData) {
            this.ui.masterData.renderTeachers();
            this.ui.masterData.renderSubjects();
            this.ui.masterData.renderSpecialClassrooms();
        }
        this.ui.renderMainOverview();
    }

    // ============================================
    // 旧フォーマット互換（必要に応じて残す）
    // ============================================
    exportUnifiedCSV() {
        // 旧形式エクスポート（互換性のため）
        const rows = [];
        rows.push(['type', 'id', 'name', 'shortName', 'teacherId', 'subjectId', 'classId', 'weeklyHours']);

        this.store.teachers.forEach(t => {
            rows.push(['teacher', t.id, t.name, '', '', '', '', '']);
        });

        this.store.categories.forEach(c => {
            rows.push(['category', c.id, c.name, '', '', '', '', '']);
        });

        this.store.subjects.forEach(s => {
            rows.push(['subject', s.id, s.name, s.shortName, '', '', s.categoryId, '']);
        });

        this.store.assignments.forEach(a => {
            rows.push(['assignment', '', '', '', a.teacherId, a.subjectId, a.classId, a.weeklyHours]);
        });

        this.downloadCSV(rows, `timetable_master_${Date.now()}.csv`);
    }

    importUnifiedCSV() {
        // 旧実装は削除（新UIを使用）
    }

    // ============================================
    // 担当授業 CSV
    // ============================================
    exportAssignments() {
        const rows = [['教員名', '教科名', '科目名', 'クラス', '週時間数']];

        this.store.assignments.forEach(a => {
            const teacher = this.store.getTeacher(a.teacherId);
            const subject = this.store.getSubject(a.subjectId);
            const category = subject ? this.store.getCategory(subject.categoryId) : null;

            if (teacher && subject && category) {
                rows.push([
                    teacher.name,
                    category.name,
                    subject.name,
                    a.classId,
                    a.weeklyHours
                ]);
            }
        });

        // ファイル名: yymmdd_担当授業マスタ.csv
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const filename = `${yy}${mm}${dd}_担当授業マスタ.csv`;

        this.downloadCSV(rows, filename);
        showToast('担当授業をエクスポートしました', 'success');
    }

    importAssignments(file, replaceAll = false) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split(/\r\n|\n/);
                let count = 0;
                const errors = [];

                // 全て置き換えの場合、既存データを削除
                if (replaceAll) {
                    this.store.assignments = [];
                }

                // ヘッダースキップ判定
                const firstLine = lines[0].trim();
                const hasHeader = firstLine.startsWith('教員名') || firstLine.startsWith('教員');
                const startIndex = hasHeader ? 1 : 0;

                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const cols = this.parseCSVLine(line);
                    if (cols.length < 5) continue;

                    const teacherName = cols[0]?.trim();
                    const categoryName = cols[1]?.trim();
                    const subjectName = cols[2]?.trim();
                    const classIds = cols[3]?.trim();
                    const weeklyHours = parseInt(cols[4]?.trim());

                    if (!teacherName || !categoryName || !subjectName || !classIds || isNaN(weeklyHours)) {
                        errors.push(`行${i + 1}: 必須項目が不足しています`);
                        continue;
                    }

                    // 教員を検索
                    const teacher = this.store.teachers.find(t => t.name === teacherName);
                    if (!teacher) {
                        errors.push(`行${i + 1}: 教員「${teacherName}」が見つかりません`);
                        continue;
                    }

                    // 教科を検索
                    const category = this.store.categories.find(c => c.name === categoryName);
                    if (!category) {
                        errors.push(`行${i + 1}: 教科「${categoryName}」が見つかりません`);
                        continue;
                    }

                    // 科目を検索
                    const subject = this.store.subjects.find(
                        s => s.name === subjectName && s.categoryId === category.id
                    );
                    if (!subject) {
                        errors.push(`行${i + 1}: 科目「${subjectName}」が見つかりません`);
                        continue;
                    }

                    // クラスを分割（・区切り対応）
                    const classList = classIds.split(/[・\/,]/).map(c => c.trim()).filter(c => c);

                    // 各クラスに対して担当授業を追加
                    for (const classId of classList) {
                        const existing = this.store.assignments.find(
                            a => a.teacherId === teacher.id &&
                                a.subjectId === subject.id &&
                                a.classId === classId
                        );

                        if (!existing) {
                            this.store.assignments.push({
                                teacherId: teacher.id,
                                subjectId: subject.id,
                                classId: classId,
                                weeklyHours: weeklyHours
                            });
                            count++;
                        }
                    }
                }

                this.store.saveToStorage();

                if (errors.length > 0) {
                    const errorMsg = errors.slice(0, 5).join('\n') +
                        (errors.length > 5 ? `\n...他${errors.length - 5}件` : '');
                    showToast(`${count}件インポート完了\n\nエラー:\n${errorMsg}`, 'warning', 5000);
                } else {
                    this.showImportResult('assignments', count, replaceAll);
                }

                this.refreshUI();
            } catch (err) {
                this.showImportError('assignments', err);
            }
        };
        reader.readAsText(file);
    }
}
