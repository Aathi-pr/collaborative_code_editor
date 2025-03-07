from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from .models import CodeRoom
from channels.exceptions import DenyConnection

User = get_user_model()

class WebSocketMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # Get the user
        if scope["user"].is_anonymous:
            raise DenyConnection("Authentication required")
            
        # Add the room to the scope
        room_id = scope['url_route']['kwargs']['room_id']
        scope['room'] = await self.get_room(room_id)
        
        if not scope['room']:
            raise DenyConnection("Room not found")
            
        # Check if user has access to the room
        if not await self.has_room_access(scope['user'], scope['room']):
            raise DenyConnection("Access denied")

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_room(self, room_id):
        try:
            return CodeRoom.objects.get(room_id=room_id)
        except CodeRoom.DoesNotExist:
            return None

    @database_sync_to_async
    def has_room_access(self, user, room):
        # Implement your room access logic here
        # For example:
        return (
            room.created_by == user or
            room.usersession_set.filter(user=user).exists()
        )

from django.http import HttpResponse

class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Add security headers
        response['Cross-Origin-Opener-Policy'] = 'same-origin'
        response['Cross-Origin-Embedder-Policy'] = 'require-corp'
        response['Cross-Origin-Resource-Policy'] = 'same-origin'
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['Referrer-Policy'] = 'same-origin'
        
        return response