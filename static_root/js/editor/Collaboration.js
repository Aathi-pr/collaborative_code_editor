// class CollaborationManager {
//     constructor(editor, roomId) {
//         this.editor = editor;
//         this.roomId = roomId;
//         this.cursors = new Map();
//         this.currentUser = document.querySelector('#current-user')?.value;
//         this.initializeWebSocket();
//         this.setupEditorEvents();
//     }

// initializeWebSocket() {
//     const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//     const wsUrl = `${protocol}//${window.location.host}/ws/editor/${this.roomId}/`;
    
//     console.log('Connecting to WebSocket:', wsUrl);
    
//     this.socket = new WebSocket(wsUrl);

//     this.socket.onopen = () => {
//         console.log('WebSocket connection established');
//         this.handleConnect();
//     };

//     this.socket.onmessage = (event) => {
//         try {
//             const data = JSON.parse(event.data);
//             this.handleMessage(data);
//         } catch (error) {
//             console.error('Error parsing WebSocket message:', error);
//         }
//     };

//     this.socket.onclose = (event) => {
//         console.log('WebSocket connection closed:', event.code, event.reason);
//         this.handleDisconnect();
        
//         // Attempt to reconnect after delay
//         setTimeout(() => {
//             if (this.socket.readyState === WebSocket.CLOSED) {
//                 console.log('Attempting to reconnect...');
//                 this.initializeWebSocket();
//             }
//         }, 3000);
//     };

//     this.socket.onerror = (error) => {
//         console.error('WebSocket error:', error);
//         showNotification('Connection error occurred', 'error');
//     };
// }

//     setupEditorEvents() {
//         // Handle cursor movements
//         this.editor.on('cursorActivity', () => {
//             if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
            
//             const position = this.editor.getCursor();
//             const selection = this.editor.getSelection();
//             this.sendCursorUpdate(position, selection);
//         });

//         // Handle content changes
//         let changeTimeout;
//         this.editor.on('change', (cm, change) => {
//             if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
//             if (change.origin === 'setValue' || change.origin === 'remote') return;

//             clearTimeout(changeTimeout);
//             changeTimeout = setTimeout(() => {
//                 this.sendCodeUpdate(cm.getValue());
//             }, 100);
//         });
//     }

//     handleMessage(data) {
//         switch (data.type) {
//             case 'code_update':
//                 this.handleCodeUpdate(data);
//                 break;
//             case 'cursor_update':
//                 this.handleCursorUpdate(data);
//                 break;
//             case 'room_state':
//                 this.handleRoomState(data.state);
//                 break;
//             case 'user_joined':
//                 this.handleUserJoined(data.user);
//                 break;
//             case 'user_left':
//                 this.handleUserLeft(data.user);
//                 break;
//         }
//     }

//     handleCodeUpdate(data) {
//         if (data.user !== this.currentUser) {
//             const cursor = this.editor.getCursor();
//             this.editor.setValue(data.code);
//             this.editor.setCursor(cursor);
//         }
//     }

//     handleCursorUpdate(data) {
//         if (data.user === this.currentUser) return;
//         this.updateRemoteCursor(data.user, data.position, data.selection);
//     }

//     updateRemoteCursor(user, position, selection) {
//         let cursorElement = this.cursors.get(user);
        
//         if (!cursorElement) {
//             cursorElement = this.createCursorElement(user);
//             this.cursors.set(user, cursorElement);
//         }

//         const coords = this.editor.charCoords(position, 'local');
//         cursorElement.style.left = `${coords.left}px`;
//         cursorElement.style.top = `${coords.top}px`;

//         if (selection) {
//             this.updateSelection(user, selection);
//         }
//     }

//     createCursorElement(user) {
//         const cursor = document.createElement('div');
//         cursor.className = 'remote-cursor';
//         cursor.innerHTML = `
//             <div class="cursor-flag">
//                 <span>${user}</span>
//             </div>
//             <div class="cursor-caret"></div>
//         `;
//         this.editor.getWrapperElement().appendChild(cursor);
//         return cursor;
//     }

//     updateSelection(user, selection) {
//         // Remove previous selection markers
//         this.editor.getAllMarks()
//             .filter(mark => mark.className === `selection-${user}`)
//             .forEach(mark => mark.clear());

//         // Add new selection markers
//         if (selection.from && selection.to) {
//             this.editor.markText(
//                 selection.from,
//                 selection.to,
//                 {
//                     className: `selection-${user}`,
//                     css: 'background-color: rgba(255, 255, 0, 0.2)'
//                 }
//             );
//         }
//     }

//     sendCodeUpdate(code) {
//         this.socket.send(JSON.stringify({
//             type: 'code_update',
//             code: code,
//             language: this.editor.getOption('mode')
//         }));
//     }

