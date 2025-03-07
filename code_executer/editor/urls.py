from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('create-room/', views.create_room, name='create_room'),
    path('delete-room/<str:room_id>/', views.delete_room, name='delete_room'),
    path('room/<str:room_id>/', views.room_details, name='room_details'),
    path('editor/', views.editor_view, name='editor'),
    path('save-code/', views.save_code, name='save_code'),
    path('execute-code/', views.execute_code, name='execute_code'),
    path('api/update-user-count/', views.update_user_count, name='update_user_count'),
    path('api/update-user-activity/', views.update_user_activity, name='update_user_activity'),
]