/**
 * TTLogic - TT授業・合同授業の判定ロジック
 */
class TTLogic {
    constructor(store) {
        this.store = store;
    }

    /**
     * 指定スロットがTTかどうかを判定
     * @returns {{ isTT: boolean, type: 'same_class'|'same_teacher'|'both'|null, slots: Array, teacherIds: Set, classIds: Set }}
     */
    isTTSlot(classId, day, period) {
        const slots = this.store.getSlot(classId, day, period);
        if (slots.length === 0) return { isTT: false, type: null, slots: [], teacherIds: new Set(), classIds: new Set() };

        let sameClass = false;
        let sameTeacher = false;
        const allSlots = [...slots];
        const allTeacherIds = new Set();
        const allClassIds = new Set([classId]);

        slots.forEach(slot => {
            // 教員IDを収集
            slot.teacherIds?.forEach(tid => allTeacherIds.add(tid));

            // 同一クラス内に複数教員
            if (slot.teacherIds && slot.teacherIds.length > 1) {
                sameClass = true;
            }

            // 同一教員が他クラスにもいるか
            slot.teacherIds?.forEach(tid => {
                CLASSES.forEach(cls => {
                    if (cls.id === classId) return;
                    const otherSlots = this.store.getSlot(cls.id, day, period);
                    otherSlots.forEach(os => {
                        if (os.teacherIds.includes(tid) && os.subjectId === slot.subjectId) {
                            sameTeacher = true;
                            allClassIds.add(cls.id);
                            // 他クラスのスロットも収集
                            if (!allSlots.some(s => s.classId === cls.id && s.subjectId === os.subjectId)) {
                                allSlots.push({ ...os, classId: cls.id });
                            }
                            os.teacherIds?.forEach(t => allTeacherIds.add(t));
                        }
                    });
                });
            });
        });

        let type = null;
        if (sameClass && sameTeacher) type = 'both';
        else if (sameClass) type = 'same_class';
        else if (sameTeacher) type = 'same_teacher';

        return {
            isTT: sameClass || sameTeacher,
            type,
            slots: allSlots,
            teacherIds: allTeacherIds,
            classIds: allClassIds
        };
    }

    /**
     * 教員の時間割から合同授業を判定
     */
    isJointLesson(teacherId, day, period, slots) {
        return slots.length > 1;
    }

    /**
     * スロットがTT授業かどうか（複数教員）
     */
    hasMultipleTeachers(slot) {
        return slot.teacherIds && slot.teacherIds.length > 1;
    }

    /**
     * 関連するすべてのスロットを取得（合同授業用）
     */
    getLinkedSlots(classId, day, period) {
        const result = this.isTTSlot(classId, day, period);
        return result.slots;
    }
}

// グローバルに公開
window.TTLogic = TTLogic;
