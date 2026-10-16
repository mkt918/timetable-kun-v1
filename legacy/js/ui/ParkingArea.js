/**
 * パーキングエリア（一時保管場所）UI管理
 * 全教員タブに表示される折りたたみ式のパネル
 */
class ParkingAreaManager {
    constructor(store, ui) {
        this.store = store;
        this.ui = ui;
        this.isExpanded = false; // 折りたたみ状態
    }

    /**
     * パーキングエリアUIをレンダリング（全教員タブに表示）
     * @param {string} containerId - コンテナ要素のID
     */
    render(containerId = 'parking-area-container') {
        let container = document.getElementById(containerId);

        // コンテナがない場合は作成
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.style.cssText = 'margin: 10px 0; padding: 0;';

            // Use .app-header as anchor (below the header)
            const anchor = document.querySelector('.app-header');
            if (anchor) {
                anchor.parentNode.insertBefore(container, anchor.nextSibling);
            }
        }

        // 全教員のパーキングアイテム数をカウント
        const allItems = this.store.getAllParkingItems();
        const totalItems = allItems.length;

        // ヘッダー部分
        const headerHtml = `
            <div class="parking-header" onclick="ui.parkingArea.toggle()" style="
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 10px 15px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                user-select: none;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.2em;">🅿️</span>
                    <span style="font-weight: 600;">パーキングエリア</span>
                    <span class="parking-badge" style="
                        background: ${totalItems > 0 ? '#dc3545' : '#6c757d'};
                        color: white;
                        border-radius: 12px;
                        padding: 2px 8px;
                        font-size: 0.8em;
                        min-width: 20px;
                        text-align: center;
                    ">${totalItems}件</span>
                </div>
                <span style="transition: transform 0.3s; transform: rotate(${this.isExpanded ? '180deg' : '0deg'});">▼</span>
            </div>
        `;

        // コンテンツ部分
        let contentHtml = '';
        if (this.isExpanded) {
            contentHtml = this.renderContent();
        }

        container.innerHTML = headerHtml + contentHtml;
    }

    /**
     * 展開時のコンテンツをレンダリング（全アイテム一覧）
     */
    renderContent() {
        // 全教員のパーキングアイテムを取得
        const allItems = this.store.getAllParkingItems();

        let itemsHtml = '';
        if (allItems.length > 0) {
            itemsHtml = allItems.map(item => {
                const subject = this.store.getSubject(item.subjectId);
                const subjectName = subject ? subject.shortName || subject.name : '不明';
                const className = CLASSES.find(c => c.id === item.classId)?.name || item.classId;
                const origDay = DAYS[item.originalPosition.day];
                const origPeriod = item.originalPosition.period + 1;

                return `
                    <div class="parking-item" style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 8px 12px;
                        margin: 4px 0;
                        background: white;
                        border: 1px solid #e0e0e0;
                        border-radius: 4px;
                        border-left: 3px solid #007bff;
                    ">
                        <div style="flex: 1;">
                            <span style="font-weight: 600; color: #495057;">${item.teacherName}</span>
                            <span style="margin: 0 8px; color: #dee2e6;">|</span>
                            <span style="font-weight: 600;">${subjectName}</span>
                            <span style="color: #666; margin-left: 8px;">${className}</span>
                            <span style="color: #999; font-size: 0.85em; margin-left: 8px;">
                                (元: ${origDay}${origPeriod})
                            </span>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-sm btn-primary" onclick="ui.parkingArea.restoreItem('${item.teacherId}', '${item.id}')" title="元の位置に復元" style="padding: 4px 8px; font-size: 0.85em;">
                                ↩️ 復元
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="ui.parkingArea.removeItem('${item.teacherId}', '${item.id}')" title="削除" style="padding: 4px 8px; font-size: 0.85em;">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            itemsHtml = '<p style="color: #999; text-align: center; padding: 30px; margin: 0;">パーキングエリアは空です</p>';
        }

        // 全件操作ボタン
        const bulkActionsHtml = allItems.length > 0 ? `
            <div style="display: flex; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #dee2e6;">
                <button class="btn btn-sm btn-success" onclick="ui.parkingArea.restoreAll()" style="flex: 1;">
                    ↩️ すべて復元
                </button>
                <button class="btn btn-sm btn-secondary" onclick="ui.parkingArea.clearAll()" style="flex: 1;">
                    🗑️ すべて削除
                </button>
            </div>
        ` : '';

        return `
            <div class="parking-content" style="
                border: 1px solid #dee2e6;
                border-top: none;
                border-radius: 0 0 8px 8px;
                padding: 15px;
                background: #f8f9fa;
                animation: slideDown 0.3s ease-out;
                max-height: 400px;
                overflow-y: auto;
            ">
                <div class="parking-items">
                    ${itemsHtml}
                </div>
                ${bulkActionsHtml}
            </div>
            <style>
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        `;
    }

    /**
     * 折りたたみ状態をトグル
     */
    toggle() {
        this.isExpanded = !this.isExpanded;
        this.render();
    }

    /**
     * アイテムを元の位置に復元（教員ID指定）
     */
    restoreItem(teacherId, itemId) {
        const result = this.store.restoreFromParking(teacherId, itemId);
        if (result.success) {
            showToast('授業を復元しました', 'success');
            this.render();
            this.ui.renderMainOverview();
            this.ui.checkConflicts();
        } else {
            showToast(result.message || '復元に失敗しました', 'error');
        }
    }

    /**
     * アイテムを削除（教員ID指定）
     */
    removeItem(teacherId, itemId) {
        if (confirm('このアイテムを削除しますか?\n（時間割には復元されません）')) {
            const result = this.store.removeFromParking(teacherId, itemId);
            if (result.success) {
                showToast('削除しました', 'success');
                this.render();
            }
        }
    }

    /**
     * 全教員のすべてのアイテムを復元
     */
    restoreAll() {
        const allItems = this.store.getAllParkingItems();
        if (allItems.length === 0) {
            showToast('復元するアイテムがありません', 'info');
            return;
        }

        let successCount = 0;
        let failCount = 0;

        // 全教員のアイテムを復元
        for (const teacherId in this.store.parkingArea) {
            const result = this.store.restoreAllFromParking(teacherId);
            if (result.success) {
                successCount += result.count;
            } else {
                failCount++;
            }
        }

        if (successCount > 0) {
            showToast(`${successCount}件を復元しました`, 'success');
            this.render();
            this.ui.renderMainOverview();
            this.ui.checkConflicts();
        } else {
            showToast('復元できませんでした', 'error');
        }
    }

    /**
     * 全教員のすべてのアイテムを削除
     */
    clearAll() {
        const allItems = this.store.getAllParkingItems();
        if (allItems.length === 0) {
            showToast('削除するアイテムがありません', 'info');
            return;
        }

        if (confirm(`${allItems.length}件のアイテムを削除しますか?\n（時間割には復元されません）`)) {
            this.store.clearParking(); // 引数なしで全教員をクリア
            showToast(`${allItems.length}件を削除しました`, 'success');
            this.render();
        }
    }
}
