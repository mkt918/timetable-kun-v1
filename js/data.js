/**
 * ============================================================
 * 時間割くん - データモデルと管理クラス
 * ============================================================
 * 
 * アプリケーションのデータ構造（教員、授業、時間割）を管理します。
 * データのCRUD操作、重複チェック、CSVインポート/エクスポート機能を提供します。
 * 
 * ※ 定数（DAYS, PERIODS, CLASS_CONFIG等）はconfig.jsで定義
 * ※ ユーティリティ関数（showToast等）はutils.jsで定義
 * 
 * ■ 目次
 * ──────────────────────────────────────────────────
 * 1. DataStore クラス定義
 * 2. データのCRUD操作（teachers, categories, subjects, assignments）
 * 3. 時間割操作（setSlot, getSlot, checkConflicts）
 * 4. CSV入出力（import, export）
 * ──────────────────────────────────────────────────
 */

/**
 * データストア
 */
class DataStore {
    // ══════════════════════════════════════════════════════════
    // ■ セクション1: データストア初期化
    // ══════════════════════════════════════════════════════════

    constructor() {
        this.teachers = [];      // 教員リスト
        this.categories = [];    // 教科カテゴリリスト（国語、数学など）
        this.subjects = [];      // 科目リスト（現代文、古典など）
        this.assignments = [];   // 担当授業リスト
        this.specialClassrooms = []; // 特別教室リスト
        this.meetings = [];      // 会議リスト
        this.timetable = {};     // 時間割データ（クラスIDをキーにした辞書）

        // パーキングエリア（一時保管場所）- 教員ごとに最大20件
        // 構造: { teacherId: [{ classId, day, period, subjectId, teacherIds, specialClassroomIds, originalPosition: {day, period} }] }
        this.parkingArea = {};

        // 手動連動グループ: [{ id, slots: [{classId, day, period}, ...] }]
        this.linkedGroups = [];

        // 設定データ
        this.settings = {
            periods: 7,
            classConfig: { 1: 6, 2: 6, 3: 6 },
            unavailableSlots: {}
        };

        // モジュール初期化（新アーキテクチャ）
        this._storage = new Storage(this);
        this._ttLogic = new TTLogic(this);
        this._slotManager = new SlotManager(this);

        this.loadFromStorage();
        // 読み込み後に選択クラスを初期化（CLASSESが生成された後）
        this.selectedTeacherId = null;
        this.selectedClassId = CLASSES.length > 0 ? CLASSES[0].id : null;

        // Undo/Redo用スタック
        this.undoStack = [];
        this.redoStack = [];
        this.MAX_HISTORY = 5;
    }

    /**
     * 現在の状態を履歴に保存（変更操作の直前に呼ぶ）
     */
    snapshot() {
        const state = {
            assignments: JSON.parse(JSON.stringify(this.assignments)),
            timetable: JSON.parse(JSON.stringify(this.timetable)),
            linkedGroups: JSON.parse(JSON.stringify(this.linkedGroups)) // 連動グループも保存
        };
        this.undoStack.push(state);
        // 最大履歴数制限
        if (this.undoStack.length > this.MAX_HISTORY) {
            this.undoStack.shift();
        }
        // 新しい操作をしたらRedoスタックはクリア
        this.redoStack = [];
    }

    /**
     * 元に戻す
     */
    undo() {
        if (this.undoStack.length === 0) return { success: false };

        // 現在の状態をRedoスタックに退避
        const currentState = {
            assignments: JSON.parse(JSON.stringify(this.assignments)),
            timetable: JSON.parse(JSON.stringify(this.timetable)),
            linkedGroups: JSON.parse(JSON.stringify(this.linkedGroups))
        };
        this.redoStack.push(currentState);
        if (this.redoStack.length > this.MAX_HISTORY) {
            this.redoStack.shift();
        }

        // 過去の状態を復元
        const prevState = this.undoStack.pop();
        this.assignments = prevState.assignments;
        this.timetable = prevState.timetable;
        this.linkedGroups = prevState.linkedGroups || []; // 旧データ対応

        this.saveToStorage();
        return { success: true };
    }

    /**
     * やり直す
     */
    redo() {
        if (this.redoStack.length === 0) return { success: false };

        // 現在の状態をUndoスタックに退避
        const currentState = {
            assignments: JSON.parse(JSON.stringify(this.assignments)),
            timetable: JSON.parse(JSON.stringify(this.timetable)),
            linkedGroups: JSON.parse(JSON.stringify(this.linkedGroups))
        };
        this.undoStack.push(currentState);
        if (this.undoStack.length > this.MAX_HISTORY) {
            this.undoStack.shift();
        }

        // 未来の状態を復元
        const nextState = this.redoStack.pop();
        this.assignments = nextState.assignments;
        this.timetable = nextState.timetable;
        this.linkedGroups = nextState.linkedGroups || [];

        this.saveToStorage();
        return { success: true };
    }

