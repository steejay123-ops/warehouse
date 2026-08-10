import requests
import sys

def test_refresh_token_rotation():
    TARGET_URL = "http://localhost:8000/api"
    
    # Step 1: Login to get initial tokens
    print("Logging in to get initial tokens...")
    response = requests.post(
        f"{TARGET_URL}/auth/login/",
        json={"username": "saman_admin", "password": "123456"}
    )
    
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        sys.exit(1)
        
    data = response.json()
    access_token_1 = data["tokens"]["access"]
    refresh_token_1 = data["tokens"]["refresh"]
    
    # Step 2: Use the refresh token to get a new set of tokens
    print("Refreshing token (1st time)...")
    refresh_response_1 = requests.post(
        f"{TARGET_URL}/auth/refresh/",
        json={"refresh": refresh_token_1}
    )
    
    if refresh_response_1.status_code != 200:
        print(f"First refresh failed: {refresh_response_1.text}")
        sys.exit(1)
        
    refresh_data_1 = refresh_response_1.json()
    
    if "refresh" not in refresh_data_1:
        print("ERROR: Rotate refresh tokens is not working, no refresh token returned!")
        sys.exit(1)
        
    access_token_2 = refresh_data_1["access"]
    refresh_token_2 = refresh_data_1["refresh"]
    
    if refresh_token_1 == refresh_token_2:
        print("ERROR: Refresh token was not rotated!")
        sys.exit(1)
        
    print("Successfully rotated token. Testing blacklist functionality...")
    
    # Step 3: Attempt to use the OLD refresh token again (should fail because it is blacklisted)
    refresh_response_old = requests.post(
        f"{TARGET_URL}/auth/refresh/",
        json={"refresh": refresh_token_1}
    )
    
    if refresh_response_old.status_code != 401:
        print(f"ERROR: Old refresh token was not blacklisted! Status Code: {refresh_response_old.status_code}")
        sys.exit(1)
        
    print("Old token correctly blacklisted (401 received).")
        
    # Step 4: Attempt to use the NEW refresh token (should succeed)
    print("Testing second refresh with new token...")
    refresh_response_new = requests.post(
        f"{TARGET_URL}/auth/refresh/",
        json={"refresh": refresh_token_2}
    )
    
    if refresh_response_new.status_code != 200:
        print(f"Second refresh failed: {refresh_response_new.text}")
        sys.exit(1)
        
    print("Second refresh succeeded! Backend rotation test passed successfully!")

if __name__ == "__main__":
    test_refresh_token_rotation()
