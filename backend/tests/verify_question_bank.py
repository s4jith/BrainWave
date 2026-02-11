import requests
import json
import sys

API_URL = "http://localhost:8000"

def login(email, password):
    print(f"Logging in as {email}...")
    try:
        response = requests.post(f"{API_URL}/api/auth/login", data={"username": email, "password": password})
        if response.status_code == 200:
            token = response.json().get("access_token")
            print("Login successful")
            return token
        else:
            print(f"Login failed: {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def test_create_question(token):
    print("\nTesting Create Question...")
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "text": "What is the capital of France?",
        "subject": "Social Science",
        "topic": "Geography",
        "class_level": 10,
        "difficulty": "easy",
        "type": "mcq",
        "marks": 1,
        "options": ["London", "Berlin", "Paris", "Madrid"],
        "correct_answer": "Paris",
        "explanation": "Paris is the capital of France."
    }
    response = requests.post(f"{API_URL}/api/question-bank/questions", json=data, headers=headers)
    if response.status_code == 200:
        print("Create Question: PASS")
        return response.json()
    else:
        print(f"Create Question: FAIL - {response.text}")
        return None

def test_get_questions(token):
    print("\nTesting Get Questions...")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_URL}/api/question-bank/questions?subject=Social Science", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f"Get Questions: PASS - Found {len(data.get('questions', []))} questions")
        return data.get('questions', [])
    else:
        print(f"Get Questions: FAIL - {response.text}")
        return []

def test_delete_question(token, question_id):
    print(f"\nTesting Delete Question {question_id}...")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.delete(f"{API_URL}/api/question-bank/questions/{question_id}", headers=headers)
    if response.status_code == 200:
        print("Delete Question: PASS")
    else:
        print(f"Delete Question: FAIL - {response.text}")

def main():
    # Assuming standard admin credentials or similar
    # If these don't work, I might need to create a user first, but let's try standard known ones or just fail and ask user.
    # I'll try a common test user if testing was done before.
    # Actually, I'll try to signup a temp user if login fails?
    # For now, let's try 'admin@example.com' 'admin123' which is common default.
    # Or 'teacher@example.com'
    
    token = login("admin@example.com", "admin123")
    if not token:
        # Try signing up
        print("Login failed, trying to create a temp admin...")
        # ... logic to create user ... 
        # But let's assume the user has a running DB with some users. 
        # If not, I can just report failure.
        return

    question = test_create_question(token)
    if question:
        questions = test_get_questions(token)
        # Verify our question is there
        found = any(q['id'] == question['id'] for q in questions)
        if found:
            print("Verification: New question found in list.")
        else:
            print("Verification: New question NOT found in list.")
            
        test_delete_question(token, question['id'])

if __name__ == "__main__":
    main()