    /**
     * 履歴をクリア（大幅なデータ変更時など）
     */
    clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
    }

    /**
     * ローカルストレージからデータを読み込む
     */
    /**
     * ローカルストレージからデータを読み込む
     */
    loadFromStorage() {
        try {
            // 設定の読み込みと適用（最優先）
            const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (storedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(storedSettings) };
            }
            // unavailableSlotsの初期化保証
            if (!this.settings.unavailableSlots) {
                this.settings.unavailableSlots = {};
            }

            // グローバル変数の更新
            this.applySettings();

            const teachers = localStorage.getItem(STORAGE_KEYS.TEACHERS);
            const categories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
            const subjects = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
            const assignments = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
            const timetable = localStorage.getItem(STORAGE_KEYS.TIMETABLE);

            if (teachers) this.teachers = JSON.parse(teachers);
            if (categories) this.categories = JSON.parse(categories);
            if (subjects) this.subjects = JSON.parse(subjects);
            if (assignments) this.assignments = JSON.parse(assignments);

            // 教員データのマイグレーション: categoriesフィールドがない場合は空配列を追加
            this.teachers.forEach(teacher => {
                if (!teacher.categories) {
                    teacher.categories = [];
                }
            });

            const specialClassrooms = localStorage.getItem('timetable_special_classrooms');
            if (specialClassrooms) {
                try {
                    this.specialClassrooms = JSON.parse(specialClassrooms) || [];
                } catch (e) {
                    console.error('Failed to parse specialClassrooms', e);
                    this.specialClassrooms = [];
                }
            }

            // 会議データ読み込み
            const meetings = localStorage.getItem('timetable_meetings');
            if (meetings) {
                try {
                    this.meetings = JSON.parse(meetings) || [];
                } catch (e) {
                    console.error('Failed to parse meetings', e);
                    this.meetings = [];
                }
            }

            // 手動連動グループ読み込み
            if (localStorage.getItem('timetable_linked_groups')) {
                this.linkedGroups = JSON.parse(localStorage.getItem('timetable_linked_groups'));
            }

            // パーキングエリア読み込み
            const parkingArea = localStorage.getItem('timetable_parking_area');
            if (parkingArea) {
                try {
                    this.parkingArea = JSON.parse(parkingArea) || {};
                } catch (e) {
                    console.error('Failed to parse parkingArea', e);
                    this.parkingArea = {};
                }
            }

            if (timetable) {
                this.timetable = JSON.parse(timetable);
                // データ構造のマイグレーション（Object -> Array）
                this.migrateTimetableData();
            }

            // 初期データ投入（初回起動時のみ）
            if (this.teachers.length === 0 && this.subjects.length === 0) {
                this.initSampleData();
            } else {
                // 既存データがある場合、timetableの整合性をチェック（クラスが増えた場合など）
                // ただし今回はシンプルにするため特になにもしない
            }
        } catch (e) {
            console.error('ストレージからの読み込みエラー:', e);
        }
    }

    applySettings() {
        if (this.settings.periods) {
            PERIODS = parseInt(this.settings.periods);
        }
        if (this.settings.classConfig) {
            CLASS_CONFIG = this.settings.classConfig;
        }
        this.generateClasses();
    }

    generateClasses() {
        CLASSES = [];
        for (let grade = 1; grade <= 3; grade++) {
            const count = CLASS_CONFIG[grade] || 0;
            for (let cls = 1; cls <= count; cls++) {
                CLASSES.push({
                    id: `${grade}-${cls}`,
                    name: `${grade}年${cls}組`,
                    grade: grade
                });
            }
        }
    }

    /**
     * データ構造のマイグレーション
     * - Object形式からArray形式へ変換
     * - 教員ID(t1など)でキー付けされたデータをクラスID(1-1など)へ移行
     */
    migrateTimetableData() {
        if (!this.timetable) return;

        const classIds = CLASSES.map(c => c.id);
        const keysToMigrate = [];

        // 1. Object形式 -> Array形式の変換 & 不正キーの検出
        Object.keys(this.timetable).forEach(id => {
            const slots = this.timetable[id];
            if (!slots || typeof slots !== 'object') return;

            Object.keys(slots).forEach(key => {
                const slot = slots[key];
                // Object形式 -> Array形式
                if (slot && !Array.isArray(slot)) {
                    slots[key] = [slot];
                }
            });

            // 不正キー(教員IDなど)の検出
            if (!classIds.includes(id) && id !== 'non-class-duty') {
                keysToMigrate.push(id);
            }
        });

        // 2. 教員IDでキー付けされたデータを正しいクラスIDへ移行
        keysToMigrate.forEach(wrongKey => {
            const slots = this.timetable[wrongKey];
            Object.keys(slots).forEach(timeKey => {
                const lessonsAtTime = slots[timeKey];
                if (!Array.isArray(lessonsAtTime)) return;

                lessonsAtTime.forEach(lesson => {
                    // lessonにclassIdがあれば、それを正しいキーとして使う
                    // なければ、割り当て情報から推測を試みる（難しいのでスキップ）
                    // 今回は単にclassIdがあるケースのみ対応
                    // 旧形式ではlessonにclassIdは含まれていない可能性が高い
                    // その場合はteacherIdsとsubjectIdから割り当てを探す

                    // 割り当て情報から対応するクラスを特定
                    if (lesson.teacherIds && lesson.subjectId) {
                        const assignment = this.assignments.find(a =>
                            a.teacherId === lesson.teacherIds[0] && a.subjectId === lesson.subjectId
                        );
                        if (assignment && assignment.classId) {
                            const targetClassId = assignment.classId;
                            if (!this.timetable[targetClassId]) {
                                this.timetable[targetClassId] = {};
                            }
                            if (!this.timetable[targetClassId][timeKey]) {
                                this.timetable[targetClassId][timeKey] = [];
                            }
                            // 重複チェック
                            const exists = this.timetable[targetClassId][timeKey].some(
                                s => s.subjectId === lesson.subjectId &&
                                    JSON.stringify(s.teacherIds) === JSON.stringify(lesson.teacherIds)
                            );
                            if (!exists) {
                                this.timetable[targetClassId][timeKey].push(lesson);
                            }
                        }
                    }
                });
            });

            // 移行完了後、不正キーを削除
            delete this.timetable[wrongKey];
        });

        // 変更があれば保存
        if (keysToMigrate.length > 0) {
            console.log(`データ移行完了: ${keysToMigrate.length}件の不正キーを修正しました`);
            this.saveToStorage();
        }
    }

    saveSettings(periods, classConfig, unavailableSlots = null) {
        this.settings.periods = periods;
        this.settings.classConfig = classConfig;
        if (unavailableSlots) {
            this.settings.unavailableSlots = unavailableSlots;
        }
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
        this.applySettings();
        return true;
    }

    setUnavailable(teacherId, day, period, isUnavailable) {
        if (!this.settings.unavailableSlots) this.settings.unavailableSlots = {};
        if (!this.settings.unavailableSlots[teacherId]) this.settings.unavailableSlots[teacherId] = [];

        const key = `${day}-${period}`;
        const index = this.settings.unavailableSlots[teacherId].indexOf(key);

        if (isUnavailable && index === -1) {
            this.settings.unavailableSlots[teacherId].push(key);
        } else if (!isUnavailable && index !== -1) {
            this.settings.unavailableSlots[teacherId].splice(index, 1);
        }
        this.saveToStorage();
        // 設定オブジェクト単体の保存も忘れずに
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    }

    isUnavailable(teacherId, day, period) {
        if (!this.settings.unavailableSlots || !this.settings.unavailableSlots[teacherId]) return false;
        return this.settings.unavailableSlots[teacherId].includes(`${day}-${period}`);
    }

    // 全データリセット
    resetAll() {
        localStorage.clear();
        // 設定も初期化されるので、リロードすれば初期設定に戻る
    }

    /**
     * ローカルストレージにデータを保存
     */
    saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(this.teachers));
            localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(this.categories));
            localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(this.subjects));
            localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(this.assignments));
            localStorage.setItem('timetable_special_classrooms', JSON.stringify(this.specialClassrooms));
            localStorage.setItem('timetable_meetings', JSON.stringify(this.meetings));
            localStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(this.timetable));
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
            // 手動連動グループも保存
            localStorage.setItem('timetable_linked_groups', JSON.stringify(this.linkedGroups));
            // パーキングエリアも保存
            localStorage.setItem('timetable_parking_area', JSON.stringify(this.parkingArea));
            return true;
        } catch (e) {
            console.error('ストレージへの保存エラー:', e);
            return false;
        }
    }

    /**
     * 全データを削除（オールリセット）
     */
    resetAll() {
        localStorage.clear();
        this.teachers = [];
        this.categories = [];
        this.subjects = [];
        this.assignments = [];
        this.timetable = {};
        return true;
    }

    /**
     * 時間割データを初期化
     */
    initializeTimetable() {
        CLASSES.forEach(cls => {
            this.timetable[cls.id] = {};
            for (let day = 0; day < DAYS.length; day++) {
                for (let period = 0; period < PERIODS; period++) {
                    const key = `${day}-${period}`;
                    // 変更: 1つのコマに複数の授業（オブジェクト）を格納するため配列にする
                    this.timetable[cls.id][key] = [];
                }
            }
        });
    }

    /**
     * データ構造のマイグレーション
     * 旧形式（Object/null）の時間割データを新形式（Array）に変換
     */
    migrateTimetableData() {
        if (!this.timetable) return;
        let modified = false;

        Object.keys(this.timetable).forEach(classId => {
            const classData = this.timetable[classId];
            Object.keys(classData).forEach(key => {
                const slot = classData[key];
                // nullまたはオブジェクトの場合は配列にラップする
                if (slot === null) {
                    classData[key] = [];
                    modified = true;
                } else if (!Array.isArray(slot)) {
                    // 旧形式のデータスロットを配列に変換
                    classData[key] = [slot];
                    modified = true;
                }
            });
        });

        if (modified) {
            console.log('時間割データを配列形式にマイグレーションしました');
            this.saveToStorage();
        }
    }

    // ══════════════════════════════════════════════════════════
    // ■ セクション2: データのCRUD操作（基本マスター管理）
    // ══════════════════════════════════════════════════════════

    addTeacher(id, name, categoryIds = []) {
        if (this.teachers.find(t => t.id === id)) {
            return { success: false, message: '同じIDの教員が存在します' };
        }
        this.teachers.push({ id, name, categoryIds: categoryIds || [] });
        this.saveToStorage();
        return { success: true };
    }

    updateTeacher(id, name, categoryIds = null) {
        const teacher = this.teachers.find(t => t.id === id);
        if (!teacher) return { success: false, message: '教員が見つかりません' };
        teacher.name = name;
        if (categoryIds !== null) {
            teacher.categoryIds = categoryIds;
        }
        this.saveToStorage();
        return { success: true };
    }
    deleteTeacher(id) {
        const index = this.teachers.findIndex(t => t.id === id);
        if (index !== -1) {
            this.teachers.splice(index, 1);
            // 関連する担当授業も削除
            this.assignments = this.assignments.filter(a => a.teacherId !== id);
            // 時間割からも削除
            // 時間割からも削除
            this.removeTeacherFromTimetable(id);
            this.saveToStorage();
            return { success: true };
        }
        return { success: false, message: '教員が見つかりません' };
    }

    getTeacher(id) {
        return this.teachers.find(t => t.id === id);
    }

    // ==========================================
    // 教科カテゴリ管理（国語、数学など）
    // ==========================================

    addCategory(id, name) {
        if (this.categories.find(c => c.id === id)) {
            return { success: false, message: '同じIDの教科が存在します' };
        }
        this.categories.push({ id, name });
        this.saveToStorage();
        return { success: true };
    }

    updateCategory(id, name) {
        const category = this.categories.find(c => c.id === id);
        if (category) {
            category.name = name;
            this.saveToStorage();
            return { success: true };
        }
        return { success: false, message: '教科が見つかりません' };
    }

    deleteCategory(id) {
        const index = this.categories.findIndex(c => c.id === id);
        if (index !== -1) {
            this.categories.splice(index, 1);
            // 関連する科目も削除
            const subjectIds = this.subjects.filter(s => s.categoryId === id).map(s => s.id);
            this.subjects = this.subjects.filter(s => s.categoryId !== id);
            // 関連する担当授業も削除
            this.assignments = this.assignments.filter(a => !subjectIds.includes(a.subjectId));
            this.saveToStorage();
            return { success: true };
        }
        return { success: false, message: '教科が見つかりません' };
    }

    getCategory(id) {
        return this.categories.find(c => c.id === id);
    }

    // ==========================================
    // 科目管理（現代文、古典など）
    // ==========================================

    addSubject(id, categoryId, name, shortName, isHidden = false) {
        if (this.subjects.find(s => s.id === id)) {
            return { success: false, message: '同じIDの科目が存在します' };
        }
        this.subjects.push({ id, categoryId, name, shortName: shortName || name, isHidden });
        this.saveToStorage();
        return { success: true };
    }

    updateSubject(id, name, shortName, categoryId, isHidden = false) {
        const subject = this.subjects.find(s => s.id === id);
        if (subject) {
            subject.name = name;
            subject.shortName = shortName || name;
            if (categoryId) subject.categoryId = categoryId; // categoryId更新対応
            subject.isHidden = isHidden;
            this.saveToStorage();
            return { success: true };
        }
        return { success: false, message: '科目が見つかりません' };
    }

    deleteSubject(id) {
        const index = this.subjects.findIndex(s => s.id === id);
        if (index !== -1) {
            this.subjects.splice(index, 1);
            // 関連する担当授業も削除
            this.assignments = this.assignments.filter(a => a.subjectId !== id);
            this.saveToStorage();
            return { success: true };
        }
        return { success: false, message: '科目が見つかりません' };
    }

    getSubject(id) {
        return this.subjects.find(s => s.id === id);
    }

    // ==========================================
    // 選択授業グループ管理
    // ==========================================

    addElectiveGroup(id, name, color, subjectIds) {
        if (this.electiveGroups.find(g => g.id === id)) {
            return { success: false, message: '同じIDのグループが存在します' };
        }
        this.electiveGroups.push({ id, name, color, subjectIds });
        this.saveToStorage();
        // 別途保存もしておく（マイグレーション等で消えないように）
        localStorage.setItem('timetable_elective_groups', JSON.stringify(this.electiveGroups));
        return { success: true };
    }

    updateElectiveGroup(id, name, color, subjectIds) {
        const group = this.electiveGroups.find(g => g.id === id);
        if (group) {
            group.name = name;
            group.color = color;
            group.subjectIds = subjectIds;
            this.saveToStorage();
            localStorage.setItem('timetable_elective_groups', JSON.stringify(this.electiveGroups));
            return { success: true };
        }
        return { success: false, message: 'グループが見つかりません' };
    }

    deleteElectiveGroup(id) {
        const index = this.electiveGroups.findIndex(g => g.id === id);
        if (index !== -1) {
            this.electiveGroups.splice(index, 1);
            this.saveToStorage();
            localStorage.setItem('timetable_elective_groups', JSON.stringify(this.electiveGroups));
            return { success: true };
        }
        return { success: false, message: 'グループが見つかりません' };
    }

    getElectiveGroup(id) {
        return this.electiveGroups.find(g => g.id === id);
    }

    // 科目が所属するグループを取得
    getElectiveGroupBySubject(subjectId) {
        return this.electiveGroups.find(g => g.subjectIds.includes(subjectId));
    }

    getSubjectsByCategory(categoryId) {
        return this.subjects.filter(s => s.categoryId === categoryId);
    }

    // ==========================================
    // 担当授業管理
    // ==========================================

    addAssignment(teacherId, subjectId, classId, weeklyHours) {
        // 同じ組み合わせがないかチェック
        const existing = this.assignments.find(
            a => a.teacherId === teacherId && a.subjectId === subjectId && a.classId === classId
        );
        if (existing) {
            return { success: false, message: '同じ担当授業が存在します' };
        }

        this.assignments.push({
            teacherId,
            subjectId,
            classId,
            weeklyHours: parseInt(weeklyHours)
        });
        this.saveToStorage();
        return { success: true };
    }

    deleteAssignment(teacherId, subjectId, classId) {
        const index = this.assignments.findIndex(
            a => a.teacherId === teacherId && a.subjectId === subjectId && a.classId === classId
        );
        if (index !== -1) {
            this.assignments.splice(index, 1);
            this.saveToStorage();
            return { success: true };
        }
        return { success: false, message: '担当授業が見つかりません' };
    }

    /**
     * 教員の担当授業一覧を取得
     */
    getTeacherAssignments(teacherId) {
        return this.assignments.filter(a => a.teacherId === teacherId);
    }

    // ══════════════════════════════════════════════════════════
    // ■ セクション2.5: パーキングエリア（一時保管場所）
    // ══════════════════════════════════════════════════════════

    /**
     * 授業をパーキングエリアに移動
     * @param {string} teacherId - 教員ID
     * @param {string} classId - クラスID
     * @param {number} day - 曜日
     * @param {number} period - 時限
     * @returns {{success: boolean, message?: string}}
     */
    moveToParking(teacherId, classId, day, period) {
        // 教員のパーキングエリアを初期化
        if (!this.parkingArea[teacherId]) {
            this.parkingArea[teacherId] = [];
        }

        // 容量チェック（最大20件）
        if (this.parkingArea[teacherId].length >= 20) {
            return { success: false, message: 'パーキングエリアが満杯です（最大20件）' };
        }

        // 現在のスロットを取得
        const slots = this.getSlot(classId, day, period);
        if (slots.length === 0) {
            return { success: false, message: '授業が見つかりません' };
        }

        // 該当教員の授業を検索
        const slot = slots.find(s => s.teacherIds && s.teacherIds.includes(teacherId));
        if (!slot) {
            return { success: false, message: 'この教員の授業が見つかりません' };
        }

        // パーキングアイテムを作成
        const parkingItem = {
            id: `park_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            classId: classId,
            subjectId: slot.subjectId,
            teacherIds: [...slot.teacherIds],
            specialClassroomIds: slot.specialClassroomIds ? [...slot.specialClassroomIds] : null,
            originalPosition: { day, period },
            movedAt: new Date().toISOString()
        };

        // パーキングエリアに追加
        this.parkingArea[teacherId].push(parkingItem);

        // 元のスロットから削除
        this.clearSlot(classId, day, period);

        this.saveToStorage();
        return { success: true, item: parkingItem };
    }

    /**
     * パーキングエリアから授業を復元
     * @param {string} teacherId - 教員ID
     * @param {string} itemId - パーキングアイテムID
     * @param {number} targetDay - 復元先の曜日（省略時は元の位置）
     * @param {number} targetPeriod - 復元先の時限（省略時は元の位置）
     * @returns {{success: boolean, message?: string}}
     */
    restoreFromParking(teacherId, itemId, targetDay = null, targetPeriod = null) {
        if (!this.parkingArea[teacherId]) {
            return { success: false, message: 'パーキングエリアが空です' };
        }

        const index = this.parkingArea[teacherId].findIndex(item => item.id === itemId);
        if (index === -1) {
            return { success: false, message: 'アイテムが見つかりません' };
        }

        const item = this.parkingArea[teacherId][index];
        const day = targetDay !== null ? targetDay : item.originalPosition.day;
        const period = targetPeriod !== null ? targetPeriod : item.originalPosition.period;

        // 復元先のスロットを設定
        this.setSlot(item.classId, day, period, item.subjectId, item.teacherIds, item.specialClassroomIds);

        // パーキングエリアから削除
        this.parkingArea[teacherId].splice(index, 1);

        this.saveToStorage();
        return { success: true };
    }

    /**
     * パーキングエリアからアイテムを削除（完全削除）
     * @param {string} teacherId - 教員ID
     * @param {string} itemId - パーキングアイテムID
     * @returns {{success: boolean}}
     */
    removeFromParking(teacherId, itemId) {
        if (!this.parkingArea[teacherId]) {
            return { success: false };
        }

        const index = this.parkingArea[teacherId].findIndex(item => item.id === itemId);
        if (index === -1) {
            return { success: false };
        }

        this.parkingArea[teacherId].splice(index, 1);
        this.saveToStorage();
        return { success: true };
    }

    /**
     * 教員のパーキングアイテムを取得
     * @param {string} teacherId - 教員ID
     * @returns {Array} パーキングアイテムの配列
     */
    getParkingItems(teacherId) {
        return this.parkingArea[teacherId] || [];
    }

    /**
     * 全教員のパーキングアイテムを取得（教員情報付き）
     * @returns {Array} パーキングアイテムの配列（各アイテムにteacherIdとteacherNameを含む）
     */
    getAllParkingItems() {
        const allItems = [];

        for (const teacherId in this.parkingArea) {
            const items = this.parkingArea[teacherId];
            const teacher = this.getTeacher(teacherId);

            items.forEach(item => {
                allItems.push({
                    ...item,
                    teacherId: teacherId,
                    teacherName: teacher ? teacher.name : '不明'
                });
            });
        }

        // 移動日時の降順でソート（新しいものが上）
        allItems.sort((a, b) => new Date(b.movedAt) - new Date(a.movedAt));

        return allItems;
    }


    /**
     * パーキングエリアを全クリア
     * @param {string} teacherId - 教員ID（省略時は全教員）
     */
    clearParking(teacherId = null) {
        if (teacherId) {
            this.parkingArea[teacherId] = [];
        } else {
            this.parkingArea = {};
        }
        this.saveToStorage();
    }

    /**
     * 一括でパーキングエリアに移動
     * @param {string} teacherId - 教員ID
     * @param {Object} filter - 絞り込み条件 { day?: number, period?: number }
     * @returns {{success: boolean, count: number}}
     */
    moveToParkingBulk(teacherId, filter = {}) {
        const teacherTimetable = this.getTeacherTimetable(teacherId);
        let count = 0;

        // フィルタに基づいてスロットを収集
        const slotsToMove = [];
        DAYS.forEach((dayName, dayIndex) => {
            if (filter.day !== undefined && filter.day !== dayIndex) return;

            for (let period = 0; period < PERIODS; period++) {
                if (filter.period !== undefined && filter.period !== period) continue;

                const key = `${dayIndex}-${period}`;
                const slots = teacherTimetable[key] || [];

                slots.forEach(slot => {
                    if (slot.teacherIds && slot.teacherIds.includes(teacherId)) {
                        slotsToMove.push({
                            classId: slot.classId,
                            day: dayIndex,
                            period: period
                        });
                    }
                });
            }
        });

        // 各スロットをパーキングに移動
        slotsToMove.forEach(slotInfo => {
            const result = this.moveToParking(teacherId, slotInfo.classId, slotInfo.day, slotInfo.period);
            if (result.success) count++;
        });

        return { success: true, count };
    }

    /**
     * パーキングエリアから全て元の位置に復元
     * @param {string} teacherId - 教員ID
     * @returns {{success: boolean, count: number}}
     */
    restoreAllFromParking(teacherId) {
        if (!this.parkingArea[teacherId] || this.parkingArea[teacherId].length === 0) {
            return { success: false, count: 0 };
        }

        let count = 0;
        // 後ろから処理して配列操作の問題を回避
        while (this.parkingArea[teacherId].length > 0) {
            const item = this.parkingArea[teacherId][0];
            const result = this.restoreFromParking(teacherId, item.id);
            if (result.success) count++;
            else break; // エラー時は中断
        }

        return { success: true, count };
    }

    // ══════════════════════════════════════════════════════════
    // ■ セクション3: 時間割操作（メインロジック）
    // ══════════════════════════════════════════════════════════

    /**
     * 時間割にスロットを設定（配列対応）
     * @param {string} classId - クラスID
     * @param {number} day - 曜日（0-4）
     * @param {number} period - 時限（0-6）
     * @param {string} subjectId - 教科ID
     * @param {string[]} teacherIds - 教員ID配列（TT対応）
     * @param {string|string[]|null} specialClassroomIds - 特別教室ID(s) - 単一IDまたは配列
     * @param {boolean} append - 追加モードかどうか
     */
    setSlot(classId, day, period, subjectId, teacherIds, specialClassroomIds = null, append = false) {
        const key = `${day}-${period}`;

        if (!this.timetable[classId]) {
            this.timetable[classId] = {};
        }

        // 初期化（未定義なら空配列）
        if (!Array.isArray(this.timetable[classId][key])) {
            this.timetable[classId][key] = [];
        }

        if (subjectId && teacherIds && teacherIds.length > 0) {
            // specialClassroomIds を配列に正規化
            let roomIds = null;
            if (specialClassroomIds) {
                if (Array.isArray(specialClassroomIds)) {
                    roomIds = specialClassroomIds.filter(id => id); // 空文字除去
                } else if (typeof specialClassroomIds === 'string' && specialClassroomIds) {
                    roomIds = [specialClassroomIds];
                }
            }

            const newLesson = {
                subjectId,
                teacherIds,
                specialClassroomIds: roomIds && roomIds.length > 0 ? roomIds : null
            };

            if (append) {
                // 追加: 既存配列にプッシュ
                this.timetable[classId][key].push(newLesson);
            } else {
                // 上書き: 新しい授業だけの配列にする
                this.timetable[classId][key] = [newLesson];
            }
        } else if (!append) {
            // クリア（上書きモードでデータなしの場合）
            this.timetable[classId][key] = [];
        }

        this.saveToStorage();
        return { success: true };
    }

    /**
     * 時間割スロットを取得
     */
    /**
     * 時間割スロットを取得（常に配列を返す）
     */
    getSlot(classId, day, period) {
        const key = `${day}-${period}`;
        const slot = this.timetable[classId]?.[key];
        // null/undefined/旧object形式対策
        if (!slot) return [];
        return Array.isArray(slot) ? slot : [slot];
    }

    /**
     * 既存スロットの使用教室のみを更新
     * @param {string} classId - クラスID
     * @param {number} day - 曜日
     * @param {number} period - 時限
     * @param {string[]} specialClassroomIds - 新しい特別教室ID配列
     * @returns {Object} 結果
     */
    updateSlotRooms(classId, day, period, specialClassroomIds) {
        const key = `${day}-${period}`;
        const slots = this.timetable[classId]?.[key];
        if (!slots || !Array.isArray(slots) || slots.length === 0) {
            return { success: false, message: 'スロットが見つかりません' };
        }

        // 正規化
        let roomIds = null;
        if (specialClassroomIds) {
            if (Array.isArray(specialClassroomIds)) {
                roomIds = specialClassroomIds.filter(id => id);
            } else if (typeof specialClassroomIds === 'string' && specialClassroomIds) {
                roomIds = [specialClassroomIds];
            }
        }

        // 全てのスロットの教室情報を更新
        slots.forEach(slot => {
            slot.specialClassroomIds = roomIds && roomIds.length > 0 ? roomIds : null;
            // 旧形式も削除
            delete slot.specialClassroomId;
        });

        this.saveToStorage();
        return { success: true };
    }

    /**
     * 時間割スロットをクリア
     */
    clearSlot(classId, day, period) {
        const key = `${day}-${period}`;
        if (this.timetable[classId]) {
            this.timetable[classId][key] = [];
            this.saveToStorage();
        }
    }

    /**
     * 連動授業を一括削除
     * @param {string} classId - 基準クラスID
     * @param {number} day - 曜日
     * @param {number} period - 時限
     * @returns {{count: number}} 削除した件数
     */
    clearLinkedLessons(classId, day, period) {
        const linkedLessons = this.getLinkedLessons(classId, day, period);

        if (linkedLessons.length <= 1) {
            // 単一授業なので通常削除
            this.clearSlot(classId, day, period);
            return { count: 1 };
        }

        // 連動削除
        linkedLessons.forEach(lesson => {
            const key = `${day}-${period}`;
            if (this.timetable[lesson.classId]) {
                const slots = this.timetable[lesson.classId][key] || [];
                // 該当科目だけ削除
                this.timetable[lesson.classId][key] = slots.filter(s => s.subjectId !== lesson.subjectId);
            }
        });

        this.saveToStorage();
        return { count: linkedLessons.length };
    }

    /**
     * 教員を時間割から削除（配列対応）
     */
    removeTeacherFromTimetable(teacherId) {
        Object.keys(this.timetable).forEach(classId => {
            Object.keys(this.timetable[classId]).forEach(key => {
                const slots = this.timetable[classId][key];
                if (Array.isArray(slots)) {
                    // 逆順ループで削除安全に
                    for (let i = slots.length - 1; i >= 0; i--) {
                        const lesson = slots[i];
                        if (lesson.teacherIds && lesson.teacherIds.includes(teacherId)) {
                            const idx = lesson.teacherIds.indexOf(teacherId);
                            if (idx !== -1) {
                                lesson.teacherIds.splice(idx, 1);
                                // 教員が0人になったら授業削除
                                if (lesson.teacherIds.length === 0) {
                                    slots.splice(i, 1);
                                }
                            }
                        }
                    }
                } else if (slots && slots.teacherIds) {
                    // 旧形式
                    const index = slots.teacherIds.indexOf(teacherId);
                    if (index !== -1) {
                        slots.teacherIds.splice(index, 1);
                        if (slots.teacherIds.length === 0) {
                            this.timetable[classId][key] = []; // 空配列に変換
                        }
                    }
                }
            });
        });
        this.saveToStorage();
    }

    /**
     * 連動授業を取得（手動連動グループのみ）
     * @param {string} classId - クラスID
     * @param {number} day - 曜日
     * @param {number} period - 時限
     * @returns {Array<{classId, subjectId, teacherIds, day, period}>} 連動する授業のリスト
     */
    getLinkedLessons(classId, day, period) {
        const slots = this.getSlot(classId, day, period);
        if (slots.length === 0) return [];

        const linked = [];

        // 自分自身を追加
        slots.forEach(s => {
            linked.push({
                classId: classId,
                day: day,
                period: period,
                subjectId: s.subjectId,
                teacherIds: s.teacherIds
            });
        });

        // 手動連動グループをチェック
        this.linkedGroups.forEach(group => {
            const isInGroup = group.slots.some(s =>
                s.classId === classId && s.day === day && s.period === period
            );
            if (isInGroup) {
                group.slots.forEach(s => {
                    // 自分自身以外を追加
                    if (s.classId === classId && s.day === day && s.period === period) return;

                    const slotData = this.getSlot(s.classId, s.day, s.period);
                    if (slotData.length > 0) {
                        // 重複チェック
                        const exists = linked.some(l =>
                            l.classId === s.classId && l.day === s.day && l.period === s.period
                        );
                        if (!exists) {
                            linked.push({
                                classId: s.classId,
                                day: s.day,
                                period: s.period,
                                subjectId: slotData[0].subjectId,
                                teacherIds: slotData[0].teacherIds
                            });
                        }
                    }
                });
            }
        });

        return linked;
    }

    /**
     * 授業を移動（シンプルな連動移動）
     */
    moveLesson(classId, fromDay, fromPeriod, subjectId, teacherIds, toDay, toPeriod) {
        // 移動先が同じなら何もしない
        if (fromDay === toDay && fromPeriod === toPeriod) return { success: true };

        // 連動授業を取得
        const linkedLessons = this.getLinkedLessons(classId, fromDay, fromPeriod);

        if (linkedLessons.length > 1) {
            // 連動移動: すべての関連授業を移動
            return this.moveLinkedLessons(linkedLessons, fromDay, fromPeriod, toDay, toPeriod);
        } else {
            // 単一授業移動
            return this.moveSingleLesson(classId, fromDay, fromPeriod, subjectId, teacherIds, toDay, toPeriod);
        }
    }

    /**
     * 連動授業を一括移動
     */
    moveLinkedLessons(linkedLessons, fromDay, fromPeriod, toDay, toPeriod) {
        // 各授業を移動
        linkedLessons.forEach(lesson => {
            const slots = this.getSlot(lesson.classId, fromDay, fromPeriod);
            const slot = slots.find(s => s.subjectId === lesson.subjectId);
            if (slot) {
                // 移動元からクリア
                const newSlots = slots.filter(s => s.subjectId !== lesson.subjectId);
                const fromKey = `${fromDay}-${fromPeriod}`;
                this.timetable[lesson.classId][fromKey] = newSlots;

                // 移動先に追加
                // specialClassroomId も引き継ぐ必要があるが、lessonオブジェクトは getSlot したものではなく getLinkedLessons の結果。
                // getLinkedLessons は specialClassroomId を返していないので修正が必要。
                // いや、 data.js の getLinkedLessons 修正は後で行うとして、ここでは slot オブジェクトから直接取る。
                // slot は getSlot() で取得したもの。
                const originalSlot = slots.find(s => s.subjectId === lesson.subjectId);
                const roomIds = originalSlot ? (originalSlot.specialClassroomIds || (originalSlot.specialClassroomId ? [originalSlot.specialClassroomId] : null)) : null;

                this.setSlot(lesson.classId, toDay, toPeriod, lesson.subjectId, lesson.teacherIds, roomIds, true);
            }
        });

        // 手動連動グループの時間帯も更新
        this.linkedGroups.forEach(group => {
            group.slots = group.slots.map(s => {
                if (s.day === fromDay && s.period === fromPeriod) {
                    return { ...s, day: toDay, period: toPeriod };
                }
                return s;
            });
        });

        this.saveToStorage();
        return { success: true, count: linkedLessons.length };
    }


    /**
     * 単一授業の移動
     */
    moveSingleLesson(classId, fromDay, fromPeriod, subjectId, teacherIds, toDay, toPeriod) {
        // 移動先の確認（重複など）はUI側で事前チェック推奨だが、ここでも強制上書きとする
        // 必要なら checkConflicts 的なものを呼ぶ

        // 1. 移動先に追加 (append=true)
        // 元の授業から roomId を取得する必要があるが、引数に含まれていない。
        // getSlotで取得してから呼ぶか、引数を増やすか。
        // moveLesson -> moveSingleLesson の流れなので、 moveLesson 内で取得済み？
        // いや、 moveLesson は roomId を知らない。
        // ここで再取得するのが安全。
        const sourceSlots = this.getSlot(classId, fromDay, fromPeriod);
        const sourceSlot = sourceSlots.find(s => s.subjectId === subjectId); // subjectIdは必須
        const roomIds = sourceSlot ? (sourceSlot.specialClassroomIds || (sourceSlot.specialClassroomId ? [sourceSlot.specialClassroomId] : null)) : null;

        this.setSlot(classId, toDay, toPeriod, subjectId, teacherIds, roomIds, false);

        // 2. 移動元から削除
        const fromSlots = this.getSlot(classId, fromDay, fromPeriod);
        const newFromSlots = fromSlots.filter(s => s.subjectId !== subjectId); // 同一科目が複数あると全部消えるが、通常はない想定

        const key = `${fromDay}-${fromPeriod}`;
        this.timetable[classId][key] = newFromSlots;

        this.saveToStorage();
        return { success: true };
    }

    /**
     * 選択授業グループの一括移動
     */
    moveElectiveGroupLesson(group, fromDay, fromPeriod, toDay, toPeriod) {
        // 影響を受けるクラスと授業を収集
        const targets = [];

        CLASSES.forEach(cls => {
            const slots = this.getSlot(cls.id, fromDay, fromPeriod);
            slots.forEach(slot => {
                if (group.subjectIds.includes(slot.subjectId)) {
                    targets.push({
                        classId: cls.id,
                        subjectId: slot.subjectId,
                        teacherIds: slot.teacherIds
                    });
                }
            });
        });

        if (targets.length === 0) return { success: false, message: '移動対象が見つかりません' };

        // 一括移動実行
        targets.forEach(target => {
            // 移動先へ追加
            const sourceSlots = this.getSlot(target.classId, fromDay, fromPeriod);
            const sourceSlot = sourceSlots.find(s => s.subjectId === target.subjectId);
            const roomIds = sourceSlot ? (sourceSlot.specialClassroomIds || (sourceSlot.specialClassroomId ? [sourceSlot.specialClassroomId] : null)) : null;

            this.setSlot(target.classId, toDay, toPeriod, target.subjectId, target.teacherIds, roomIds, true);

            // 移動元から削除
            const key = `${fromDay}-${fromPeriod}`;
            const currentSlots = this.timetable[target.classId][key];
            if (Array.isArray(currentSlots)) {
                this.timetable[target.classId][key] = currentSlots.filter(s => s.subjectId !== target.subjectId);
            }
        });

        this.saveToStorage();
        return { success: true, count: targets.length };
    }

    /**
     * 教員の時間割を取得（配列対応）
     */
    getTeacherTimetable(teacherId) {
        const result = {};

        for (let day = 0; day < DAYS.length; day++) {
            for (let period = 0; period < PERIODS; period++) {
                const key = `${day}-${period}`;
                // 空の配列で初期化しない場合、存在するキーのみ持つことになる

                const cellData = [];

                // 全クラスをチェック
                CLASSES.forEach(cls => {
                    const slots = this.getSlot(cls.id, day, period);
                    slots.forEach(slot => {
                        if (slot.teacherIds && slot.teacherIds.includes(teacherId)) {
                            // 科目情報の取得
                            const subject = this.getSubject(slot.subjectId);
                            // 非表示科目でも教員一覧には表示する（ユーザー要望により変更）

                            cellData.push({
                                classId: cls.id,
                                className: cls.name,
                                subjectId: slot.subjectId,
                                subjectName: subject?.shortName || '',
                                teacherIds: slot.teacherIds,
                                isTT: slot.teacherIds.length > 1,
                                specialClassroomIds: slot.specialClassroomIds || (slot.specialClassroomId ? [slot.specialClassroomId] : null)
                            });
                        }
                    });
                });

                // non-class-duty (授業外業務) もチェック
                const nonClassSlots = this.getSlot('non-class-duty', day, period);
                nonClassSlots.forEach(slot => {
                    if (slot.teacherIds && slot.teacherIds.includes(teacherId)) {
                        const subject = this.getSubject(slot.subjectId);
                        cellData.push({
                            classId: 'non-class-duty',
                            className: '業務',
                            subjectId: slot.subjectId,
                            subjectName: subject?.shortName || '業務',
                            teacherIds: slot.teacherIds,
                            isTT: false,
                            specialClassroomIds: slot.specialClassroomIds || (slot.specialClassroomId ? [slot.specialClassroomId] : null)
                        });
                    }
                });

                if (cellData.length > 0) {
                    result[key] = cellData;
                }
            }
        }
        return result;
    }

    /**
     * 教員の残り時間数を計算
     */
    getTeacherRemainingHours(teacherId) {
        const assignments = this.getTeacherAssignments(teacherId);
        const teacherTimetable = this.getTeacherTimetable(teacherId);

        // 各担当授業の使用時間をカウント
        const usedHours = {};

        Object.values(teacherTimetable).forEach(slots => {
            slots.forEach(slot => {
                const key = `${slot.subjectId}-${slot.classId}`;
                usedHours[key] = (usedHours[key] || 0) + 1;
            });
        });

        // 残り時間を計算
        return assignments.map(a => {
            const key = `${a.subjectId}-${a.classId}`;
            const used = usedHours[key] || 0;
            const className = CLASSES.find(c => c.id === a.classId)?.name || a.classId;
            const subjectName = this.getSubject(a.subjectId)?.shortName || a.subjectId;

            return {
                subjectId: a.subjectId,
                subjectName,
                classId: a.classId,
                className,
                weeklyHours: a.weeklyHours,
                usedHours: used,
                remainingHours: a.weeklyHours - used,
                isComplete: used >= a.weeklyHours
            };
        });
    }

    // ==========================================
    // 重複チェック
    // ==========================================

    /**
     * 重複をチェック
     * @returns {Array} 重複警告の配列
     */
    checkConflicts() {
        const conflicts = [];

        // 各クラスの時間割をチェック
        CLASSES.forEach(cls => {
            for (let day = 0; day < DAYS.length; day++) {
                for (let period = 0; period < PERIODS; period++) {
                    const slots = this.getSlot(cls.id, day, period);

                    // スロット内の全授業についてチェック
                    slots.forEach(lesson => {
                        if (lesson.teacherIds && lesson.teacherIds.length > 0) {
                            lesson.teacherIds.forEach(teacherId => {
                                // この教員が同じ時間帯に他のクラスにいないかチェック
                                CLASSES.forEach(otherCls => {
                                    if (otherCls.id === cls.id) return;

                                    const otherSlots = this.getSlot(otherCls.id, day, period);
                                    otherSlots.forEach(otherLesson => {
                                        if (otherLesson.teacherIds && otherLesson.teacherIds.includes(teacherId)) {
                                            // 同じ科目の場合は重複を許可（TT機能）
                                            if (lesson.subjectId === otherLesson.subjectId) {
                                                return; // 同一科目なので重複OK
                                            }

                                            // 選択授業グループチェック: 両科目が同じ選択グループに属する場合も許可
                                            const group1 = this.getElectiveGroupBySubject(lesson.subjectId);
                                            const group2 = this.getElectiveGroupBySubject(otherLesson.subjectId);
                                            if (group1 && group2 && group1.id === group2.id) {
                                                return; // 同じ選択グループなので重複OK
                                            }

                                            // 重複発見
                                            const teacher = this.getTeacher(teacherId);
                                            const conflict = {
                                                type: 'teacher_conflict',
                                                message: `${teacher?.name || teacherId}が${DAYS[day]}曜${period + 1}限に${cls.name}と${otherCls.name}で重複しています`,
                                                day,
                                                period,
                                                teacherId,
                                                classIds: [cls.id, otherCls.id]
                                            };

                                            // 重複を避けて追加
                                            const exists = conflicts.some(c =>
                                                c.type === conflict.type &&
                                                c.day === conflict.day &&
                                                c.period === conflict.period &&
                                                c.teacherId === conflict.teacherId &&
                                                (c.classIds.includes(cls.id) && c.classIds.includes(otherCls.id))
                                            );
                                            if (!exists) {
                                                conflicts.push(conflict);
                                            }
                                        }
                                    });
                                });
                            });
                        }
                    });
                }
            }
        });

        return conflicts;
    }

    /**
     * TT（チームティーチング）の重複チェック
     * @returns {{ isTT: boolean, type: 'same_class'|'same_teacher'|null, existingTeachers: string[], existingClasses: string[], message: string }}
     */
    checkTTConflict(classId, day, period, teacherId, subjectId) {
        const result = { isTT: false, type: null, existingTeachers: [], existingClasses: [], message: '' };

        // パターン1: 同一クラスに既に別の教員がいるか？
        const slots = this.getSlot(classId, day, period);
        if (slots.length > 0) {
            slots.forEach(slot => {
                if (slot.subjectId === subjectId && !slot.teacherIds.includes(teacherId)) {
                    result.isTT = true;
                    result.type = 'same_class';
                    result.existingTeachers = slot.teacherIds;
                    const teacherNames = slot.teacherIds.map(tid => this.getTeacher(tid)?.name || tid).join('、');
                    result.message = `このコマには既に${teacherNames}が配置されています。TT（チームティーチング）として登録しますか？`;
                }
            });
        }

        // パターン2: 同一教員が同じ時間に別クラスにいるか？
        if (!result.isTT) {
            CLASSES.forEach(cls => {
                if (cls.id === classId) return;
                const otherSlots = this.getSlot(cls.id, day, period);
                otherSlots.forEach(slot => {
                    if (slot.teacherIds.includes(teacherId) && slot.subjectId === subjectId) {
                        result.isTT = true;
                        result.type = 'same_teacher';
                        result.existingClasses.push(cls.name);
                    }
                });
            });
            if (result.existingClasses.length > 0) {
                result.message = `${this.getTeacher(teacherId)?.name || teacherId}は同じ時間に${result.existingClasses.join('、')}でも${this.getSubject(subjectId)?.shortName || subjectId}を担当しています。TT（合同授業）として登録しますか？`;
            }
        }

        return result;
    }

    /**
     * TTグループを取得（同一時間・同一科目の全授業）
     * @returns {Array<{classId: string, subjectId: string, teacherIds: string[]}>}
     */
    getTTGroup(day, period, subjectId) {
        const group = [];
        CLASSES.forEach(cls => {
            const slots = this.getSlot(cls.id, day, period);
            slots.forEach(slot => {
                if (slot.subjectId === subjectId) {
                    group.push({
                        classId: cls.id,
                        subjectId: slot.subjectId,
                        teacherIds: slot.teacherIds
                    });
                }
            });
        });
        return group;
    }

    /**
     * TTグループの一括移動
     */
    moveTTGroup(day, period, subjectId, toDay, toPeriod) {
        if (day === toDay && period === toPeriod) return { success: true };

        const group = this.getTTGroup(day, period, subjectId);
        if (group.length === 0) return { success: false, message: '移動対象が見つかりません' };

        // 一括移動実行
        group.forEach(item => {
            // 移動先へ追加
            this.setSlot(item.classId, toDay, toPeriod, item.subjectId, item.teacherIds, true);

            // 移動元から削除
            const key = `${day}-${period}`;
            const currentSlots = this.timetable[item.classId][key];
            if (Array.isArray(currentSlots)) {
                this.timetable[item.classId][key] = currentSlots.filter(s => s.subjectId !== item.subjectId);
            }
        });

        this.saveToStorage();
        return { success: true, count: group.length };
    }

    /**
     * 選択授業グループを取得（同一時間帯の同じ選択グループに属する全授業）
     */
    getElectiveGroupSlots(day, period) {
        const result = [];
        const processedGroups = new Set();

        CLASSES.forEach(cls => {
            const slots = this.getSlot(cls.id, day, period);
            slots.forEach(slot => {
                const group = this.getElectiveGroupBySubject(slot.subjectId);
                if (group && !processedGroups.has(group.id)) {
                    // このグループの全スロットを収集
                    CLASSES.forEach(c => {
                        const s = this.getSlot(c.id, day, period);
                        s.forEach(sl => {
                            const g = this.getElectiveGroupBySubject(sl.subjectId);
                            if (g && g.id === group.id) {
                                result.push({
                                    classId: c.id,
                                    subjectId: sl.subjectId,
                                    teacherIds: sl.teacherIds,
                                    groupId: group.id
                                });
                            }
                        });
                    });
                    processedGroups.add(group.id);
                }
            });
        });
        return result;
    }

    /**
     * 選択授業グループの一括移動
     */
    moveElectiveGroup(day, period, toDay, toPeriod) {
        if (day === toDay && period === toPeriod) return { success: true };

        const groupSlots = this.getElectiveGroupSlots(day, period);
        if (groupSlots.length === 0) return { success: false, message: '選択授業が見つかりません' };

        // 一括移動実行
        groupSlots.forEach(item => {
            // 移動先へ追加
            this.setSlot(item.classId, toDay, toPeriod, item.subjectId, item.teacherIds, true);

            // 移動元から削除
            const key = `${day}-${period}`;
            const currentSlots = this.timetable[item.classId][key];
            if (Array.isArray(currentSlots)) {
                this.timetable[item.classId][key] = currentSlots.filter(s => s.subjectId !== item.subjectId);
            }
        });

        this.saveToStorage();
        return { success: true, count: groupSlots.length };
    }

    /**
     * 選択授業グループの一括削除
     */
    clearElectiveGroupSlot(day, period) {
        const groupSlots = this.getElectiveGroupSlots(day, period);
        if (groupSlots.length === 0) return { success: false, message: '選択授業が見つかりません' };

        // 一括削除実行
        groupSlots.forEach(item => {
            const key = `${day}-${period}`;
            const currentSlots = this.timetable[item.classId][key];
            if (Array.isArray(currentSlots)) {
                this.timetable[item.classId][key] = currentSlots.filter(s => s.subjectId !== item.subjectId);
            }
        });

        this.saveToStorage();
        return { success: true, count: groupSlots.length };
    }

    /**
     * 指定スロットに選択授業があるかどうかを判定
     * @returns {{ isElective: boolean, groupId: string | null, groupName: string | null }}
     */
    isElectiveSlot(classId, day, period) {
        const slots = this.getSlot(classId, day, period);
        for (const slot of slots) {
            const group = this.getElectiveGroupBySubject(slot.subjectId);
            if (group) {
                return { isElective: true, groupId: group.id, groupName: group.name };
            }
        }
        return { isElective: false, groupId: null, groupName: null };
    }

    /**
     * 指定スロットがTTかどうかを判定
     * @returns {{ isTT: boolean, type: 'same_class'|'same_teacher'|'both'|null }}
     */
    isTTSlot(classId, day, period) {
        const slots = this.getSlot(classId, day, period);
        if (slots.length === 0) return { isTT: false, type: null };

        let sameClass = false;
        let sameTeacher = false;

        slots.forEach(slot => {
            // 同一クラス内に複数教員
            if (slot.teacherIds && slot.teacherIds.length > 1) {
                sameClass = true;
            }

            // 同一教員が他クラスにもいるか
            slot.teacherIds?.forEach(tid => {
                CLASSES.forEach(cls => {
                    if (cls.id === classId) return;
                    const otherSlots = this.getSlot(cls.id, day, period);
                    otherSlots.forEach(os => {
                        if (os.teacherIds.includes(tid) && os.subjectId === slot.subjectId) {
                            sameTeacher = true;
                        }
                    });
                });
            });
        });

        if (sameClass && sameTeacher) return { isTT: true, type: 'both' };
        if (sameClass) return { isTT: true, type: 'same_class' };
        if (sameTeacher) return { isTT: true, type: 'same_teacher' };
        return { isTT: false, type: null };
    }

    /**
     * 配置済み時間数をカウント
     * @param {string} teacherId - 教員ID
     * @param {string} subjectId - 科目ID
     * @param {string} classId - クラスID
     * @returns {number} 配置済み時間数
     */
    /**
     * 配置済み時間数をカウント
     * @param {string} teacherId - 教員ID
     * @param {string} subjectId - 科目ID
     * @param {string} classId - クラスID
     * @returns {number} 配置済み時間数
     */
    countPlacedHours(teacherId, subjectId, classId) {
        let count = 0;

        for (let day = 0; day < DAYS.length; day++) {
            for (let period = 0; period < PERIODS; period++) {
                const slots = this.getSlot(classId, day, period);
                // getSlotは常に配列を返すようになっている
                slots.forEach(slot => {
                    if (slot.subjectId === subjectId &&
                        slot.teacherIds &&
                        slot.teacherIds.includes(teacherId)) {
                        count++;
                    }
                });
            }
        }

        return count;
    }

    // ══════════════════════════════════════════════════════════
    // ■ セクション4: CSV入出力
    // ══════════════════════════════════════════════════════════

    /**
     * CSVをパース
     */
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }

        return data;
    }

    /**
     * 教員CSVを読み込み
     */
    importTeachersCSV(csvText) {
        const data = this.parseCSV(csvText);
        let count = 0;

        data.forEach(row => {
            if (row.id && row.name) {
                const result = this.addTeacher(row.id, row.name);
                if (result.success) {
                    count++;

                    // 教科情報がある場合は設定
                    if (row.category || row['教科']) {
                        const categoryName = row.category || row['教科'];
                        const categoryNames = categoryName.split('・').map(n => n.trim());
                        const categoryIds = [];

                        categoryNames.forEach(catName => {
                            // 教科名から教科IDを検索
                            const category = this.categories.find(c => c.name === catName);
                            if (category) {
                                categoryIds.push(category.id);
                            }
                        });

                        // 教員に教科IDを設定
                        if (categoryIds.length > 0) {
                            const teacher = this.getTeacher(row.id);
                            if (teacher) {
                                teacher.categoryIds = categoryIds;
                            }
                        }
                    }
                }
            }
        });

        this.saveToStorage();
        return { success: true, count };
    }

    /**
     * 教科CSVを読み込み
     */
    importSubjectsCSV(csvText) {
        const data = this.parseCSV(csvText);
        let count = 0;

        data.forEach(row => {
            if (row.id && row.name) {
                const result = this.addSubject(row.id, row.name, row.shortName);
                if (result.success) count++;
            }
        });

        return { success: true, count };
    }

    /**
     * 担当授業CSVを読み込み
     */
    importAssignmentsCSV(csvText) {
        const data = this.parseCSV(csvText);
        let count = 0;

        data.forEach(row => {
            if (row.teacherId && row.subjectId && row.classId && row.weeklyHours) {
                const result = this.addAssignment(
                    row.teacherId,
                    row.subjectId,
                    row.classId,
                    row.weeklyHours
                );
                if (result.success) count++;
            }
        });

        return { success: true, count };
    }

    /**
     * 統合CSVを読み込み（マスターデータ一括）
     * 形式: type,id,name,shortName,categoryId,teacherId,subjectId,classId,weeklyHours
     */
    importUnifiedCSV(csvText) {
        const data = this.parseCSV(csvText);
        let teacherCount = 0;
        let categoryCount = 0;
        let subjectCount = 0;
        let assignmentCount = 0;

        // 既存データをクリア
        this.teachers = [];
        this.categories = [];
        this.subjects = [];
        this.assignments = [];

        data.forEach(row => {
            switch (row.type) {
                case 'teacher':
                    if (row.id && row.name) {
                        const result = this.addTeacher(row.id, row.name);
                        if (result.success) teacherCount++;
                    }
                    break;
                case 'category':
                    if (row.id && row.name) {
                        const result = this.addCategory(row.id, row.name);
                        if (result.success) categoryCount++;
                    }
                    break;
                case 'subject':
                    if (row.id && row.categoryId && row.name) {
                        const result = this.addSubject(row.id, row.categoryId, row.name, row.shortName);
                        if (result.success) subjectCount++;
                    }
                    break;
                case 'assignment':
                    if (row.teacherId && row.subjectId && row.classId && row.weeklyHours) {
                        const result = this.addAssignment(
                            row.teacherId,
                            row.subjectId,
                            row.classId,
                            row.weeklyHours
                        );
                        if (result.success) assignmentCount++;
                    }
                    break;
            }
        });

        return {
            success: true,
            teacherCount,
            categoryCount,
            subjectCount,
            assignmentCount
        };
    }

    /**
     * 統合CSVをエクスポート
     */
    exportUnifiedCSV() {
        const lines = [];

        // ヘッダー
        lines.push('type,id,name,shortName,categoryId,teacherId,subjectId,classId,weeklyHours');

        // 教員データ
        this.teachers.forEach(t => {
            lines.push(`teacher,${t.id},${t.name},,,,,,,`);
        });

        // 教科カテゴリデータ
        this.categories.forEach(c => {
            lines.push(`category,${c.id},${c.name},,,,,,,`);
        });

        // 科目データ
        this.subjects.forEach(s => {
            lines.push(`subject,${s.id},${s.name},${s.shortName},${s.categoryId},,,,`);
        });

        // 担当授業データ
        this.assignments.forEach(a => {
            lines.push(`assignment,,,,,,${a.teacherId},${a.subjectId},${a.classId},${a.weeklyHours}`);
        });

        return lines.join('\n');
    }

    /**
     * CSVファイルをダウンロード
     */
    downloadCSV(content, filename) {
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * 特別教室を追加
     */
    addSpecialClassroom(id, name, shortName) {
        this.specialClassrooms.push({ id, name, shortName });
        this.saveToStorage();
    }

    /**
     * 特別教室を更新
     */
    updateSpecialClassroom(id, name, shortName) {
        const room = this.specialClassrooms.find(r => r.id === id);
        if (room) {
            room.name = name;
            room.shortName = shortName;
            this.saveToStorage();
        }
    }

    /**
     * 特別教室を削除
     */
    deleteSpecialClassroom(id) {
        this.specialClassrooms = this.specialClassrooms.filter(r => r.id !== id);
        this.saveToStorage();
    }

    /**
     * 特別教室を取得
     */
    getSpecialClassroom(id) {
        return this.specialClassrooms.find(r => r.id === id);
    }
}

// グローバルインスタンス
const dataStore = new DataStore();

