"""Check groups in MongoDB"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.mongo import db

# Get all groups
groups = list(db.groups.find({}))
print(f'\n👥 Total groups in MongoDB: {len(groups)}\n')

if groups:
    print('Groups found:')
    for group in groups:
        name = group.get('name', 'N/A')
        subject = group.get('subject', 'N/A')
        class_level = group.get('class_level', 'N/A')
        teacher_id = group.get('teacher_id', 'N/A')
        teacher_ids = group.get('teacher_ids', [])
        
        print(f'  • Group: {name}')
        print(f'    Subject: {subject} | Class: {class_level}')
        print(f'    Teacher ID: {teacher_id}')
        print(f'    Teacher IDs: {teacher_ids}')
        print(f'    Combined: {group.get("combined", "N/A")}')
        print()
else:
    print('❌ No groups found in MongoDB!')