//     sendCursorUpdate(position, selection) {
//         this.socket.send(JSON.stringify({
//             type: 'cursor_update',
//             position: {
//                 line: position.line,
//                 ch: position.ch
//             },
//             selection: selection ? {
//                 from: { line: selection.from.line, ch: selection.from.ch },
//                 to: { line: selection.to.line, ch: selection.to.ch }
//             } : null
//         }));
//     }

//     handleConnect() {
//         console.log('Connected to collaboration server');
//         showNotification('Connected to room', 'success');
//     }

//     handleDisconnect() {
//         console.log('Disconnected from collaboration server');
//         showNotification('Connection lost. Trying to reconnect...', 'error');
//         setTimeout(() => this.initializeWebSocket(), 3000);
//     }

//     handleRoomState(state) {
//         if (state.code) {
//             const cursor = this.editor.getCursor();
//             this.editor.setValue(state.code);
//             this.editor.setCursor(cursor);
//         }
        
//         if (state.language) {
//             this.editor.setOption('mode', state.language);
//         }
        
//         this.updateUserList(state.users);
//     }

//     updateUserList(users) {
//         const userList = document.getElementById('user-list');
//         if (!userList) return;

//         userList.innerHTML = users.map(user => `
//             <div class="user-item">
//                 <span class="user-status ${user.active ? 'active' : ''}"></span>
//                 <span class="user-name">${user.username}</span>
//             </div>
//         `).join('');
//     }

//     handleUserJoined(user) {
//         showNotification(`${user} joined the room`, 'info');
//     }

//     handleUserLeft(user) {
//         showNotification(`${user} left the room`, 'info');
        
//         // Remove user's cursor
//         const cursorElement = this.cursors.get(user);
//         if (cursorElement) {
//             cursorElement.remove();
//             this.cursors.delete(user);
//         }
        
//         // Remove user's selection
//         this.editor.getAllMarks()
//             .filter(mark => mark.className === `selection-${user}`)
//             .forEach(mark => mark.clear());
//     }
// }




class Collaboration {
    constructor(editor) {
        this.editor = editor;
        this.socket = null;
        this.collaborators = new Map();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws/editor/${this.editor.roomId}/`;
        
        this.socket = new WebSocket(url);
        this.socket.onopen = this.handleOpen.bind(this);
        this.socket.onmessage = this.handleMessage.bind(this);
        this.socket.onclose = this.handleClose.bind(this);
        this.socket.onerror = this.handleError.bind(this);
    }

    handleOpen() {
        console.log('WebSocket connection established');
    }

    handleMessage(event) {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'code_update':
                this.handleCodeUpdate(data);
                break;
            case 'cursor_update':
                this.handleCursorUpdate(data);
                break;
            case 'user_joined':
                this.handleUserJoined(data);
                break;
            case 'user_left':
                this.handleUserLeft(data);
                break;
        }
    }

    handleClose() {
        console.log('WebSocket connection closed');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connect(), 5000);
    }

    handleError(error) {
        console.error('WebSocket error:', error);
    }

    sendCodeUpdate(code) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'code_update',
                code: code
            }));
        }
    }

    handleCodeUpdate(data) {
        if (data.user !== this.editor.currentUser) {
            const cursor = this.editor.editor.getCursor();
            this.editor.editor.setValue(data.code);
            this.editor.editor.setCursor(cursor);
        }
    }

    handleCursorUpdate(data) {
        if (data.user !== this.editor.currentUser) {
            this.updateCollaboratorCursor(data.user, data.position);
        }
    }

    handleUserJoined(data) {
        this.editor.showNotification(`${data.user} joined the room`);
        document.getElementById('user-count').textContent = data.connected_users;
    }

    handleUserLeft(data) {
        this.editor.showNotification(`${data.user} left the room`);
        document.getElementById('user-count').textContent = data.connected_users;
        this.removeCollaboratorCursor(data.user);
    }

    updateCollaboratorCursor(user, position) {
        let cursorElement = this.collaborators.get(user);
        
        if (!cursorElement) {
            cursorElement = this.createCursorElement(user);
            this.collaborators.set(user, cursorElement);
        }

        const coords = this.editor.editor.charCoords(position, 'local');
        cursorElement.style.left = `${coords.left}px`;
        cursorElement.style.top = `${coords.top}px`;
    }

    createCursorElement(user) {
        const cursor = document.createElement('div');
        cursor.className = 'remote-cursor';
        cursor.innerHTML = `
            <div class="cursor-caret"></div>
            <div class="cursor-label">${user}</div>
        `;
        this.editor.editor.getWrapperElement().appendChild(cursor);
        return cursor;
    }

    removeCollaboratorCursor(user) {
        const cursor = this.collaborators.get(user);
        if (cursor) {
            cursor.remove();
            this.collaborators.delete(user);
        }
    }
}