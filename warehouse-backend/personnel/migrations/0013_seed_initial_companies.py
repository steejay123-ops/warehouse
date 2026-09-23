from django.db import migrations


def seed_companies(apps, schema_editor):
    Company = apps.get_model('personnel', 'Company')
    FinancialProject = apps.get_model('personnel', 'FinancialProject')
    User = apps.get_model('accounts', 'CustomUser')
    UserCompanyAccess = apps.get_model('personnel', 'UserCompanyAccess')

    # ۱. ایجاد شرکت‌های پایه با اطلاعات اولیه
    pts_company, _ = Company.objects.get_or_create(
        code='PTS',
        defaults={
            'name': 'پاینده توان ساینا',
            'national_id': '14008123456',
            'economic_code': '411512345678',
            'is_active': True,
        }
    )

    fa_company, _ = Company.objects.get_or_create(
        code='FA',
        defaults={
            'name': 'فارس عالیش',
            'national_id': '14009876543',
            'economic_code': '411698765432',
            'is_active': True,
        }
    )

    # ۲. انتساب پروژه‌های دالان و پارسیان به پاینده توان ساینا
    # دالان: id=2 یا code='1' | پارسیان: id=3 یا code='2'
    FinancialProject.objects.filter(id__in=[2, 3]).update(company=pts_company)
    FinancialProject.objects.filter(code__in=['1', '2']).update(company=pts_company)

    # ۳. انتساب پروژه انبارداری به فارس عالیش
    # انبارداری: id=22 یا code='3'
    FinancialProject.objects.filter(id=22).update(company=fa_company)
    FinancialProject.objects.filter(code='3').update(company=fa_company)

    # ۴. دسترسی پیش‌فرض برای مدیران کل / سوپریوزرها به هر دو شرکت
    for superuser in User.objects.filter(is_superuser=True):
        UserCompanyAccess.objects.get_or_create(user=superuser, company=pts_company, defaults={'is_default': True})
        UserCompanyAccess.objects.get_or_create(user=superuser, company=fa_company, defaults={'is_default': False})


def rollback_companies(apps, schema_editor):
    Company = apps.get_model('personnel', 'Company')
    FinancialProject = apps.get_model('personnel', 'FinancialProject')

    FinancialProject.objects.filter(company__code__in=['PTS', 'FA']).update(company=None)
    Company.objects.filter(code__in=['PTS', 'FA']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('personnel', '0012_company_alter_payrollyearlysettings_project_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_companies, rollback_companies),
    ]
