from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='reportexportjob',
            name='heartbeat_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='آخرین نبض پردازش'),
        ),
        migrations.CreateModel(
            name='ExportWorkerStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('alive_at', models.DateTimeField(verbose_name='آخرین نبض')),
            ],
            options={
                'verbose_name': 'وضعیت worker خروجی',
                'verbose_name_plural': 'وضعیت worker خروجی',
            },
        ),
    ]
