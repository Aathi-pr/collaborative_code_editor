xclass Settings {
    constructor(editor) {
        this.editor = editor;
        this.defaultSettings = {
            theme: 'github-dark',
            fontSize: 14,
            tabSize: 4,
            autoSave: true,
            autoComplete: true,
            wordWrap: true,
            showMinimap: true,
            showLineNumbers: true,
            formatOnSave: true,
            bracketPairColorization: true,
            indentGuides: true,
            fontFamily: 'Fira Code',
            keyboardShortcuts: {
                save: 'Ctrl-S',
                format: 'Shift-Alt-F',
                run: 'Ctrl-Enter',
                findNext: 'Ctrl-G',
                findPrev: 'Shift-Ctrl-G',
                replace: 'Ctrl-H',
                goToLine: 'Ctrl-L'
            }
        };
        this.settings = { ...this.defaultSettings };
        this.initialize();
    }

    async initialize() {
        await this.loadSettings();
        this.setupEventListeners();
        this.applySettings();
    }

    async loadSettings() {
        try {
            const storedSettings = localStorage.getItem('editorSettings');
            if (storedSettings) {
                this.settings = JSON.parse(storedSettings);
            }

            // Load server-side settings if they exist
            const response = await fetch(`/api/settings/get/?room_id=${this.editor.roomId}`);
            const data = await response.json();
            
            if (data.status === 'success' && data.settings) {
                this.settings = { ...this.settings, ...data.settings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            // Save to localStorage
            localStorage.setItem('editorSettings', JSON.stringify(this.settings));

            // Save to server
            await fetch('/api/settings/save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId,
                    settings: this.settings
                })
            });

            this.applySettings();
            this.editor.showNotification('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.editor.showNotification('Error saving settings', 'error');
        }
    }

    applySettings() {
        // Apply CodeMirror settings
        this.editor.editor.setOption('theme', this.settings.theme);
        this.editor.editor.setOption('tabSize', this.settings.tabSize);
        this.editor.editor.setOption('lineNumbers', this.settings.showLineNumbers);
        this.editor.editor.setOption('lineWrapping', this.settings.wordWrap);
        
        // Apply font settings
        const editorElement = this.editor.editor.getWrapperElement();
        editorElement.style.fontSize = `${this.settings.fontSize}px`;
        editorElement.style.fontFamily = this.settings.fontFamily;

        // Apply other UI settings
        document.documentElement.style.setProperty('--editor-font-size', `${this.settings.fontSize}px`);
        document.documentElement.style.setProperty('--editor-font-family', this.settings.fontFamily);

        // Update keyboard shortcuts
        this.updateKeyboardShortcuts();
    }

    updateKeyboardShortcuts() {
        const extraKeys = {
            ...this.settings.keyboardShortcuts,
            'Tab': (cm) => {
                if (cm.somethingSelected()) {
                    cm.indentSelection('add');
                } else {
                    cm.replaceSelection(' '.repeat(this.settings.tabSize));
                }
            }
        };

        this.editor.editor.setOption('extraKeys', extraKeys);
    }

    showSettingsDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'modal settings-modal';
        
        dialog.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Settings</h2>
                    <button class="close-button">×</button>
                </div>
                <div class="modal-body">
                    <div class="settings-sidebar">
                        <div class="settings-categories">
                            <button class="category-btn active" data-category="editor">Editor</button>
                            <button class="category-btn" data-category="appearance">Appearance</button>
                            <button class="category-btn" data-category="keyboard">Keyboard</button>
                            <button class="category-btn" data-category="features">Features</button>
                        </div>
                    </div>
                    <div class="settings-content">
                        <!-- Editor Settings -->
                        <div class="settings-section active" id="editor-settings">
                            <div class="setting-item">
                                <label>Tab Size</label>
                                <input type="number" id="tabSize" value="${this.settings.tabSize}" min="2" max="8">
                            </div>
                            <div class="setting-item">
                                <label>Auto Save</label>
                                <input type="checkbox" id="autoSave" ${this.settings.autoSave ? 'checked' : ''}>
                            </div>
                            <div class="setting-item">
                                <label>Format On Save</label>
                                <input type="checkbox" id="formatOnSave" ${this.settings.formatOnSave ? 'checked' : ''}>
                            </div>
                        </div>

                        <!-- Appearance Settings -->
                        <div class="settings-section" id="appearance-settings">
                            <div class="setting-item">
                                <label>Font Size</label>
                                <input type="number" id="fontSize" value="${this.settings.fontSize}" min="10" max="30">
                            </div>
                            <div class="setting-item">
                                <label>Font Family</label>
                                <select id="fontFamily">
                                    <option value="Fira Code" ${this.settings.fontFamily === 'Fira Code' ? 'selected' : ''}>Fira Code</option>
                                    <option value="Monaco" ${this.settings.fontFamily === 'Monaco' ? 'selected' : ''}>Monaco</option>
                                    <option value="Consolas" ${this.settings.fontFamily === 'Consolas' ? 'selected' : ''}>Consolas</option>
                                </select>
                            </div>
                            <div class="setting-item">
                                <label>Show Line Numbers</label>
                                <input type="checkbox" id="showLineNumbers" ${this.settings.showLineNumbers ? 'checked' : ''}>
                            </div>
                            <div class="setting-item">
                                <label>Word Wrap</label>
                                <input type="checkbox" id="wordWrap" ${this.settings.wordWrap ? 'checked' : ''}>
                            </div>
                        </div>

                        <!-- Keyboard Settings -->
                        <div class="settings-section" id="keyboard-settings">
                            ${this.generateKeyboardShortcutsHTML()}
                        </div>

                        <!-- Features Settings -->
                        <div class="settings-section" id="features-settings">
                            <div class="setting-item">
                                <label>Auto Complete</label>
                                <input type="checkbox" id="autoComplete" ${this.settings.autoComplete ? 'checked' : ''}>
                            </div>
                            <div class="setting-item">
                                <label>Show Minimap</label>
                                <input type="checkbox" id="showMinimap" ${this.settings.showMinimap ? 'checked' : ''}>
                            </div>
                            <div class="setting-item">
                                <label>Bracket Pair Colorization</label>
                                <input type="checkbox" id="bracketPairColorization" ${this.settings.bracketPairColorization ? 'checked' : ''}>
                            </div>
                            <div class="setting-item">
                                <label>Indent Guides</label>
                                <input type="checkbox" id="indentGuides" ${this.settings.indentGuides ? 'checked' : ''}>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn primary" id="save-settings">Save Changes</button>
                    <button class="btn" id="reset-settings">Reset to Default</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        this.setupSettingsDialogEvents(dialog);
    }

    generateKeyboardShortcutsHTML() {
        return Object.entries(this.settings.keyboardShortcuts)
            .map(([action, shortcut]) => `
                <div class="setting-item">
                    <label>${this.formatActionName(action)}</label>
                    <input type="text" class="shortcut-input" data-action="${action}" value="${shortcut}">
                </div>
            `).join('');
    }

    formatActionName(action) {
        return action
            .split(/(?=[A-Z])/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    setupSettingsDialogEvents(dialog) {
        // Category switching
        dialog.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                dialog.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                dialog.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
                
                btn.classList.add('active');
                dialog.querySelector(`#${btn.dataset.category}-settings`).classList.add('active');
            });
        });

        // Save button
        dialog.querySelector('#save-settings').addEventListener('click', () => {
            this.saveSettingsFromDialog(dialog);
            dialog.remove();
        });

        // Reset button
        dialog.querySelector('#reset-settings').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all settings to default?')) {
                this.settings = { ...this.defaultSettings };
                this.saveSettings();
                dialog.remove();
                this.showSettingsDialog();
            }
        });

        // Close button
        dialog.querySelector('.close-button').addEventListener('click', () => {
            dialog.remove();
        });

        // Keyboard shortcut inputs
        dialog.querySelectorAll('.shortcut-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                e.preventDefault();
                const keys = [];
                if (e.ctrlKey) keys.push('Ctrl');
                if (e.shiftKey) keys.push('Shift');
                if (e.altKey) keys.push('Alt');
                if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
                    keys.push(e.key.toUpperCase());
                }
                input.value = keys.join('-');
            });
        });
    }

    saveSettingsFromDialog(dialog) {
        // Editor settings
        this.settings.tabSize = parseInt(dialog.querySelector('#tabSize').value);
        this.settings.autoSave = dialog.querySelector('#autoSave').checked;
        this.settings.formatOnSave = dialog.querySelector('#formatOnSave').checked;

        // Appearance settings
        this.settings.fontSize = parseInt(dialog.querySelector('#fontSize').value);
        this.settings.fontFamily = dialog.querySelector('#fontFamily').value;
        this.settings.showLineNumbers = dialog.querySelector('#showLineNumbers').checked;
        this.settings.wordWrap = dialog.querySelector('#wordWrap').checked;

        // Feature settings
        this.settings.autoComplete = dialog.querySelector('#autoComplete').checked;
        this.settings.showMinimap = dialog.querySelector('#showMinimap').checked;
        this.settings.bracketPairColorization = dialog.querySelector('#bracketPairColorization').checked;
        this.settings.indentGuides = dialog.querySelector('#indentGuides').checked;

        // Keyboard shortcuts
        dialog.querySelectorAll('.shortcut-input').forEach(input => {
            this.settings.keyboardShortcuts[input.dataset.action] = input.value;
        });

        this.saveSettings();
    }

    setupEventListeners() {
        // Settings button click
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.showSettingsDialog();
        });
    }
}