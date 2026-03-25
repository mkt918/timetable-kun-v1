/**
 * AutoScheduler - 自動時間割配置アルゴリズム
 *
 * classCurriculum（クラス別科目・週時間数）と
 * assignments（教員担当設定）を入力として、
 * 制約条件を満たしながら自動でコマを配置する。
 *
 * 制約条件:
 *   - 同一クラスは同一時間帯に1授業のみ
 *   - 同一教員は同一時間帯に1授業のみ
 *   - 教員の勤務不可時間には配置しない
 *   - 教員の会議時間には配置しない
 */
class AutoScheduler {
    constructor(store) {
        this.store = store;
    }

    /**
     * メイン実行
     * @param {object} options
     *   targetClasses: string[]   - 対象クラスIDリスト
     *   clearFirst: boolean       - true=既存授業を全消去してから配置
     *   distribute: boolean       - true=同科目を週内で分散配置
     *   avoidConsecutive: boolean - true=同教員の同科目が連続にならないよう
     *   dryRun: boolean           - true=書き込みせず結果だけ返す（プレビュー用）
     * @returns {{ placed, unplaced, warnings }}
     */
    run(options = {}) {
        const {
            targetClasses = CLASSES.map(c => c.id),
            clearFirst = false,
            distribute = true,
            avoidConsecutive = true,
            dryRun = false
        } = options;

        const result = {
            placed: [],
            unplaced: [],
            warnings: []
        };

        // Undo用スナップショット（dryRun以外のとき）
        if (!dryRun) {
            this.store.snapshot();
        }

        // 既存スロットをクリア（clearFirst=true のとき）
        if (clearFirst && !dryRun) {
            for (const classId of targetClasses) {
                for (let day = 0; day < DAYS.length; day++) {
                    for (let period = 0; period < PERIODS; period++) {
                        const existing = this.store.getSlot(classId, day, period);
                        if (existing.length > 0) {
                            this.store.clearSlot(classId, day, period);
                        }
                    }
                }
            }
        }

        // 現在の占有状態マップを構築
        const occupiedMap = this._buildOccupiedMap(targetClasses, clearFirst);

        // タスクリスト生成
        const tasks = this._buildTasks(targetClasses, result, clearFirst, occupiedMap);

        // 難易度順にソート（候補スロットが少ないものを先に）
        this._sortByDifficulty(tasks, occupiedMap);

        // 各タスクにスロットを割り当て
        for (const task of tasks) {
            const candidates = this._findAvailableSlots(task, occupiedMap);

            if (candidates.length < task.count) {
                result.warnings.push(
                    `${this._className(task.classId)} ${this._subjectName(task.subjectId)}`
                    + `（${this._teacherName(task.teacherId)}）:`
                    + ` 空きコマ不足（必要${task.count}コマ、利用可能${candidates.length}コマ）`
                );
            }

            const chosen = distribute
                ? this._selectSlotsDistributed(candidates, task.count, task.classId, task.subjectId, occupiedMap, avoidConsecutive)
                : candidates.slice(0, task.count);

            // 配置実行
            for (const { day, period } of chosen) {
                if (!dryRun) {
                    this.store.setSlot(task.classId, day, period, task.subjectId, [task.teacherId]);
                }
                result.placed.push({ classId: task.classId, day, period, subjectId: task.subjectId, teacherId: task.teacherId });

                // 占有マップを更新
                const key = `${day}-${period}`;
                occupiedMap.byClass[task.classId] = occupiedMap.byClass[task.classId] || new Set();
                occupiedMap.byClass[task.classId].add(key);
                occupiedMap.byTeacher[task.teacherId] = occupiedMap.byTeacher[task.teacherId] || new Set();
                occupiedMap.byTeacher[task.teacherId].add(key);
            }

            // 不足分を unplaced に記録
            const remaining = task.count - chosen.length;
            if (remaining > 0) {
                result.unplaced.push({
                    classId: task.classId,
                    subjectId: task.subjectId,
                    teacherId: task.teacherId,
                    remaining,
                    reason: '空きコマ不足'
                });
            }
        }

        return result;
    }

    // ──────────────────────────────────────────────────
    // 内部ヘルパー
    // ──────────────────────────────────────────────────

