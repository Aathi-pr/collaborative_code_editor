class CodeDebugger {
    constructor(editor) {
        this.editor = editor;
        this.breakpoints = new Set();
        this.isDebugging = false;
        this.currentLine = null;
        this.variables = new Map();
        this.callStack = [];
        this.initializeDebugger();
    }

    initializeDebugger() {
        this.setupBreakpointHandling();
        this.setupDebugControls();
        this.setupVariableWatching();
        this.setupEventListeners();
    }

    setupBreakpointHandling() {
        this.editor.on('gutterClick', (cm, line, gutter) => {
            if (gutter === 'CodeMirror-linenumbers') {
                this.toggleBreakpoint(line);
            }
        });
    }

    setupDebugControls() {
        // Create debug toolbar if it doesn't exist
        if (!document.querySelector('.debug-toolbar')) {
            const toolbar = document.createElement('div');
            toolbar.className = 'debug-toolbar';
            toolbar.innerHTML = `
                <div class="debug-controls">
                    <button id="debug-start" class="debug-btn" title="Start Debugging (F5)">
                        <i class="ri-bug-line"></i>
                    </button>
                    <button id="debug-stop" class="debug-btn" title="Stop (Shift+F5)" disabled>
                        <i class="ri-stop-line"></i>
                    </button>
                    <button id="debug-continue" class="debug-btn" title="Continue (F8)" disabled>
                        <i class="ri-play-line"></i>
                    </button>
                    <button id="debug-step-over" class="debug-btn" title="Step Over (F10)" disabled>
                        <i class="ri-skip-forward-line"></i>
                    </button>
                    <button id="debug-step-into" class="debug-btn" title="Step Into (F11)" disabled>
                        <i class="ri-login-box-line"></i>
                    </button>
                    <button id="debug-step-out" class="debug-btn" title="Step Out (Shift+F11)" disabled>
                        <i class="ri-logout-box-line"></i>
                    </button>
                </div>
            `;
            document.querySelector('.editor-controls').appendChild(toolbar);
        }
    }

    setupVariableWatching() {
        // Create variables panel if it doesn't exist
        if (!document.querySelector('.debug-variables')) {
            const panel = document.createElement('div');
            panel.className = 'debug-variables';
            panel.innerHTML = `
                <div class="debug-panel-header">
                    <h3>Variables</h3>
                </div>
                <div class="variables-content"></div>
            `;
            document.querySelector('.debug-panel').appendChild(panel);
        }
    }

    setupEventListeners() {
        // Debug control buttons
        document.getElementById('debug-start').addEventListener('click', () => this.startDebugging());
        document.getElementById('debug-stop').addEventListener('click', () => this.stopDebugging());
        document.getElementById('debug-continue').addEventListener('click', () => this.continueExecution());
        document.getElementById('debug-step-over').addEventListener('click', () => this.stepOver());
        document.getElementById('debug-step-into').addEventListener('click', () => this.stepInto());
        document.getElementById('debug-step-out').addEventListener('click', () => this.stepOut());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F5') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.stopDebugging();
                } else {
                    this.startDebugging();
                }
            } else if (e.key === 'F8' && this.isDebugging) {
                e.preventDefault();
                this.continueExecution();
            } else if (e.key === 'F10' && this.isDebugging) {
                e.preventDefault();
                this.stepOver();
            } else if (e.key === 'F11' && this.isDebugging) {
                e.preventDefault();
                if (e.shiftKey) {
                    this.stepOut();
                } else {
                    this.stepInto();
                }
            }
        });
    }

    async startDebugging() {
        if (this.isDebugging) return;

        try {
            const code = this.editor.getValue();
            const response = await fetch('/api/debug/start/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({
                    code,
                    breakpoints: Array.from(this.breakpoints)
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                this.isDebugging = true;
                this.updateDebuggerState(data);
                this.enableDebugControls();
                showNotification('Debugging started', 'success');
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Error starting debugger', 'error');
            console.error('Debug error:', error);
        }
    }

    async stopDebugging() {
        if (!this.isDebugging) return;

        try {
            await fetch('/api/debug/stop/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                }
            });

            this.isDebugging = false;
            this.clearDebugState();
            this.disableDebugControls();
            showNotification('Debugging stopped', 'info');
        } catch (error) {
            showNotification('Error stopping debugger', 'error');
            console.error('Debug error:', error);
        }
    }

    toggleBreakpoint(line) {
        const info = this.editor.lineInfo(line);
        
        if (info.gutterMarkers && info.gutterMarkers.breakpoints) {
            this.editor.setGutterMarker(line, 'breakpoints', null);
            this.breakpoints.delete(line);
        } else {
            const marker = document.createElement('div');
            marker.className = 'breakpoint-marker';
            marker.innerHTML = '●';
            this.editor.setGutterMarker(line, 'breakpoints', marker);
            this.breakpoints.add(line);
        }

        // Update breakpoints if debugging is active
        if (this.isDebugging) {
            this.updateBreakpoints();
        }
    }

    async updateBreakpoints() {
        try {
            await fetch('/api/debug/breakpoints/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({
                    breakpoints: Array.from(this.breakpoints)
                })
            });
        } catch (error) {
            console.error('Error updating breakpoints:', error);
        }
    }

    updateDebuggerState(data) {
        // Update current line
        if (this.currentLine !== null) {
            this.editor.removeLineClass(this.currentLine, 'background', 'debug-current-line');
        }
        
        if (data.currentLine !== null) {
            this.currentLine = data.currentLine;
            this.editor.addLineClass(this.currentLine, 'background', 'debug-current-line');
            
            // Scroll to current line
            const coords = this.editor.charCoords({line: this.currentLine, ch: 0}, 'local');
            this.editor.scrollTo(null, coords.top - 100);
        }

        // Update variables
        this.updateVariables(data.variables);

        // Update call stack
        this.updateCallStack(data.callStack);
    }

    updateVariables(variables) {
        const container = document.querySelector('.variables-content');
        container.innerHTML = '';

        Object.entries(variables).forEach(([name, value]) => {
            const varElement = document.createElement('div');
            varElement.className = 'variable-item';
            varElement.innerHTML = `
                <span class="variable-name">${name}</span>
                <span class="variable-value">${this.formatValue(value)}</span>
            `;
            container.appendChild(varElement);
        });
    }

    updateCallStack(callStack) {
        const container = document.querySelector('.call-stack-content');
        container.innerHTML = '';

        callStack.forEach(frame => {
            const frameElement = document.createElement('div');
            frameElement.className = 'stack-frame';
            frameElement.innerHTML = `
                <span class="frame-function">${frame.function}</span>
                <span class="frame-location">${frame.file}:${frame.line}</span>
            `;
            container.appendChild(frameElement);
        });
    }

    formatValue(value) {
        if (typeof value === 'string') return `"${value}"`;
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) return `[${value.map(v => this.formatValue(v)).join(', ')}]`;
        if (typeof value === 'object') return JSON.stringify(value);
        return value.toString();
    }

    clearDebugState() {
        // Clear current line highlight
        if (this.currentLine !== null) {
            this.editor.removeLineClass(this.currentLine, 'background', 'debug-current-line');
            this.currentLine = null;
        }

        // Clear variables
        document.querySelector('.variables-content').innerHTML = '';

        // Clear call stack
        document.querySelector('.call-stack-content').innerHTML = '';
    }

    enableDebugControls() {
        document.getElementById('debug-start').disabled = true;
        document.getElementById('debug-stop').disabled = false;
        document.getElementById('debug-continue').disabled = false;
        document.getElementById('debug-step-over').disabled = false;
        document.getElementById('debug-step-into').disabled = false;
        document.getElementById('debug-step-out').disabled = false;
    }

    disableDebugControls() {
        document.getElementById('debug-start').disabled = false;
        document.getElementById('debug-stop').disabled = true;
        document.getElementById('debug-continue').disabled = true;
        document.getElementById('debug-step-over').disabled = true;
        document.getElementById('debug-step-into').disabled = true;
        document.getElementById('debug-step-out').disabled = true;
    }
}