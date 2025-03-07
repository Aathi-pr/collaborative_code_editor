// Initialize CodeMirror with advanced configuration
document.addEventListener('DOMContentLoaded', function() {
    // Theme configuration
    const themes = {
        dark: 'github-dark',
        light: 'default'
    };

    // Language modes configuration
    const languageModes = {
        python: {
            name: 'python',
            indent: 4,
            extraKeys: {
                'Ctrl-Space': 'autocomplete',
                'Tab': 'indentMore',
                'Shift-Tab': 'indentLess'
            }
        },
        javascript: {
            name: 'javascript',
            json: true,
            indent: 2
        },
        html: {
            name: 'xml',
            htmlMode: true
        },
        css: 'css'
    };

    // Initialize CodeMirror
    const editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
        mode: "python",
        theme: themes.dark,
        lineNumbers: true,
        lineWrapping: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        matchTags: true,
        autoCloseTags: true,
        foldGutter: true,
        styleActiveLine: true,
        styleActiveSelection: true,
        gutters: [
            "CodeMirror-linenumbers",
            "CodeMirror-foldgutter",
            "CodeMirror-lint-markers",
            "breakpoints"
        ],
        extraKeys: {
            "Ctrl-Space": "autocomplete",
            "Ctrl-/": "toggleComment",
            "Ctrl-F": "findPersistent",
            "Ctrl-H": "replace",
            "Alt-F": "findNext",
            "Shift-Alt-F": "findPrev",
            "Ctrl-G": "jumpToLine",
            "F11": function(cm) {
                cm.setOption("fullScreen", !cm.getOption("fullScreen"));
            },
            "Esc": function(cm) {
                if (cm.getOption("fullScreen")) cm.setOption("fullScreen", false);
            }
        },
        lint: true,
        hintOptions: {
            completeSingle: false,
            closeOnUnfocus: false,
            alignWithWord: true,
            async: true
        },
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        showCursorWhenSelecting: true,
        cursorBlinkRate: 530,
        cursorHeight: 0.85,
        electricChars: true,
        dragDrop: true,
        viewportMargin: Infinity
    });

    // Add custom keymaps
    editor.setOption("keymap", "sublime");
    
    // Initialize features
    initializeFeatures(editor);
});

function initializeFeatures(editor) {
    // Minimap
    const minimapElement = document.querySelector('.editor-minimap');
    let minimapContent = '';
    
    editor.on('change', function() {
        updateMinimap(editor, minimapElement);
    });

    // Breakpoints
    editor.on("gutterClick", function(cm, n) {
        let info = cm.lineInfo(n);
        cm.setGutterMarker(n, "breakpoints", info.gutterMarkers ? null : makeMarker());
    });

    // Error checking
    editor.on("change", function(cm, change) {
        checkErrors(cm);
    });

    // Auto-save
    let saveTimeout;
    editor.on("change", function(cm, change) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(function() {
            saveCode(cm.getValue());
        }, 1000);
    });

    // Code folding
    editor.on("fold", function(cm, from, to) {
        updateMinimap(editor, minimapElement);
    });

    // Search and Replace
    initializeSearchFeature(editor);
}

// Helper Functions
function updateMinimap(editor, minimapElement) {
    const content = editor.getValue();
    const lines = content.split('\n');
    const minimapContent = lines.map(line => {
        return `<div class="minimap-line">${line}</div>`;
    }).join('');
    minimapElement.innerHTML = minimapContent;
}

function makeMarker() {
    const marker = document.createElement("div");
    marker.className = "breakpoint-marker";
    marker.innerHTML = "●";
    return marker;
}

function checkErrors(cm) {
    // Implement error checking logic
    const content = cm.getValue();
    // Add your error checking logic here
}

function initializeSearchFeature(editor) {
    // Implement search feature
    CodeMirror.commands.search = function(cm) {
        // Add your search implementation
    };
}

// Code execution
async function executeCode(code, language) {
    try {
        const response = await fetch('{% url "execute_code" %}', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': '{{ csrf_token }}'
            },
            body: `code=${encodeURIComponent(code)}&language=${language}`
        });
        
        return await response.json();
    } catch (error) {
        console.error('Error executing code:', error);
        return { error: 'Failed to execute code' };
    }
}

class IDEPanels {
    constructor() {
        this.initializePanels();
        this.initializeTerminal();
        this.initializeDebugger();
        this.initializeResizer();
        this.setupEventListeners();
        this.outputBuffer = [];
        this.commandHistory = [];
        this.historyIndex = -1;
    }

    initializePanels() {
        // Panel management
        this.bottomPanel = document.querySelector('.bottom-panel');
        this.panelTabs = document.querySelectorAll('.panel-tab');
        this.panels = document.querySelectorAll('.panel');
        this.outputPanel = document.getElementById('output');
        this.terminalContent = document.getElementById('terminal');
        this.problemsList = document.querySelector('.problems-list');
    }