    /**
     * タスクリストを生成
     * classCurriculum × assignments をマッチングし、
     * 既に配置済みのコマ数を差し引いた残数を count に設定する
     */
    _buildTasks(targetClasses, result, clearFirst, occupiedMap) {
        const tasks = [];

        for (const classId of targetClasses) {
            const curriculum = this.store.classCurriculum.filter(c => c.classId === classId);

            for (const cc of curriculum) {
                // 担当教員を assignments から取得
                const assignment = this.store.assignments.find(
                    a => a.classId === classId && a.subjectId === cc.subjectId
                );

                if (!assignment) {
                    result.unplaced.push({
                        classId,
                        subjectId: cc.subjectId,
                        teacherId: null,
                        remaining: cc.weeklyHours,
                        reason: '教員未設定'
                    });
                    result.warnings.push(
                        `${this._className(classId)} ${this._subjectName(cc.subjectId)}: 担当教員が設定されていません`
                    );
                    continue;
                }

                let count = cc.weeklyHours;

                // clearFirst=false のとき、既に配置済みのコマを差し引く
                if (!clearFirst) {
                    const alreadyPlaced = this._countExistingLessons(classId, cc.subjectId, assignment.teacherId, occupiedMap);
                    count = Math.max(0, cc.weeklyHours - alreadyPlaced);
                }

                if (count > 0) {
                    tasks.push({
                        classId,
                        subjectId: cc.subjectId,
                        teacherId: assignment.teacherId,
                        count
                    });
                }
            }
        }

        return tasks;
    }

    /**
     * 指定クラス・科目・教員の既配置コマ数を数える
     */
    _countExistingLessons(classId, subjectId, teacherId) {
        let count = 0;
        for (let day = 0; day < DAYS.length; day++) {
            for (let period = 0; period < PERIODS; period++) {
                const slots = this.store.getSlot(classId, day, period);
                for (const s of slots) {
                    if (s.subjectId === subjectId && s.teacherIds.includes(teacherId)) {
                        count++;
                    }
                }
            }
        }
        return count;
    }

    /**
     * タスクを難易度順（候補スロット数が少ない順）にソート
     */
    _sortByDifficulty(tasks, occupiedMap) {
        tasks.sort((a, b) => {
            const slotsA = this._findAvailableSlots(a, occupiedMap).length;
            const slotsB = this._findAvailableSlots(b, occupiedMap).length;
            return slotsA - slotsB;
        });
    }

    /**
     * 配置可能なスロット一覧を返す
     * 制約: クラス空き & 教員空き & 教員勤務可 & 会議なし
     */
    _findAvailableSlots(task, occupiedMap) {
        const candidates = [];
        const classOccupied = occupiedMap.byClass[task.classId] || new Set();
        const teacherOccupied = occupiedMap.byTeacher[task.teacherId] || new Set();

        for (let day = 0; day < DAYS.length; day++) {
            for (let period = 0; period < PERIODS; period++) {
                const key = `${day}-${period}`;

                // ① クラスが空いている
                if (classOccupied.has(key)) continue;
                // ② 教員が空いている
                if (teacherOccupied.has(key)) continue;
                // ③ 教員の勤務不可時間でない
                if (this.store.isUnavailable(task.teacherId, day, period)) continue;
                // ④ 教員に会議が入っていない
                if (this._hasMeeting(task.teacherId, day, period)) continue;

                candidates.push({ day, period });
            }
        }

        return candidates;
    }

