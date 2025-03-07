from django.urls import re_path
from .consumers import EditorConsumer
from .consumers.editor_consumer import EditorConsumer
# from .consumers.debug_consumer import DebugConsumer

websocket_urlpatterns = [
    re_path(r'ws/editor/(?P<room_id>\w+)/$', EditorConsumer.as_asgi()),
    # re_path(r'ws/debug/(?P<room_id>\w+)/$', DebugConsumer.as_asgi()),
]