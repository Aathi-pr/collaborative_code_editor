
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid

class CodeRoom(models.Model):
    room_id = models.CharField(max_length=50, unique=True, default=uuid.uuid4)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    last_active = models.DateTimeField(auto_now=True)
    description = models.TextField(blank=True, null=True)
    is_public = models.BooleanField(default=True)

    class Meta:
        ordering = ['-last_active']

    def __str__(self):
        return f"Room {self.room_id} by {self.created_by.username}"

class UserSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(CodeRoom, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    cursor_position = models.JSONField(null=True)
    selection = models.JSONField(null=True)

    class Meta:
        unique_together = ('user', 'room')

class CodeSession(models.Model):
    room = models.ForeignKey(CodeRoom, on_delete=models.CASCADE)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    code_content = models.TextField()
    language = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    execution_result = models.TextField(null=True, blank=True)
    version = models.IntegerField(default=1)
    is_saved = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Code in {self.room.room_id} by {self.created_by.username}"

    def save(self, *args, **kwargs):
        if not self.pk:  # If this is a new code session
            # Get the latest version number for this room
            latest = CodeSession.objects.filter(room=self.room).order_by('-version').first()
            if latest:
                self.version = latest.version + 1
        super().save(*args, **kwargs)

class ChatMessage(models.Model):
    room_id = models.CharField(max_length=255)  # Ensure it's named `room_id`, NOT `room`
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

class FileEntry(models.Model):
    room = models.ForeignKey(CodeRoom, on_delete=models.CASCADE, related_name='files')
    filename = models.CharField(max_length=255)
    content = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('room', 'filename')
        ordering = ['filename']
    
    def __str__(self):
        return f"{self.filename} in {self.room.room_id}"
