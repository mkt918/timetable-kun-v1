/**
 * 時間割バリデーションルール定義
 * 各ルールは以下の形式で定義:
 * {
 *   id: string,           // ルールの一意識別子
 *   name: string,         // ルール名（表示用）
 *   level: string,        // 'error' | 'warning' | 'info'
 *   check: function,      // チェック関数 (store) => Issue[]
 *   enabled: boolean      // ルールの有効/無効
 * }
 */

const VALIDATION_RULES = [
    // ========== エラー（重大な問題） ==========
    {
        id: 'duplicate-teacher',
        name: '教員の重複',
        level: 'error',
        enabled: true,
        check: (store) => {
            const issues = [];

            // 全教員の時間割をチェック
            store.teachers.forEach(teacher => {
                const timetable = store.getTeacherTimetable(teacher.id);

                // 各時限をチェック
                for (let day = 0; day < DAYS.length; day++) {
                    for (let period = 0; period < PERIODS; period++) {
                        const key = `${day}-${period}`;
                        const slots = timetable[key] || [];

                        if (slots.length > 1) {
                            // 同じ時間に複数の授業
                            const dayName = DAYS[day];
                            const periodNum = period + 1;
                            const classes = slots.map(s => s.className).join(', ');

                            issues.push({
                                message: `${teacher.name}が${dayName}曜${periodNum}限に重複: ${classes}`,
                                location: { teacherId: teacher.id, day, period }
                            });
                        }
                    }
                }
            });

            return issues;
        }
    },

    {
        id: 'duplicate-class',
        name: 'クラスの重複',
        level: 'error',
        enabled: true,
        check: (store) => {
            const issues = [];

            CLASSES.forEach(cls => {
                for (let day = 0; day < DAYS.length; day++) {
                    for (let period = 0; period < PERIODS; period++) {
                        const slots = store.getSlot(cls.id, day, period);

                        if (slots.length > 1) {
                            // 同じ時間に複数の授業
                            const dayName = DAYS[day];
                            const periodNum = period + 1;
                            const subjects = slots.map(s => {
                                const subj = store.getSubject(s.subjectId);
                                return subj ? (subj.shortName || subj.name) : '不明';
                            }).join(', ');

                            issues.push({
                                message: `${cls.name}が${dayName}曜${periodNum}限に重複: ${subjects}`,
                                location: { classId: cls.id, day, period }
                            });
                        }
                    }
                }
            });

            return issues;
        }
    },

    {
        id: 'duplicate-room',
        name: '特別教室の重複',
        level: 'error',
        enabled: true,
        check: (store) => {
            const issues = [];
            const roomUsage = {}; // { 'day-period': { roomId: [classIds] } }

            // 全クラスの時間割から特別教室の使用状況を収集
            CLASSES.forEach(cls => {
                for (let day = 0; day < DAYS.length; day++) {
                    for (let period = 0; period < PERIODS; period++) {
                        const slots = store.getSlot(cls.id, day, period);

                        slots.forEach(slot => {
                            if (slot.specialClassroomIds && slot.specialClassroomIds.length > 0) {
                                const key = `${day}-${period}`;
                                if (!roomUsage[key]) roomUsage[key] = {};

                                slot.specialClassroomIds.forEach(roomId => {
                                    if (!roomUsage[key][roomId]) roomUsage[key][roomId] = [];
                                    roomUsage[key][roomId].push(cls.id);
                                });
                            }
                        });
                    }
                }
            });

            // 重複をチェック
            Object.keys(roomUsage).forEach(key => {
                const [day, period] = key.split('-').map(Number);
                const dayName = DAYS[day];
                const periodNum = period + 1;

                Object.keys(roomUsage[key]).forEach(roomId => {
                    const classIds = roomUsage[key][roomId];
                    if (classIds.length > 1) {
                        const room = store.getSpecialClassroom(roomId);
                        const roomName = room ? room.name : roomId;
                        const classes = classIds.map(cid => {
                            const cls = CLASSES.find(c => c.id === cid);
                            return cls ? cls.name : cid;
                        }).join(', ');

                        issues.push({
                            message: `${roomName}が${dayName}曜${periodNum}限に重複: ${classes}`,
                            location: { roomId, day, period }
                        });
                    }
                });
            });

            return issues;
        }
    },

    {
        id: 'unassigned-lessons',
        name: '授業コマ数の過不足',
        level: 'error',
        enabled: true,
        check: (store) => {
            const issues = [];

            store.teachers.forEach(teacher => {
                const assignments = store.getTeacherAssignments(teacher.id);
                const timetable = store.getTeacherTimetable(teacher.id);

                // 配置済みの授業をカウント
                const placedCount = {};
                Object.values(timetable).forEach(slots => {
                    slots.forEach(slot => {
                        const key = `${slot.subjectId}-${slot.classId}`;
                        placedCount[key] = (placedCount[key] || 0) + 1;
                    });
                });

                // 未配置・配置しすぎをチェック
                assignments.forEach(assignment => {
                    const key = `${assignment.subjectId}-${assignment.classId}`;
                    const placed = placedCount[key] || 0;
                    const required = assignment.weeklyHours || 0;

                    if (placed < required) {
                        // 未配置（足りない）
                        const subject = store.getSubject(assignment.subjectId);
                        const cls = CLASSES.find(c => c.id === assignment.classId);
                        const subjectName = subject ? (subject.shortName || subject.name) : '不明';
                        const className = cls ? cls.name : assignment.classId;

                        issues.push({
                            message: `${teacher.name}: ${subjectName}(${className}) が未配置 (${placed}/${required}コマ)`,
                            location: { teacherId: teacher.id, subjectId: assignment.subjectId, classId: assignment.classId }
                        });
                    } else if (placed > required) {
                        // 配置しすぎ
                        const subject = store.getSubject(assignment.subjectId);
                        const cls = CLASSES.find(c => c.id === assignment.classId);
                        const subjectName = subject ? (subject.shortName || subject.name) : '不明';
                        const className = cls ? cls.name : assignment.classId;
                        const over = placed - required;

                        issues.push({
                            message: `${teacher.name}: ${subjectName}(${className}) が${over}コマ多い (${placed}/${required}コマ)`,
                            location: { teacherId: teacher.id, subjectId: assignment.subjectId, classId: assignment.classId }
                        });
                    }
                });
            });

            return issues;
        }
    },

    // ========== 警告（注意が必要） ==========
    {
        id: 'consecutive-periods',
        name: '連続コマ数',
        level: 'warning',
        enabled: true,
        check: (store, rule) => {
            const threshold = store.settings.validationThresholds?.teacherConsecutive || 4;
            const issues = [];

            store.teachers.forEach(teacher => {
                const timetable = store.getTeacherTimetable(teacher.id);

                for (let day = 0; day < DAYS.length; day++) {
                    let consecutive = 0;
                    let startPeriod = -1;

                    for (let period = 0; period < PERIODS; period++) {
                        const key = `${day}-${period}`;
                        const slots = timetable[key] || [];

                        if (slots.length > 0) {
                            if (consecutive === 0) startPeriod = period;
                            consecutive++;
                        } else {
                            if (consecutive >= threshold) {
                                issues.push({
                                    message: `${teacher.name}: ${DAYS[day]}曜に${consecutive}コマ連続 (${startPeriod + 1}～${period}限)`,
                                    location: { teacherId: teacher.id, day, period: startPeriod }
                                });
                            }
                            consecutive = 0;
                        }
                    }

                    // 最後までチェック
                    if (consecutive >= threshold) {
                        issues.push({
                            message: `${teacher.name}: ${DAYS[day]}曜に${consecutive}コマ連続 (${startPeriod + 1}～${PERIODS}限)`,
                            location: { teacherId: teacher.id, day, period: startPeriod }
                        });
                    }
                }
            });

            return issues;
        }
    },

    {
        id: 'meeting-conflict',
        name: '会議時間との重複',
        level: 'warning',
        enabled: true,
        check: (store) => {
            const issues = [];

            // 会議データから教員ごとの会議スケジュールを構築
            const teacherMeetings = {};
            (store.meetings || []).forEach(meeting => {
                meeting.teacherIds.forEach(teacherId => {
                    if (!teacherMeetings[teacherId]) teacherMeetings[teacherId] = [];
                    meeting.schedule.forEach(s => {
                        teacherMeetings[teacherId].push({
                            day: s.dayIndex,
                            period: s.period - 1, // periodは1始まりなので0始まりに変換
                            meetingName: meeting.name
                        });
                    });
                });
            });

            store.teachers.forEach(teacher => {
                const timetable = store.getTeacherTimetable(teacher.id);
                const meetings = teacherMeetings[teacher.id] || [];

                meetings.forEach(slot => {
                    const key = `${slot.day}-${slot.period}`;
                    const lessons = timetable[key] || [];

                    if (lessons.length > 0) {
                        const classes = lessons.map(l => l.className).join(', ');

                        issues.push({
                            message: `${teacher.name}: ${DAYS[slot.day]}曜${slot.period + 1}限は会議「${slot.meetingName}」ですが授業あり (${classes})`,
                            location: { teacherId: teacher.id, day: slot.day, period: slot.period }
                        });
                    }
                });
            });

            return issues;
        }
    },

    {
        id: 'unavailable-conflict',
        name: '勤務不可時間との重複',
        level: 'warning',
        enabled: true,
        check: (store) => {
            const issues = [];

            store.teachers.forEach(teacher => {
                const timetable = store.getTeacherTimetable(teacher.id);
                const unavailable = store.settings.unavailableSlots[teacher.id] || [];

                unavailable.forEach(slotKey => {
                    // slotKeyは文字列形式 "day-period" (例: "0-1")
                    if (typeof slotKey === 'string') {
                        const [day, period] = slotKey.split('-').map(Number);
                        const lessons = timetable[slotKey] || [];

                        if (lessons.length > 0) {
                            const classes = lessons.map(l => l.className).join(', ');

                            issues.push({
                                message: `${teacher.name}: ${DAYS[day]}曜${period + 1}限は勤務不可ですが授業あり (${classes})`,
                                location: { teacherId: teacher.id, day, period }
                            });
                        }
                    }
                });
            });

            return issues;
        }
    },

    {
        id: 'consecutive-lesson-limit',
        name: 'クラスの連続授業時間数制限',
        level: 'warning',
        enabled: true,
        threshold: 4, // クラスが4コマ以上連続で授業を受けると警告
        check: (store, rule) => {
            const issues = [];

            CLASSES.forEach(cls => {
                for (let day = 0; day < DAYS.length; day++) {
                    let consecutive = 0;
                    let startPeriod = -1;

                    for (let period = 0; period < PERIODS; period++) {
                        const slots = store.getSlot(cls.id, day, period);

                        if (slots.length > 0) {
                            if (consecutive === 0) startPeriod = period;
                            consecutive++;
                        } else {
                            if (consecutive >= rule.threshold) {
                                issues.push({
                                    message: `${cls.name}: ${DAYS[day]}曜に${consecutive}コマ連続授業 (${startPeriod + 1}～${period}限)`,
                                    location: { classId: cls.id, day, period: startPeriod }
                                });
                            }
                            consecutive = 0;
                        }
                    }

                    // 最後までチェック
                    if (consecutive >= rule.threshold) {
                        issues.push({
                            message: `${cls.name}: ${DAYS[day]}曜に${consecutive}コマ連続授業 (${startPeriod + 1}～${PERIODS}限)`,
                            location: { classId: cls.id, day, period: startPeriod }
                        });
                    }
                }
            });

            return issues;
        }
    },

    {
        id: 'consecutive-same-subject',
        name: '連続同一科目の警告',
        level: 'warning',
        enabled: true,
        threshold: 2, // 同じ科目が2コマ以上連続で警告
        check: (store, rule) => {
            const issues = [];

            CLASSES.forEach(cls => {
                for (let day = 0; day < DAYS.length; day++) {
                    let prevSubjectId = null;
                    let consecutive = 0;
                    let startPeriod = -1;

                    for (let period = 0; period < PERIODS; period++) {
                        const slots = store.getSlot(cls.id, day, period);

                        if (slots.length > 0) {
                            const currentSubjectId = slots[0].subjectId;

                            if (currentSubjectId === prevSubjectId) {
                                consecutive++;
                            } else {
                                // 科目が変わった
                                if (consecutive >= rule.threshold && prevSubjectId) {
                                    const subject = store.getSubject(prevSubjectId);
                                    const subjectName = subject ? (subject.shortName || subject.name) : '不明';

                                    issues.push({
                                        message: `${cls.name}: ${DAYS[day]}曜に${subjectName}が${consecutive}コマ連続 (${startPeriod + 1}～${period}限)`,
                                        location: { classId: cls.id, day, period: startPeriod, subjectId: prevSubjectId }
                                    });
                                }

                                prevSubjectId = currentSubjectId;
                                consecutive = 1;
                                startPeriod = period;
                            }
                        } else {
                            // 空きコマ
                            if (consecutive >= rule.threshold && prevSubjectId) {
                                const subject = store.getSubject(prevSubjectId);
                                const subjectName = subject ? (subject.shortName || subject.name) : '不明';

                                issues.push({
                                    message: `${cls.name}: ${DAYS[day]}曜に${subjectName}が${consecutive}コマ連続 (${startPeriod + 1}～${period}限)`,
                                    location: { classId: cls.id, day, period: startPeriod, subjectId: prevSubjectId }
                                });
                            }

                            prevSubjectId = null;
                            consecutive = 0;
                        }
                    }

                    // 最後までチェック
                    if (consecutive >= rule.threshold && prevSubjectId) {
                        const subject = store.getSubject(prevSubjectId);
                        const subjectName = subject ? (subject.shortName || subject.name) : '不明';

                        issues.push({
                            message: `${cls.name}: ${DAYS[day]}曜に${subjectName}が${consecutive}コマ連続 (${startPeriod + 1}～${PERIODS}限)`,
                            location: { classId: cls.id, day, period: startPeriod, subjectId: prevSubjectId }
                        });
                    }
                }
            });

            return issues;
        }
    },

    {
        id: 'many-free-periods',
        name: '空きコマの多さ',
        level: 'info',
        enabled: true,
        check: (store, rule) => {
            const threshold = store.settings.validationThresholds?.freePeriods || 3;
            const issues = [];

            store.teachers.forEach(teacher => {
                const timetable = store.getTeacherTimetable(teacher.id);

                for (let day = 0; day < DAYS.length; day++) {
                    let freeCount = 0;
                    let hasLesson = false;

                    // その日に授業があるかチェック
                    for (let period = 0; period < PERIODS; period++) {
                        const key = `${day}-${period}`;
                        const slots = timetable[key] || [];
                        if (slots.length > 0) {
                            hasLesson = true;
                        } else {
                            freeCount++;
                        }
                    }

                    // 授業がある日で空きコマが多い場合
                    if (hasLesson && freeCount >= threshold) {
                        issues.push({
                            message: `${teacher.name}: ${DAYS[day]}曜に空きコマが${freeCount}コマ`,
                            location: { teacherId: teacher.id, day }
                        });
                    }
                }
            });

            return issues;
        }
    },

    // ========== 情報（参考） ==========
    {
        id: 'placement-rate',
        name: '授業配置率',
        level: 'info',
        enabled: true,
        check: (store) => {
            let totalRequired = 0;
            let totalPlaced = 0;

            store.teachers.forEach(teacher => {
                const assignments = store.getTeacherAssignments(teacher.id);
                const timetable = store.getTeacherTimetable(teacher.id);

                // 必要コマ数
                assignments.forEach(assignment => {
                    totalRequired += assignment.weeklyHours || 0;
                });

                // 配置済みコマ数
                Object.values(timetable).forEach(slots => {
                    totalPlaced += slots.length;
                });
            });

            const rate = totalRequired > 0 ? Math.round((totalPlaced / totalRequired) * 100) : 0;

            return [{
                message: `全体の授業配置率: ${rate}% (${totalPlaced}/${totalRequired}コマ)`,
                location: null
            }];
        }
    }
];
