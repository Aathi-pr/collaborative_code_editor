from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.core.exceptions import PermissionDenied
from django.contrib import messages
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from .models import CodeRoom, CodeSession, UserSession
from .forms import UserRegistrationForm, LoginForm
# from .filemanager import ProjectFileManager
from .services.code_executer import CodeExecuter
# from .services.debugger import PythonDebugger
from pathlib import Path
import uuid
import logging
import json
import subprocess
import docker
import time

logger = logging.getLogger(__name__)

def home(request):
    """Home page view for non-authenticated users"""
    if request.user.is_authenticated:
        return redirect('dashboard')
    return render(request, 'editor/home.html')

def signup_view(request):
    """User registration view"""
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            try:
                with transaction.atomic():
                    user = form.save()
                    login(request, user)
                    messages.success(request, 'Account created successfully!')
                    return redirect('dashboard')
            except Exception as e:
                logger.error(f'Error during signup: {str(e)}')
                messages.error(request, 'An error occurred during signup. Please try again.')
    else:
        form = UserRegistrationForm()
    return render(request, 'editor/signup.html', {'form': form})

def login_view(request):
    """User login view"""
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            user = authenticate(
                username=form.cleaned_data['username'],
                password=form.cleaned_data['password']
            )
            if user:
                login(request, user)
                next_url = request.GET.get('next', 'dashboard')
                messages.success(request, 'Logged in successfully!')
                return redirect(next_url)
            else:
                messages.error(request, 'Invalid username or password.')
    else:
        form = LoginForm()
    return render(request, 'editor/login.html', {'form': form})

@login_required
def dashboard(request):
    try:
        recent_rooms = CodeRoom.objects.filter(
            usersession__user=request.user
        ).distinct().order_by('-last_active')[:5]

        created_rooms = CodeRoom.objects.filter(
            created_by=request.user
        ).order_by('-created_at')[:5]

        context = {
            'recent_rooms': recent_rooms,
            'created_rooms': created_rooms,
            'user': request.user
        }
        return render(request, 'editor/dashboard.html', context)
    except Exception as e:
        logger.error(f"Error in dashboard view: {str(e)}")
        messages.error(request, "Error loading dashboard")
        return redirect('home')

@login_required
def logout_view(request):
    """User logout view"""
    try:
        UserSession.objects.filter(user=request.user).delete()
        logout(request)
        messages.success(request, 'Logged out successfully!')
    except Exception as e:
        logger.error(f'Error during logout: {str(e)}')
        messages.error(request, 'An error occurred during logout.')
    return redirect('home')

@login_required
def editor_view(request):
    """Main editor view for users joining or creating a room."""
    room_id = request.GET.get("room")  # Get the room ID from the URL

    try:
        with transaction.atomic():
            if not room_id:  # If no room ID, create a new one
                room_id = str(uuid.uuid4())[:8]
                room = CodeRoom.objects.create(
                    room_id=room_id,
                    created_by=request.user,
                    last_active=timezone.now()
                )
            else:
                # Join an existing room
                room = get_object_or_404(CodeRoom, room_id=room_id)
                room.last_active = timezone.now()
                room.save()

            # Update user session
            user_session, created = UserSession.objects.get_or_create(
                user=request.user,
                room=room,
                defaults={"last_activity": timezone.now()}
            )
            if not created:
                user_session.last_activity = timezone.now()
                user_session.save()

            active_users = UserSession.objects.filter(
                room=room,
                last_activity__gte=timezone.now() - timezone.timedelta(minutes=5)
            )

            context = {
                "room_id": room_id,
                "connected_users": active_users.count(),
                "active_users": active_users,
                "latest_code": CodeSession.objects.filter(room=room).order_by("-created_at").first().code_content if CodeSession.objects.filter(room=room).exists() else "",
            }

            return render(request, "editor/editor.html", context)

    except Exception as e:
        logger.error(f"Error accessing editor: {str(e)}")
        messages.error(request, "Error accessing the editor. Please try again.")
        return redirect("dashboard")

@login_required
def create_room(request):
    """Create a new code room"""
    try:
        room_id = str(uuid.uuid4())[:8]
        room = CodeRoom.objects.create(
            room_id=room_id,
            created_by=request.user,
            last_active=timezone.now()
        )
        UserSession.objects.create(
            user=request.user,
            room=room,
            last_activity=timezone.now()
        )
        return redirect('editor')
    except Exception as e:
        logger.error(f'Error creating room: {str(e)}')
        messages.error(request, f"Error creating room: {str(e)}")
        return redirect('dashboard')

