import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist
from editor.models import CodeRoom, UserSession, CodeSession, ChatMessage, FileEntry

logger = logging.getLogger(__name__)

class EditorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Handles WebSocket connection."""
        try:
            self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
            self.room_group_name = f"editor_{self.room_id}"
            self.user = self.scope["user"]

            if not self.user.is_authenticated:
                logger.warning("Unauthorized user attempted connection")
                await self.close(code=4001)
                return

            if not await self.verify_room_access():
                logger.warning(f"Access denied for room {self.room_id}")
                await self.close(code=4003)
                return

            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.accept()
            await self.add_user_to_session()

            # Send initial state including chat history
            await self.send_initial_state()

            logger.info(f"User {self.user.username} joined room {self.room_id}")

        except Exception as e:
            logger.error(f"WebSocket connection error: {str(e)}")
            await self.close(code=1011)

    async def receive(self, text_data):
        """Handles incoming WebSocket messages (code & chat)."""
        try:
            data = json.loads(text_data)
            message_type = data.get("type")

            if message_type == "request_latest":
                await self.send_room_state()
            elif message_type == "code_update":
                await self.handle_code_update(data)
            elif message_type == "chat_message":
                await self.handle_chat_message(data)
            elif message_type == "file_update":
                await self.handle_file_update(data)
            else:
                logger.warning(f"Unknown WebSocket message type: {message_type}")

        except json.JSONDecodeError:
            logger.error("Invalid JSON received in WebSocket.")
            await self.send_error("Invalid JSON format")
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            await self.send_error(f"Error processing message: {str(e)}")

    async def handle_chat_message(self, data):
        """Handles chat messages and broadcasts them."""
        try:
            message = data.get("message", "").strip()
            if not message:
                return

            # Save message to database
            await self.save_chat_message(message)

            # Broadcast to all users in the room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_chat",
                    "message": message,
                    "user": self.user.username,
                    "timestamp": timezone.now().isoformat()
                }
            )
        except Exception as e:
            logger.error(f"Chat message error: {str(e)}")
            await self.send_error("Failed to send message")

    async def broadcast_chat(self, event):
        """Broadcasts chat message to connected clients."""
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "message": event["message"],
            "user": event["user"],
            "timestamp": event["timestamp"]
        }))

    async def disconnect(self, close_code):
        """Handles WebSocket disconnection."""
        try:
            if hasattr(self, 'room_group_name'):
                await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
                await self.remove_user_from_session()
                logger.info(f"User {self.user.username} left room {self.room_id}")
        except Exception as e:
            logger.error(f"Disconnect error: {str(e)}")

    async def handle_code_update(self, data):
        """Handles real-time code updates."""
        try:
            code = data.get("code", "")
            language = data.get("language", "python")

            # Save the latest code state
            await self.save_code_session(code, language)

            # Broadcast update to all users
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_code",
                    "code": code,
                    "language": language,
                    "user": self.user.username,
                    "timestamp": timezone.now().isoformat()
                }
            )
        except Exception as e:
            logger.error(f"Code update error: {str(e)}")
            await self.send_error("Failed to update code")

    async def broadcast_code(self, event):
        """Broadcasts updated code to all connected users."""
        await self.send(text_data=json.dumps({
            "type": "code_update",
            "code": event["code"],
            "language": event["language"],
            "user": event["user"],
            "timestamp": event["timestamp"]
        }))

    async def handle_file_update(self, data):
        """Handles file updates."""
        try:
            action = data.get("action", "")
            filename = data.get("filename", "")
            content = data.get("content", "")
            
            if not filename:
                await self.send_error("Filename is required")
                return
                
            # Save file to database
            if action in ["create", "update"]:
                await self.save_file(filename, content)
            elif action == "delete":
                await self.delete_file(filename)
            elif action == "rename":
                new_filename = data.get("newFilename", "")
                if not new_filename:
                    await self.send_error("New filename is required for rename")
                    return
                await self.rename_file(filename, new_filename)
            
            # Broadcast file update to all users
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_file_update",
                    "action": action,
                    "filename": filename,
                    "content": content,
                    "newFilename": data.get("newFilename", ""),
                    "user": data.get("user"),
                    "username": self.user.username
                }
            )
        except Exception as e:
            logger.error(f"File update error: {str(e)}", exc_info=True)
            await self.send_error(f"Failed to update file: {str(e)}")

    async def broadcast_file_update(self, event):
        """Broadcasts file updates to connected clients."""
        await self.send(text_data=json.dumps({
            "type": "file_update",
            "action": event["action"],
            "filename": event["filename"],
            "content": event["content"],
            "newFilename": event.get("newFilename", ""),
            "user": event["user"],
            "username": event.get("username")
        }))

    @database_sync_to_async
    def save_chat_message(self, message):
        """Saves chat message to database."""
        try:
            room = CodeRoom.objects.get(room_id=self.room_id)
            chat_message = ChatMessage.objects.create(
                room_id=self.room_id,
                user=self.user,
                message=message,
                timestamp=timezone.now()
            )
            return chat_message
        except CodeRoom.DoesNotExist:
            logger.error(f"Room {self.room_id} not found when saving chat message")
            raise
        except Exception as e:
            logger.error(f"Failed to save chat message: {str(e)}", exc_info=True)
            raise

    @database_sync_to_async
    def get_chat_history(self):
        """Fetches chat history for the room."""
        try:
            messages = ChatMessage.objects.filter(
                room_id=self.room_id
            ).select_related('user').order_by('-timestamp')[:50]
            
            return [{
                'user': msg.user.username,
                'message': msg.message,
                'timestamp': msg.timestamp.isoformat()
            } for msg in messages]
        except Exception as e:
            logger.error(f"Error fetching chat history: {str(e)}", exc_info=True)
            return []

    @database_sync_to_async
    def save_file(self, filename, content):
        """Saves file to the database."""
        try:
            room = CodeRoom.objects.get(room_id=self.room_id)
            
            # Update existing file or create new one
            FileEntry.objects.update_or_create(
                room=room,
                filename=filename,
                defaults={
                    'content': content,
                    'created_by': self.user,
                    'updated_at': timezone.now()
                }
            )
            
            return True
        except Exception as e:
            logger.error(f"Error saving file {filename}: {str(e)}", exc_info=True)
            raise

    @database_sync_to_async
    def delete_file(self, filename):
        """Deletes file from the database."""
        try:
            room = CodeRoom.objects.get(room_id=self.room_id)
            FileEntry.objects.filter(room=room, filename=filename).delete()
            return True
        except Exception as e:
            logger.error(f"Error deleting file {filename}: {str(e)}", exc_info=True)
            raise

    @database_sync_to_async
    def rename_file(self, old_filename, new_filename):
        """Renames file in the database."""
        try:
            room = CodeRoom.objects.get(room_id=self.room_id)
            file_entry = FileEntry.objects.get(room=room, filename=old_filename)
            file_entry.filename = new_filename
            file_entry.save()
            return True
        except Exception as e:
            logger.error(f"Error renaming file {old_filename} to {new_filename}: {str(e)}", exc_info=True)
            raise

    @database_sync_to_async
    def get_room_files(self):
        """Retrieves all files for a room."""
        try:
            room = CodeRoom.objects.get(room_id=self.room_id)
            files = FileEntry.objects.filter(room=room)
            return {
                file.filename: file.content
                for file in files
            }
        except Exception as e:
            logger.error(f"Error retrieving files for room {self.room_id}: {str(e)}", exc_info=True)
            return {}

    async def send_initial_state(self):
        """Sends initial room state including code and chat history."""
        try:
            # Get latest code session
            latest_session = await self.get_latest_code_session()
            code = ""
            language = "python"
            
            if latest_session:
                code = latest_session.code_content
                language = latest_session.language

            # Get chat history
            chat_history = await self.get_chat_history()
            
            # Get room files
            files = await self.get_room_files()
            
            # Determine current file
            current_file = None
            if files:
                # Use first file by default or main.py if it exists
                current_file = "main.py" if "main.py" in files else list(files.keys())[0]

            # Send complete state
            await self.send(text_data=json.dumps({
                "type": "initial_state",
                "code": code,
                "language": language,
                "chat_history": chat_history,
                "files": files,
                "currentFile": current_file
            }))
            
            logger.info(f"Initial state sent for room {self.room_id}")
            
        except Exception as e:
            logger.error(f"Failed to send initial state: {str(e)}", exc_info=True)
            await self.send_error("Failed to load initial room state")

    async def send_room_state(self):
        """Sends the latest room state (code + language) to the client."""
        try:
            latest_session = await self.get_latest_code_session()
            if latest_session:
                code = latest_session.code_content
                language = latest_session.language
            else:
                code = ""
                language = "python"
                
            # Get room files
            files = await self.get_room_files()

            await self.send(text_data=json.dumps({
                "type": "room_state",
                "code": code,
                "language": language,
                "files": files
            }))
        except Exception as e:
            logger.error(f"Failed to load room state: {str(e)}")
            await self.send_error("Failed to load room state")

    async def send_error(self, message):
        """Sends error message to client."""
        try:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": message,
                "timestamp": timezone.now().isoformat()
            }))
        except Exception as e:
            logger.error(f"Failed to send error message: {str(e)}", exc_info=True)

    @database_sync_to_async
    def verify_room_access(self):
        """Verifies if the room exists."""
        try:
            room = CodeRoom.objects.get(room_id=self.room_id)
            return True
        except CodeRoom.DoesNotExist:
            return False
        except Exception as e:
            logger.error(f"Error verifying room access: {str(e)}", exc_info=True)
            return False

    @database_sync_to_async
    def add_user_to_session(self):
        """Adds user to active session."""
        try:
            room = CodeRoom.objects.get(room_id=self.room_id)
            UserSession.objects.update_or_create(
                user=self.user,
                room=room,
                defaults={
                    "is_active": True,
                    "last_activity": timezone.now()
                }
            )
        except CodeRoom.DoesNotExist:
            logger.error(f"Room {self.room_id} not found when adding user to session")
            raise
        except Exception as e:
            logger.error(f"Failed to add user to session: {str(e)}", exc_info=True)
            raise

    @database_sync_to_async
    def remove_user_from_session(self):
        """Removes user from active session."""
        try:
            UserSession.objects.filter(
                user=self.user,
                room__room_id=self.room_id
            ).update(is_active=False, last_activity=timezone.now())
        except Exception as e:
            logger.error(f"Failed to remove user from session: {str(e)}")

    @database_sync_to_async
    def save_code_session(self, code, language):
        """Saves the latest code to the database."""
        try:
            room = CodeRoom.objects.get(room_id=self.room_id)
            CodeSession.objects.create(
                room=room,
                code_content=code,
                language=language,
                created_by=self.user
            )
        except Exception as e:
            logger.error(f"Error saving code session: {str(e)}")

    @database_sync_to_async
    def get_latest_code_session(self):
        """Retrieves the latest saved code session."""
        try:
            return CodeSession.objects.filter(
                room__room_id=self.room_id
            ).order_by('-created_at').first()
        except Exception as e:
            logger.error(f"Error fetching latest code session: {str(e)}", exc_info=True)
            return None