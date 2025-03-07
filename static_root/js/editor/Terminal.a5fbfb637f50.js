class Terminal {
    constructor(editor) {
        this.editor = editor;
        this.container = document.getElementById('terminal');
        this.currentInput = '';
        this.history = [];
        this.historyIndex = -1;
        this.prompt = '$ ';
        this.workingDirectory = '~';
        this.isProcessing = false;
        this.initialize();
    }

    initialize() {
        this.container.innerHTML = '';
        this.createNewLine();
        this.setupEventListeners();
    }

    createNewLine(showPrompt = true) {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        
        if (showPrompt) {
            line.innerHTML = `
                <span class="terminal-prompt">
                    <span class="terminal-user">user@codefusion</span>
                    <span class="terminal-separator">:</span>
                    <span class="terminal-directory">${this.workingDirectory}</span>
                    <span class="terminal-prompt-symbol">${this.prompt}</span>
                </span>
                <span class="terminal-input" contenteditable="true"></span>
            `;
            
            const input = line.querySelector('.terminal-input');
            input.addEventListener('keydown', this.handleInput.bind(this));
            input.addEventListener('paste', this.handlePaste.bind(this));
        }
        
        this.container.appendChild(line);
        this.scrollToBottom();
        
        if (showPrompt) {
            line.querySelector('.terminal-input').focus();
        }
    }

    async handleInput(event) {
        if (this.isProcessing) {
            event.preventDefault();
            return;
        }

        const input = event.target;
        
        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                const command = input.textContent.trim();
                if (command) {
                    this.history.push(command);
                    this.historyIndex = this.history.length;
                    await this.executeCommand(command);
                }
                break;

            case 'ArrowUp':
                event.preventDefault();
                this.navigateHistory(-1);
                break;

            case 'ArrowDown':
                event.preventDefault();
                this.navigateHistory(1);
                break;

            case 'Tab':
                event.preventDefault();
                await this.handleTabCompletion(input.textContent);
                break;

            case 'c':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.handleCtrlC();
                }
                break;
        }
    }

    async executeCommand(command) {
        this.isProcessing = true;
        const currentLine = this.container.lastElementChild;
        currentLine.querySelector('.terminal-input').contentEditable = false;

        try {
            const response = await fetch('/api/terminal/execute/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    command,
                    room_id: this.editor.roomId,
                    working_directory: this.workingDirectory
                })
            });

            const result = await response.json();
            
            if (result.output) {
                this.writeOutput(result.output);
            }

            if (result.working_directory) {
                this.workingDirectory = result.working_directory;
            }

        } catch (error) {
            this.writeOutput(`Error: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
            this.createNewLine();
        }
    }

    writeOutput(output, type = 'standard') {
        const outputLine = document.createElement('div');
        outputLine.className = `terminal-output ${type}`;
        
        if (typeof output === 'string') {
            outputLine.innerHTML = `<pre>${this.escapeHtml(output)}</pre>`;
        } else {
            outputLine.innerHTML = `<pre>${this.escapeHtml(JSON.stringify(output, null, 2))}</pre>`;
        }
        
        this.container.appendChild(outputLine);
        this.scrollToBottom();
    }

    navigateHistory(direction) {
        if (this.history.length === 0) return;

        this.historyIndex += direction;
        
        if (this.historyIndex >= this.history.length) {
            this.historyIndex = this.history.length - 1;
        } else if (this.historyIndex < 0) {
            this.historyIndex = 0;
        }

        const input = this.container.querySelector('.terminal-input:last-child');
        input.textContent = this.history[this.historyIndex];
        this.setCaretToEnd(input);
    }

    async handleTabCompletion(partial) {
        if (!partial) return;

        try {
            const response = await fetch('/api/terminal/complete/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    partial,
                    room_id: this.editor.roomId,
                    working_directory: this.workingDirectory
                })
            });

            const result = await response.json();
            
            if (result.completions?.length > 0) {
                if (result.completions.length === 1) {
                    // Single completion
                    const input = this.container.querySelector('.terminal-input:last-child');
                    input.textContent = result.completions[0];
                    this.setCaretToEnd(input);
                } else {
                    // Multiple possibilities
                    this.writeOutput(result.completions.join('    '));
                    this.createNewLine();
                }
            }
        } catch (error) {
            console.error('Completion error:', error);
        }
    }

    handleCtrlC() {
        if (this.isProcessing) {
            // TODO: Implement process termination
            this.isProcessing = false;
        }
        this.writeOutput('^C');
        this.createNewLine();
    }

    handlePaste(event) {
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    }

    setCaretToEnd(element) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    setupEventListeners() {
        // Clear terminal button
        document.getElementById('clear-terminal')?.addEventListener('click', () => {
            this.container.innerHTML = '';
            this.createNewLine();
        });

        // Focus terminal when clicked
        this.container.addEventListener('click', () => {
            const input = this.container.querySelector('.terminal-input:last-child');
            if (input) {
                input.focus();
            }
        });
    }

    clear() {
        this.container.innerHTML = '';
        this.createNewLine();
    }
}
```

2. **Debugger.js** - Debugging functionality:
```javascript
class Debugger {
    constructor(editor) {
        this.editor = editor;
        this.isDebugging = false;
        this.breakpoints = new Set();
        this.currentLine = null;
        this.variables = new Map();
        this.callStack = [];
        this.initialize();
    }

    initialize() {
        this.setupDebuggerUI();
        this.setupEventListeners();
    }

    setupDebuggerUI() {
        // Add debugging gutter to CodeMirror
        this.editor.editor.setOption('gutters', [
            'CodeMirror-linenumbers',
            'CodeMirror-foldgutter',
            'breakpoints'
        ]);

        // Initialize debug controls
        this.debugControls = {
            start: document.getElementById('start-debug'),
            stop: document.getElementById('stop-debug'),
            stepOver: document.getElementById('step-over'),
            stepInto: document.getElementById('step-into'),
            stepOut: document.getElementById('step-out'),
            continue: document.getElementById('continue-debug')
        };

        // Initialize debug info panels
        this.debugPanels = {
            variables: document.getElementById('debug-variables'),
            callStack: document.getElementById('debug-callstack'),
            breakpoints: document.getElementById('debug-breakpoints')
        };
    }

    setupEventListeners() {
        // Breakpoint toggle on gutter click
        this.editor.editor.on('gutterClick', (cm, line, gutter) => {
            if (gutter === 'breakpoints') {
                this.toggleBreakpoint(line);
            }
        });

        // Debug control buttons
        if (this.debugControls.start) {
            this.debugControls.start.addEventListener('click', () => this.startDebugging());
        }
        if (this.debugControls.stop) {
            this.debugControls.stop.addEventListener('click', () => this.stopDebugging());
        }
        if (this.debugControls.stepOver) {
            this.debugControls.stepOver.addEventListener('click', () => this.stepOver());
        }
        if (this.debugControls.stepInto) {
            this.debugControls.stepInto.addEventListener('click', () => this.stepInto());
        }
        if (this.debugControls.stepOut) {
            this.debugControls.stepOut.addEventListener('click', () => this.stepOut());
        }
        if (this.debugControls.continue) {
            this.debugControls.continue.addEventListener('click', () => this.continue());
        }
    }

    toggleBreakpoint(line) {
        const info = this.editor.editor.lineInfo(line);
        
        if (info.gutterMarkers && info.gutterMarkers.breakpoints) {
            this.editor.editor.setGutterMarker(line, 'breakpoints', null);
            this.breakpoints.delete(line);
        } else {
            const marker = document.createElement('div');
            marker.className = 'breakpoint';
            marker.innerHTML = '●';
            this.editor.editor.setGutterMarker(line, 'breakpoints', marker);
            this.breakpoints.add(line);
        }

        this.updateBreakpointsList();
    }

    async startDebugging() {
        if (this.isDebugging) return;

        try {
            const response = await fetch('/api/debug/start/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    code: this.editor.editor.getValue(),
                    breakpoints: Array.from(this.breakpoints),
                    language: this.editor.currentFile?.language || 'python',
                    room_id: this.editor.roomId
                })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.isDebugging = true;
                this.enableDebugControls();
                this.updateDebugState(result.debug_info);
                this.editor.showNotification('Debugging started');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Debug error:', error);
            this.editor.showNotification('Failed to start debugging', 'error');
        }
    }

    async stopDebugging() {
        if (!this.isDebugging) return;

        try {
            await fetch('/api/debug/stop/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    room_id: this.editor.roomId
                })
            });

            this.isDebugging = false;
            this.disableDebugControls();
            this.clearDebugState();
            this.editor.showNotification('Debugging stopped');
        } catch (error) {
            console.error('Error stopping debug:', error);
        }
    }

    async stepOver() {
        if (!this.isDebugging) return;
        await this.executeDebugCommand('step_over');
    }

    async stepInto() {
        if (!this.isDebugging) return;
        await this.executeDebugCommand('step_into');
    }

    async stepOut() {
        if (!this.isDebugging) return;
        await this.executeDebugCommand('step_out');
    }

    async continue() {
        if (!this.isDebugging) return;
        await this.executeDebugCommand('continue');
    }

    async executeDebugCommand(command) {
        try {
            const response = await fetch('/api/debug/execute/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    command,
                    room_id: this.editor.roomId
                })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                this.updateDebugState(result.debug_info);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Debug command error:', error);
            this.editor.showNotification(`Debug command failed: ${error.message}`, 'error');
        }
    }

    updateDebugState(debugInfo) {
        // Update current line
        if (this.currentLine !== null) {
            this.editor.editor.removeLineClass(this.currentLine, 'background', 'debug-current-line');
        }
        
        if (debugInfo.current_line !== null) {
            this.currentLine = debugInfo.current_line;
            this.editor.editor.addLineClass(this.currentLine, 'background', 'debug-current-line');
            this.editor.editor.scrollIntoView({line: this.currentLine, ch: 0}, 100);
        }

        // Update variables
        this.variables = new Map(Object.entries(debugInfo.variables || {}));
        this.updateVariablesPanel();

        // Update call stack
        this.callStack = debugInfo.call_stack || [];
        this.updateCallStackPanel();

        // Update debug console
        if (debugInfo.console_output) {
            this.updateDebugConsole(debugInfo.console_output);
        }
    }

    updateVariablesPanel() {
        if (!this.debugPanels.variables) return;

        this.debugPanels.variables.innerHTML = '';
        
        this.variables.forEach((value, name) => {
            const variable = document.createElement('div');
            variable.className = 'debug-variable';
            variable.innerHTML = `
                <span class="variable-name">${name}</span>
                <span class="variable-value">${this.formatValue(value)}</span>
            `;
            this.debugPanels.variables.appendChild(variable);
        });
    }

    updateCallStackPanel() {
        if (!this.debugPanels.callStack) return;

        this.debugPanels.callStack.innerHTML = '';
        
        this.callStack.forEach((frame, index) => {
            const stackFrame = document.createElement('div');
            stackFrame.className = 'stack-frame';
            stackFrame.innerHTML = `
                <span class="frame-function">${frame.function}</span>
                <span class="frame-file">${frame.file}:${frame.line}</span>
            `;
            this.debugPanels.callStack.appendChild(stackFrame);
        });
    }

    updateBreakpointsList() {
        if (!this.debugPanels.breakpoints) return;

        this.debugPanels.breakpoints.innerHTML = '';
        
        this.breakpoints.forEach(line => {
            const breakpoint = document.createElement('div');
            breakpoint.className = 'breakpoint-item';
            breakpoint.innerHTML = `
                <span class="breakpoint-line">Line ${line + 1}</span>
                <button class="breakpoint-remove" data-line="${line}">×</button>
            `;
            
            breakpoint.querySelector('.breakpoint-remove').addEventListener('click', () => {
                this.toggleBreakpoint(line);
            });
            
            this.debugPanels.breakpoints.appendChild(breakpoint);
        });
    }

    updateDebugConsole(output) {
        const console = document.getElementById('debug-console');
        if (!console) return;

        const outputElement = document.createElement('div');
        outputElement.className = 'debug-console-output';
        outputElement.textContent = output;
        console.appendChild(outputElement);
        console.scrollTop = console.scrollHeight;
    }

    enableDebugControls() {
        Object.values(this.debugControls).forEach(control => {
            if (control && control !== this.debugControls.start) {
                control.disabled = false;
            }
        });
        this.debugControls.start.disabled = true;
    }

    disableDebugControls() {
        Object.values(this.debugControls).forEach(control => {
            if (control && control !== this.debugControls.start) {
                control.disabled = true;
            }
        });
        this.debugControls.start.disabled = false;
    }

    clearDebugState() {
        if (this.currentLine !== null) {
            this.editor.editor.removeLineClass(this.currentLine, 'background', 'debug-current-line');
            this.currentLine = null;
        }

        this.variables.clear();
        this.callStack = [];
        this.updateVariablesPanel();
        this.updateCallStackPanel();
    }

    formatValue(value) {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return String(value);
    }
}