@login_required
def delete_room(request, room_id):
    """Delete a code room"""
    if request.method == 'POST':
        try:
            room = get_object_or_404(CodeRoom, room_id=room_id, created_by=request.user)
            room.delete()
            messages.success(request, "Room deleted successfully!")
        except Exception as e:
            logger.error(f'Error deleting room: {str(e)}')
            messages.error(request, f"Error deleting room: {str(e)}")
    return redirect('dashboard')

@login_required
def room_details(request, room_id):
    """View detailed information about a specific room"""
    try:
        room = get_object_or_404(CodeRoom, room_id=room_id)
        
        if not UserSession.objects.filter(user=request.user, room=room).exists():
            messages.error(request, "You don't have access to this room.")
            return redirect('dashboard')

        sessions = CodeSession.objects.filter(room=room).order_by('-created_at')
        participants = UserSession.objects.filter(room=room).select_related('user')

        context = {
            'room': room,
            'sessions': sessions,
            'participants': participants,
        }
        return render(request, 'editor/room_details.html', context)
    except Exception as e:
        logger.error(f'Error loading room details: {str(e)}')
        messages.error(request, f"Error loading room details: {str(e)}")
        return redirect('dashboard')

@login_required
@require_http_methods(["POST"])
def save_code(request):
    """Handles code saving HTTP endpoint."""
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        required_fields = ['room_id', 'code', 'language']
        if not all(field in data for field in required_fields):
            return JsonResponse({
                'error': 'Missing required fields',
                'required': required_fields
            }, status=400)

        # Get or create room
        room = CodeRoom.objects.get(room_id=data['room_id'])
        
        # Create code session
        code_session = CodeSession.objects.create(
            room=room,
            code_content=data['code'],
            language=data['language'],
            created_by=request.user
        )

        return JsonResponse({
            'success': True,
            'session_id': code_session.id,
            'timestamp': code_session.created_at.isoformat()
        })

    except CodeRoom.DoesNotExist:
        return JsonResponse({'error': 'Room not found'}, status=404)
    except ValidationError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
def update_user_count(request):
    """API endpoint to get current number of users in a room"""
    try:
        room_id = request.GET.get('room_id')
        if not room_id:
            return JsonResponse({
                'status': 'error',
                'message': 'Room ID is required'
            }, status=400)

        room = get_object_or_404(CodeRoom, room_id=room_id)
        
        active_users = UserSession.objects.filter(
            room=room,
            last_activity__gte=timezone.now() - timezone.timedelta(minutes=5)
        ).count()

        return JsonResponse({
            'status': 'success',
            'user_count': active_users
        })
    except Exception as e:
        logger.error(f'Error updating user count: {str(e)}')
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

def cleanup_inactive_sessions():
    """Clean up inactive user sessions"""
    try:
        timeout = timezone.now() - timezone.timedelta(minutes=30)
        UserSession.objects.filter(last_activity__lt=timeout).delete()
    except Exception as e:
        logger.error(f'Error cleaning up sessions: {str(e)}')

@login_required
@require_http_methods(["POST"])
def execute_code(request):
    """Execute code in a safe environment"""
    try:
        # ✅ FIX: Parse JSON request body instead of using request.POST
        data = json.loads(request.body)  
        code = data.get("code")
        language = data.get("language")
        room_id = data.get("room_id")

        if not all([code, language, room_id]):
            return JsonResponse({
                "status": "error",
                "message": "Missing required fields"
            }, status=400)

        room = get_object_or_404(CodeRoom, room_id=room_id)
        user_session = get_object_or_404(UserSession, user=request.user, room=room)

        user_session.last_activity = timezone.now()
        user_session.save()

        output = execute_code_safely(code, language)

        return JsonResponse({
            "status": "success",
            "output": output
        })

    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON format"}, status=400)

    except Exception as e:
        logger.error(f"Error executing code: {str(e)}")
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

def execute_code_safely(code, language):
    """Execute code in a Docker container with enhanced safety and features"""
    try:
        client = docker.from_env()
        
        language_configs = {
            'python': {
                'image': 'python:3.9-slim',
                'command': ['python', '-c', code],
                'timeout': 30,
                'setup': '',
                'file_ext': '.py'
            },
            'javascript': {
                'image': 'node:14-alpine',
                'command': ['node', '-e', code],
                'timeout': 30,
                'setup': '',
                'file_ext': '.js'
            },
            'java': {
                'image': 'openjdk:11-slim',
                'command': ['java', 'Main.java'],
                'setup': 'public class Main {\n    public static void main(String[] args) {\n        %s\n    }\n}',
                'file_ext': '.java'
            },
            'cpp': {
                'image': 'gcc:latest',
                'command': ['g++', '-o', 'program', 'main.cpp', '&&', './program'],
                'timeout': 30,
                'file_ext': '.cpp'
            }
        }
        
        config = language_configs.get(language)
        if not config:
            return {
                'output': '',
                'error': f"Language {language} is not supported",
                'execution_time': 0
            }

        start_time = time.time()
        
        # Create container with proper configuration
        container = client.containers.run(
            image=config['image'],
            command=config['command'],
            remove=True,
            mem_limit='100m',
            network_disabled=True,
            cpu_period=100000,
            cpu_quota=25000,  # 25% CPU limit
            working_dir='/workspace',
            volumes={
                '/tmp/code': {'bind': '/workspace', 'mode': 'rw'}
            },
            environment={
                'PYTHONUNBUFFERED': '1',
                'NODE_ENV': 'production'
            }
        )
        
        execution_time = time.time() - start_time
        
        output = container.decode('utf-8')
        return {
            'output': output,
            'error': None,
            'execution_time': round(execution_time, 3)
        }
        
    except docker.errors.ContainerError as e:
        return {
            'output': '',
            'error': str(e.stderr, 'utf-8'),
            'execution_time': 0
        }
    except Exception as e:
        logger.error(f'Error in code execution: {str(e)}')
        return {
            'output': '',
            'error': f"Error executing code: {str(e)}",
            'execution_time': 0
        }