    setupEventListeners() {
        // Panel tab switching
        this.panelTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchPanel(tab.dataset.panel));
        });

        // Output controls
        document.getElementById('clear-output').addEventListener('click', () => this.clearOutput());
        document.getElementById('copy-output').addEventListener('click', () => this.copyOutput());

        // Terminal input handling
        this.terminalContent.addEventListener('keydown', (e) => this.handleTerminalInput(e));

        // Problem filters
        document.querySelectorAll('.problem-filter').forEach(filter => {
            filter.addEventListener('click', () => this.filterProblems(filter.dataset.type));
        });

        // Debug controls
        document.getElementById('start-debug').addEventListener('click', () => this.startDebugging());
    }

    // Panel Management
    switchPanel(panelId) {
        this.panels.forEach(panel => panel.classList.remove('active'));
        this.panelTabs.forEach(tab => tab.classList.remove('active'));
        
        document.getElementById(`${panelId}-panel`).classList.add('active');
        document.querySelector(`[data-panel="${panelId}"]`).classList.add('active');
    }

    // Output Management
    appendOutput(content, type = 'info') {
        const outputLine = document.createElement('div');
        outputLine.className = `output-line ${type}`;
        outputLine.textContent = content;
        this.outputPanel.appendChild(outputLine);
        this.outputPanel.scrollTop = this.outputPanel.scrollHeight;
    }

    clearOutput() {
        this.outputPanel.innerHTML = `
            <div class="output-placeholder">
                <i class="ri-code-line"></i>
                <p>Run your code to see the output here</p>
            </div>
        `;
    }

    copyOutput() {
        const output = Array.from(this.outputPanel.querySelectorAll('.output-line'))
            .map(line => line.textContent)
            .join('\n');
        navigator.clipboard.writeText(output)
            .then(() => this.showNotification('Output copied to clipboard'))
            .catch(err => this.showNotification('Failed to copy output', 'error'));
    }

    // Terminal Emulation
    initializeTerminal() {
        this.currentCommand = '';
        this.commandHistory = [];
        this.historyIndex = -1;
        this.addNewCommandLine();
    }

    addNewCommandLine() {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `
            <span class="prompt">$</span>
            <span class="command-input" contenteditable="true"></span>
        `;
        this.terminalContent.appendChild(line);
        line.querySelector('.command-input').focus();
    }

    handleTerminalInput(e) {
        const input = e.target;
        
        if (e.key === 'Enter') {
            e.preventDefault();
            const command = input.textContent.trim();
            if (command) {
                this.executeCommand(command);
                this.commandHistory.push(command);
                this.historyIndex = this.commandHistory.length;
            }
            this.addNewCommandLine();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateHistory('up');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateHistory('down');
        }
    }

    async executeCommand(command) {
        try {
            const response = await fetch('/execute-terminal/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({ command })
            });
            
            const result = await response.json();
            this.appendTerminalOutput(result.output);
        } catch (error) {
            this.appendTerminalOutput(`Error: ${error.message}`, 'error');
        }
    }

    // Debug Functionality
    initializeDebugger() {
        this.debugState = {
            isActive: false,
            breakpoints: new Set(),
            variables: new Map(),
            callStack: []
        };
    }

    async startDebugging() {
        if (this.debugState.isActive) return;

        this.debugState.isActive = true;
        document.getElementById('start-debug').disabled = true;
        
        try {
            const code = editor.getValue();
            const response = await fetch('/debug/start/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({ code })
            });
            
            const debugInfo = await response.json();
            this.updateDebugInfo(debugInfo);
        } catch (error) {
            this.showNotification('Failed to start debugging', 'error');
        }
    }

    updateDebugInfo(info) {
        this.updateVariables(info.variables);
        this.updateCallStack(info.callStack);
        this.highlightCurrentLine(info.currentLine);
    }

    // Problem Detection
    addProblem(problem) {
        const problemElement = document.createElement('div');
        problemElement.className = `problem-item ${problem.type}`;
        problemElement.innerHTML = `
            <div class="problem-icon">
                <i class="ri-${problem.type === 'error' ? 'error-warning' : 'alert'}-line"></i>
            </div>
            <div class="problem-details">
                <div class="problem-message">${problem.message}</div>
                <div class="problem-location">Line ${problem.line}, Column ${problem.column}</div>
            </div>
        `;
        this.problemsList.appendChild(problemElement);
        this.updateProblemCount();
    }

    // Panel Resizing
    initializeResizer() {
        const resizer = document.querySelector('.panel-resizer');
        let startY, startHeight;

        const startResize = (e) => {
            startY = e.clientY;
            startHeight = parseInt(getComputedStyle(this.bottomPanel).height, 10);
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
        };

        const resize = (e) => {
            const diff = startY - e.clientY;
            this.bottomPanel.style.height = `${startHeight + diff}px`;
        };

        const stopResize = () => {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        };

        resizer.addEventListener('mousedown', startResize);
    }

    // Utility Functions
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        }, 100);
    }

    updateProblemCount() {
        const counts = {
            all: this.problemsList.children.length,
            errors: this.problemsList.querySelectorAll('.error').length,
            warnings: this.problemsList.querySelectorAll('.warning').length
        };

        Object.entries(counts).forEach(([type, count]) => {
            document.querySelector(`[data-type="${type}"] .count`).textContent = count;
        });
    }
}

// Initialize panels when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.idePanels = new IDEPanels();
});

class CollaborationManager {
    constructor(editor, roomId) {
        this.editor = editor;
        this.roomId = roomId;
        this.cursors = new Map();
        this.initializeWebSocket();
        this.setupEditorEvents();
    }

    initializeWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.socket = new WebSocket(
            `${protocol}//${window.location.host}/ws/code/${this.roomId}/`
        );

        this.socket.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
        this.socket.onclose = () => this.handleDisconnect();
        this.socket.onopen = () => this.handleConnect();
    }

    setupEditorEvents() {
        // Handle cursor movements
        this.editor.on('cursorActivity', () => {
            const position = this.editor.getCursor();
            const selection = this.editor.getSelection();
            
            this.sendCursorUpdate(position, selection);
        });

        // Handle content changes
        let changeTimeout;
        this.editor.on('change', (cm, change) => {
            if (change.origin !== 'setValue' && change.origin !== 'remote') {
                clearTimeout(changeTimeout);
                changeTimeout = setTimeout(() => {
                    this.sendCodeUpdate(cm.getValue());
                }, 100);
            }
        });
    }

    handleMessage(data) {
        switch (data.type) {
            case 'code_update':
                this.handleCodeUpdate(data);
                break;
            case 'cursor_update':
                this.handleCursorUpdate(data);
                break;
            case 'room_state':
                this.handleRoomState(data.state);
                break;
            case 'user_joined':
                this.handleUserJoined(data.user);
                break;
            case 'user_left':
                this.handleUserLeft(data.user);
                break;
        }
    }

    handleCodeUpdate(data) {
        if (data.user !== currentUser) {
            const cursor = this.editor.getCursor();
            this.editor.setValue(data.code);
            this.editor.setCursor(cursor);
        }
    }

    handleCursorUpdate(data) {
        if (data.user !== currentUser) {
            this.updateRemoteCursor(data.user, data.position, data.selection);
        }
    }

    updateRemoteCursor(user, position, selection) {
        let cursorElement = this.cursors.get(user);
        
        if (!cursorElement) {
            cursorElement = this.createCursorElement(user);
            this.cursors.set(user, cursorElement);
        }

        const coords = this.editor.cursorCoords(position, 'local');
        cursorElement.style.left = `${coords.left}px`;
        cursorElement.style.top = `${coords.top}px`;

        if (selection) {
            this.updateSelection(user, selection);
        }
    }

    createCursorElement(user) {
        const cursor = document.createElement('div');
        cursor.className = 'remote-cursor';
        cursor.innerHTML = `
            <div class="cursor-flag">
                <span>${user}</span>
            </div>
            <div class="cursor-caret"></div>
        `;
        this.editor.getWrapperElement().appendChild(cursor);
        return cursor;
    }

    updateSelection(user, selection) {
        // Implementation for showing remote user's selection
    }

    sendCodeUpdate(code) {
        this.socket.send(JSON.stringify({
            action: 'code_update',
            code: code,
            language: this.editor.getOption('mode')
        }));
    }

    sendCursorUpdate(position, selection) {
        this.socket.send(JSON.stringify({
            action: 'cursor_update',
            position: {
                line: position.line,
                ch: position.ch
            },
            selection: selection
        }));
    }

    handleConnect() {
        console.log('Connected to collaboration server');
        this.showNotification('Connected to room', 'success');
    }

    handleDisconnect() {
        console.log('Disconnected from collaboration server');
        this.showNotification('Connection lost. Trying to reconnect...', 'error');
        setTimeout(() => this.initializeWebSocket(), 3000);
    }

    handleRoomState(state) {
        if (state.code) {
            this.editor.setValue(state.code);
        }
        this.editor.setOption('mode', state.language);
        this.updateUserList(state.users);
    }

    updateUserList(users) {
        const userList = document.getElementById('user-list');
        userList.innerHTML = users.map(user => `
            <div class="user-item">
                <span class="user-status"></span>
                <span class="user-name">${user.username}</span>
            </div>
        `).join('');
    }

    showNotification(message, type = 'info') {
        // Implementation from previous notification system
    }
}

// Initialize collaboration when document is ready
document.addEventListener('DOMContentLoaded', () => {
    const roomId = document.getElementById('room-id').textContent;
    window.collaboration = new CollaborationManager(editor, roomId);
});

class PreferencesManager {
    constructor() {
        this.defaultPreferences = {
            theme: 'vs-dark',
            fontSize: 14,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'on',
            minimap: true,
            autoSave: true,
            formatOnSave: true,
            lineNumbers: true,
            rulers: [80, 120],
            matchBrackets: true,
            autoClosingBrackets: true,
            autoClosingQuotes: true,
            autoSurround: true,
            cursorStyle: 'line',
            cursorBlinking: 'blink',
            mouseWheelZoom: true,
            smoothScrolling: true,
            colorDecorators: true,
            codeLens: true,
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            matchOnWordHighlight: true,
            occurrencesHighlight: true,
            renderControlCharacters: false,
            renderIndentGuides: true,
            renderLineHighlight: 'all',
            renderWhitespace: 'none',
            snippetSuggestions: 'inline',
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            acceptSuggestionOnCommitCharacter: true,
            wordBasedSuggestions: true,
            quickSuggestions: {
                other: true,
                comments: false,
                strings: false
            }
        };
        
        this.preferences = this.loadPreferences();
        this.applyPreferences();
    }

    loadPreferences() {
        const savedPrefs = localStorage.getItem('editorPreferences');
        return savedPrefs ? {...this.defaultPreferences, ...JSON.parse(savedPrefs)} : this.defaultPreferences;
    }

