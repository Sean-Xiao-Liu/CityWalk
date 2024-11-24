export class NoteService {
    constructor() {
        this.currentEditingLocationIndex = null;
        this.editingNoteId = null;
        this.locations = [];
        this.currentTripName = null;
    }
    
    // 修改保存笔记的方法
  saveLocationNote() {
    if (this.currentEditingLocationIndex !== null) {
      const editor = document.getElementById("note-editor");
      const saveBtn = document.getElementById("save-note");
      const cancelBtn = document.getElementById("cancel-note");
      const noteContent = editor.value.trim();

      if (noteContent) {
        if (this.editingNoteId) {
          // 更新现有笔记
          const notes = this.locations[this.currentEditingLocationIndex].notes;
          const index = notes.findIndex(
            (n) => n.id.toString() === this.editingNoteId
          );
          if (index !== -1) {
            notes[index] = {
              ...notes[index],
              content: noteContent,
              date: new Date().toISOString(),
            };
          }
          this.editingNoteId = null;
        } else {
          // 创建新笔记
          const newNote = {
            content: noteContent,
            date: new Date().toISOString(),
            id: Date.now(),
          };

          if (!this.locations[this.currentEditingLocationIndex].notes) {
            this.locations[this.currentEditingLocationIndex].notes = [];
          }
          this.locations[this.currentEditingLocationIndex].notes.push(newNote);
        }

        // 更新显示
        this.updateNotesList();

        // 重置编辑器和按钮
        editor.value = "";
        saveBtn.textContent = "Add Note";
        cancelBtn.style.display = "none";

        // 如果当前是已保存的行程，更新 localStorage
        if (this.currentTripName) {
          let savedTrips = JSON.parse(
            localStorage.getItem("savedTrips") || "[]"
          );
          const tripIndex = savedTrips.findIndex(
            (trip) => trip.name === this.currentTripName
          );

          if (tripIndex !== -1) {
            // 更新保存的行程中的地点数据
            savedTrips[tripIndex].locations = this.locations;
            localStorage.setItem("savedTrips", JSON.stringify(savedTrips));
          }
        }
      }
    }
  }

  // 添加更新笔记列表的方法
  updateNotesList() {
    const notesList = document.querySelector(".notes-list");
    if (!notesList) {
      console.error("Notes list container not found");
      return;
    }

    const locationNotes = this.locations[this.currentEditingLocationIndex].notes || [];

    if (locationNotes.length === 0) {
      notesList.innerHTML = '<div class="no-notes">No notes yet</div>';
      return;
    }

    notesList.innerHTML = locationNotes
      .map(note => `
        <div class="note-card" data-note-id="${note.id}">
          <div class="note-header">
            <div class="note-date">${new Date(note.date).toLocaleString()}</div>
            <div class="note-actions">
              <button class="edit-note" title="Edit note">
                <svg class="edit-icon" viewBox="0 0 24 24">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
              <button class="delete-note" title="Delete note">
                <svg class="delete-icon" viewBox="0 0 24 24">
                  <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="note-content">${note.content}</div>
        </div>
      `).join("");

    // 添加编辑和删除事件监听
    this.setupNoteEventListeners(notesList);
  }

  // 添加笔记事件监听器设置方法
  setupNoteEventListeners(notesList) {
    notesList.querySelectorAll(".edit-note").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const noteId = e.target.closest(".note-card").dataset.noteId;
        this.editNote(noteId);
      });
    });

    notesList.querySelectorAll(".delete-note").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const noteCard = e.target.closest(".note-card");
        const noteId = noteCard.dataset.noteId;
        this.showDeleteNoteConfirmation(noteId);
      });
    });
  }

  // 添加删除笔记确认对话框方法
  showDeleteNoteConfirmation(noteId) {
    const deleteModal = document.getElementById("delete-note-modal");
    const confirmBtn = document.getElementById("confirm-delete-note");
    const cancelBtn = document.getElementById("cancel-delete-note");

    deleteModal.style.display = "block";
    document.body.style.overflow = "hidden";

    const closeModal = () => {
      deleteModal.style.display = "none";
      document.body.style.overflow = "";
    };

    cancelBtn.onclick = closeModal;
    deleteModal.querySelector(".close-modal").onclick = closeModal;

    confirmBtn.onclick = () => {
      const notes = this.locations[this.currentEditingLocationIndex].notes;
      const index = notes.findIndex(n => n.id.toString() === noteId);
      if (index !== -1) {
        notes.splice(index, 1);
        this.updateNotesList();
      }
      closeModal();
    };

    deleteModal.onclick = (e) => {
      if (e.target === deleteModal) {
        closeModal();
      }
    };
  }

  // 修改编辑笔记的方法
  editNote(noteId) {
    const notes = this.locations[this.currentEditingLocationIndex].notes;
    const note = notes.find((n) => n.id.toString() === noteId);
    if (note) {
      const editor = document.getElementById("note-editor");
      const saveBtn = document.getElementById("save-note");
      const cancelBtn = document.getElementById("cancel-note");

      editor.value = note.content;
      saveBtn.textContent = "Update Note";
      cancelBtn.style.display = "block"; // 编辑时显示取消按钮

      this.editingNoteId = noteId;
      editor.focus();
    }
  }

  // 修改取消编辑的方法
  cancelNote() {
    const editor = document.getElementById("note-editor");
    const saveBtn = document.getElementById("save-note");
    const cancelBtn = document.getElementById("cancel-note");

    editor.value = "";
    saveBtn.textContent = "Add Note";
    cancelBtn.style.display = "none"; // 取消后隐藏取消按钮

    this.editingNoteId = null;
  }

  // 修改打开编辑器的方法
  openNoteEditor(locationIndex) {
    console.log("Opening note editor for location", locationIndex);
    
    const modal = document.getElementById("editor-modal");
    if (!modal) {
        console.error("Editor modal not found");
        return;
    }

    const editor = document.getElementById("note-editor");
    const saveBtn = document.getElementById("save-note");
    const cancelBtn = document.getElementById("cancel-note");

    if (!editor || !saveBtn || !cancelBtn) {
        console.error("Required editor elements not found");
        return;
    }

    this.currentEditingLocationIndex = locationIndex;

    // 确保模态框可见
    modal.style.display = "block";
    document.body.style.overflow = "hidden";

    // 重置编辑器状态
    editor.value = "";
    saveBtn.textContent = "Add Note";
    cancelBtn.style.display = "none";
    this.editingNoteId = null;

    // 更新笔记列表
    this.updateNotesList();

    // 使用事件委托来处理模态框的关闭
    const handleModalClose = () => {
        modal.style.display = "none";
        document.body.style.overflow = "";
        this.currentEditingLocationIndex = null;
        this.editingNoteId = null;
    };

    // 清除之前的事件监听器
    const closeBtn = modal.querySelector(".close-modal");
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    // 添加新的事件监听器
    newCloseBtn.addEventListener("click", handleModalClose);
    
    // 点击模态框外部关闭
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            handleModalClose();
        }
    });

    // 确保保存和取消按钮的事件监听器正确绑定
    saveBtn.onclick = () => {
        console.log("Save button clicked");
        this.saveLocationNote();
    };

    cancelBtn.onclick = () => {
        console.log("Cancel button clicked");
        this.cancelNote();
    };
  }

  // 添加初始化事件监听器的方法
  initializeEventListeners() {
    console.log("Initializing note service event listeners");
    
    const saveBtn = document.getElementById("save-note");
    const cancelBtn = document.getElementById("cancel-note");
    const modal = document.getElementById("editor-modal");
    
    if (!saveBtn || !cancelBtn || !modal) {
        console.error("Required elements not found during initialization");
        return;
    }

    // 使用 addEventListener 而不是 onclick
    saveBtn.addEventListener("click", () => {
        console.log("Save button clicked from global listener");
        this.saveLocationNote();
    });
    
    cancelBtn.addEventListener("click", () => {
        console.log("Cancel button clicked from global listener");
        this.cancelNote();
    });
  }
}