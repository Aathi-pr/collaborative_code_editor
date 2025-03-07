class FileExplorer {
    constructor(editor) {
        this.editor = editor;
        this.container = document.getElementById('file-explorer');
        this.currentPath = '/';
        this.fileTree = new Map();
        this.setupEventListeners();
    }

    async loadFiles() {
        try {
            const response = await fetch(`/api/files/list/?room_id=${this.editor.roomId}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.fileTree = this.buildFileTree(data.files);
                this.renderFileTree();
            }
        } catch (error) {
            console.error('Error loading files:', error);
            this.editor.showNotification('Error loading files', 'error');
        }
    }

    buildFileTree(files) {
        const tree = new Map();
        
        files.forEach(file => {
            const parts = file.path.split('/');
            let currentLevel = tree;
            
            parts.forEach((part, index) => {
                if (!currentLevel.has(part)) {
                    currentLevel.set(part, {
                        type: index === parts.length - 1 ? 'file' : 'directory',
                        name: part,
                        path: parts.slice(0, index + 1).join('/'),
                        children: new Map()
                    });
                }
                currentLevel = currentLevel.get(part).children;
            });
        });

        return tree;
    }

    renderFileTree() {
        this.container.innerHTML = '';
        this.renderDirectory(this.fileTree, this.container, 0);
    }

    renderDirectory(directory, container, level) {
        directory.forEach((item, name) => {
            const itemElement = this.createFileElement(item, level);
            container.appendChild(itemElement);

            if (item.type === 'directory' && item.children.size > 0) {
                const childContainer = document.createElement('div');
                childContainer.className = 'directory-children';
                childContainer.style.display = 'none';
                container.appendChild(childContainer);
                this.renderDirectory(item.children, childContainer, level + 1);
            }
        });
    }

    createFileElement(item, level) {
        const element = document.createElement('div');
        element.className = `file-item ${item.type}`;
        element.dataset.path = item.path;
        element.style.paddingLeft = `${level * 20}px`;

        const icon = document.createElement('i');
        icon.className = this.getItemIcon(item);
        
        const name = document.createElement('span');
        name.textContent = item.name;
        
        element.appendChild(icon);
        element.appendChild(name);

        if (item.type === 'directory') {
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDirectory(element);
            });
        } else {
            element.addEventListener('click', () => this.openFile(item.path));
        }

        // Context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, item);
        });

        return element;
    }

    getItemIcon(item) {
        if (item.type === 'directory') {
            return 'ri-folder-line';
        }

        const extension = item.name.split('.').pop().toLowerCase();
        const iconMap = {
            'py': 'ri-python-line',
            'js': 'ri-javascript-line',
            'html': 'ri-html5-line',
            'css': 'ri-css3-line',
            'java': 'ri-code-line',
            'cpp': 'ri-code-line',
            'php': 'ri-code-line'
        };

        return iconMap[extension] || 'ri-file-code-line';
    }

    toggleDirectory(element) {
        const children = element.nextElementSibling;
        const icon = element.querySelector('i');
        
        if (children && children.className === 'directory-children') {
            const isExpanded = children.style.display !== 'none';
            children.style.display = isExpanded ? 'none' : 'block';
            icon.className = isExpanded ? 'ri-folder-line' : 'ri-folder-open-line';
        }
    }

    async openFile(path) {
        try {
            const response = await fetch(`/api/files/read/?room_id=${this.editor.roomId}&path=${path}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.editor.currentFile = {
                    path: path,
                    language: data.language,
                    name: path.split('/').pop()
                };

                this.editor.editor.setValue(data.content);
                this.editor.setLanguage(data.language);
                this.updateActiveFile(path);
                this.addFileTab(path);
            }
        } catch (error) {
            console.error('Error opening file:', error);
            this.editor.showNotification('Error opening file', 'error');
        }
    }

    updateActiveFile(path) {
        this.container.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.path === path) {
                item.classList.add('active');
            }
        });
    }

    addFileTab(path) {
        const tabList = document.getElementById('tab-list');
        const fileName = path.split('/').pop();
        
        // Check if tab already exists
        const existingTab = tabList.querySelector(`[data-path="${path}"]`);
        if (existingTab) {
            this.activateTab(existingTab);
            return;
        }

        const tab = document.createElement('div');
        tab.className = 'editor-tab';
        tab.dataset.path = path;
        
        tab.innerHTML = `
            <i class="${this.getItemIcon({ name: fileName, type: 'file' })}"></i>
            <span>${fileName}</span>
            <button class="tab-close">×</button>
        `;

        tab.addEventListener('click', () => this.activateTab(tab));
        tab.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tab);
        });

        tabList.appendChild(tab);
        this.activateTab(tab);
    }

    activateTab(tab) {
        document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.openFile(tab.dataset.path);
    }

    closeTab(tab) {
        const nextTab = tab.nextElementSibling || tab.previousElementSibling;
        tab.remove();
        
        if (nextTab) {
            this.activateTab(nextTab);
        }
    }

    showContextMenu(event, item) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        
        const options = this.getContextMenuOptions(item);
        
        options.forEach(option => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.innerHTML = `
                <i class="${option.icon}"></i>
                <span>${option.label}</span>
            `;
            menuItem.addEventListener('click', () => {
                option.action();
                menu.remove();
            });
            menu.appendChild(menuItem);
        });

        // Position menu
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        
        // Add to body and handle click outside
        document.body.appendChild(menu);
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 0);
    }

    getContextMenuOptions(item) {
        const baseOptions = [
            {
                label: 'Rename',
                icon: 'ri-edit-line',
                action: () => this.renameItem(item)
            },
            {
                label: 'Delete',
                icon: 'ri-delete-bin-line',
                action: () => this.deleteItem(item)
            }
        ];

        if (item.type === 'directory') {
            return [
                {
                    label: 'New File',
                    icon: 'ri-file-add-line',
                    action: () => this.createNewFile(item.path)
                },
                {
                    label: 'New Folder',
                    icon: 'ri-folder-add-line',
                    action: () => this.createNewFolder(item.path)
                },
                ...baseOptions
            ];
        }

        return baseOptions;
    }

    async createNewFile(parentPath = '') {
        const fileName = prompt('Enter file name:');
        if (!fileName) return;

        try {
            const response = await fetch('/api/files/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId,
                    path: parentPath ? `${parentPath}/${fileName}` : fileName,
                    content: ''
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                await this.loadFiles();
                this.openFile(data.path);
            }
        } catch (error) {
            console.error('Error creating file:', error);
            this.editor.showNotification('Error creating file', 'error');
        }
    }

    async createNewFolder(parentPath = '') {
        const folderName = prompt('Enter folder name:');
        if (!folderName) return;

        try {
            const response = await fetch('/api/files/create-directory/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId,
                    path: parentPath ? `${parentPath}/${folderName}` : folderName
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                await this.loadFiles();
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            this.editor.showNotification('Error creating folder', 'error');
        }
    }

    async renameItem(item) {
        const newName = prompt('Enter new name:', item.name);
        if (!newName || newName === item.name) return;

        try {
            const response = await fetch('/api/files/rename/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId,
                    old_path: item.path,
                    new_name: newName
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                await this.loadFiles();
            }
        } catch (error) {
            console.error('Error renaming item:', error);
            this.editor.showNotification('Error renaming item', 'error');
        }
    }

    async deleteItem(item) {
        if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;

        try {
            const response = await fetch('/api/files/delete/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId,
                    path: item.path
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                await this.loadFiles();
                if (this.editor.currentFile?.path === item.path) {
                    this.closeTab(document.querySelector(`[data-path="${item.path}"]`));
                }
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            this.editor.showNotification('Error deleting item', 'error');
        }
    }

    setupEventListeners() {
        // New file button
        document.getElementById('new-file-sidebar-btn').addEventListener('click', () => {
            this.createNewFile();
        });

        // Handle drag and drop
        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleFileDrop(e.dataTransfer.files);
        });
    }

    async handleFileDrop(files) {
        for (const file of files) {
            try {
                const content = await this.readFile(file);
                await this.createNewFile(this.currentPath, file.name, content);
            } catch (error) {
                console.error('Error uploading file:', error);
                this.editor.showNotification(`Error uploading ${file.name}`, 'error');
            }
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
}