    savePreferences() {
        localStorage.setItem('editorPreferences', JSON.stringify(this.preferences));
    }

    updatePreference(key, value) {
        this.preferences[key] = value;
        this.savePreferences();
        this.applyPreference(key, value);
    }

    applyPreferences() {
        Object.entries(this.preferences).forEach(([key, value]) => {
            this.applyPreference(key, value);
        });
    }

    applyPreference(key, value) {
        if (window.editor) {
            switch(key) {
                case 'theme':
                    editor.setOption('theme', value);
                    document.body.setAttribute('data-theme', value);
                    break;
                case 'fontSize':
                    document.querySelector('.CodeMirror').style.fontSize = `${value}px`;
                    break;
                case 'tabSize':
                    editor.setOption('tabSize', value);
                    editor.setOption('indentUnit', value);
                    break;
                // Add more cases for other preferences
            }
        }
    }

    showPreferencesDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'preferences-dialog';
        dialog.innerHTML = this.getPreferencesDialogHTML();
        
        document.body.appendChild(dialog);
        this.setupPreferencesDialogEvents(dialog);
    }

    getPreferencesDialogHTML() {
        return `
            <div class="preferences-content">
                <h2>Editor Preferences</h2>
                <div class="preferences-sections">
                    <div class="preferences-section">
                        <h3>Appearance</h3>
                        <div class="preference-item">
                            <label for="theme">Theme</label>
                            <select id="theme" value="${this.preferences.theme}">
                                <option value="vs-dark">Dark</option>
                                <option value="vs-light">Light</option>
                            </select>
                        </div>
                        <div class="preference-item">
                            <label for="fontSize">Font Size</label>
                            <input type="number" id="fontSize" 
                                value="${this.preferences.fontSize}" 
                                min="8" max="32">
                        </div>
                    </div>
                    
                    <div class="preferences-section">
                        <h3>Editor</h3>
                        <div class="preference-item">
                            <label for="tabSize">Tab Size</label>
                            <input type="number" id="tabSize" 
                                value="${this.preferences.tabSize}" 
                                min="2" max="8">
                        </div>
                        <div class="preference-item">
                            <label>
                                <input type="checkbox" id="insertSpaces"
                                    ${this.preferences.insertSpaces ? 'checked' : ''}>
                                Insert Spaces
                            </label>
                        </div>
                    </div>
                    
                    <div class="preferences-section">
                        <h3>Features</h3>
                        <div class="preference-item">
                            <label>
                                <input type="checkbox" id="autoSave"
                                    ${this.preferences.autoSave ? 'checked' : ''}>
                                Auto Save
                            </label>
                        </div>
                        <div class="preference-item">
                            <label>
                                <input type="checkbox" id="formatOnSave"
                                    ${this.preferences.formatOnSave ? 'checked' : ''}>
                                Format On Save
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="preferences-actions">
                    <button class="secondary-btn" onclick="this.closest('.preferences-dialog').remove()">
                        Cancel
                    </button>
                    <button class="primary-btn" onclick="preferencesManager.saveAndCloseDialog(this)">
                        Save
                    </button>
                </div>
            </div>
        `;
    }

    setupPreferencesDialogEvents(dialog) {
        // Implementation for handling preference changes
    }

    saveAndCloseDialog(button) {
        const dialog = button.closest('.preferences-dialog');
        // Save all preference changes
        dialog.remove();
    }
}

// Initialize preferences manager
document.addEventListener('DOMContentLoaded', () => {
    window.preferencesManager = new PreferencesManager();
});

class AdvancedCollaborationSystem {
    constructor(editor, roomId) {
        this.editor = editor;
        this.roomId = roomId;
        this.peers = new Map();
        this.plugins = new Map();
        this.initializeRTC();
        this.initializePlugins();
        this.setupCollaborationFeatures();
    }

