"""Check questions in MongoDB"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.mongo import db

# Get all questions
questions = list(db.questions.find({}))
print(f'\n📝 Total questions in MongoDB: {len(questions)}\n')

if questions:
    print('Questions found:')
    for q in questions:
        question_text = q.get('question_text', 'N/A')
        subject = q.get('subject', 'N/A')
        class_level = q.get('class_level', 'N/A')
        status = q.get('status', 'N/A')
        difficulty = q.get('difficulty', 'N/A')
        type_ = q.get('type', 'N/A')
        
        print(f'  • Question: {question_text[:80]}...')
        print(f'    Subject: {subject} | Class: {class_level}')
        print(f'    Status: {status} | Type: {type_} | Difficulty: {difficulty}')
        print(f'    Created by: {q.get("created_by", "N/A")}')
        print()
else:
    print('❌ No questions found in MongoDB!')
