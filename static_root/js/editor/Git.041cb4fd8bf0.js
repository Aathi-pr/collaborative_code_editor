class Git {
    constructor(editor) {
        this.editor = editor;
        this.container = document.getElementById('git-panel');
        this.changesContainer = document.getElementById('git-changes');
        this.isInitialized = false;
        this.changes = new Map();
        this.branch = '';
        this.initialize();
    }

    async initialize() {
        await this.checkGitStatus();
        this.setupEventListeners();
        this.startStatusPolling();
    }

    async checkGitStatus() {
        try {
            const response = await fetch(`/api/git/status/?room_id=${this.editor.roomId}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.isInitialized = data.initialized;
                if (this.isInitialized) {
                    this.branch = data.branch;
                    this.updateChanges(data.changes);
                }
                this.updateUI();
            }
        } catch (error) {
            console.error('Git status error:', error);
        }
    }

    updateChanges(changes) {
        this.changes.clear();
        changes.forEach(change => {
            this.changes.set(change.file, change);
        });
        this.renderChanges();
    }

    renderChanges() {
        if (!this.changesContainer) return;

        this.changesContainer.innerHTML = '';
        
        if (this.changes.size === 0) {
            this.changesContainer.innerHTML = `
                <div class="git-empty-state">
                    <i class="ri-git-commit-line"></i>
                    <p>No changes detected</p>
                </div>
            `;
            return;
        }

        const stagedGroup = document.createElement('div');
        stagedGroup.className = 'changes-group';
        stagedGroup.innerHTML = '<h3>Staged Changes</h3>';

        const unstagedGroup = document.createElement('div');
        unstagedGroup.className = 'changes-group';
        unstagedGroup.innerHTML = '<h3>Changes</h3>';

        this.changes.forEach((change, file) => {
            const changeElement = this.createChangeElement(file, change);
            if (change.staged) {
                stagedGroup.appendChild(changeElement);
            } else {
                unstagedGroup.appendChild(changeElement);
            }
        });

        if (stagedGroup.children.length > 1) { // > 1 because of the h3
            this.changesContainer.appendChild(stagedGroup);
        }
        if (unstagedGroup.children.length > 1) {
            this.changesContainer.appendChild(unstagedGroup);
        }
    }

    createChangeElement(file, change) {
        const element = document.createElement('div');
        element.className = 'git-change';
        
        element.innerHTML = `
            <div class="change-header">
                <i class="ri-${this.getChangeIcon(change.status)}"></i>
                <span class="change-file">${file}</span>
            </div>
            <div class="change-actions">
                ${change.staged ? `
                    <button class="action-btn unstage" title="Unstage changes">
                        <i class="ri-subtract-line"></i>
                    </button>
                ` : `
                    <button class="action-btn stage" title="Stage changes">
                        <i class="ri-add-line"></i>
                    </button>
                `}
                <button class="action-btn discard" title="Discard changes">
                    <i class="ri-arrow-go-back-line"></i>
                </button>
            </div>
        `;

        // Add click handlers
        element.querySelector('.change-file').addEventListener('click', () => {
            this.showDiff(file);
        });

        const stageBtn = element.querySelector('.stage');
        if (stageBtn) {
            stageBtn.addEventListener('click', () => this.stageFile(file));
        }

        const unstageBtn = element.querySelector('.unstage');
        if (unstageBtn) {
            unstageBtn.addEventListener('click', () => this.unstageFile(file));
        }

        element.querySelector('.discard').addEventListener('click', () => {
            this.discardChanges(file);
        });

        return element;
    }

    getChangeIcon(status) {
        const icons = {
            'modified': 'file-edit-line',
            'added': 'file-add-line',
            'deleted': 'file-reduce-line',
            'renamed': 'file-transfer-line',
            'untracked': 'file-line'
        };
        return icons[status] || 'file-line';
    }

    async showDiff(file) {
        try {
            const response = await fetch(`/api/git/diff/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId,
                    file: file
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                this.showDiffModal(file, data.diff);
            }
        } catch (error) {
            console.error('Diff error:', error);
            this.editor.showNotification('Error showing diff', 'error');
        }
    }

    showDiffModal(file, diff) {
        const modal = document.createElement('div');
        modal.className = 'modal diff-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Changes in ${file}</h2>
                    <button class="close-button">×</button>
                </div>
                <div class="modal-body">
                    <pre class="diff-content">${diff}</pre>
                </div>
            </div>
        `;

        modal.querySelector('.close-button').addEventListener('click', () => {
            modal.remove();
        });

        document.body.appendChild(modal);
    }

    async stageFile(file) {
        try {
            const response = await fetch('/api/git/stage/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId,
                    file: file
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                await this.checkGitStatus();
            }
        } catch (error) {
            console.error('Stage error:', error);
            this.editor.showNotification('Error staging file', 'error');
        }
    }

    async unstageFile(file) {
        try {
            const response = await fetch('/api/git/unstage/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId,
                    file: file
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                await this.checkGitStatus();
            }
        } catch (error) {
            console.error('Unstage error:', error);
            this.editor.showNotification('Error unstaging file', 'error');
        }
    }

    async discardChanges(file) {
        if (!confirm(`Are you sure you want to discard changes in ${file}?`)) {
            return;
        }

        try {
            const response = await fetch('/api/git/discard/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId,
                    file: file
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                await this.checkGitStatus();
                this.editor.showNotification('Changes discarded');
            }
        } catch (error) {
            console.error('Discard error:', error);
            this.editor.showNotification('Error discarding changes', 'error');
        }
    }

    async commit(message) {
        if (!message.trim()) {
            this.editor.showNotification('Please enter a commit message', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/git/commit/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId,
                    message: message
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                await this.checkGitStatus();
                this.editor.showNotification('Changes committed successfully');
            }
        } catch (error) {
            console.error('Commit error:', error);
            this.editor.showNotification('Error committing changes', 'error');
        }
    }

    async push() {
        try {
            const response = await fetch('/api/git/push/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                this.editor.showNotification('Changes pushed successfully');
            }
        } catch (error) {
            console.error('Push error:', error);
            this.editor.showNotification('Error pushing changes', 'error');
        }
    }

    async pull() {
        try {
            const response = await fetch('/api/git/pull/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                await this.checkGitStatus();
                this.editor.showNotification('Changes pulled successfully');
            }
        } catch (error) {
            console.error('Pull error:', error);
            this.editor.showNotification('Error pulling changes', 'error');
        }
    }

    updateUI() {
        if (!this.container) return;

        const header = this.container.querySelector('.panel-header');
        if (header) {
            header.innerHTML = `
                <h2>SOURCE CONTROL ${this.branch ? `(${this.branch})` : ''}</h2>
                <div class="panel-actions">
                    ${this.isInitialized ? `
                        <button class="action-button" id="git-refresh" title="Refresh">
                            <i class="ri-refresh-line"></i>
                        </button>
                        <button class="action-button" id="git-commit" title="Commit">
                            <i class="ri-git-commit-line"></i>
                        </button>
                        <button class="action-button" id="git-push" title="Push">
                            <i class="ri-upload-2-line"></i>
                        </button>
                        <button class="action-button" id="git-pull" title="Pull">
                            <i class="ri-download-2-line"></i>
                        </button>
                    ` : `
                        <button class="action-button" id="git-init" title="Initialize Git">
                            <i class="ri-git-repository-line"></i>
                        </button>
                    `}
                </div>
            `;
        }
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('git-refresh')?.addEventListener('click', () => {
            this.checkGitStatus();
        });

        // Commit button
        document.getElementById('git-commit')?.addEventListener('click', () => {
            this.showCommitDialog();
        });

        // Push button
        document.getElementById('git-push')?.addEventListener('click', () => {
            this.push();
        });

        // Pull button
        document.getElementById('git-pull')?.addEventListener('click', () => {
            this.pull();
        });

        // Initialize button
        document.getElementById('git-init')?.addEventListener('click', () => {
            this.initializeRepository();
        });
    }

    showCommitDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'modal';
        
        dialog.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Commit Changes</h2>
                    <button class="close-button">×</button>
                </div>
                <div class="modal-body">
                    <textarea 
                        id="commit-message" 
                        placeholder="Enter commit message..."
                        rows="4"
                    ></textarea>
                    <div class="modal-actions">
                        <button class="btn primary" id="commit-submit">Commit</button>
                        <button class="btn" id="commit-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.querySelector('.close-button').addEventListener('click', () => {
            dialog.remove();
        });

        dialog.querySelector('#commit-cancel').addEventListener('click', () => {
            dialog.remove();
        });

        dialog.querySelector('#commit-submit').addEventListener('click', () => {
            const message = dialog.querySelector('#commit-message').value;
            this.commit(message);
            dialog.remove();
        });
    }

    async initializeRepository() {
        try {
            const response = await fetch('/api/git/init/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                this.isInitialized = true;
                await this.checkGitStatus();
                this.editor.showNotification('Git repository initialized');
            }
        } catch (error) {
            console.error('Git init error:', error);
            this.editor.showNotification('Error initializing repository', 'error');
        }
    }

    startStatusPolling() {
        setInterval(() => {
            if (this.isInitialized) {
                this.checkGitStatus();
            }
        }, 30000); // Poll every 30 seconds
    }
}