/**
 * ============================================================
 * 時間割くん - ユーティリティ関数
 * ============================================================
 * 
 * アプリケーション全体で使用する共通関数を提供します。
 * 
 * ──────────────────────────────────────────────────
 * 提供する機能:
 *   - showToast: トースト通知の表示
 *   - generateId: ユニークID生成
 *   - formatDate: 日付フォーマット
 *   - deepClone: オブジェクトのディープコピー
 * ──────────────────────────────────────────────────
 */

// ========================================
// トースト通知
// ========================================

/**
 * トースト通知を表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - 'success' | 'error' | 'info'
 * @param {number} duration - 表示時間（ミリ秒）
 */
function showToast(message, type = 'info', duration = 3000) {
    // 既存のトーストを削除
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    const bgColors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#6366f1',
        warning: '#f59e0b'
    };

    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${bgColors[type] || bgColors.info};
        color: white;
        border-radius: 8px;
        font-size: 14px;
        z-index: 2000;
        animation: toastSlideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ========================================
// HTMLエスケープ（XSS対策）
// ========================================

/**
 * HTMLエスケープ（XSS対策）
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ========================================
// ID生成
// ========================================

/**
 * ユニークなIDを生成
 * @param {string} prefix - IDのプレフィックス
 * @returns {string} 生成されたID
 */
function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ========================================
// 日付フォーマット
// ========================================

/**
 * 日付を指定形式でフォーマット
 * @param {Date} date - 日付オブジェクト
 * @param {string} format - フォーマット形式 ('YYYY-MM-DD' | 'YYYYMMDD_HHmm')
 * @returns {string} フォーマットされた日付文字列
 */
function formatDate(date = new Date(), format = 'YYYY-MM-DD') {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    switch (format) {
        case 'YYYYMMDD_HHmm':
            return `${y}${m}${d}_${h}${min}`;
        case 'YYYY-MM-DD':
        default:
            return `${y}-${m}-${d}`;
    }
}

// ========================================
// オブジェクト操作
// ========================================

/**
 * オブジェクトをディープコピー
 * @param {any} obj - コピーするオブジェクト
 * @returns {any} コピーされたオブジェクト
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        const copy = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                copy[key] = deepClone(obj[key]);
            }
        }
        return copy;
    }
    return obj;
}

// ========================================
// 配列操作
// ========================================

/**
 * 配列から指定条件に一致する要素を削除
 * @param {Array} array - 対象配列
 * @param {Function} predicate - 削除条件
 * @returns {boolean} 削除されたかどうか
 */
function removeFromArray(array, predicate) {
    const index = array.findIndex(predicate);
    if (index !== -1) {
        array.splice(index, 1);
        return true;
    }
    return false;
}

/**
 * 配列をグループ化
 * @param {Array} array - 対象配列
 * @param {string|Function} key - グループ化のキー
 * @returns {Object} グループ化されたオブジェクト
 */
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const keyValue = typeof key === 'function' ? key(item) : item[key];
        (result[keyValue] = result[keyValue] || []).push(item);
        return result;
    }, {});
}

// ========================================
// DOM操作
// ========================================

/**
 * 要素を安全に取得（存在しない場合はnull）
 * @param {string} id - 要素のID
 * @returns {HTMLElement|null}
 */
function $(id) {
    return document.getElementById(id);
}

/**
 * クエリセレクタのショートカット
 * @param {string} selector - CSSセレクタ
 * @param {HTMLElement} parent - 親要素（省略時はdocument）
 * @returns {HTMLElement|null}
 */
function $$(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * クエリセレクタオール
 * @param {string} selector - CSSセレクタ
 * @param {HTMLElement} parent - 親要素（省略時はdocument）
 * @returns {NodeList}
 */
function $$$(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

// ========================================
// トーストアニメーション（スタイル追加）
// ========================================

(function () {
    const toastStyle = document.createElement('style');
    toastStyle.textContent = `
        @keyframes toastSlideIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastSlideOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(20px); }
        }
    `;
    document.head.appendChild(toastStyle);
})();
