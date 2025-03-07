class Theme {
    constructor(editor) {
        this.editor = editor;
        this.currentTheme = 'dark';
        this.themes = {
            dark: {
                name: 'Dark Theme',
                editorTheme: 'github-dark',
                colors: {
                    background: '#1e1e1e',
                    foreground: '#d4d4d4',
                    accent: '#0e639c',
                    sidebar: '#252526',
                    activeLine: '#2c313a',
                    selection: '#264f78',
                    errorForeground: '#f48771',
                    warningForeground: '#cca700',
                    successForeground: '#89d185'
                }
            },
            light: {
                name: 'Light Theme',
                editorTheme: 'default',
                colors: {
                    background: '#ffffff',
                    foreground: '#333333',
                    accent: '#007acc',
                    sidebar: '#f3f3f3',
                    activeLine: '#e6f3ff',
                    selection: '#add6ff',
                    errorForeground: '#d32f2f',
                    warningForeground: '#927500',
                    successForeground: '#388e3c'
                }
            }
        };
        this.initialize();
    }

    initialize() {
        this.loadThemePreference();
        this.setupEventListeners();
        this.apply();
    }

    loadThemePreference() {
        const savedTheme = localStorage.getItem('editorTheme');
        if (savedTheme && this.themes[savedTheme]) {
            this.currentTheme = savedTheme;
        }
    }

    apply() {
        const theme = this.themes[this.currentTheme];
        
        // Apply theme to editor
        this.editor.editor.setOption('theme', theme.editorTheme);

        // Apply CSS variables
        Object.entries(theme.colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--${key}`, value);
        });

        // Update body class
        document.body.classList.remove('theme-dark', 'theme-light');
        document.body.classList.add(`theme-${this.currentTheme}`);

        // Update theme button icon
        const themeButton = document.getElementById('theme-toggle');
        if (themeButton) {
            themeButton.innerHTML = `<i class="ri-${this.currentTheme === 'dark' ? 'sun' : 'moon'}-line"></i>`;
        }

        // Save preference
        localStorage.setItem('editorTheme', this.currentTheme);
    }

    toggle() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.apply();
    }

    setupEventListeners() {
        // Theme toggle button
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            this.toggle();
        });

        // System theme change
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('editorTheme')) {
                this.currentTheme = e.matches ? 'dark' : 'light';
                this.apply();
            }
        });
    }

    getThemeColors() {
        return this.themes[this.currentTheme].colors;
    }
}