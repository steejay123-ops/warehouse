import json
import logging
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'global_notifications'
        self.app_group_name = None
        self.client_tab_id = None

        # استخراج پارامتر قلمرو فعال (app) و شناسه تب (tab_id) از Query String
        try:
            query_string = self.scope.get('query_string', b'').decode('utf-8')
            params = parse_qs(query_string)
            app_param = params.get('app', [None])[0]
            if app_param in ('warehouse', 'finance', 'personnel'):
                normalized_app = 'finance' if app_param == 'personnel' else app_param
                self.app_group_name = f'app_{normalized_app}'
            self.client_tab_id = params.get('tab_id', [None])[0]
        except Exception:
            self.app_group_name = None
            self.client_tab_id = None

        try:
            # ۱. عضویت در کانال عمومی سامانه
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            # ۲. عضویت در کانال تفکیک‌شده قلمرو فعال (Domain Isolation)
            if self.app_group_name:
                await self.channel_layer.group_add(
                    self.app_group_name,
                    self.channel_name
                )
            await self.accept()
        except Exception as e:
            logger.error(f"[NotificationConsumer] Connection error: {e}")
            await self.close()

    async def disconnect(self, close_code):
        try:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            if self.app_group_name:
                await self.channel_layer.group_discard(
                    self.app_group_name,
                    self.channel_name
                )
        except Exception as e:
            logger.warning(f"[NotificationConsumer] Disconnect discard error: {e}")

    async def receive(self, text_data=None, bytes_data=None):
        """
        پاسخ‌گویی به بسته‌های Heartbeat Ping و درخواست‌های سوئیچ قلمرو کلاینت
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
            elif msg_type == 'switch_app':
                new_app = payload.get('app')
                if payload.get('tab_id'):
                    self.client_tab_id = payload.get('tab_id')
                if new_app in ('warehouse', 'finance', 'personnel'):
                    normalized_app = 'finance' if new_app == 'personnel' else new_app
                    new_group = f'app_{normalized_app}'
                    if self.app_group_name != new_group:
                        if self.app_group_name:
                            await self.channel_layer.group_discard(
                                self.app_group_name,
                                self.channel_name
                            )
                        self.app_group_name = new_group
                        await self.channel_layer.group_add(
                                self.app_group_name,
                                self.channel_name
                            )
                        await self.send(text_data=json.dumps({
                            'type': 'app_switched',
                            'active_app': normalized_app,
                            'tab_id': self.client_tab_id
                        }))

                    # به‌روزرسانی بلادرنگ فیلد app_scope در نشست کلاینت و برودکست به ناوگان
                    if self.client_tab_id:
                        await self.update_tab_session_app_scope(self.client_tab_id, normalized_app)
                        await self.channel_layer.group_send(
                            'global_notifications',
                            {
                                'type': 'send_notification',
                                'type_str': 'fleet_update',
                                'message': '',
                                'client_tab_id': self.client_tab_id,
                                'broadcast_to_sender': False
                            }
                        )

            elif msg_type == 'logout':
                target_tab = payload.get('tab_id') or self.client_tab_id
                if target_tab:
                    await self.remove_tab_session_on_logout(target_tab)
                    await self.channel_layer.group_send(
                        'global_notifications',
                        {
                            'type': 'send_notification',
                            'type_str': 'fleet_update',
                            'message': '',
                            'client_tab_id': target_tab,
                            'broadcast_to_sender': False
                        }
                    )
                await self.send(text_data=json.dumps({
                    'type': 'logout_acknowledged',
                    'tab_id': target_tab
                }))
        except Exception as e:
            logger.warning(f"[NotificationConsumer] Receive error: {e}")

    @database_sync_to_async
    def update_tab_session_app_scope(self, tab_id, app_scope):
        try:
            from accounts.models import UserDeviceSession
            from django.utils import timezone
            UserDeviceSession.objects.filter(tab_id=tab_id).update(
                app_scope=app_scope,
                last_heartbeat=timezone.now()
            )
        except Exception as e:
            logger.debug(f"[NotificationConsumer] Error updating tab app scope: {e}")

    @database_sync_to_async
    def remove_tab_session_on_logout(self, tab_id):
        try:
            from accounts.models import UserDeviceSession
            UserDeviceSession.objects.filter(tab_id=tab_id).delete()
        except Exception as e:
            logger.debug(f"[NotificationConsumer] Error removing tab session on logout: {e}")

    # Receive message from room group
    async def send_notification(self, event):
        try:
            # فیلتر اکوی خود تب (Tab Echo Suppression) برای تب ارسال‌کننده رویداد
            sender_tab = event.get('client_tab_id') or event.get('sender_tab_id')
            if sender_tab and self.client_tab_id and sender_tab == self.client_tab_id and not event.get('broadcast_to_sender', False) and event.get('type_str') != 'system_broadcast':
                return

            # ایزولاسیون قلمرو پیام: جلوگیری از ارسال رویدادهای غیرمرتبط به کلاینت
            event_app = event.get('app_module') or event.get('target_app')
            if event_app and self.app_group_name:
                normalized_event_app = 'finance' if event_app == 'personnel' else event_app
                expected_group = f'app_{normalized_event_app}'
                if expected_group != self.app_group_name and event.get('type_str') != 'system_broadcast':
                    return

            message = event.get('message', '')
            type_str = event.get('type_str', 'info')

            out_data = {
                'message': message,
                'type': type_str,
                'event': type_str,
            }
            for k in ('warehouse_id', 'task_id', 'task', 'log', 'log_id', 'login_log', 'stats', 'date_shamsi', 'year_month', 'attendance_data', 'sender_id', 'client_tab_id', 'app_module', 'session_id', 'revoked_tab_id', 'fleet_data'):
                if k in event:
                    out_data[k] = event[k]

            # Send message to WebSocket
            await self.send(text_data=json.dumps(out_data))
        except Exception as e:
            logger.error(f"[NotificationConsumer] Error sending notification: {e}")
