/**
 * ============================================================
 * 時間割くん - データ入出力クラス
 * ============================================================
 * 
 * マスターデータと時間割のインポート/エクスポート機能を提供します。
 * 
 * ──────────────────────────────────────────────────
 * エクスポート形式（JSON）:
 *   - version: データ形式のバージョン
 *   - exportedAt: エクスポート日時
 *   - settings: 設定（時限数、クラス構成）
 *   - masters: マスターデータ（教員、教科・科目、選択グループ、担当授業）
 *   - timetable: 時間割データ
 * ──────────────────────────────────────────────────
 */

class TimetableIO {
    static VERSION = '1.0.0';

    constructor(store) {
        this.store = store;
    }

    // ════════════════════════════════════════════════════════════
    // ■ エクスポート機能
    // ════════════════════════════════════════════════════════════

    /**
     * マスターデータをJSON形式でエクスポート
     * @returns {Object} マスターデータ
     */
    exportMasterData() {
        return {
            version: TimetableIO.VERSION,
            exportedAt: new Date().toISOString(),
            type: 'master',
            data: {
                teachers: this.store.teachers,
                categories: this.store.categories,
                subjects: this.store.subjects,
                electiveGroups: this.store.electiveGroups,
                assignments: this.store.assignments
            }
        };
    }

    /**
     * 時間割データをJSON形式でエクスポート
     * @returns {Object} 時間割データ
     */
    exportTimetable() {
        return {
            version: TimetableIO.VERSION,
            exportedAt: new Date().toISOString(),
            type: 'timetable',
            data: {
                timetable: this.store.timetable
            }
        };
    }

    /**
     * 設定データをエクスポート
     * @returns {Object} 設定データ
     */
    exportSettings() {
        return {
            version: TimetableIO.VERSION,
            exportedAt: new Date().toISOString(),
            type: 'settings',
            data: {
                periods: PERIODS,
                classConfig: CLASS_CONFIG,
                unavailableSlots: this.store.settings?.unavailableSlots || {}
            }
        };
    }

    /**
     * 全データをまとめてエクスポート
     * @returns {Object} 全データ
     */
    exportAll() {
        return {
            version: TimetableIO.VERSION,
            exportedAt: new Date().toISOString(),
            type: 'full',
            data: {
                settings: {
                    periods: PERIODS,
                    classConfig: CLASS_CONFIG,
                    unavailableSlots: this.store.settings?.unavailableSlots || {}
                },
                masters: {
                    teachers: this.store.teachers,
                    categories: this.store.categories,
                    subjects: this.store.subjects,
                    electiveGroups: this.store.electiveGroups,
                    assignments: this.store.assignments
                },
                timetable: this.store.timetable
            }
        };
    }

