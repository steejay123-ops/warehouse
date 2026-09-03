from django.test import TestCase
from accounts.serializers import UserSerializer
from accounts.models import CustomUser

class UserSerializerValidationTests(TestCase):
    def test_create_user_without_email_succeeds(self):
        data = {
            'username': 'user_no_email',
            'first_name': 'علی',
            'last_name': 'رضایی',
            'phone_number': '09123456789',
        }
        serializer = UserSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertEqual(user.email, '')

    def test_create_user_with_null_email_succeeds(self):
        data = {
            'username': 'user_null_email',
            'first_name': 'سارا',
            'last_name': 'محمدی',
            'phone_number': '09123456789',
            'email': None
        }
        serializer = UserSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertEqual(user.email, '')

    def test_create_user_without_phone_fails(self):
        data = {
            'username': 'user_no_phone',
            'first_name': 'مهدی',
            'last_name': 'کریمی',
        }
        serializer = UserSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('phone_number', serializer.errors)

    def test_create_user_with_invalid_phone_fails(self):
        data = {
            'username': 'user_bad_phone',
            'first_name': 'مهدی',
            'last_name': 'کریمی',
            'phone_number': '02188776655', # Not mobile
        }
        serializer = UserSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('phone_number', serializer.errors)

    def test_create_user_with_iranian_mobile_normalization_succeeds(self):
        data = {
            'username': 'user_iran_phone',
            'first_name': 'مهدی',
            'last_name': 'کریمی',
            'phone_number': '+989123456789',
        }
        serializer = UserSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertEqual(user.phone_number, '09123456789')
