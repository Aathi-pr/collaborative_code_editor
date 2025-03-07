class PreferencesManager {
    constructor(editor) {
        this.editor = editor;
        this.defaultPreferences = {
            theme: 'github-dark',
            fontSize: 14,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: true,
            lineNumbers: true,
            minimap: true,
            autoSave: true,
            formatOnSave: true,
            matchBrackets: true,
            autoClosingBrackets: true,
            autoClosingQuotes: true,
            highlightActiveLine: true,
            indentGuides: true
        };
        
        this.preferences = this.loadPreferences();
        this.applyPreferences();
        this.initializeEventListeners();
    }

    loadPreferences() {
        const savedPrefs = localStorage.getItem('editorPreferences');
        return savedPrefs ? 
            { ...this.defaultPreferences, ...JSON.parse(savedPrefs) } : 
            this.defaultPreferences;
    }

    savePreferences() {
        localStorage.setItem('editorPreferences', JSON.stringify(this.preferences));
    }

    applyPreferences() {
        // Apply to editor
        this.editor.setOption('theme', this.preferences.theme);
        this.editor.setOption('tabSize', this.preferences.tabSize);
        this.editor.setOption('lineNumbers', this.preferences.lineNumbers);
        this.editor.setOption('lineWrapping', this.preferences.wordWrap);
        this.editor.setOption('matchBrackets', this.preferences.matchBrackets);
        this.editor.setOption('autoCloseBrackets', this.preferences.autoClosingBrackets);
        this.editor.setOption('styleActiveLine', this.preferences.highlightActiveLine);

        // Apply to DOM
        document.body.setAttribute('data-theme', this.preferences.theme);
        document.querySelector('.CodeMirror').style.fontSize = 
            `${this.preferences.fontSize}px`;

        // Toggle minimap
        const minimap = document.querySelector('.editor-minimap');
        if (minimap) {
            minimap.style.display = this.preferences.minimap ? 'block' : 'none';
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
                <div class="preferences-header">
                    <h2>Editor Preferences</h2>
                    <button class="close-btn">&times;</button>
                </div>
                
                <div class="preferences-body">
                    <div class="preferences-section">
                        <h3>Appearance</h3>
                        <div class="preference-item">
                            <label for="theme">Theme</label>
                            <select id="theme" value="${this.preferences.theme}">
                                <option value="github-dark">Dark</option>
                                <option value="default">Light</option>
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
                        <div class="preference-item">
                            <label>
                                <input type="checkbox" id="wordWrap"
                                    ${this.preferences.wordWrap ? 'checked' : ''}>
                                Word Wrap
                            </label>
                        </div>
                    </div>
                    
                    <div class="preferences-section">
                        <h3>Features</h3>
                        <div class="preference-item">
                            <label>
                                <input type="checkbox" id="minimap"
                                    ${this.preferences.minimap ? 'checked' : ''}>
                                Show Minimap
                            </label>
                        </div>
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
                
                <div class="preferences-footer">
                    <button class="secondary-btn" onclick="this.closest('.preferences-dialog').remove()">
                        Cancel
                    </button>
                    <button class="primary-btn save-btn">Save</button>
                </div>
            </div>
        `;
    }

    setupPreferencesDialogEvents(dialog) {
        // Close button
        dialog.querySelector('.close-btn').onclick = () => dialog.remove();

        // Save button
        dialog.querySelector('.save-btn').onclick = () => {
            this.savePreferencesFromDialog(dialog);
            dialog.remove();
        };

        // Handle changes
        dialog.querySelectorAll('input, select').forEach(input => {
            input.onchange = () => {
                const key = input.id;
                const value = input.type === 'checkbox' ? input.checked : input.value;
                this.updatePreference(key, value);
            };
        });
    }

    savePreferencesFromDialog(dialog) {
        // Get all values
        const newPrefs = {};
        dialog.querySelectorAll('input, select').forEach(input => {
            newPrefs[input.id] = input.type === 'checkbox' ? 
                input.checked : 
                input.value;
        });

        // Update preferences
        this.preferences = { ...this.preferences, ...newPrefs };
        this.savePreferences();
        this.applyPreferences();
        
        showNotification('Preferences saved successfully', 'success');
    }

    initializeEventListeners() {
        // Settings button
        const settingsBtn = document.querySelector('button[title="Settings"]');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showPreferencesDialog());
        }
    }
}