class FileExplorer {
    constructor(roomId) {
        this.roomId = roomId;
        this.fileList = document.getElementById('file-list');
        this.currentPath = '';
        this.initializeEventListeners();
        this.loadFiles();
    }

    async loadFiles() {
        try {
            const response = await fetch(`/api/files/list/?room_id=${this.roomId}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.renderFiles(data.files);
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Error loading files', 'error');
        }
    }

    renderFiles(files) {
        this.fileList.innerHTML = '';
        
        // Sort files: directories first, then files
        files.sort((a, b) => {
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
        });

        files.forEach(file => {
            const fileElement = this.createFileElement(file);
            this.fileList.appendChild(fileElement);
        });
    }

    createFileElement(file) {
        const element = document.createElement('div');
        element.className = `file-item${file.type === 'directory' ? ' folder' : ''}`;
        element.dataset.path = file.name;
        element.dataset.type = file.type;

        const icon = document.createElement('i');
        icon.className = `ri-${this.getFileIcon(file.type)}-line`;

        const name = document.createElement('span');
        name.textContent = file.name.split('/').pop();

        const actions = document.createElement('div');
        actions.className = 'file-actions';

        if (file.type !== 'directory') {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="ri-delete-bin-line"></i>';
            deleteBtn.title = 'Delete';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteFile(file.name);
            };
            actions.appendChild(deleteBtn);
        }

        element.appendChild(icon);
        element.appendChild(name);
        element.appendChild(actions);

        element.onclick = () => this.handleFileClick(file);
        element.oncontextmenu = (e) => this.showContextMenu(e, file);

        return element;
    }

    handleFileClick(file) {
        if (file.type === 'directory') {
            this.toggleFolder(file.name);
        } else {
            this.openFile(file);
        }
    }

    async openFile(file) {
        try {
            const response = await fetch(`/api/files/read/?room_id=${this.roomId}&filename=${file.name}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                // Update editor content
                window.editor.setValue(data.content);
                window.editor.setOption('mode', file.type);
                
                // Update active file
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('active');
                });
                document.querySelector(`[data-path="${file.name}"]`).classList.add('active');
                
                // Update tab
                this.updateEditorTab(file);
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Error opening file', 'error');
        }
    }

    async createNewFile() {
        const filename = prompt('Enter file name:');
        if (!filename) return;

        try {
            const response = await fetch('/api/files/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({
                    room_id: this.roomId,
                    filename: this.currentPath ? `${this.currentPath}/${filename}` : filename,
                    content: ''
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                await this.loadFiles();
                showNotification('File created successfully', 'success');
                
                // Create new tab and open file
                const fileType = this.getFileType(filename);
                this.createNewTab(filename, fileType);
                
                // Set up the editor
                window.editor.setValue('');
                window.editor.setOption('mode', fileType);
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Error creating file', 'error');
        }
    }

    async deleteFile(filename) {
        if (confirm(`Are you sure you want to delete ${filename}?`)) {
            try {
                const response = await fetch('/api/files/delete/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    },
                    body: JSON.stringify({
                        room_id: this.roomId,
                        filename: filename
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    await this.loadFiles();
                    showNotification('File deleted successfully', 'success');
                    
                    // Close tab if open
                    this.closeFileTab(filename);
                } else {
                    showNotification(data.message, 'error');
                }
            } catch (error) {
                showNotification('Error deleting file', 'error');
            }
        }
    }

    // Helper methods
    getFileIcon(type) {
        const icons = {
            'python': 'python',
            'javascript': 'javascript',
            'html': 'html5',
            'css': 'css3',
            'directory': 'folder'
        };
        return icons[type] || 'file';
    }

    getFileType(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const typeMap = {
            'py': 'python',
            'js': 'javascript',
            'html': 'html',
            'css': 'css'
        };
        return typeMap[extension] || 'text';
    }

    updateEditorTab(file) {
        const tabsContainer = document.querySelector('.editor-tabs');
        const existingTab = Array.from(tabsContainer.children)
            .find(tab => tab.querySelector('span').textContent === file.name);
        
        if (!existingTab) {
            this.createNewTab(file.name, file.type);
        } else {
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            existingTab.classList.add('active');
        }
    }

    createNewTab(filename, fileType) {
        const tabsContainer = document.querySelector('.editor-tabs');
        
        // Remove active class from existing tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Create new tab
        const newTab = document.createElement('div');
        newTab.className = 'tab active';
        newTab.innerHTML = `
            <i class="ri-${this.getFileIcon(fileType)}-line"></i>
            <span>${filename}</span>
            <button class="tab-close">
                <i class="ri-close-line"></i>
            </button>
        `;

        // Add close handler
        newTab.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeFileTab(filename);
        });

        tabsContainer.appendChild(newTab);
    }

    closeFileTab(filename) {
        const tab = Array.from(document.querySelectorAll('.tab'))
            .find(tab => tab.querySelector('span').textContent === filename);
        
        if (tab) {
            if (tab.classList.contains('active')) {
                const nextTab = tab.nextElementSibling || tab.previousElementSibling;
                if (nextTab) {
                    nextTab.classList.add('active');
                    const nextFilename = nextTab.querySelector('span').textContent;
                    const nextFileType = this.getFileType(nextFilename);
                    this.openFile({
                        name: nextFilename,
                        type: nextFileType
                    });
                }
            }
            tab.remove();
        }
    }

    initializeEventListeners() {
        // New file button
        const newFileBtn = document.querySelector('.new-file-btn');
        if (newFileBtn) {
            newFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.createNewFile();
            });
        }

        // Sidebar new file button
        const sidebarNewFileBtn = document.querySelector('.sidebar-btn[title="New File"]');
        if (sidebarNewFileBtn) {
            sidebarNewFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.createNewFile();
            });
        }
    }
}