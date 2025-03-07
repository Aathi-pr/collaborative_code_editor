class Editor {
    constructor(config) {
        this.roomId = config.roomId;
        this.user = config.user;
        this.editor = null;
        this.fileManager = null;
        this.terminal = null;
        this.debugger = null;
        this.git = null;
        this.settings = null;
        this.theme = null;
        this.currentFile = null;
        this.files = new Map();
        this.isAutosaving = false;
        this.changeTimeout = null;
    }

    async initialize() {
        // Initialize CodeMirror
        this.editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
            mode: 'python',
            theme: 'github-dark',
            lineNumbers: true,
            autoCloseBrackets: true,
            autoCloseTags: true,
            foldGutter: true,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter', 'breakpoints'],
            matchBrackets: true,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true,
            extraKeys: {
                'Ctrl-S': () => this.saveCurrentFile(),
                'Cmd-S': () => this.saveCurrentFile(),
                'Ctrl-B': () => this.runCode(),
                'Cmd-B': () => this.runCode(),
                'Ctrl-Space': 'autocomplete',
                'F5': () => this.debugger.startDebugging(),
                'F9': () => this.debugger.toggleBreakpoint()
            }
        });

        // Initialize components
        this.fileManager = new FileExplorer(this);
        this.terminal = new Terminal(this);
        this.debugger = new Debugger(this);
        this.git = new Git(this);
        this.settings = new Settings(this);
        this.theme = new Theme(this);

        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial state
        await this.loadInitialState();
        
        // Setup autosave
        this.setupAutosave();
    }

    async loadInitialState() {
        try {
            // Load files
            await this.fileManager.loadFiles();
            
            // Load settings
            await this.settings.loadSettings();
            
            // Load git status if available
            await this.git.loadStatus();
            
            // Apply theme
            this.theme.apply();
            
        } catch (error) {
            console.error('Error loading initial state:', error);
            this.showNotification('Error loading workspace', 'error');
        }
    }

    setupEventListeners() {
        // Language selection
        document.getElementById('language-select').addEventListener('change', (e) => {
            this.setLanguage(e.target.value);
        });

        // Run button
        document.getElementById('run-code').addEventListener('click', () => this.runCode());

        // Activity bar buttons
        document.querySelectorAll('.activity-button').forEach(button => {
            button.addEventListener('click', () => this.togglePanel(button.dataset.panel));
        });

        // Panel tabs
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchPanel(tab.dataset.panel));
        });

        // Editor changes
        this.editor.on('change', (cm, change) => {
            if (change.origin !== 'setValue') {
                this.handleEditorChange(change);
            }
        });

        // Breakpoint handling
        this.editor.on('gutterClick', (cm, line, gutter) => {
            if (gutter === 'breakpoints') {
                this.debugger.toggleBreakpoint(line);
            }
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.theme.toggle();
        });
    }

    async runCode() {
        if (!this.currentFile) {
            this.showNotification('No file is currently open', 'warning');
            return;
        }

        const outputPanel = document.getElementById('output');
        outputPanel.innerHTML = '<div class="loading">Running code...</div>';

        try {
            const response = await fetch('/api/execute-code/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    code: this.editor.getValue(),
                    language: this.currentFile.language,
                    file_path: this.currentFile.path,
                    room_id: this.roomId
                })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                outputPanel.innerHTML = `
                    <div class="output-header">
                        <span class="output-status success">
                            <i class="ri-check-line"></i> Execution successful
                        </span>
                        <span class="output-time">${result.execution_time}ms</span>
                    </div>
                    <pre class="output-content">${result.output}</pre>
                `;
            } else {
                outputPanel.innerHTML = `
                    <div class="output-header">
                        <span class="output-status error">
                            <i class="ri-error-warning-line"></i> Execution failed
                        </span>
                    </div>
                    <pre class="output-content error">${result.error}</pre>
                `;
            }
        } catch (error) {
            outputPanel.innerHTML = `
                <div class="output-header">
                    <span class="output-status error">
                        <i class="ri-error-warning-line"></i> System Error
                    </span>
                </div>
                <pre class="output-content error">${error.message}</pre>
            `;
        }
    }

    async saveCurrentFile() {
        if (!this.currentFile) return;

        try {
            const content = this.editor.getValue();
            await this.fileManager.saveFile(this.currentFile.path, content);
            this.showNotification('File saved successfully');
            
            // Update git status if available
            await this.git.updateStatus();
        } catch (error) {
            this.showNotification('Error saving file', 'error');
        }
    }

    setLanguage(language) {
        const modeMap = {
            'python': 'python',
            'javascript': 'javascript',
            'java': 'text/x-java',
            'cpp': 'text/x-c++src',
            'html': 'xml',
            'css': 'css',
            'php': 'php'
        };

        this.editor.setOption('mode', modeMap[language] || 'text/plain');
        if (this.currentFile) {
            this.currentFile.language = language;
        }
    }

    togglePanel(panelId) {
        const panels = document.querySelectorAll('.sidebar-panel');
        const buttons = document.querySelectorAll('.activity-button');

        panels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `${panelId}-panel`) {
                panel.classList.toggle('active');
            }
        });

        buttons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.panel === panelId) {
                button.classList.toggle('active');
            }
        });
    }

    switchPanel(panelId) {
        const panels = document.querySelectorAll('.panel');
        const tabs = document.querySelectorAll('.panel-tab');

        panels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `${panelId}-panel`) {
                panel.classList.add('active');
            }
        });

        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.panel === panelId) {
                tab.classList.add('active');
            }
        });
    }

    handleEditorChange(change) {
        // Update linting
        this.updateLinting();
        
        // Schedule autosave
        if (this.isAutosaving) {
            clearTimeout(this.changeTimeout);
            this.changeTimeout = setTimeout(() => this.saveCurrentFile(), 1000);
        }
    }

    updateLinting() {
        const content = this.editor.getValue();
        const language = this.currentFile?.language || 'python';

        // Clear existing markers
        this.editor.clearGutter('CodeMirror-lint-markers');

        // Send code for linting
        fetch('/api/lint-code/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken()
            },
            body: JSON.stringify({ code: content, language })
        })
        .then(response => response.json())
        .then(data => {
            if (data.issues) {
                this.displayLintingIssues(data.issues);
            }
        })
        .catch(error => console.error('Linting error:', error));
    }

    displayLintingIssues(issues) {
        const problemsList = document.getElementById('problems-list');
        problemsList.innerHTML = '';

        issues.forEach(issue => {
            // Add gutter marker
            const marker = document.createElement('div');
            marker.className = `lint-marker ${issue.severity}`;
            marker.innerHTML = '<i class="ri-error-warning-line"></i>';
            this.editor.setGutterMarker(issue.line - 1, 'CodeMirror-lint-markers', marker);

            // Add to problems list
            const problemItem = document.createElement('div');
            problemItem.className = `problem-item ${issue.severity}`;
            problemItem.innerHTML = `
                <div class="problem-header">
                    <i class="ri-error-warning-line"></i>
                    <span class="problem-message">${issue.message}</span>
                </div>
                <div class="problem-location">
                    Line ${issue.line}, Column ${issue.column}
                </div>
            `;
            problemsList.appendChild(problemItem);
        });
    }

    setupAutosave() {
        this.isAutosaving = true;
        this.editor.on('change', () => {
            if (this.isAutosaving && this.currentFile) {
                clearTimeout(this.changeTimeout);
                this.changeTimeout = setTimeout(() => this.saveCurrentFile(), 1000);
            }
        });
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="ri-${type === 'success' ? 'check' : 'error-warning'}-line"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }
}