
import socket
import httpx
import sys

def test_dns():
    print("Testing DNS resolution for api.resend.com...")
    try:
        ip = socket.gethostbyname("api.resend.com")
        print(f"SUCCESS: Resolved api.resend.com to {ip}")
        return True
    except socket.gaierror as e:
        print(f"FAILURE: DNS resolution failed: {e}")
        return False

def test_https():
    print("\nTesting HTTPS connection to https://api.resend.com/emails...")
    try:
        response = httpx.get("https://api.resend.com", timeout=10.0)
        print(f"SUCCESS: Connected. Status Code: {response.status_code}")
        return True
    except Exception as e:
        print(f"FAILURE: HTTPS connection failed: {e}")
        return False

if __name__ == "__main__":
    dns_success = test_dns()
    https_success = test_https()
    
    if dns_success and https_success:
        print("\nAll checks passed.")
    else:
        print("\nSome checks failed.")
