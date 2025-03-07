import docker
import tempfile
import os
import subprocess
import json
from pathlib import Path
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class CodeExecuter:
    def __init__(self):
        self.client = docker.from_env()
        self.language_configs = {
            'python': {
                'image': 'python:3.9-slim',
                'command': ['python', '/code/main.py'],
                'file_ext': '.py',
                'timeout': 30,
                'memory_limit': '100m'
            },
            'javascript': {
                'image': 'node:14-alpine',
                'command': ['node', '/code/main.js'],
                'file_ext': '.js',
                'timeout': 30,
                'memory_limit': '100m'
            },
            'java': {
                'image': 'openjdk:11-slim',
                'command': ['java', 'Main.java'],
                'file_ext': '.java',
                'timeout': 30,
                'memory_limit': '200m'
            },
            'cpp': {
                'image': 'gcc:latest',
                'command': ['bash', '-c', 'g++ -o /code/program /code/main.cpp && /code/program'],
                'file_ext': '.cpp',
                'timeout': 30,
                'memory_limit': '100m'
            }
        }

    async def execute(self, code, language):
        try:
            config = self.language_configs.get(language)
            if not config:
                return {
                    'success': False,
                    'output': f'Language {language} is not supported',
                    'error': None
                }

            # Create temporary directory for code execution
            with tempfile.TemporaryDirectory() as temp_dir:
                # Write code to file
                file_path = Path(temp_dir) / f'main{config["file_ext"]}'
                with open(file_path, 'w') as f:
                    f.write(code)

                # Run code in container
                container = await self.run_in_container(
                    temp_dir,
                    config['image'],
                    config['command'],
                    config['timeout'],
                    config['memory_limit']
                )

                return {
                    'success': True,
                    'output': container['output'],
                    'error': container['error'],
                    'execution_time': container['execution_time'],
                    'memory_usage': container['memory_usage']
                }

        except Exception as e:
            logger.error(f'Error executing code: {str(e)}')
            return {
                'success': False,
                'output': None,
                'error': str(e)
            }

    async def run_in_container(self, code_dir, image, command, timeout, memory_limit):
        try:
            container = self.client.containers.run(
                image=image,
                command=command,
                volumes={
                    code_dir: {
                        'bind': '/code',
                        'mode': 'ro'
                    }
                },
                working_dir='/code',
                remove=True,
                detach=False,
                mem_limit=memory_limit,
                network_disabled=True,
                cpu_period=100000,
                cpu_quota=25000,  # 25% CPU limit
                timeout=timeout
            )

            return {
                'output': container.decode('utf-8'),
                'error': None,
                'execution_time': 0,  # Add timing logic
                'memory_usage': 0  # Add memory tracking
            }

        except docker.errors.ContainerError as e:
            return {
                'output': None,
                'error': e.stderr.decode('utf-8'),
                'execution_time': 0,
                'memory_usage': 0
            }

class LanguageServer:
    def __init__(self):
        self.language_servers = {
            'python': PyLanguageServer(),
            'javascript': JSLanguageServer(),
            'java': JavaLanguageServer(),
            'cpp': CPPLanguageServer()
        }

    def get_server(self, language):
        return self.language_servers.get(language)

class BaseLanguageServer:
    def __init__(self):
        self.completions = {}
        self.diagnostics = {}

    async def provide_completions(self, code, position):
        raise NotImplementedError

    async def provide_diagnostics(self, code):
        raise NotImplementedError

    async def format_code(self, code):
        raise NotImplementedError

class PyLanguageServer(BaseLanguageServer):
    def __init__(self):
        super().__init__()
        self.pylint_path = 'pylint'
        self.black_path = 'black'

    async def provide_completions(self, code, position):
        try:
            import jedi
            script = jedi.Script(code)
            completions = script.complete(position['line'], position['ch'])
            return [
                {
                    'label': c.name,
                    'kind': c.type,
                    'detail': c.description,
                    'documentation': c.docstring(),
                    'insertText': c.complete
                }
                for c in completions
            ]
        except Exception as e:
            logger.error(f'Error providing Python completions: {str(e)}')
            return []

    async def provide_diagnostics(self, code):
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py') as f:
                f.write(code)
                f.flush()
                
                result = subprocess.run(
                    [self.pylint_path, f.name],
                    capture_output=True,
                    text=True
                )

                diagnostics = []
                for line in result.stdout.splitlines():
                    if ':' in line:
                        parts = line.split(':')
                        if len(parts) >= 3:
                            diagnostics.append({
                                'line': int(parts[1]),
                                'message': parts[2].strip(),
                                'severity': 'error' if 'error' in line.lower() else 'warning'
                            })
                
                return diagnostics
        except Exception as e:
            logger.error(f'Error providing Python diagnostics: {str(e)}')
            return []

    async def format_code(self, code):
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py') as f:
                f.write(code)
                f.flush()
                
                result = subprocess.run(
                    [self.black_path, f.name],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    with open(f.name, 'r') as formatted_file:
                        return formatted_file.read()
                return code
        except Exception as e:
            logger.error(f'Error formatting Python code: {str(e)}')
            return code

# Add similar implementations for other language servers...

# Git Integration Service
class GitService:
    def __init__(self, project_path):
        self.project_path = project_path
        self.repo = None
        self.initialize_repo()

    def initialize_repo(self):
        try:
            import git
            if not os.path.exists(os.path.join(self.project_path, '.git')):
                self.repo = git.Repo.init(self.project_path)
            else:
                self.repo = git.Repo(self.project_path)
        except Exception as e:
            logger.error(f'Error initializing git repo: {str(e)}')

    async def commit_changes(self, message):
        try:
            self.repo.index.add('*')
            self.repo.index.commit(message)
            return True
        except Exception as e:
            logger.error(f'Error committing changes: {str(e)}')
            return False

    async def create_branch(self, branch_name):
        try:
            current = self.repo.create_head(branch_name)
            current.checkout()
            return True
        except Exception as e:
            logger.error(f'Error creating branch: {str(e)}')
            return False

# Project Template Service
class ProjectTemplateService:
    def __init__(self):
        self.templates_path = Path(settings.BASE_DIR) / 'editor' / 'templates' / 'projects'

    async def list_templates(self):
        templates = []
        for template_dir in self.templates_path.iterdir():
            if template_dir.is_dir():
                config_file = template_dir / 'template.json'
                if config_file.exists():
                    with open(config_file) as f:
                        config = json.load(f)
                        templates.append({
                            'id': template_dir.name,
                            'name': config.get('name'),
                            'description': config.get('description'),
                            'languages': config.get('languages', []),
                            'files': config.get('files', [])
                        })
        return templates

    async def create_from_template(self, template_id, project_path):
        template_dir = self.templates_path / template_id
        if not template_dir.exists():
            raise ValueError(f'Template {template_id} not found')

        # Copy template files
        shutil.copytree(template_dir, project_path, dirs_exist_ok=True)
        
        # Remove template config
        config_file = Path(project_path) / 'template.json'
        if config_file.exists():
            config_file.unlink()

        return True