@login_required
@require_http_methods(["POST"])
def update_user_activity(request):
    """Update user's last activity timestamp"""
    try:
        room_id = request.POST.get('room_id')
        room = get_object_or_404(CodeRoom, room_id=room_id)
        user_session = get_object_or_404(UserSession, user=request.user, room=room)
        user_session.last_activity = timezone.now()
        user_session.save()
        
        active_users = UserSession.objects.filter(
            room=room,
            last_activity__gte=timezone.now() - timezone.timedelta(minutes=5)
        ).count()
        
        return JsonResponse({
            'status': 'success',
            'active_users': active_users
        })
    except Exception as e:
        logger.error(f'Error updating user activity: {str(e)}')
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

@login_required
@require_http_methods(["POST"])
def create_file(request):
    try:
        data = json.loads(request.body)
        room_id = data.get('room_id')
        filename = data.get('filename')
        content = data.get('content', '')
        
        if not all([room_id, filename]):
            return JsonResponse({
                'status': 'error',
                'message': 'Missing required fields'
            }, status=400)

        # Create file manager instance
        file_manager = ProjectFileManager(room_id)
        
        # Create the file
        file_path = file_manager.create_file(filename, content)
        
        # Get file type
        file_type = file_manager.get_file_type(Path(filename))
        
        return JsonResponse({
            'status': 'success',
            'file': {
                'name': filename,
                'path': file_path,
                'type': file_type
            }
        })
    except Exception as e:
        logger.error(f'Error creating file: {str(e)}')
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@login_required
@require_http_methods(["GET"])
def list_files(request):
    """List all files in the project"""
    try:
        room_id = request.GET.get('room_id')
        
        if not room_id:
            return JsonResponse({
                'status': 'error',
                'message': 'Room ID is required'
            }, status=400)

        file_manager = ProjectFileManager(room_id)
        files = file_manager.list_files()
        
        return JsonResponse({
            'status': 'success',
            'files': files
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@login_required
@require_http_methods(["POST"])
def save_file(request):
    """Save file content"""
    try:
        data = json.loads(request.body)
        room_id = data.get('room_id')
        filename = data.get('filename')
        content = data.get('content')
        
        if not all([room_id, filename, content]):
            return JsonResponse({
                'status': 'error',
                'message': 'Missing required fields'
            }, status=400)

        file_manager = ProjectFileManager(room_id)
        file_manager.update_file(filename, content)
        
        return JsonResponse({
            'status': 'success',
            'message': 'File saved successfully'
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@login_required
@require_http_methods(["POST"])
def delete_file(request):
    """Delete a file from the project"""
    try:
        data = json.loads(request.body)
        room_id = data.get('room_id')
        filename = data.get('filename')
        
        if not all([room_id, filename]):
            return JsonResponse({
                'status': 'error',
                'message': 'Missing required fields'
            }, status=400)

        file_manager = ProjectFileManager(room_id)
        file_manager.delete_file(filename)
        
        return JsonResponse({
            'status': 'success',
            'message': 'File deleted successfully'
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@login_required
@require_http_methods(["GET"])
def read_file(request):
    """Read file content"""
    try:
        room_id = request.GET.get('room_id')
        filename = request.GET.get('filename')
        
        if not all([room_id, filename]):
            return JsonResponse({
                'status': 'error',
                'message': 'Missing required fields'
            }, status=400)

        file_manager = ProjectFileManager(room_id)
        content = file_manager.read_file(filename)
        
        return JsonResponse({
            'status': 'success',
            'content': content,
            'type': file_manager.get_file_type(Path(filename))
        })
    except FileNotFoundError:
        return JsonResponse({
            'status': 'error',
            'message': f'File {filename} not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

