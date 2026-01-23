/**
 * PrintManager - 印刷機能管理
 */
class PrintManager {
    constructor(store, ui) {
        this.store = store;
        this.ui = ui;
        this.selectedTabs = ['teacher']; // デフォルトで全教員を選択
        this.printFormat = 'a3-landscape'; // デフォルトはA3横
        this.printDate = this.getNextMonday();
    }

    /**
     * 次の月曜日を取得
     */
    getNextMonday() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + daysUntilMonday);
        return nextMonday;
    }

    /**
     * 印刷ダイアログを開く
     */
    openDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.id = 'print-dialog';
        overlay.innerHTML = `
            <div class="dialog-content" style="max-width: 500px;">
                <h2 style="margin-bottom: 20px;">🖨️ 印刷設定</h2>
                
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="font-weight: bold; margin-bottom: 8px; display: block;">印刷する時間割（複数選択可）</label>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                            <input type="checkbox" class="print-tab-check" value="teacher" ${this.selectedTabs.includes('teacher') ? 'checked' : ''}>
                            <span>📋 全教員表</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                            <input type="checkbox" class="print-tab-check" value="class" ${this.selectedTabs.includes('class') ? 'checked' : ''}>
                            <span>🏫 全クラス表</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                            <input type="checkbox" class="print-tab-check" value="room" ${this.selectedTabs.includes('room') ? 'checked' : ''}>
                            <span>🚪 特別教室表</span>
                        </label>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="font-weight: bold; margin-bottom: 8px; display: block;">印刷様式</label>
                    <select id="print-format" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                        <option value="a3-landscape" ${this.printFormat === 'a3-landscape' ? 'selected' : ''}>A3 横長（推奨）</option>
                        <option value="a3-landscape-large" ${this.printFormat === 'a3-landscape-large' ? 'selected' : ''}>A3 横長（大きめ文字）</option>
                        <option value="a4-landscape" ${this.printFormat === 'a4-landscape' ? 'selected' : ''}>A4 横長</option>
                    </select>
                </div>

                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="font-weight: bold; margin-bottom: 8px; display: block;">日付（週の開始日）</label>
                    <input type="date" id="print-date" value="${this.formatDate(this.printDate)}" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                    <div style="font-size: 0.85em; color: #666; margin-top: 4px;">
                        ※ 印刷物のヘッダーに表示されます
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 24px;">
                    <label style="font-weight: bold; margin-bottom: 8px; display: block;">出力形式</label>
                    <div style="display: flex; gap: 12px;">
                        <button id="btn-print-pdf" class="btn btn-primary" style="flex: 1; padding: 12px;">
                            📄 PDFで印刷
                        </button>
                        <button id="btn-print-image" class="btn btn-secondary" style="flex: 1; padding: 12px;">
                            🖼️ 画像で保存
                        </button>
                    </div>
                </div>

                <div style="text-align: right;">
                    <button id="btn-print-cancel" class="btn btn-secondary">キャンセル</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.attachDialogEvents(overlay);
    }

    attachDialogEvents(overlay) {
        // キャンセル
        overlay.querySelector('#btn-print-cancel').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        // タブ選択の変更
        overlay.querySelectorAll('.print-tab-check').forEach(cb => {
            cb.onchange = () => {
                this.selectedTabs = Array.from(overlay.querySelectorAll('.print-tab-check:checked'))
                    .map(c => c.value);
            };
        });

        // 様式の変更
        overlay.querySelector('#print-format').onchange = (e) => {
            this.printFormat = e.target.value;
        };

        // 日付の変更
        overlay.querySelector('#print-date').onchange = (e) => {
            this.printDate = new Date(e.target.value);
        };

        // PDF印刷
        overlay.querySelector('#btn-print-pdf').onclick = () => {
            if (this.selectedTabs.length === 0) {
                showToast('印刷するタブを選択してください', 'error');
                return;
            }
            overlay.remove();
            this.printAsPDF();
        };

        // 画像保存
        overlay.querySelector('#btn-print-image').onclick = () => {
            if (this.selectedTabs.length === 0) {
                showToast('印刷するタブを選択してください', 'error');
                return;
            }
            overlay.remove();
            this.saveAsImage();
        };
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatDateJapanese(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}年${month}月${day}日（月）〜`;
    }

    /**
     * 印刷用HTMLを生成
     */
    generatePrintHTML() {
        const dateStr = this.formatDateJapanese(this.printDate);

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>時間割表 - ${dateStr}</title>
                <style>
                    @page {
                        size: ${this.printFormat.includes('a3') ? 'A3' : 'A4'} landscape;
                        margin: 10mm;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    body {
                        font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
                        font-size: ${this.printFormat === 'a3-landscape-large' ? '11px' : '9px'};
                        background: white;
                    }
                    .print-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 10px;
                        padding-bottom: 8px;
                        border-bottom: 2px solid #333;
                    }
                    .print-header h1 {
                        font-size: 18px;
                    }
                    .print-date {
                        font-size: 14px;
                        font-weight: bold;
                    }
                    .print-container {
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                    }
                    .print-section {
                        page-break-inside: avoid;
                    }
                    .print-section h2 {
                        font-size: 14px;
                        margin-bottom: 8px;
                        padding: 4px 8px;
                        background: #f0f0f0;
                        border-left: 4px solid #667eea;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: fixed;
                    }
                    th, td {
                        border: 1px solid #999;
                        padding: 3px 4px;
                        text-align: center;
                        vertical-align: middle;
                        word-wrap: break-word;
                        overflow: hidden;
                    }
                    th {
                        background: #e8e8e8;
                        font-weight: bold;
                    }
                    .time-header {
                        width: 35px;
                        background: #d0d0d0;
                        font-weight: bold;
                    }
                    .has-lesson {
                        background: #e8f5e9;
                    }
                    .cell-subject {
                        font-weight: bold;
                        display: block;
                    }
                    .cell-class, .cell-teacher {
                        font-size: 0.85em;
                        color: #555;
                    }
                    .tt-badge {
                        display: inline-block;
                        background: #ff9800;
                        color: white;
                        padding: 1px 3px;
                        border-radius: 3px;
                        font-size: 0.7em;
                        margin-right: 2px;
                    }
                    .day-separator {
                        border-bottom: 2px solid #666;
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>📋 時間割表</h1>
                    <div class="print-date">${dateStr}</div>
                </div>
                <div class="print-container">
        `;

        // 選択されたタブを順に追加
        if (this.selectedTabs.includes('teacher')) {
            html += this.generateTeacherTable();
        }
        if (this.selectedTabs.includes('class')) {
            html += this.generateClassTable();
        }
        if (this.selectedTabs.includes('room')) {
            html += this.generateRoomTable();
        }

        html += `
                </div>
            </body>
            </html>
        `;

        return html;
    }

    generateTeacherTable() {
        const teachers = this.store.teachers;
        if (teachers.length === 0) return '';

        let html = `<div class="print-section"><h2>📋 全教員表</h2><table><thead><tr><th class="time-header">時限</th>`;

        teachers.forEach(t => {
            html += `<th>${t.shortName || t.name}</th>`;
        });
        html += '</tr></thead><tbody>';

        const teacherTimetables = {};
        teachers.forEach(t => {
            teacherTimetables[t.id] = this.store.getTeacherTimetable(t.id);
        });

        DAYS.forEach((day, dayIndex) => {
            for (let period = 0; period < PERIODS; period++) {
                const isLast = period === PERIODS - 1;
                html += `<tr class="${isLast ? 'day-separator' : ''}"><td class="time-header">${day}${period + 1}</td>`;

                teachers.forEach(teacher => {
                    const key = `${dayIndex}-${period}`;
                    const slots = teacherTimetables[teacher.id][key] || [];

                    if (slots.length > 0) {
                        const slot = slots[0];
                        const isTT = slots.length > 1 || (slot.teacherIds && slot.teacherIds.length > 1);
                        html += `<td class="has-lesson">`;
                        if (isTT) html += '<span class="tt-badge">TT</span>';
                        html += `<span class="cell-subject">${slot.subjectName || ''}</span>`;
                        html += `<span class="cell-class">${slot.className || ''}</span>`;
                        html += '</td>';
                    } else {
                        html += '<td></td>';
                    }
                });
                html += '</tr>';
            }
        });

        html += '</tbody></table></div>';
        return html;
    }

    generateClassTable() {
        const classes = CLASSES;
        if (classes.length === 0) return '';

        let html = `<div class="print-section"><h2>🏫 全クラス表</h2><table><thead><tr><th class="time-header">時限</th>`;

        classes.forEach(c => {
            html += `<th>${c.name}</th>`;
        });
        html += '</tr></thead><tbody>';

        DAYS.forEach((day, dayIndex) => {
            for (let period = 0; period < PERIODS; period++) {
                const isLast = period === PERIODS - 1;
                html += `<tr class="${isLast ? 'day-separator' : ''}"><td class="time-header">${day}${period + 1}</td>`;

                classes.forEach(cls => {
                    const slots = this.store.getSlot(cls.id, dayIndex, period);

                    if (slots.length > 0) {
                        const slot = slots[0];
                        const subject = this.store.getSubject(slot.subjectId);
                        const teacherNames = slot.teacherIds.map(tid => {
                            const t = this.store.getTeacher(tid);
                            return t ? (t.shortName || t.name) : '';
                        }).join('・');

                        html += `<td class="has-lesson">`;
                        html += `<span class="cell-subject">${subject?.shortName || subject?.name || ''}</span>`;
                        html += `<span class="cell-teacher">${teacherNames}</span>`;
                        html += '</td>';
                    } else {
                        html += '<td></td>';
                    }
                });
                html += '</tr>';
            }
        });

        html += '</tbody></table></div>';
        return html;
    }

    generateRoomTable() {
        const rooms = this.store.specialClassrooms || [];
        if (rooms.length === 0) return '';

        let html = `<div class="print-section"><h2>🚪 特別教室表</h2><table><thead><tr><th class="time-header">時限</th>`;

        rooms.forEach(r => {
            html += `<th>${r.shortName || r.name}</th>`;
        });
        html += '</tr></thead><tbody>';

        // 教室ごとの使用状況をスキャン
        const roomUsage = {};
        rooms.forEach(room => {
            roomUsage[room.id] = {};
            DAYS.forEach((day, dayIndex) => {
                for (let period = 0; period < PERIODS; period++) {
                    const key = `${dayIndex}-${period}`;
                    roomUsage[room.id][key] = [];

                    CLASSES.forEach(cls => {
                        const slots = this.store.getSlot(cls.id, dayIndex, period);
                        slots.forEach(slot => {
                            if (slot.specialClassroomIds?.includes(room.id)) {
                                const subject = this.store.getSubject(slot.subjectId);
                                roomUsage[room.id][key].push({
                                    className: cls.name,
                                    subjectName: subject?.shortName || subject?.name || ''
                                });
                            }
                        });
                    });
                }
            });
        });

        DAYS.forEach((day, dayIndex) => {
            for (let period = 0; period < PERIODS; period++) {
                const key = `${dayIndex}-${period}`;
                const isLast = period === PERIODS - 1;
                html += `<tr class="${isLast ? 'day-separator' : ''}"><td class="time-header">${day}${period + 1}</td>`;

                rooms.forEach(room => {
                    const usage = roomUsage[room.id][key] || [];
                    if (usage.length > 0) {
                        html += `<td class="has-lesson">`;
                        usage.forEach(u => {
                            html += `<div><span class="cell-subject">${u.subjectName}</span><span class="cell-class">${u.className}</span></div>`;
                        });
                        html += '</td>';
                    } else {
                        html += '<td></td>';
                    }
                });
                html += '</tr>';
            }
        });

        html += '</tbody></table></div>';
        return html;
    }

    /**
     * PDFとして印刷
     */
    printAsPDF() {
        const printHTML = this.generatePrintHTML();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printHTML);
        printWindow.document.close();

        // 少し待ってから印刷ダイアログを開く
        setTimeout(() => {
            printWindow.print();
        }, 500);

        showToast('印刷ダイアログを開きました', 'success');
    }

    /**
     * 画像として保存
     */
    async saveAsImage() {
        showToast('画像を生成中...', 'info');

        // 一時的なiframeを作成して印刷用HTMLをレンダリング
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.width = '1500px';
        iframe.style.height = '1000px';
        document.body.appendChild(iframe);

        const printHTML = this.generatePrintHTML();
        iframe.contentDocument.write(printHTML);
        iframe.contentDocument.close();

        // html2canvasがなければCDNから読み込み
        if (typeof html2canvas === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => this.captureAndDownload(iframe);
            document.head.appendChild(script);
        } else {
            await this.captureAndDownload(iframe);
        }
    }

    async captureAndDownload(iframe) {
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // レンダリング待機

            const canvas = await html2canvas(iframe.contentDocument.body, {
                scale: 2,
                useCORS: true,
                logging: false
            });

            // ダウンロード
            const link = document.createElement('a');
            const dateStr = this.formatDate(this.printDate);
            link.download = `時間割_${dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            showToast('画像を保存しました', 'success');
        } catch (error) {
            console.error('Image capture error:', error);
            showToast('画像の生成に失敗しました', 'error');
        } finally {
            iframe.remove();
        }
    }
}

// グローバルに公開
window.PrintManager = PrintManager;
