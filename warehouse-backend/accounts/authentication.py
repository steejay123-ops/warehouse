from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from datetime import datetime

class CustomJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        
        # Check if the token was issued before the password was last changed
        if user and user.password_changed_at:
            # iat (issued at) is a Unix timestamp
            iat = validated_token.get('iat')
            if iat:
                iat_datetime = datetime.fromtimestamp(iat, tz=user.password_changed_at.tzinfo)
                # Compare the token issue time with the password change time
                if iat_datetime < user.password_changed_at:
                    raise AuthenticationFailed('رمز عبور تغییر کرده است، لطفا مجددا وارد شوید.', code='password_changed')
                    
        return user
