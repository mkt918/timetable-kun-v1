/**
 * RoomManager - 特別教室管理モジュール
 */
class RoomManager {
    constructor(store, ui, masterData) {
        this.store = store;
        this.ui = ui;
        this.masterData = masterData;
    }

    render() {
        const container = document.getElementById('room-cards');
        if (!container) return;

        const rooms = this.store.specialClassrooms || [];

        if (rooms.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    特別教室が登録されていません。<br>
                    「+ 教室を追加」ボタンから追加してください。
                </div>
            `;
        } else {
            container.innerHTML = rooms.map((room, index) => `
                <div class="card-item room-card" data-id="${room.id}" data-index="${index}" draggable="true">
                    <div class="card-drag-handle">≡</div>
                    <div class="card-content">
                        <span class="card-name">${room.name}</span>
                        ${room.shortName && room.shortName !== room.name ?
                    `<span class="card-short-name">(${room.shortName})</span>` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="card-edit" data-id="${room.id}" title="編集">✏️</button>
                        <button class="card-delete" data-id="${room.id}" title="削除">×</button>
                    </div>
                </div>
            `).join('');

            this.attachEvents(container);
        }

        this.setupButtons();
    }

    setupButtons() {
        const addBtn = document.getElementById('btn-add-room');
        if (addBtn) {
            addBtn.onclick = () => {
                const name = prompt('教室名を入力（例：理科室、音楽室）');
                if (name) {
                    this.store.addSpecialClassroom(`r_${Date.now()}`, name, name);
                    this.render();
                }
            };
        }
    }

    attachEvents(container) {
        let draggedItem = null;

        container.querySelectorAll('.room-card').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => item.classList.add('dragging'), 0);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== item) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (!draggedItem || draggedItem === item) return;

                const fromIndex = parseInt(draggedItem.dataset.index);
                const toIndex = parseInt(item.dataset.index);

                const [moved] = this.store.specialClassrooms.splice(fromIndex, 1);
                this.store.specialClassrooms.splice(toIndex, 0, moved);
                this.store.saveToStorage();
                this.render();
            });
        });

        // 編集ボタン
        container.querySelectorAll('.card-edit').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const roomId = btn.dataset.id;
                const room = this.store.getSpecialClassroom(roomId);
                if (room) {
                    const newName = prompt('教室名を編集', room.name);
                    if (newName && newName.trim()) {
                        this.store.updateSpecialClassroom(roomId, { name: newName.trim(), shortName: newName.trim() });
                        this.render();
                    }
                }
            };
        });

        // 削除ボタン
        container.querySelectorAll('.card-delete').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const roomId = btn.dataset.id;
                const room = this.store.getSpecialClassroom(roomId);
                if (room && confirm(`「${room.name}」を削除しますか？`)) {
                    this.store.deleteSpecialClassroom(roomId);
                    this.render();
                    showToast('削除しました', 'success');
                }
            };
        });
    }
}

// グローバルに公開
window.RoomManager = RoomManager;
