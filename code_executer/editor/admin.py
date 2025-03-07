from django.contrib import admin
from .models import CodeRoom, CodeSession, UserSession
# DebugSession, CodeReview, ReviewComment, Plugin, UserPlugin, RTCSession

@admin.register(CodeRoom)
class CodeRoomAdmin(admin.ModelAdmin):
    list_display = ('room_id', 'created_by', 'created_at', 'last_active')
    list_filter = ('created_at', 'last_active')
    search_fields = ('room_id', 'created_by__username')
    readonly_fields = ('created_at',)

@admin.register(CodeSession)
class CodeSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'created_by', 'language', 'created_at')
    list_filter = ('language', 'created_at')
    search_fields = ('room__room_id', 'created_by__username')
    readonly_fields = ('created_at',)

@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'room', 'is_active', 'joined_at', 'last_activity')
    list_filter = ('is_active', 'joined_at', 'last_activity')
    search_fields = ('user__username', 'room__room_id')
    readonly_fields = ('joined_at',)
