import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'global_notifications'

        try:
            # Join room group
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
        except Exception as e:
            logger.error(f"[NotificationConsumer] Connection error: {e}")
            await self.close()

    async def disconnect(self, close_code):
        try:
            # Leave room group
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
        except Exception as e:
            logger.warning(f"[NotificationConsumer] Disconnect discard error: {e}")

    async def receive(self, text_data=None, bytes_data=None):
        """
        پاسخ‌گویی به بسته‌های Heartbeat Ping کلاینت‌ها جهت حفظ پایداری ارتباط
        """
        if not text_data:
            return
        try:
            payload = json.loads(text_data)
            msg_type = payload.get('type')
            if msg_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': payload.get('timestamp')
                }))
        except Exception:
            pass

    # Receive message from room group
    async def send_notification(self, event):
        try:
            message = event.get('message', '')
            type_str = event.get('type_str', 'info')

            out_data = {
                'message': message,
                'type': type_str,
                'event': type_str,
            }
            if 'warehouse_id' in event:
                out_data['warehouse_id'] = event['warehouse_id']
            if 'task_id' in event:
                out_data['task_id'] = event['task_id']

            # Send message to WebSocket
            await self.send(text_data=json.dumps(out_data))
        except Exception as e:
            logger.error(f"[NotificationConsumer] Error sending notification: {e}")
