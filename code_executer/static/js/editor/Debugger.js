class Debugger {
    constructor(editor) {
        this.editor = editor;
        this.isDebugging = false;
        this.isPaused = false;
        this.breakpoints = new Set();
        this.currentLine = null;
        this.variables = new Map();
        this.callStack = [];
        this.watchExpressions = new Map();
        this.debugSocket = null;
        this.initialize();
    }

    initialize() {
        this.setupDebuggerUI();
        this.setupEventListeners();
        this.setupWebSocket();
    }

    setupDebuggerUI() {
        // Add breakpoint gutter to CodeMirror
        this.editor.editor.setOption('gutters', [
            'CodeMirror-linenumbers',
            'breakpoints',
            'CodeMirror-foldgutter'
        ]);

        // Initialize debug controls
        this.debugControls = {
            start: document.getElementById('start-debug'),
            stop: document.getElementById('stop-debug'),
            stepOver: document.getElementById('step-over'),
            stepInto: document.getElementById('step-into'),
            stepOut: document.getElementById('step-out'),
            continue: document.getElementById('continue-debug'),
            restart: document.getElementById('restart-debug'),
            pause: document.getElementById('pause-debug')
        };

        // Initialize debug panels
        this.debugPanels = {
            variables: document.getElementById('debug-variables'),
            callStack: document.getElementById('debug-callstack'),
            watch: document.getElementById('debug-watch'),
            breakpoints: document.getElementById('debug-breakpoints'),
            console: document.getElementById('debug-console')
        };

        this.disableDebugControls();
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws/debug/${this.editor.roomId}/`;
        
        this.debugSocket = new WebSocket(url);
        this.debugSocket.onmessage = (event) => this.handleDebugMessage(event);
        this.debugSocket.onclose = () => {
            this.stopDebugging();
            setTimeout(() => this.setupWebSocket(), 5000); // Reconnect after 5 seconds
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
        Object.entries(this.debugControls).forEach(([action, button]) => {
            if (button) {
                button.addEventListener('click', () => this[action]());
            }
        });

        // Watch expressions
        const addWatchBtn = document.getElementById('add-watch');
        if (addWatchBtn) {
            addWatchBtn.addEventListener('click', () => this.addWatchExpression());
        }
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

            const data = await response.json();
            
            if (data.status === 'success') {
                this.isDebugging = true;
                this.enableDebugControls();
                this.editor.showNotification('Debugging started');
                this.updateDebugState(data.debug_info);
            } else {
                throw new Error(data.error);
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
            this.isPaused = false;
            this.disableDebugControls();
            this.clearDebugState();
            this.editor.showNotification('Debugging stopped');
        } catch (error) {
            console.error('Error stopping debug:', error);
        }
    }

    async pause() {
        if (!this.isDebugging || this.isPaused) return;
        await this.sendDebugCommand('pause');
    }

    async continue() {
        if (!this.isDebugging || !this.isPaused) return;
        await this.sendDebugCommand('continue');
    }

    async stepOver() {
        if (!this.isDebugging || !this.isPaused) return;
        await this.sendDebugCommand('step_over');
    }

    async stepInto() {
        if (!this.isDebugging || !this.isPaused) return;
        await this.sendDebugCommand('step_into');
    }

    async stepOut() {
        if (!this.isDebugging || !this.isPaused) return;
        await this.sendDebugCommand('step_out');
    }

    async restart() {
        if (!this.isDebugging) return;
        await this.sendDebugCommand('restart');
    }

    async sendDebugCommand(command) {
        try {
            const response = await fetch('/api/debug/command/', {
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

            const data = await response.json();
            
            if (data.status === 'success') {
                this.updateDebugState(data.debug_info);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Debug command error:', error);
            this.editor.showNotification(`Debug command failed: ${error.message}`, 'error');
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
        
        if (this.isDebugging) {
            this.sendDebugCommand('update_breakpoints');
        }
    }

    updateDebugState(debugInfo) {
        // Update current line highlight
        if (this.currentLine !== null) {
            this.editor.editor.removeLineClass(this.currentLine, 'background', 'debug-current-line');
        }
        
        if (debugInfo.current_line !== null) {
            this.currentLine = debugInfo.current_line;
            this.editor.editor.addLineClass(this.currentLine, 'background', 'debug-current-line');
            this.editor.editor.scrollIntoView({line: this.currentLine, ch: 0}, 100);
        }

        // Update variables panel
        this.updateVariablesPanel(debugInfo.variables || {});

        // Update call stack
        this.updateCallStack(debugInfo.call_stack || []);

        // Update watch expressions
        this.updateWatchExpressions(debugInfo.watch_values || {});

        // Update debug console
        if (debugInfo.console_output) {
            this.appendToDebugConsole(debugInfo.console_output);
        }

        // Update debug controls state
        this.isPaused = debugInfo.is_paused;
        this.updateControlsState();
    }

    updateVariablesPanel(variables) {
        if (!this.debugPanels.variables) return;

        this.debugPanels.variables.innerHTML = '';
        
        Object.entries(variables).forEach(([name, value]) => {
            const variableElement = document.createElement('div');
            variableElement.className = 'debug-variable';
            variableElement.innerHTML = `
                <div class="variable-name">${name}</div>
                <div class="variable-value">${this.formatValue(value)}</div>
            `;
            this.debugPanels.variables.appendChild(variableElement);
        });
    }

    updateCallStack(callStack) {
        if (!this.debugPanels.callStack) return;

        this.debugPanels.callStack.innerHTML = '';
        
        callStack.forEach((frame, index) => {
            const frameElement = document.createElement('div');
            frameElement.className = 'call-stack-frame';
            frameElement.innerHTML = `
                <div class="frame-function">${frame.function}</div>
                <div class="frame-location">${frame.file}:${frame.line}</div>
            `;
            
            frameElement.addEventListener('click', () => {
                this.jumpToFrame(index);
            });
            
            this.debugPanels.callStack.appendChild(frameElement);
        });
    }

    async addWatchExpression() {
        const expression = prompt('Enter watch expression:');
        if (!expression) return;

        try {
            const response = await fetch('/api/debug/watch/add/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    expression,
                    room_id: this.editor.roomId
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                this.watchExpressions.set(expression, data.value);
                this.updateWatchExpressions();
            }
        } catch (error) {
            console.error('Error adding watch expression:', error);
        }
    }

    updateWatchExpressions(values = null) {
        if (!this.debugPanels.watch) return;

        if (values) {
            this.watchExpressions = new Map(Object.entries(values));
        }

        this.debugPanels.watch.innerHTML = '';
        
        this.watchExpressions.forEach((value, expression) => {
            const watchElement = document.createElement('div');
            watchElement.className = 'watch-expression';
            watchElement.innerHTML = `
                <div class="watch-expression-content">
                    <div class="expression">${expression}</div>
                    <div class="value">${this.formatValue(value)}</div>
                </div>
                <button class="remove-watch" title="Remove watch">×</button>
            `;
            
            watchElement.querySelector('.remove-watch').addEventListener('click', () => {
                this.removeWatchExpression(expression);
            });
            
            this.debugPanels.watch.appendChild(watchElement);
        });
    }

    async removeWatchExpression(expression) {
        try {
            await fetch('/api/debug/watch/remove/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.editor.getCsrfToken()
                },
                body: JSON.stringify({
                    expression,
                    room_id: this.editor.roomId
                })
            });

            this.watchExpressions.delete(expression);
            this.updateWatchExpressions();
        } catch (error) {
            console.error('Error removing watch expression:', error);
        }
    }

    appendToDebugConsole(output) {
        if (!this.debugPanels.console) return;

        const outputElement = document.createElement('div');
        outputElement.className = 'debug-console-output';
        outputElement.textContent = output;
        this.debugPanels.console.appendChild(outputElement);
        this.debugPanels.console.scrollTop = this.debugPanels.console.scrollHeight;
    }

    enableDebugControls() {
        Object.values(this.debugControls).forEach(button => {
            if (button) button.disabled = false;
        });
        this.debugControls.start.disabled = true;
    }

    disableDebugControls() {
        Object.values(this.debugControls).forEach(button => {
            if (button) button.disabled = true;
        });
        this.debugControls.start.disabled = false;
    }

    updateControlsState() {
        if (!this.isDebugging) {
            this.disableDebugControls();
            return;
        }

        this.enableDebugControls();
        
        if (this.isPaused) {
            this.debugControls.continue.disabled = false;
            this.debugControls.pause.disabled = true;
            this.debugControls.stepOver.disabled = false;
            this.debugControls.stepInto.disabled = false;
            this.debugControls.stepOut.disabled = false;
        } else {
            this.debugControls.continue.disabled = true;
            this.debugControls.pause.disabled = false;
            this.debugControls.stepOver.disabled = true;
            this.debugControls.stepInto.disabled = true;
            this.debugControls.stepOut.disabled = true;
        }
    }

    clearDebugState() {
        if (this.currentLine !== null) {
            this.editor.editor.removeLineClass(this.currentLine, 'background', 'debug-current-line');
            this.currentLine = null;
        }

        this.variables.clear();
        this.callStack = [];
        this.updateVariablesPanel({});
        this.updateCallStack([]);
        this.updateWatchExpressions({});
        
        if (this.debugPanels.console) {
            this.debugPanels.console.innerHTML = '';
        }
    }

    formatValue(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            } catch (e) {
                return String(value);
            }
        }
        
        return String(value);
    }

    handleDebugMessage(event) {
        try {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'debug_state':
                    this.updateDebugState(data.state);
                    break;
                case 'debug_error':
                    this.editor.showNotification(data.error, 'error');
                    break;
                case 'debug_output':
                    this.appendToDebugConsole(data.output);
                    break;
            }
        } catch (error) {
            console.error('Error handling debug message:', error);
        }
    }

    async jumpToFrame(frameIndex) {
        if (!this.isDebugging || !this.isPaused) return;
        
        try {
            await this.sendDebugCommand('select_frame', { frameIndex });
        } catch (error) {
            console.error('Error jumping to frame:', error);
        }
    }
}