    /**
     * データをJSONファイルとしてダウンロード
     * @param {Object} data - エクスポートするデータ
     * @param {string} filename - ファイル名
     */
    downloadAsJson(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * マスターデータをファイルとしてダウンロード
     */
    downloadMasterData() {
        const data = this.exportMasterData();
        const filename = `timetable_master_${this._getDateString()}.json`;
        this.downloadAsJson(data, filename);
    }

    /**
     * 時間割データをファイルとしてダウンロード
     */
    downloadTimetable() {
        const data = this.exportTimetable();
        const filename = `timetable_schedule_${this._getDateString()}.json`;
        this.downloadAsJson(data, filename);
    }

    /**
     * 全データをファイルとしてダウンロード
     */
    downloadAll() {
        const data = this.exportAll();
        const filename = `timetable_full_${this._getDateString()}.json`;
        this.downloadAsJson(data, filename);
    }

    // ════════════════════════════════════════════════════════════
    // ■ インポート機能
    // ════════════════════════════════════════════════════════════

    /**
     * ファイルからJSONデータを読み込む
     * @param {File} file - 読み込むファイル
     * @returns {Promise<Object>} パースされたJSONデータ
     */
    async readJsonFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (error) {
                    reject(new Error('JSONファイルの解析に失敗しました'));
                }
            };
            reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
            reader.readAsText(file);
        });
    }

    /**
     * インポートデータの検証
     * @param {Object} data - 検証するデータ
     * @returns {{valid: boolean, message: string}} 検証結果
     */
    validateImportData(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, message: 'データ形式が正しくありません' };
        }

        if (!data.version) {
            return { valid: false, message: 'バージョン情報がありません' };
        }

        if (!data.type) {
            return { valid: false, message: 'データタイプが指定されていません' };
        }

        if (!data.data) {
            return { valid: false, message: 'データ本体がありません' };
        }

        return { valid: true, message: 'OK' };
    }

    /**
     * マスターデータをインポート
     * @param {Object} importData - インポートするデータ
     * @param {boolean} merge - trueの場合は既存データとマージ、falseの場合は上書き
     * @returns {{success: boolean, message: string}} 結果
     */
    importMasterData(importData, merge = false) {
        const validation = this.validateImportData(importData);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }

        if (importData.type !== 'master' && importData.type !== 'full') {
            return { success: false, message: 'マスターデータの形式ではありません' };
        }

        try {
            const masters = importData.type === 'full'
                ? importData.data.masters
                : importData.data;

            if (merge) {
                // マージモード: 既存データに追加
                this._mergeMasterData(masters);
            } else {
                // 上書きモード: 既存データを置換
                this._replaceMasterData(masters);
            }

            this.store.saveToStorage();
            return { success: true, message: 'マスターデータをインポートしました' };
        } catch (error) {
            return { success: false, message: `インポートに失敗しました: ${error.message}` };
        }
    }

    /**
     * 時間割データをインポート
     * @param {Object} importData - インポートするデータ
     * @returns {{success: boolean, message: string}} 結果
     */
    importTimetable(importData) {
        const validation = this.validateImportData(importData);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }

        if (importData.type !== 'timetable' && importData.type !== 'full') {
            return { success: false, message: '時間割データの形式ではありません' };
        }

        try {
            const timetable = importData.type === 'full'
                ? importData.data.timetable
                : importData.data.timetable;

            this.store.timetable = timetable;
            this.store.saveToStorage();
            return { success: true, message: '時間割データをインポートしました' };
        } catch (error) {
            return { success: false, message: `インポートに失敗しました: ${error.message}` };
        }
    }

    /**
     * 設定データをインポート
     * @param {Object} importData - インポートするデータ
     * @returns {{success: boolean, message: string}} 結果
     */
    importSettings(importData) {
        const validation = this.validateImportData(importData);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }

        if (importData.type !== 'settings' && importData.type !== 'full') {
            return { success: false, message: '設定データの形式ではありません' };
        }

        try {
            const settings = importData.type === 'full'
                ? importData.data.settings
                : importData.data;

            if (settings.periods) PERIODS = settings.periods;
            if (settings.classConfig) CLASS_CONFIG = settings.classConfig;
            if (settings.unavailableSlots) {
                this.store.settings.unavailableSlots = settings.unavailableSlots;
            }

            this.store.generateClasses();
            this.store.saveToStorage();
            return { success: true, message: '設定をインポートしました' };
        } catch (error) {
            return { success: false, message: `インポートに失敗しました: ${error.message}` };
        }
    }

    /**
     * 全データをインポート
     * @param {Object} importData - インポートするデータ
     * @returns {{success: boolean, message: string}} 結果
     */
    importAll(importData) {
        const validation = this.validateImportData(importData);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }

        if (importData.type !== 'full') {
            return { success: false, message: '完全データの形式ではありません' };
        }

        try {
            // 設定を先にインポート（クラス構成に影響するため）
            this.importSettings(importData);

            // マスターデータをインポート
            this.importMasterData(importData, false);

            // 時間割をインポート
            this.importTimetable(importData);

            return { success: true, message: '全データをインポートしました' };
        } catch (error) {
            return { success: false, message: `インポートに失敗しました: ${error.message}` };
        }
    }

    // ════════════════════════════════════════════════════════════
    // ■ プライベートメソッド
    // ════════════════════════════════════════════════════════════

    /**
     * マスターデータをマージ
     * @private
     */
    _mergeMasterData(masters) {
        if (masters.teachers) {
            masters.teachers.forEach(t => {
                if (!this.store.teachers.find(e => e.id === t.id)) {
                    this.store.teachers.push(t);
                }
            });
        }

        if (masters.categories) {
            masters.categories.forEach(c => {
                if (!this.store.categories.find(e => e.id === c.id)) {
                    this.store.categories.push(c);
                }
            });
        }

        if (masters.subjects) {
            masters.subjects.forEach(s => {
                if (!this.store.subjects.find(e => e.id === s.id)) {
                    this.store.subjects.push(s);
                }
            });
        }

        if (masters.electiveGroups) {
            masters.electiveGroups.forEach(g => {
                if (!this.store.electiveGroups.find(e => e.id === g.id)) {
                    this.store.electiveGroups.push(g);
                }
            });
        }

        if (masters.assignments) {
            masters.assignments.forEach(a => {
                const exists = this.store.assignments.find(e =>
                    e.teacherId === a.teacherId &&
                    e.subjectId === a.subjectId &&
                    e.classId === a.classId
                );
                if (!exists) {
                    this.store.assignments.push(a);
                }
            });
        }
    }

    /**
     * マスターデータを置換
     * @private
     */
    _replaceMasterData(masters) {
        if (masters.teachers) this.store.teachers = masters.teachers;
        if (masters.categories) this.store.categories = masters.categories;
        if (masters.subjects) this.store.subjects = masters.subjects;
        if (masters.electiveGroups) this.store.electiveGroups = masters.electiveGroups;
        if (masters.assignments) this.store.assignments = masters.assignments;
    }

    /**
     * 日付文字列を取得（ファイル名用）
     * @private
     */
    _getDateString() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${y}${m}${d}_${h}${min}`;
    }
}
