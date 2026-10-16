/**
 * SlotManager - 時間割スロットの操作
 */
class SlotManager {
    constructor(store) {
        this.store = store;
    }

    /**
     * 時間割スロットを取得（常に配列を返す）
     */
    getSlot(classId, day, period) {
        const key = `${day}-${period}`;
        const slot = this.store.timetable[classId]?.[key];
        if (!slot) return [];
        return Array.isArray(slot) ? slot : [slot];
    }

    /**
     * 時間割にスロットを設定
     * @param {string} classId - クラスID
     * @param {number} day - 曜日（0-4）
     * @param {number} period - 時限（0-6）
     * @param {string} subjectId - 科目ID
     * @param {string[]} teacherIds - 教員ID配列（TT対応）
     * @param {string|string[]|null} specialClassroomIds - 特別教室ID(s)
     * @param {boolean} append - 追加モードかどうか
     */
    setSlot(classId, day, period, subjectId, teacherIds, specialClassroomIds = null, append = false) {
        const key = `${day}-${period}`;

        if (!this.store.timetable[classId]) {
            this.store.timetable[classId] = {};
        }

        if (!Array.isArray(this.store.timetable[classId][key])) {
            this.store.timetable[classId][key] = [];
        }

        if (subjectId && teacherIds && teacherIds.length > 0) {
            // specialClassroomIds を配列に正規化
            let roomIds = null;
            if (specialClassroomIds) {
                if (Array.isArray(specialClassroomIds)) {
                    roomIds = specialClassroomIds.filter(id => id);
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
                this.store.timetable[classId][key].push(newLesson);
            } else {
                this.store.timetable[classId][key] = [newLesson];
            }
        } else if (!append) {
            this.store.timetable[classId][key] = [];
        }

        this.store.saveToStorage();
        return { success: true };
    }

    /**
     * 時間割スロットをクリア
     */
    clearSlot(classId, day, period) {
        const key = `${day}-${period}`;
        if (this.store.timetable[classId]) {
            this.store.timetable[classId][key] = [];
            this.store.saveToStorage();
        }
    }

    /**
     * スロットを移動
     */
    moveSlot(fromClassId, fromDay, fromPeriod, toClassId, toDay, toPeriod) {
        const slots = this.getSlot(fromClassId, fromDay, fromPeriod);
        if (slots.length === 0) return { success: false };

        const slot = slots[0];
        this.clearSlot(fromClassId, fromDay, fromPeriod);
        this.setSlot(toClassId, toDay, toPeriod, slot.subjectId, slot.teacherIds, slot.specialClassroomIds);
        return { success: true };
    }

    /**
     * 教員の時間割を取得
     */
    getTeacherTimetable(teacherId) {
        const result = {};
        CLASSES.forEach(cls => {
            DAYS.forEach((day, dayIndex) => {
                for (let period = 0; period < PERIODS; period++) {
                    const slots = this.getSlot(cls.id, dayIndex, period);
                    slots.forEach(slot => {
                        if (slot.teacherIds && slot.teacherIds.includes(teacherId)) {
                            const key = `${dayIndex}-${period}`;
                            if (!result[key]) result[key] = [];
                            result[key].push({ ...slot, classId: cls.id });
                        }
                    });
                }
            });
        });
        return result;
    }
}

// グローバルに公開
window.SlotManager = SlotManager;
