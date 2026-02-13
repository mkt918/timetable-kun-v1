/**
 * ============================================================
 * 時間割くん - UI操作クラス (Main)
 * ============================================================
 */
class TimetableUI {
    constructor(store) {
        this.store = store;

        // Initialize Sub-components
        this.overview = new OverviewRenderer(store, this);
        this.masterData = new MasterDataManager(store, this);
        this.lessonModal = new LessonManager(store, this);
        this.unavailableSettings = new UnavailableSettingsManager(store, this);
        this.csv = new CSVManager(store, this);
        this.parkingArea = new ParkingAreaManager(store, this);
        this.validationModal = new ValidationModal(store, this);

        // Context Menu is managed in app.js or moving here?
        // Plan said app.js handles initialization, but context menu logic was in app.js
        // I will keep Context Menu in app.js for now to minimize risk, 
        // or expecting app.js to instantiate a ContextMenuManager if I made one.
        // I haven't made ContextMenuManager yet.
    }

    init() {
        this.overview.init();
        this.renderMainOverview();
        this.checkConflicts();
        this.setupUndoRedo();
    }

    // CSV Facade
    openCSVUnifiedModal() { this.csv.openUnifiedModal(); }
    exportUnifiedCSV() { this.csv.exportUnifiedCSV(); }
    importUnifiedCSV() { this.csv.importUnifiedCSV(); }

    // Facade methods to maintain compatibility with existing HTML onclick handlers if any,
    // and for inter-module communication.

    renderMainOverview() {
        this.overview.render();
    }

    checkConflicts() {
        this.overview.checkConflicts();
    }

    // Master Data Facade
    openMasterDataModal() {
        this.masterData.openModal();
    }

    // Facade for HTML onclicks that might reference `ui.switchMasterTab`
    switchMasterTab(tab) {
        this.masterData.switchTab(tab);
    }

    // Facade for master data inner calls (if needed by HTML attributes)
    addMasterTeacher() { this.store.addTeacher(`t_${Date.now()}`, '新規教員'); this.masterData.renderTeachers(); }
    addMasterCategory() {
        const name = prompt('新しい教科カテゴリ名');
        if (name) { this.store.addCategory(`c_${Date.now()}`, name); this.masterData.renderCategoryList(); }
    }
    addMasterSubject() {
        // This was logic inside renderSubjectList in ui.js, triggered by a button ID
        // The listener is set in renderSubjectList, so no facade needed for button ID if checking there.
        // But let's check MasterDataManager logic. It sets onclick for btn-add-subject.
    }

    addMasterAssignment() { this.masterData.handleAddAssignment(); }

    // Facade for Teacher Card events (if HTML onclick="ui.something" used)
    editTeacher(id) {
        const t = this.store.getTeacher(id);
        const name = prompt('教員名を入力', t.name);
        if (name) { this.store.updateTeacher(id, name); this.masterData.renderTeachers(); this.renderMainOverview(); }
    }
    deleteTeacher(id) {
        if (confirm('削除しますか？')) { this.store.deleteTeacher(id); this.masterData.renderTeachers(); this.renderMainOverview(); }
    }
    toggleTeacherSeparator(id) {
        const t = this.store.getTeacher(id);
        t.separator = !t.separator;
        this.store.saveToStorage();
        this.masterData.renderTeachers();
        this.renderMainOverview();
    }

    // Category/Subject facades
    editCategory(id) {
        const c = this.store.getCategory(id);
        const name = prompt('教科名', c.name);
        if (name) { this.store.updateCategory(id, name); this.masterData.renderCategoryList(id); }
    }
    deleteCategory(id) {
        if (confirm('削除しますか？関連する科目も削除されます。')) { this.store.deleteCategory(id); this.masterData.renderCategoryList(); this.masterData.renderSubjectList(); }
    }