    // WebRTC Setup for Voice/Video
    async initializeRTC() {
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                {
                    urls: 'turn:your-turn-server.com',
                    username: 'username',
                    credential: 'credential'
                }
            ]
        };

        this.localStream = null;
        this.peerConnections = new Map();
        
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });
            this.setupMediaControls();
        } catch (error) {
            console.error('Media access error:', error);
        }
    }

    // Voice and Video Chat
    setupMediaControls() {
        const mediaControls = document.createElement('div');
        mediaControls.className = 'media-controls';
        mediaControls.innerHTML = `
            <div class="media-buttons">
                <button class="media-btn" id="toggleAudio">
                    <i class="ri-mic-line"></i>
                </button>
                <button class="media-btn" id="toggleVideo">
                    <i class="ri-video-line"></i>
                </button>
                <button class="media-btn" id="toggleScreen">
                    <i class="ri-computer-line"></i>
                </button>
            </div>
            <div class="participants-grid" id="participantsGrid"></div>
        `;
        document.body.appendChild(mediaControls);

        this.setupMediaEventListeners();
    }

    // Code Review System
    setupCodeReview() {
        this.reviewSystem = {
            comments: new Map(),
            threads: new Map(),
            suggestions: new Map()
        };

        this.editor.on('gutterClick', (cm, line, gutter) => {
            if (gutter === 'CodeMirror-linenumbers') {
                this.addReviewComment(line);
            }
        });

        // Add review toolbar
        const reviewToolbar = document.createElement('div');
        reviewToolbar.className = 'review-toolbar';
        reviewToolbar.innerHTML = `
            <div class="review-status">
                <span class="review-badge pending">Review in Progress</span>
            </div>
            <div class="review-actions">
                <button class="review-btn" id="startReview">
                    <i class="ri-draft-line"></i>
                    Start Review
                </button>
                <button class="review-btn" id="submitReview">
                    <i class="ri-check-double-line"></i>
                    Submit Review
                </button>
            </div>
        `;
        document.querySelector('.editor-header').appendChild(reviewToolbar);
    }

    // Plugin System
    initializePlugins() {
        this.pluginSystem = new PluginSystem(this);
        
        // Register core plugins
        this.registerCorePlugins();
        
        // Load user plugins
        this.loadUserPlugins();
    }

    // Real-time Collaboration Enhancements
    setupCollaborationFeatures() {
        // Presence awareness
        this.setupPresenceAwareness();
        
        // Conflict resolution
        this.setupConflictResolution();
        
        // Real-time cursors and selections
        this.setupCursorTracking();
        
        // Collaborative debugging
        this.setupCollaborativeDebugging();
    }

    // Implementation of key features
    async addReviewComment(line) {
        const commentDialog = document.createElement('div');
        commentDialog.className = 'review-comment-dialog';
        commentDialog.innerHTML = `
            <div class="comment-header">
                <h3>Add Review Comment</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="comment-body">
                <textarea placeholder="Enter your comment..."></textarea>
                <div class="comment-actions">
                    <button class="cancel-btn">Cancel</button>
                    <button class="submit-btn">Submit</button>
                </div>
            </div>
        `;

        document.body.appendChild(commentDialog);
        
        // Position the dialog next to the line
        const linePos = this.editor.charCoords({line, ch: 0}, 'local');
        commentDialog.style.top = `${linePos.top}px`;
        commentDialog.style.left = `${linePos.left + 50}px`;

        // Handle comment submission
        const submitBtn = commentDialog.querySelector('.submit-btn');
        submitBtn.addEventListener('click', () => {
            const comment = commentDialog.querySelector('textarea').value;
            this.saveComment(line, comment);
            commentDialog.remove();
        });
    }

    setupPresenceAwareness() {
        // Real-time user presence
        setInterval(() => {
            this.broadcastPresence({
                type: 'presence',
                user: this.currentUser,
                timestamp: Date.now(),
                activity: this.getUserActivity()
            });
        }, 5000);

        // Activity tracking
        this.editor.on('cursorActivity', () => {
            this.lastActivity = Date.now();
        });
    }

    setupConflictResolution() {
        this.editor.on('beforeChange', (cm, change) => {
            if (this.isConflicting(change)) {
                this.resolveConflict(change);
            }
        });
    }

    setupCollaborativeDebugging() {
        this.debugger = new CollaborativeDebugger(this.editor, {
            onBreakpoint: (line) => this.broadcastBreakpoint(line),
            onVariableUpdate: (vars) => this.broadcastVariables(vars),
            onDebuggerPause: () => this.broadcastDebuggerState('paused'),
            onDebuggerResume: () => this.broadcastDebuggerState('resumed')
        });
    }
}

// Plugin System Implementation
class PluginSystem {
    constructor(collaboration) {
        this.collaboration = collaboration;
        this.plugins = new Map();
        this.hooks = new Map();
        this.setupHooks();
    }

    setupHooks() {
        this.hooks.set('beforeChange', new Set());
        this.hooks.set('afterChange', new Set());
        this.hooks.set('beforeSave', new Set());
        this.hooks.set('afterSave', new Set());
        this.hooks.set('beforeRun', new Set());
        this.hooks.set('afterRun', new Set());
    }

    registerPlugin(plugin) {
        if (this.validatePlugin(plugin)) {
            this.plugins.set(plugin.id, plugin);
            this.attachPluginHooks(plugin);
            if (plugin.initialize) {
                plugin.initialize(this.collaboration);
            }
        }
    }

    validatePlugin(plugin) {
        return plugin.id && plugin.version && plugin.hooks;
    }

    attachPluginHooks(plugin) {
        Object.entries(plugin.hooks).forEach(([hook, callback]) => {
            if (this.hooks.has(hook)) {
                this.hooks.get(hook).add(callback);
            }
        });
    }

    async executeHook(hookName, context) {
        if (this.hooks.has(hookName)) {
            for (const callback of this.hooks.get(hookName)) {
                try {
                    await callback(context);
                } catch (error) {
                    console.error(`Plugin error at ${hookName}:`, error);
                }
            }
        }
    }
}

// Collaborative Debugger Implementation
class CollaborativeDebugger {
    constructor(editor, callbacks) {
        this.editor = editor;
        this.callbacks = callbacks;
        this.breakpoints = new Set();
        this.variables = new Map();
        this.state = 'stopped';
        this.setupDebugger();
    }

    setupDebugger() {
        this.setupBreakpointHandling();
        this.setupDebuggerControls();
        this.setupVariableWatching();
    }

    setupBreakpointHandling() {
        this.editor.on('gutterClick', (cm, line, gutter) => {
            if (gutter === 'CodeMirror-linenumbers') {
                this.toggleBreakpoint(line);
            }
        });
    }

