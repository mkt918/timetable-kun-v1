/**
 * ============================================================
 * 時間割くん - 設定・定数定義
 * ============================================================
 * 
 * アプリケーション全体で使用する定数と設定値を管理します。
 * 他のモジュールより先に読み込む必要があります。
 * 
 * ──────────────────────────────────────────────────
 * 定義内容:
 *   - DAYS: 曜日リスト
 *   - PERIODS: 時限数（設定可能）
 *   - CLASS_CONFIG: クラス構成（設定可能）
 *   - MAX_WEEKLY_HOURS: 週最大時間数
 *   - CLASSES: クラスリスト（動的生成）
 *   - STORAGE_KEYS: ローカルストレージのキー
 * ──────────────────────────────────────────────────
 */

// ========================================
// 固定定数
// ========================================

/**
 * 曜日リスト
 * @constant {string[]}
 */
const DAYS = ['月', '火', '水', '木', '金'];

/**
 * ローカルストレージのキー定義
 * @constant {Object}
 */
const STORAGE_KEYS = {
    TEACHERS: 'timetable_teachers',
    CATEGORIES: 'timetable_categories',
    SUBJECTS: 'timetable_subjects',
    ASSIGNMENTS: 'timetable_assignments',
    TIMETABLE: 'timetable_data',
    SETTINGS: 'timetable_settings',
    SPECIAL_CLASSROOMS: 'timetable_special_classrooms',
    MEETINGS: 'timetable_meetings',
    LINKED_GROUPS: 'timetable_linked_groups',
    PARKING_AREA: 'timetable_parking_area',
    ELECTIVE_GROUPS: 'timetable_elective_groups'
};

/**
 * アプリケーション定数
 * @constant {Object}
 */
const APP_CONSTANTS = {
    MAX_HISTORY: 5,
    MAX_PARKING_ITEMS: 20
};

// ========================================
// 設定可能な値（ローカルストレージで上書き可能）
// ========================================

/**
 * 時限数
 * @type {number}
 */
let PERIODS = 7;

/**
 * クラス構成（学年ごとのクラス数）
 * @type {Object<number, number>}
 */
let CLASS_CONFIG = { 1: 6, 2: 6, 3: 6 };

/**
 * 週最大時間数
 * @type {number}
 */
let MAX_WEEKLY_HOURS = 35;

/**
 * クラスリスト（generateClassesで動的に生成）
 * @type {Array<{id: string, name: string, grade: number}>}
 */
let CLASSES = [];

// ========================================
// クラスリスト生成関数
// ========================================

/**
 * CLASS_CONFIGに基づいてCLASSESを生成
 * @param {Object<number, number>} config - 学年ごとのクラス数
 * @returns {Array<{id: string, name: string, grade: number}>}
 */
function generateClassList(config = CLASS_CONFIG) {
    const classes = [];
    for (const [grade, count] of Object.entries(config)) {
        for (let i = 1; i <= count; i++) {
            classes.push({
                id: `${grade}-${i}`,
                name: `${grade}年${i}組`,
                grade: parseInt(grade)
            });
        }
    }
    return classes;
}

// 初期生成
CLASSES = generateClassList();

// ========================================
// 設定の適用
// ========================================

/**
 * 設定を適用してCLASSESを再生成
 * @param {Object} settings - 設定オブジェクト
 */
function applyConfig(settings) {
    if (settings.periods) PERIODS = settings.periods;
    if (settings.classConfig) CLASS_CONFIG = settings.classConfig;
    if (settings.maxWeeklyHours) MAX_WEEKLY_HOURS = settings.maxWeeklyHours;
    CLASSES = generateClassList(CLASS_CONFIG);
}
