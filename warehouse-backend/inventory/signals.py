from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import CountTask, DocTask

def broadcast_count_task_update():
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            'global_notifications',
            {
                'type': 'send_notification',
                'type_str': 'count_task_update',
                'message': 'تغییر در وضعیت شمارش'
            }
        )

@receiver(post_save, sender=CountTask)
def count_task_post_save(sender, instance, created, **kwargs):
    broadcast_count_task_update()

@receiver(post_delete, sender=CountTask)
def count_task_post_delete(sender, instance, **kwargs):
    broadcast_count_task_update()

def broadcast_doc_task_update():
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            'global_notifications',
            {
                'type': 'send_notification',
                'type_str': 'doc_task_update',
                'message': 'وضعیت اسناد مالی تغییر کرد'
            }
        )

@receiver(post_save, sender=DocTask)
def doc_task_post_save(sender, instance, created, **kwargs):
    broadcast_doc_task_update()

@receiver(post_delete, sender=DocTask)
def doc_task_post_delete(sender, instance, **kwargs):
    broadcast_doc_task_update()