    setupDebuggerControls() {
        const debuggerControls = document.createElement('div');
        debuggerControls.className = 'debugger-controls';
        debuggerControls.innerHTML = `
            <div class="debug-buttons">
                <button class="debug-btn" id="debugStart">
                    <i class="ri-bug-line"></i>
                    Start Debugging
                </button>
                <button class="debug-btn" id="debugPause" disabled>
                    <i class="ri-pause-line"></i>
                </button>
                <button class="debug-btn" id="debugStepOver" disabled>
                    <i class="ri-skip-forward-line"></i>
                </button>
                <button class="debug-btn" id="debugStepInto" disabled>
                    <i class="ri-login-box-line"></i>
                </button>
                <button class="debug-btn" id="debugStepOut" disabled>
                    <i class="ri-logout-box-line"></i>
                </button>
                <button class="debug-btn" id="debugStop" disabled>
                    <i class="ri-stop-line"></i>
                </button>
            </div>
            <div class="debug-info">
                <div class="variables-panel">
                    <h3>Variables</h3>
                    <div class="variables-content"></div>
                </div>
                <div class="call-stack-panel">
                    <h3>Call Stack</h3>
                    <div class="call-stack-content"></div>
                </div>
            </div>
        `;
        document.querySelector('.editor-container').appendChild(debuggerControls);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // File Management Buttons
    const newFileBtn = document.querySelector('button[title="New File"]');
    const saveBtn = document.querySelector('button[title="Save"]');
    const settingsBtn = document.querySelector('button[title="Settings"]');

    // Editor Control Buttons
    const runBtn = document.getElementById('run-btn');
    const formatBtn = document.getElementById('format-btn');
    const shareBtn = document.getElementById('share-btn');
    const languageSelect = document.getElementById('language-select');

    // Tab Management
    const tabCloseButtons = document.querySelectorAll('.tab-close');
    
    // Initialize button handlers
    if (newFileBtn) {
        newFileBtn.addEventListener('click', createNewFile);
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveCurrentFile);
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            window.preferencesManager.showPreferencesDialog();
        });
    }

    if (runBtn) {
        runBtn.addEventListener('click', runCode);
    }

    if (formatBtn) {
        formatBtn.addEventListener('click', formatCode);
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', shareCode);
    }

    if (languageSelect) {
        languageSelect.addEventListener('change', changeLanguage);
    }

    tabCloseButtons.forEach(btn => {
        btn.addEventListener('click', closeTab);
    });

    // Button Functions
    function createNewFile() {
        const fileName = prompt('Enter file name:');
        if (fileName) {
            // Create new file logic
            const fileExtension = getFileExtension(fileName);
            const language = getLanguageFromExtension(fileExtension);
            
            // Create new tab
            createNewTab(fileName, language);
            
            // Clear editor content
            editor.setValue('');
            
            // Set correct language mode
            editor.setOption('mode', language);
        }
    }

    async function saveCurrentFile() {
        const content = editor.getValue();
        const activeTab = document.querySelector('.tab.active span').textContent;
        
        try {
            const response = await fetch('/save-file/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({
                    filename: activeTab,
                    content: content
                })
            });

            if (response.ok) {
                showNotification('File saved successfully', 'success');
            } else {
                showNotification('Error saving file', 'error');
            }
        } catch (error) {
            showNotification('Error saving file', 'error');
            console.error('Save error:', error);
        }
    }

    async function runCode() {
        const code = editor.getValue();
        const language = languageSelect.value;
        
        // Show loading state
        runBtn.disabled = true;
        runBtn.innerHTML = '<i class="ri-loader-4-line"></i> Running...';
        
        try {
            const response = await executeCode(code, language);
            
            if (response.error) {
                showOutputError(response.error);
            } else {
                showOutput(response.output);
            }
        } catch (error) {
            showOutputError('Error executing code: ' + error.message);
        } finally {
            // Reset button state
            runBtn.disabled = false;
            runBtn.innerHTML = '<i class="ri-play-line"></i> Run';
        }
    }

    function formatCode() {
        try {
            const currentCode = editor.getValue();
            const language = languageSelect.value;
            
            // Format code based on language
            let formattedCode;
            switch (language) {
                case 'python':
                    formattedCode = formatPythonCode(currentCode);
                    break;
                case 'javascript':
                    formattedCode = formatJavaScriptCode(currentCode);
                    break;
                // Add more language formatters
                default:
                    formattedCode = currentCode;
            }
            
            editor.setValue(formattedCode);
            showNotification('Code formatted successfully', 'success');
        } catch (error) {
            showNotification('Error formatting code', 'error');
            console.error('Format error:', error);
        }
    }

    function shareCode() {
        const roomUrl = window.location.href;
        
        // Create share dialog
        const dialog = document.createElement('div');
        dialog.className = 'share-dialog';
        dialog.innerHTML = `
            <div class="share-content">
                <h3>Share Code</h3>
                <div class="share-url">
                    <input type="text" value="${roomUrl}" readonly>
                    <button class="copy-btn">Copy</button>
                </div>
                <div class="share-options">
                    <label>
                        <input type="checkbox" id="readOnly">
                        Share as read-only
                    </label>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Handle copy button
        dialog.querySelector('.copy-btn').addEventListener('click', () => {
            const input = dialog.querySelector('input');
            input.select();
            document.execCommand('copy');
            showNotification('URL copied to clipboard', 'success');
        });
    }

    function changeLanguage(event) {
        const language = event.target.value;
        editor.setOption('mode', language);
        
        // Update current tab icon
        const activeTab = document.querySelector('.tab.active i');
        activeTab.className = `ri-${language}-line`;
    }

    function closeTab(event) {
        event.stopPropagation();
        const tab = event.target.closest('.tab');
        
        if (tab.classList.contains('active')) {
            // If closing active tab, activate next or previous tab
            const nextTab = tab.nextElementSibling || tab.previousElementSibling;
            if (nextTab) {
                nextTab.classList.add('active');
            }
        }
        
        tab.remove();
    }

    // Helper functions
    function createNewTab(fileName, language) {
        const tabsContainer = document.querySelector('.editor-tabs');
        const newTab = document.createElement('div');
        newTab.className = 'tab active';
        newTab.innerHTML = `
            <i class="ri-${language}-line"></i>
            <span>${fileName}</span>
            <button class="tab-close">
                <i class="ri-close-line"></i>
            </button>
        `;
        
        // Remove active class from other tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        tabsContainer.appendChild(newTab);
        
        // Add close handler to new tab
        newTab.querySelector('.tab-close').addEventListener('click', closeTab);
    }

    function getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    function getLanguageFromExtension(ext) {
        const languageMap = {
            'py': 'python',
            'js': 'javascript',
            'html': 'html',
            'css': 'css'
        };
        return languageMap[ext] || 'text';
    }

    function showOutput(content) {
        const outputPanel = document.getElementById('output');
        outputPanel.innerHTML = `<pre class="output-content">${content}</pre>`;
    }

    function showOutputError(error) {
        const outputPanel = document.getElementById('output');
        outputPanel.innerHTML = `<pre class="output-content error">${error}</pre>`;
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        }, 100);
    }
});

class FileManager {
    constructor(roomId) {
        this.roomId = roomId;
        this.fileTree = document.querySelector('.folder-tree');
        this.initializeEventListeners();
        this.loadFiles();
    }

    async loadFiles() {
        try {
            const response = await fetch(`/api/files/list/?room_id=${this.roomId}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.renderFileTree(data.files);
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Error loading files', 'error');
        }
    }

    renderFileTree(files) {
        // Sort files by type and name
        files.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
        });

        const fileTree = document.createElement('div');
        fileTree.className = 'folder-item expanded';
        
        const content = document.createElement('div');
        content.className = 'folder-content';
        
        files.forEach(file => {
            const fileElement = this.createFileElement(file);
            content.appendChild(fileElement);
        });
        
        fileTree.appendChild(content);
        this.fileTree.innerHTML = '';
        this.fileTree.appendChild(fileTree);
    }

    createFileElement(file) {
        const element = document.createElement('div');
        element.className = 'file-item';
        element.dataset.filename = file.name;
        element.dataset.type = file.type;
        
        const icon = document.createElement('i');
        icon.className = `ri-${this.getFileIcon(file.type)}-line`;
        
        const name = document.createElement('span');
        name.textContent = file.name;
        
        const actions = document.createElement('div');
        actions.className = 'file-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="ri-delete-bin-line"></i>';
        deleteBtn.onclick = () => this.deleteFile(file.name);
        
        actions.appendChild(deleteBtn);
        element.appendChild(icon);
        element.appendChild(name);
        element.appendChild(actions);
        
        element.onclick = (e) => {
            if (e.target !== deleteBtn && e.target.parentElement !== deleteBtn) {
                this.openFile(file);
            }
        };
        
        return element;
    }

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

    async createFile(filename, content = '') {
        try {
            const response = await fetch('/api/files/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({
                    room_id: this.roomId,
                    filename,
                    content
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                await this.loadFiles();
                showNotification('File created successfully', 'success');
                return data.file;
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Error creating file', 'error');
        }
    }

    async saveFile(filename, content) {
        try {
            const response = await fetch('/api/files/save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({
                    room_id: this.roomId,
                    filename,
                    content
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                showNotification('File saved successfully', 'success');
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Error saving file', 'error');
        }
    }

    async deleteFile(filename) {
        if (confirm(`Are you sure you want to delete ${filename}?`)) {
            try {
                const response = await fetch('/api/files/delete/', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    },
                    body: JSON.stringify({
                        room_id: this.roomId,
                        filename
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    await this.loadFiles();
                    showNotification('File deleted successfully', 'success');
                } else {
                    showNotification(data.message, 'error');
                }
            } catch (error) {
                showNotification('Error deleting file', 'error');
            }
        }
    }

    async openFile(file) {
        try {
            const response = await fetch(`/api/files/read/?room_id=${this.roomId}&filename=${file.name}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                editor.setValue(data.content);
                editor.setOption('mode', file.type);
                
                // Update active tab
                const tabs = document.querySelector('.editor-tabs');
                const existingTab = Array.from(tabs.children).find(tab => 
                    tab.querySelector('span').textContent === file.name
                );
                
                if (!existingTab) {
                    createNewTab(file.name, file.type);
                } else {
                    // Activate existing tab
                    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                    existingTab.classList.add('active');
                }
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Error opening file', 'error');
        }
    }

    initializeEventListeners() {
        // Add new file button listener
        document.querySelector('.sidebar-btn[title="New File"]').addEventListener('click', () => {
            const filename = prompt('Enter file name:');
            if (filename) {
                this.createFile(filename);
            }
        });
    }
}

// Initialize file manager when document is ready
document.addEventListener('DOMContentLoaded', () => {
    const roomId = document.getElementById('room-id').value;
    window.fileManager = new FileManager(roomId);
});

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
                this.showNotification(data.message, 'error');
            }
        } catch (error) {
            this.showNotification('Error loading files', 'error');
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
                editor.setValue(data.content);
                editor.setOption('mode', file.type);
                
                // Update active file
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('active');
                });
                document.querySelector(`[data-path="${file.name}"]`).classList.add('active');
                
                // Update tab
                this.updateEditorTab(file);
            } else {
                this.showNotification(data.message, 'error');
            }
        } catch (error) {
            this.showNotification('Error opening file', 'error');
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
                    filename: filename,
                    content: ''
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                await this.loadFiles(); // Reload the file list
                
                // Create new tab and open file in editor
                const fileType = this.getFileType(filename);
                this.createNewTab(filename, fileType);
                
                // Set up the editor with empty content
                editor.setValue('');
                editor.setOption('mode', fileType);
                
                // Set this file as active
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('active');
                });
                const newFileItem = document.querySelector(`[data-path="${filename}"]`);
                if (newFileItem) {
                    newFileItem.classList.add('active');
                }

                this.showNotification('File created successfully', 'success');
            } else {
                this.showNotification(data.message, 'error');
            }
        } catch (error) {
            console.error('Error creating file:', error);
            this.showNotification('Error creating file', 'error');
        }
    }

    getFileType(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const typeMap = {
            'py': 'python',
            'js': 'javascript',
            'html': 'html',
            'css': 'css',
            'java': 'java',
            'cpp': 'cpp'
        };
        return typeMap[extension] || 'text';
    }

    createNewTab(filename, fileType) {
        const tabsContainer = document.querySelector('.editor-tabs');
        
        // Remove active class from all tabs
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
            this.closeTab(newTab, filename);
        });

        tabsContainer.appendChild(newTab);
    }

    closeTab(tab, filename) {
        // If this is the active tab, activate another tab
        if (tab.classList.contains('active')) {
            const nextTab = tab.nextElementSibling || tab.previousElementSibling;
            if (nextTab) {
                nextTab.classList.add('active');
                // Load the file content of the newly activated tab
                const filename = nextTab.querySelector('span').textContent;
                this.openFile({ name: filename, type: this.getFileType(filename) });
            }
        }
        tab.remove();
    }

    initializeEventListeners() {
        // Add file button handler
        const newFileBtn = document.querySelector('.new-file-btn');
        if (newFileBtn) {
            newFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.createNewFile();
            });
        }

        // Add sidebar new file button handler
        const sidebarNewFileBtn = document.querySelector('.sidebar-btn[title="New File"]');
        if (sidebarNewFileBtn) {
            sidebarNewFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.createNewFile();
            });
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
                    this.showNotification('File deleted successfully', 'success');
                } else {
                    this.showNotification(data.message, 'error');
                }
            } catch (error) {
                this.showNotification('Error deleting file', 'error');
            }
        }
    }

    showContextMenu(event, file) {
        event.preventDefault();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        
        const menuItems = [
            {
                icon: 'ri-file-edit-line',
                text: 'Rename',
                action: () => this.renameFile(file)
            },
            {
                icon: 'ri-delete-bin-line',
                text: 'Delete',
                action: () => this.deleteFile(file.name)
            }
        ];

        if (file.type === 'directory') {
            menuItems.unshift({
                icon: 'ri-file-add-line',
                text: 'New File',
                action: () => this.createNewFile(file.name)
            });
        }

        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.innerHTML = `
                <i class="${item.icon}"></i>
                <span>${item.text}</span>
            `;
            menuItem.onclick = () => {
                item.action();
                menu.remove();
            };
            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);
        
        // Position menu
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        
        // Close menu on outside click
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    initializeEventListeners() {
        // New file button
        document.querySelector('.new-file-btn').onclick = (e) => {
            e.stopPropagation();
            this.createNewFile();
        };

        // New folder button
        document.querySelector('.new-folder-btn').onclick = (e) => {
            e.stopPropagation();
            this.createNewFolder();
        };

        // Folder toggle
        document.querySelector('.folder-header').onclick = () => {
            const folderItem = document.querySelector('.folder-item');
            folderItem.classList.toggle('expanded');
            
            const toggleIcon = document.querySelector('.toggle-icon');
            toggleIcon.className = folderItem.classList.contains('expanded') 
                ? 'ri-arrow-down-s-line toggle-icon'
                : 'ri-arrow-right-s-line toggle-icon';
        };
    }

    getFileIcon(type) {
        const icons = {
            'python': 'python',
            'javascript': 'javascript',
            'html': 'html5',
            'css': 'css3',
            'directory': 'folder',
            'java': 'java',
            'cpp': 'cpu'
        };
        return icons[type] || 'file';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        }, 100);
    }
}

// Initialize file explorer when document is ready
document.addEventListener('DOMContentLoaded', () => {
    const roomId = document.getElementById('room-id').value;
    window.fileExplorer = new FileExplorer(roomId);
});