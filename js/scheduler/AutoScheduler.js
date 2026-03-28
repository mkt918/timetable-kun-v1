/**
 * AutoScheduler - 自動時間割配置アルゴリズム
 *
 * classCurriculum の設定（lessonType / consecutivePeriods / jointClassIds）を
 * 実際のスケジューリングに反映する。
 *
 * ■ 対応する設定
 *   - 通常 (normal)      : 1教員・1クラス・単独コマ
 *   - TT                : assignments に登録された複数教員を同時配置
 *   - 合同 (joint)      : jointClassIds の全クラスを同一スロットに配置
 *   - 連続コマ          : consecutivePeriods 分を連続スロットとして1ブロック扱い
 *
 * ■ 制約条件
 *   - 同一クラスは同一時間帯に1授業のみ（合同クラスすべて）
 *   - 同一教員は同一時間帯に1授業のみ（TT全教員）
 *   - 教員の勤務不可時間
 *   - 教員の会議時間
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

        const result = { placed: [], unplaced: [], warnings: [] };

        if (!dryRun) this.store.snapshot();

        // clearFirst: 対象クラス＋合同クラスをクリア
        if (clearFirst && !dryRun) {
            const toClear = this._collectClearTargets(targetClasses);
            for (const classId of toClear) {
                for (let day = 0; day < DAYS.length; day++) {
                    for (let period = 0; period < PERIODS; period++) {
                        if (this.store.getSlot(classId, day, period).length > 0) {
                            this.store.clearSlot(classId, day, period);
                        }
                    }
                }
            }
        }

        const occupiedMap = this._buildOccupiedMap(targetClasses, clearFirst);
        const tasks = this._buildTasks(targetClasses, result, clearFirst, occupiedMap);
        this._sortByDifficulty(tasks, occupiedMap);

        for (const task of tasks) {
            const candidates = this._findAvailableSlots(task, occupiedMap);

            if (candidates.length < task.count) {
                const needed = task.count * task.consecutive;
                const avail = candidates.length * task.consecutive;
                const teacherLabel = task.teacherIds.map(t => this._teacherName(t)).join('・');
                result.warnings.push(
                    `${this._className(task.classId)} ${this._subjectName(task.subjectId)}`
                    + `（${teacherLabel}）: 空き不足（必要${needed}コマ／利用可能${avail}コマ）`
                );
            }

            // avoidConsecutive は連続ブロック配置の場合は無効（意図的に連続させるため）
            const useAvoidConsecutive = avoidConsecutive && task.consecutive === 1;
            const chosen = distribute
                ? this._selectSlotsDistributed(candidates, task.count, task.classId, task.subjectId, occupiedMap, useAvoidConsecutive)
                : candidates.slice(0, task.count);

            for (const { day, period } of chosen) {
                // 連続ブロック分を一括配置
                // ※ 自動配置では特別教室情報を持たないため null を渡す（手動で後から設定可能）
                for (let p = period; p < period + task.consecutive && p < PERIODS; p++) {
                    if (!dryRun) {
                        for (const cid of task.allClassIds) {
                            this.store.setSlot(cid, day, p, task.subjectId, task.teacherIds, null);
                        }
                    }
                    result.placed.push({
                        classId: task.classId, day, period: p,
                        subjectId: task.subjectId, teacherIds: task.teacherIds
                    });

                    // 占有マップを更新（次のタスクの探索に使う）
                    const key = `${day}-${p}`;
                    for (const cid of task.allClassIds) {
                        (occupiedMap.byClass[cid] = occupiedMap.byClass[cid] || new Set()).add(key);
                    }
                    for (const tid of task.teacherIds) {
                        (occupiedMap.byTeacher[tid] = occupiedMap.byTeacher[tid] || new Set()).add(key);
                    }
                }
            }

            const remaining = (task.count - chosen.length) * task.consecutive;
            if (remaining > 0) {
                result.unplaced.push({
                    classId: task.classId,
                    subjectId: task.subjectId,
                    teacherId: task.teacherIds[0],
                    remaining,
                    reason: '空きコマ不足'
                });
            }
        }

        return result;
    }

    // ──────────────────────────────────────────────────
    // タスク構築
    // ──────────────────────────────────────────────────

    /**
     * タスクリストを生成
     * TT / 合同 / 連続コマの設定を反映する
     */
    _buildTasks(targetClasses, result, clearFirst, occupiedMap) {
        const tasks = [];
        // 合同授業で処理済みの "classId-subjectId" を記録
        const handledJoint = new Set();

        for (const classId of targetClasses) {
            const curriculum = this.store.classCurriculum.filter(c => c.classId === classId);

            for (const cc of curriculum) {
                const jkey = `${classId}-${cc.subjectId}`;
                if (handledJoint.has(jkey)) continue; // 合同でもう処理済み

                const lessonType  = cc.lessonType        || 'normal';
                const consecutive = cc.consecutivePeriods || 1;
                const jointIds    = (lessonType === 'joint' && (cc.jointClassIds || []).length > 0)
                    ? cc.jointClassIds : [];
                const allClassIds = [classId, ...jointIds];

                // 担当教員
                const assignments = this.store.assignments.filter(
                    a => a.classId === classId && a.subjectId === cc.subjectId
                );

                if (assignments.length === 0) {
                    result.unplaced.push({
                        classId, subjectId: cc.subjectId, teacherId: null,
                        remaining: cc.weeklyHours, reason: '教員未設定'
                    });
                    result.warnings.push(
                        `${this._className(classId)} ${this._subjectName(cc.subjectId)}: 担当教員が設定されていません`
                    );
                    continue;
                }

                // TT: assignments に登録された全教員、通常・合同: 先頭1人
                const teacherIds = (lessonType === 'tt' && assignments.length > 1)
                    ? assignments.map(a => a.teacherId)
                    : [assignments[0].teacherId];

                // ブロック数（連続コマを1単位として計算）
                let numBlocks = consecutive > 1
                    ? Math.floor(cc.weeklyHours / consecutive)
                    : cc.weeklyHours;

                // 追加モード: 既配置を差し引く
                if (!clearFirst) {
                    const placed      = this._countExistingLessons(classId, cc.subjectId, teacherIds[0]);
                    const placedBlocks = consecutive > 1 ? Math.floor(placed / consecutive) : placed;
                    numBlocks = Math.max(0, numBlocks - placedBlocks);
                }

                if (numBlocks > 0) {
                    if (jointIds.length > 0) {
                        allClassIds.forEach(cid => handledJoint.add(`${cid}-${cc.subjectId}`));
                    }
                    tasks.push({
                        classId,
                        subjectId: cc.subjectId,
                        teacherIds,
                        teacherId: teacherIds[0],
                        count: numBlocks,
                        consecutive,
                        allClassIds,
                        lessonType
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
                    if (s.subjectId === subjectId && s.teacherIds.includes(teacherId)) count++;
                }
            }
        }
        return count;
    }

    // ──────────────────────────────────────────────────
    // スロット探索
    // ──────────────────────────────────────────────────

    /**
     * タスクを難易度順（候補スロット数が少ない順）にソート
     */
    _sortByDifficulty(tasks, occupiedMap) {
        // 候補スロット数を事前計算してキャッシュ（sort の比較関数内で繰り返し呼ぶと O(n²) になるため）
        const scoreMap = new Map(
            tasks.map(t => [t, this._findAvailableSlots(t, occupiedMap).length])
        );
        tasks.sort((a, b) => scoreMap.get(a) - scoreMap.get(b));
    }

    /**
     * 配置可能スロット（ブロックのアンカー）一覧を返す
     * 連続コマの場合は先頭スロットだけを返し、N コマ分がすべて空きであることを確認する
     */
    _findAvailableSlots(task, occupiedMap) {
        const candidates = [];
        for (let day = 0; day < DAYS.length; day++) {
            for (let period = 0; period <= Math.max(0, PERIODS - task.consecutive); period++) {
                if (this._isBlockAvailable(task, day, period, occupiedMap)) {
                    candidates.push({ day, period });
                }
            }
        }
        return candidates;
    }

    /**
     * 指定スロットから task.consecutive コマが全クラス・全教員ともに空いているか確認
     */
    _isBlockAvailable(task, day, startPeriod, occupiedMap) {
        for (let p = startPeriod; p < startPeriod + task.consecutive; p++) {
            if (p >= PERIODS) return false;
            const key = `${day}-${p}`;

            for (const cid of task.allClassIds) {
                if ((occupiedMap.byClass[cid] || new Set()).has(key)) return false;
            }
            for (const tid of task.teacherIds) {
                if ((occupiedMap.byTeacher[tid] || new Set()).has(key)) return false;
                if (this.store.isUnavailable(tid, day, p)) return false;
                if (this._hasMeeting(tid, day, p)) return false;
            }
        }
        return true;
    }

    // ──────────────────────────────────────────────────
    // 分散配置
    // ──────────────────────────────────────────────────

    /**
     * 週内で同科目が曜日に偏らないようスロットを選ぶ（ラウンドロビン）
     */
    _selectSlotsDistributed(candidates, count, classId, subjectId, occupiedMap, avoidConsecutive) {
        if (candidates.length === 0) return [];
        if (count >= candidates.length) return candidates.slice();

        const byDay = {};
        for (const slot of candidates) {
            if (!byDay[slot.day]) byDay[slot.day] = [];
            byDay[slot.day].push(slot);
        }
        for (const d of Object.keys(byDay)) byDay[d].sort((a, b) => a.period - b.period);

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

            // まだ使っていない曜日がある間は1曜日1ブロックを優先
            // 未使用曜日が残っている場合は、同じ曜日に重複して配置しない
            const alreadyOnThisDay = chosen.filter(s => s.day === day).length;
            if (alreadyOnThisDay >= 1) {
                const unusedDays = dayOrder.filter(d => !chosen.some(s => s.day === d));
                if (unusedDays.length > 0) continue;
            }

            let slot = null;
            for (const candidate of slotsForDay) {
                if (avoidConsecutive && this._isConsecutiveWithExisting(candidate, classId, subjectId, occupiedMap, chosen)) continue;
                slot = candidate;
                break;
            }
            if (!slot) slot = slotsForDay[0];

            chosen.push(slot);
            byDay[day] = slotsForDay.filter(s => s !== slot);
        }

        // 不足分を残りの候補から補充
        if (chosen.length < count) {
            for (const c of candidates) {
                if (chosen.length >= count) break;
                if (!chosen.includes(c)) chosen.push(c);
            }
        }

        return chosen;
    }

    /**
     * 隣接コマ（前後）に同科目が既に配置されているか確認
     */
    _isConsecutiveWithExisting(slot, classId, subjectId, occupiedMap, chosen) {
        const { day, period } = slot;
        for (const s of chosen) {
            if (s.day === day && Math.abs(s.period - period) === 1) return true;
        }
        if (period > 0) {
            if (this.store.getSlot(classId, day, period - 1).some(s => s.subjectId === subjectId)) return true;
        }
        if (period < PERIODS - 1) {
            if (this.store.getSlot(classId, day, period + 1).some(s => s.subjectId === subjectId)) return true;
        }
        return false;
    }

    // ──────────────────────────────────────────────────
    // 占有マップ
    // ──────────────────────────────────────────────────

    /**
     * clearFirst 時に対象とすべきクラスID集合を返す（合同クラスを含む）
     */
    _collectClearTargets(targetClasses) {
        const toClear = new Set(targetClasses);
        for (const classId of targetClasses) {
            for (const cc of this.store.classCurriculum.filter(c => c.classId === classId)) {
                if (cc.lessonType === 'joint') {
                    (cc.jointClassIds || []).forEach(jid => toClear.add(jid));
                }
            }
        }
        return toClear;
    }

    /**
     * 現在の時間割状態から occupiedMap を構築
     * clearFirst=true の場合、対象クラス（合同含む）は空として扱う
     */
    _buildOccupiedMap(targetClasses, clearFirst) {
        const byClass  = {};
        const byTeacher = {};
        const clearSet = clearFirst ? this._collectClearTargets(targetClasses) : new Set();

        for (const cls of CLASSES) {
            if (clearSet.has(cls.id)) {
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
                        for (const s of slots) {
                            for (const tid of (s.teacherIds || [])) {
                                (byTeacher[tid] = byTeacher[tid] || new Set()).add(key);
                            }
                        }
                    }
                }
            }
        }

        return { byClass, byTeacher };
    }

    // ──────────────────────────────────────────────────
    // 会議チェック
    // ──────────────────────────────────────────────────

    _hasMeeting(teacherId, day, period) {
        for (const meeting of this.store.meetings) {
            if (!meeting.teacherIds.includes(teacherId)) continue;
            for (const s of (meeting.schedule || [])) {
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
