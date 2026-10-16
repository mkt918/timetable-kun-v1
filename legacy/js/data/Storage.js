/**
 * Storage - データの永続化処理
 */
class Storage {
    constructor(store) {
        this.store = store;
    }

    /**
     * ローカルストレージにデータを保存
     */
    saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(this.store.teachers));
            localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(this.store.categories));
            localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(this.store.subjects));
            localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(this.store.assignments));
            localStorage.setItem('timetable_special_classrooms', JSON.stringify(this.store.specialClassrooms));
            localStorage.setItem('timetable_meetings', JSON.stringify(this.store.meetings));
            localStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(this.store.timetable));
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.store.settings));
            localStorage.setItem('timetable_linked_groups', JSON.stringify(this.store.linkedGroups));
            return true;
        } catch (e) {
            console.error('ストレージへの保存エラー:', e);
            return false;
        }
    }

    /**
     * ローカルストレージからデータを読み込む
     */
    loadFromStorage() {
        try {
            // 設定の読み込みと適用
            const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (storedSettings) {
                this.store.settings = { ...this.store.settings, ...JSON.parse(storedSettings) };
            }
            if (!this.store.settings.unavailableSlots) {
                this.store.settings.unavailableSlots = {};
            }

            this.store.applySettings();

            const teachers = localStorage.getItem(STORAGE_KEYS.TEACHERS);
            const categories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
            const subjects = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
            const assignments = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
            const timetable = localStorage.getItem(STORAGE_KEYS.TIMETABLE);

            if (teachers) this.store.teachers = JSON.parse(teachers);
            if (categories) this.store.categories = JSON.parse(categories);
            if (subjects) this.store.subjects = JSON.parse(subjects);
            if (assignments) this.store.assignments = JSON.parse(assignments);

            // 教員データのマイグレーション
            this.store.teachers.forEach(teacher => {
                if (!teacher.categories) {
                    teacher.categories = [];
                }
            });

            const specialClassrooms = localStorage.getItem('timetable_special_classrooms');
            if (specialClassrooms) {
                try {
                    this.store.specialClassrooms = JSON.parse(specialClassrooms) || [];
                } catch (e) {
                    console.error('Failed to parse specialClassrooms', e);
                    this.store.specialClassrooms = [];
                }
            }

            const meetings = localStorage.getItem('timetable_meetings');
            if (meetings) {
                try {
                    this.store.meetings = JSON.parse(meetings) || [];
                } catch (e) {
                    console.error('Failed to parse meetings', e);
                    this.store.meetings = [];
                }
            }

            if (localStorage.getItem('timetable_linked_groups')) {
                this.store.linkedGroups = JSON.parse(localStorage.getItem('timetable_linked_groups'));
            }

            if (timetable) {
                this.store.timetable = JSON.parse(timetable);
                this.store.migrateTimetableData();
            }

            if (this.store.teachers.length === 0 && this.store.subjects.length === 0) {
                this.store.initSampleData();
            }
        } catch (e) {
            console.error('ストレージからの読み込みエラー:', e);
        }
    }

    /**
     * 全データをJSONとしてエクスポート
     */
    exportAllData() {
        return {
            teachers: this.store.teachers,
            categories: this.store.categories,
            subjects: this.store.subjects,
            assignments: this.store.assignments,
            specialClassrooms: this.store.specialClassrooms,
            meetings: this.store.meetings,
            timetable: this.store.timetable,
            settings: this.store.settings,
            linkedGroups: this.store.linkedGroups
        };
    }

    /**
     * JSONから全データをインポート
     */
    importAllData(data) {
        if (data.teachers) this.store.teachers = data.teachers;
        if (data.categories) this.store.categories = data.categories;
        if (data.subjects) this.store.subjects = data.subjects;
        if (data.assignments) this.store.assignments = data.assignments;
        if (data.specialClassrooms) this.store.specialClassrooms = data.specialClassrooms;
        if (data.meetings) this.store.meetings = data.meetings;
        if (data.timetable) this.store.timetable = data.timetable;
        if (data.settings) this.store.settings = data.settings;
        if (data.linkedGroups) this.store.linkedGroups = data.linkedGroups;
        this.saveToStorage();
    }
}

// グローバルに公開
window.Storage = Storage;