    /**
     * 分散配置: 週内で同科目が曜日に偏らないようスロットを選ぶ
     * 同じ曜日には同科目を重ねず、ラウンドロビンで選択する
     */
    _selectSlotsDistributed(candidates, count, classId, subjectId, occupiedMap, avoidConsecutive) {
        if (candidates.length === 0) return [];
        if (count >= candidates.length) return candidates.slice();

        // 曜日ごとにグループ化
        const byDay = {};
        for (const slot of candidates) {
            if (!byDay[slot.day]) byDay[slot.day] = [];
            byDay[slot.day].push(slot);
        }

        // 各曜日内を時限順にソート
        for (const d of Object.keys(byDay)) {
            byDay[d].sort((a, b) => a.period - b.period);
        }

        const dayOrder = Object.keys(byDay).map(Number).sort((a, b) => a - b);
        const chosen = [];
        let dayIdx = 0;
        let attempts = 0;

        while (chosen.length < count && attempts < candidates.length * 2) {
            attempts++;
            const day = dayOrder[dayIdx % dayOrder.length];
            dayIdx++;

            const slotsForDay = byDay[day];
            if (!slotsForDay || slotsForDay.length === 0) continue;

            // この曜日に既に同科目を選んでいないか確認（分散のため1曜日1コマを優先）
            const alreadyOnThisDay = chosen.filter(s => s.day === day).length;
            if (alreadyOnThisDay >= 1 && chosen.length < count - 1) {
                // まだ埋めていない曜日がある場合は後回し
                const availableDays = dayOrder.filter(d => !chosen.some(s => s.day === d));
                if (availableDays.length > 0) continue;
            }

            // 連続授業回避（avoidConsecutive=true のとき）
            let slot = null;
            for (const candidate of slotsForDay) {
                if (avoidConsecutive && this._isConsecutiveWithExisting(candidate, classId, subjectId, occupiedMap, chosen)) {
                    continue;
                }
                slot = candidate;
                break;
            }

            if (!slot) {
                // 連続回避できないなら先頭を使う
                slot = slotsForDay[0];
            }

            chosen.push(slot);
            byDay[day] = slotsForDay.filter(s => s !== slot);
        }

        // まだ足りない場合は残りの候補から補充
        if (chosen.length < count) {
            for (const c of candidates) {
                if (chosen.length >= count) break;
                if (!chosen.includes(c)) chosen.push(c);
            }
        }

        return chosen;
    }

    /**
     * 連続授業チェック: 隣接コマ（前後）に同科目が既に配置されているか
     */
    _isConsecutiveWithExisting(slot, classId, subjectId, occupiedMap, chosen) {
        const { day, period } = slot;

        // chosen（今回配置予定）に隣接コマがあるか
        for (const s of chosen) {
            if (s.day === day && Math.abs(s.period - period) === 1) return true;
        }

        // 既存の時間割に隣接コマがあるか
        if (period > 0) {
            const prev = this.store.getSlot(classId, day, period - 1);
            if (prev.some(s => s.subjectId === subjectId)) return true;
        }
        if (period < PERIODS - 1) {
            const next = this.store.getSlot(classId, day, period + 1);
            if (next.some(s => s.subjectId === subjectId)) return true;
        }

        return false;
    }

    /**
     * 現在の時間割状態から occupiedMap を構築
     * clearFirst=true の場合、対象クラスは空として扱う
     */
    _buildOccupiedMap(targetClasses, clearFirst) {
        const byClass = {};
        const byTeacher = {};

        const targetSet = new Set(targetClasses);

        for (const cls of CLASSES) {
            if (clearFirst && targetSet.has(cls.id)) {
                // クリアするクラスは空として扱う
                byClass[cls.id] = new Set();
                continue;
            }

            byClass[cls.id] = new Set();

            for (let day = 0; day < DAYS.length; day++) {
                for (let period = 0; period < PERIODS; period++) {
                    const slots = this.store.getSlot(cls.id, day, period);
                    if (slots.length > 0) {
                        const key = `${day}-${period}`;
                        byClass[cls.id].add(key);

                        // 教員の占有も記録（全クラスから）
                        for (const s of slots) {
                            for (const tid of (s.teacherIds || [])) {
                                if (!byTeacher[tid]) byTeacher[tid] = new Set();
                                byTeacher[tid].add(key);
                            }
                        }
                    }
                }
            }
        }

        return { byClass, byTeacher };
    }

    /**
     * 教員が指定時間帯に会議を持つか確認
     */
    _hasMeeting(teacherId, day, period) {
        for (const meeting of this.store.meetings) {
            if (!meeting.teacherIds.includes(teacherId)) continue;
            for (const s of (meeting.schedule || [])) {
                // schedule の period は1始まりか0始まりか確認が必要
                // data.js の会議定義を参照: period は表示上は1始まり、内部は0始まり
                if (s.dayIndex === day && s.period === period) return true;
            }
        }
        return false;
    }

    // ──────────────────────────────────────────────────
    // 表示名ヘルパー
    // ──────────────────────────────────────────────────

    _className(classId) {
        const cls = CLASSES.find(c => c.id === classId);
        return cls ? cls.name : classId;
    }

    _subjectName(subjectId) {
        const s = this.store.getSubject(subjectId);
        return s ? (s.shortName || s.name) : subjectId;
    }

    _teacherName(teacherId) {
        if (!teacherId) return '未設定';
        const t = this.store.getTeacher(teacherId);
        return t ? t.name : teacherId;
    }
}

// グローバルに公開
window.AutoScheduler = AutoScheduler;
