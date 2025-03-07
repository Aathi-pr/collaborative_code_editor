let editor, fileExplorer, debugger, collaborationManager, preferencesManager;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    // Get room ID
    const roomId = document.querySelector('.room-id')?.textContent?.replace('Room: ', '').trim();
    if (!roomId) {
        console.error('Room ID not found');
        return;
    }

    // Initialize editor
    editor = initializeEditor('code-editor');
    window.editor = editor; // Make editor globally available

    // Initialize components
    fileExplorer = new FileExplorer(roomId);
    debugger = new CodeDebugger(editor);
    collaborationManager = new CollaborationManager(editor, roomId);
    preferencesManager = new PreferencesManager(editor);

    // Setup general event listeners
    setupEventListeners();
});

// Setup general event listeners
function setupEventListeners() {
    // Editor buttons
    setupEditorButtons();

    // Language selection
    setupLanguageSelection();

    // File management
    setupFileManagement();

    // Theme toggle
    setupThemeToggle();
}

function setupEditorButtons() {
    // Run button
    const runBtn = document.getElementById('run-btn');
    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            const code = editor.getValue();
            const language = document.getElementById('language-select').value;
            
            runBtn.disabled = true;
            runBtn.innerHTML = '<i class="ri-loader-4-line"></i> Running...';
            
            try {
                const result = await executeCode(code, language);
                showOutput(result);
            } catch (error) {
                showOutputError(error.message);
            } finally {
                runBtn.disabled = false;
                runBtn.innerHTML = '<i class="ri-play-line"></i> Run';
            }
        });
    }

    // Format button
    const formatBtn = document.getElementById('format-btn');
    if (formatBtn) {
        formatBtn.addEventListener('click', () => {
            const code = editor.getValue();
            const language = document.getElementById('language-select').value;
            
            try {
                const formattedCode = formatCode(code, language);
                editor.setValue(formattedCode);
                showNotification('Code formatted successfully', 'success');
            } catch (error) {
                showNotification('Error formatting code', 'error');
            }
        });
    }

    // Share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const url = window.location.href;
            navigator.clipboard.writeText(url)
                .then(() => showNotification('URL copied to clipboard', 'success'))
                .catch(() => showNotification('Failed to copy URL', 'error'));
        });
    }
}

function setupLanguageSelection() {
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            const language = e.target.value;
            editor.setOption('mode', language);
            
            // Update file icon if in a tab
            const activeTab = document.querySelector('.tab.active i');
            if (activeTab) {
                activeTab.className = `ri-${language}-line`;
            }
        });
    }
}

function setupFileManagement() {
    // New file button
    const newFileBtn = document.querySelector('button[title="New File"]');
    if (newFileBtn) {
        newFileBtn.addEventListener('click', () => {
            fileExplorer.createNewFile();
        });
    }

    // Save button
    const saveBtn = document.querySelector('button[title="Save"]');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab.active span');
            if (activeTab) {
                fileExplorer.saveFile(
                    activeTab.textContent,
                    editor.getValue()
                );
            }
        });
    }
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = editor.getOption('theme');
            const newTheme = currentTheme === 'github-dark' ? 'default' : 'github-dark';
            
            editor.setOption('theme', newTheme);
            document.body.setAttribute('data-theme', newTheme === 'github-dark' ? 'dark' : 'light');
            
            // Save preference
            preferencesManager.updatePreference('theme', newTheme);
        });
    }
}

// Utility functions
async function executeCode(code, language) {
    const response = await fetch('/api/execute/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify({ code, language })
    });
    
    return await response.json();
}

function formatCode(code, language) {
    // Implement code formatting based on language
    // You might want to use specific formatters for each language
    return code;
}

function showOutput(result) {
    const outputPanel = document.getElementById('output');
    if (!outputPanel) return;

    if (result.error) {
        outputPanel.innerHTML = `<pre class="error">${result.error}</pre>`;
    } else {
        outputPanel.innerHTML = `<pre>${result.output}</pre>`;
    }
}

function showOutputError(error) {
    const outputPanel = document.getElementById('output');
    if (!outputPanel) return;

    outputPanel.innerHTML = `<pre class="error">Error: ${error}</pre>`;
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