    editSubject(id) {
        const s = this.store.getSubject(id);
        const name = prompt('科目名', s.name);
        if (name) {
            const short = prompt('略称', s.shortName) || name;
            this.store.updateSubject(id, name, short);
            this.masterData.renderSubjectList(s.categoryId);
            this.renderMainOverview();
        }
    }
    deleteSubject(id) {
        if (confirm('削除しますか？')) {
            const s = this.store.getSubject(id);
            this.store.deleteSubject(id);
            this.masterData.renderSubjectList(s.categoryId);
            this.renderMainOverview();
        }
    }
    toggleSubjectVisibility(id) {
        const s = this.store.getSubject(id);
        this.store.updateSubject(id, s.name, s.shortName, s.categoryId, !s.isHidden);
        this.masterData.renderSubjectList(s.categoryId);
        this.renderMainOverview();
    }

    // Assignment Facade
    renderAssignmentForm() { this.masterData.renderAssignmentForm(); }
    renderAssignmentList() { this.masterData.renderAssignmentList(); }
    handleAssignTagClick(type, id) { this.masterData.handleAssignTagClick(type, id); }
    handleEditAssignment(teacherId, subjectId, classId) { this.masterData.handleEditAssignment(teacherId, subjectId, classId); }
    handleDeleteAssignment(teacherId, subjectId, classId) { this.masterData.handleDeleteAssignment(teacherId, subjectId, classId); }
    handleAssignmentCheck(key) { this.masterData.handleAssignmentCheck(key); }
    handleDeleteSelected() { this.masterData.handleDeleteSelected(); }

    // Hours Facade (HTML onclicks are hardcoded to ui.adjustHours in original? No, they were addEventListener)
    // But I should check if I used `onclick="ui.masterData..."` in my new HTML strings.
    // Yes, I did: `onclick="ui.masterData.handleAssignTagClick..."`
    // So I don't necessarily need facade methods in TimetableUI if I access ui.masterData directly.
    // BUT the global variable is `ui`.


    // Lesson Modal Facade
    openOverviewLessonModal(classId, day, period, teacherId) {
        this.lessonModal.openOverviewLessonModal(classId, day, period, teacherId);
    }
    openOverviewAddModal(day, period, teacherId) {
        this.lessonModal.openOverviewAddModal(day, period, teacherId);
    }
    assignLessonFromOverview(teacherId, subjectId, overrideClassId) {
        this.lessonModal.assignLesson(teacherId, subjectId, overrideClassId);
    }
    clearLesson() {
        this.lessonModal.clearLesson();
    }
    closeLessonModal() {
        this.lessonModal.close();
    }
    openClassAddModal(classId, day, period) {
        this.lessonModal.openClassAddModal(classId, day, period);
    }

    // Unavailable Settings Facade
    openUnavailableSettingsModal(teacherId) {
        this.unavailableSettings.open(teacherId);
    }
    toggleUnavailableBulk(type, index) {
        this.unavailableSettings.toggleBulk(type, index);
    }

    // Undo/Redo
    setupUndoRedo() {
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');

        if (undoBtn) undoBtn.onclick = () => {
            if (this.store.undo().success) {
                showToast('元に戻しました', 'info');
                this.renderMainOverview();
                this.updateUndoRedoButtons();
            }
        };

        if (redoBtn) redoBtn.onclick = () => {
            if (this.store.redo().success) {
                showToast('やり直しました', 'info');
                this.renderMainOverview();
                this.updateUndoRedoButtons();
            }
        };

        this.updateUndoRedoButtons();
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');
        if (undoBtn) undoBtn.disabled = this.store.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = this.store.redoStack.length === 0;
    }

    // Settings Facade
    applyMasterChanges() {
        this.masterData.applyChanges();
    }
    adjustHours(delta) {
        // used by +/- buttons in assignment form
        // In my new code I used onclick setting in renderAssignHours directly.
        // But if I missed any...
        // No, MasterDataManager.renderAssignHours sets onclick.
    }

    // CSV Facade (referenced in app.js or html?)
    openCSVUnifiedModal() {
        this.csv.openUnifiedModal();
    }

    // Adding Missing CSV methods to Facade (and Manager) as placeholders or implementation if I can recall/find logic.
    // The previous view_file of ui.js was TRUNCATED or I skipped?
    // I read 1-800, 1101-1900, 1901-2231.
    // I missed 801-1100.
    // openCSVUnifiedModal was likely there.
    // I MUST READ THAT PART to ensure no data loss.
}

// showToast is defined in utils.js
