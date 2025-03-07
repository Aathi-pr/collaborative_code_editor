function initializeEditor(elementId) {
    const config = {
        mode: "python",
        theme: "github-dark",
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
    };

    // Initialize CodeMirror
    const editor = CodeMirror.fromTextArea(document.getElementById(elementId), config);
    
    // Set global editor theme
    document.body.setAttribute('data-theme', 'dark');

    // Initialize editor features
    initializeEditorFeatures(editor);

    return editor;
}

function initializeEditorFeatures(editor) {
    // Minimap
    setupMinimap(editor);
    
    // Breakpoints
    setupBreakpoints(editor);
    
    // Error checking
    setupErrorChecking(editor);
    
    // Auto-save
    setupAutoSave(editor);
    
    // Code folding
    setupCodeFolding(editor);
    
    // Search and Replace
    setupSearch(editor);
}

function setupMinimap(editor) {
    const minimapElement = document.querySelector('.editor-minimap');
    if (!minimapElement) return;

    editor.on('change', () => {
        updateMinimap(editor, minimapElement);
    });
}

function updateMinimap(editor, minimapElement) {
    const content = editor.getValue();
    const lines = content.split('\n');
    const minimapContent = lines.map(line => 
        `<div class="minimap-line">${line}</div>`
    ).join('');
    minimapElement.innerHTML = minimapContent;
}

function setupBreakpoints(editor) {
    editor.on("gutterClick", (cm, n) => {
        const info = cm.lineInfo(n);
        cm.setGutterMarker(n, "breakpoints", 
            info.gutterMarkers ? null : makeBreakpointMarker());
    });
}

function makeBreakpointMarker() {
    const marker = document.createElement("div");
    marker.className = "breakpoint-marker";
    marker.innerHTML = "●";
    return marker;
}

function setupErrorChecking(editor) {
    editor.on("change", (cm) => {
        // Clear previous error markers
        clearErrorMarkers(cm);
        
        // Check for errors
        const content = cm.getValue();
        const errors = checkCodeErrors(content, cm.getOption('mode'));
        
        // Mark errors
        markErrors(cm, errors);
    });
}

function setupAutoSave(editor) {
    let saveTimeout;
    editor.on("change", (cm) => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const content = cm.getValue();
            saveCode(content);
        }, 1000);
    });
}

function setupCodeFolding(editor) {
    editor.on("fold", (cm, from, to) => {
        // Update minimap when code is folded/unfolded
        const minimapElement = document.querySelector('.editor-minimap');
        if (minimapElement) {
            updateMinimap(editor, minimapElement);
        }
    });
}

function setupSearch(editor) {
    CodeMirror.commands.search = (cm) => {
        const searchDialog = createSearchDialog(cm);
        document.body.appendChild(searchDialog);
    };
}

function createSearchDialog(cm) {
    const dialog = document.createElement('div');
    dialog.className = 'search-dialog';
    dialog.innerHTML = `
        <div class="search-header">
            <input type="text" placeholder="Search" class="search-input">
            <input type="text" placeholder="Replace with" class="replace-input">
        </div>
        <div class="search-options">
            <label><input type="checkbox" class="case-sensitive"> Case sensitive</label>
            <label><input type="checkbox" class="whole-word"> Whole word</label>
            <label><input type="checkbox" class="regex"> Regular expression</label>
        </div>
        <div class="search-buttons">
            <button class="find-btn">Find</button>
            <button class="replace-btn">Replace</button>
            <button class="replace-all-btn">Replace All</button>
        </div>
    `;
    
    setupSearchDialogEvents(dialog, cm);
    return dialog;
}

// Utility functions
function saveCode(content) {
    // Implementation depends on your backend
    console.log('Auto-saving code...');
}

function checkCodeErrors(content, mode) {
    // Implementation depends on language
    return [];
}

function clearErrorMarkers(cm) {
    // Clear existing error markers
}

function markErrors(cm, errors) {
    // Mark errors in the editor
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