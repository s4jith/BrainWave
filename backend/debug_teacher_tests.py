"""
Debug script to check why teacher3 is not seeing tests
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    # Connect to MongoDB
    mongo_uri = os.getenv("MONGO_URI")
    client = AsyncIOMotorClient(mongo_uri)
    db = client.ncert_learning_db  # Use the actual database name
    
    teacher_id = "staff_6_teacher3"  # The actual user_id from the database
    
    print("=" * 60)
    print(f"🔍 Debugging Teacher Tests for: {teacher_id}")
    print("=" * 60)
    
    # 0. Check all groups to see what teacher IDs look like
    print("\n0️⃣ Checking ALL groups in database...")
    all_groups = await db.groups.find({}).to_list(length=100)
    print(f"   Total groups: {len(all_groups)}")
    for g in all_groups:
        print(f"   - {g.get('name')}")
        print(f"     _id: {g['_id']}")
        print(f"     teacher_id: {g.get('teacher_id')} (type: {type(g.get('teacher_id'))})")
        print(f"     teacher_ids: {g.get('teacher_ids')} (type: {type(g.get('teacher_ids'))})")
    
    # Check what teacher3's actual _id is
    print("\n📋 Checking all teacher users...")
    all_teachers = await db.users.find({"role": "teacher"}).to_list(length=100)
    print(f"   Found {len(all_teachers)} teachers:")
    for t in all_teachers:
        print(f"   - _id: {t['_id']}")
        print(f"     user_id: {t.get('user_id')}")
        print(f"     name: {t.get('name')}")
        print(f"     email: {t.get('email')}")
    
    teacher_user = await db.users.find_one({"user_id": teacher_id})
    if teacher_user:
        print(f"   Found teacher3:")
        print(f"   - _id (MongoDB): {teacher_user['_id']}")
        print(f"   - user_id: {teacher_user.get('user_id')}")
        print(f"   - name: {teacher_user.get('name')}")
        
        # Check if this _id matches any group's teacher_id
        matching_id = str(teacher_user['_id'])
        print(f"\n   Checking if this _id ({matching_id}) is in any group...")
        for g in all_groups:
            if g.get('teacher_id') == matching_id or matching_id in g.get('teacher_ids', []):
                print(f"   ✅ FOUND MATCH: Group '{g.get('name')}' has this teacher!")
    else:
        print(f"   ❌ teacher3 user not found!")
    
    # 1. Find teacher's groups
    print("\n1️⃣ Finding teacher's groups (with new logic)...")
    
    # Get teacher's MongoDB _id
    teacher_user = await db.users.find_one({"user_id": teacher_id})
    teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None
    
    print(f"   Teacher user_id: {teacher_id}")
    print(f"   Teacher MongoDB _id: {teacher_mongo_id}")
    
    # Build query supporting both user_id and MongoDB _id
    group_query = {
        "$or": [
            {"teacher_id": teacher_id},
            {"teacher_ids": teacher_id}
        ]
    }
    
    if teacher_mongo_id and teacher_mongo_id != teacher_id:
        group_query["$or"].extend([
            {"teacher_id": teacher_mongo_id},
            {"teacher_ids": teacher_mongo_id}
        ])
    
    print(f"   Group query: {group_query}")
    
    groups = await db.groups.find(group_query).to_list(length=100)
    
    print(f"   Found {len(groups)} groups:")
    teacher_group_ids = []
    for g in groups:
        group_id = str(g["_id"])
        teacher_group_ids.append(group_id)
        print(f"   - {g.get('name')} (ID: {group_id})")
        print(f"     Class: {g.get('class_level')}, Subject: {g.get('subject')}")
    
    # 2. Find all assessments
    print("\n2️⃣ Finding all assessments...")
    all_assessments = await db.assessments.find({}).to_list(length=100)
    print(f"   Total assessments in DB: {len(all_assessments)}")
    
    for assessment in all_assessments:
        print(f"\n   📝 Assessment: {assessment.get('title')}")
        print(f"      ID: {assessment['_id']}")
        print(f"      Created by: {assessment.get('instructor_id')}")
        print(f"      Subject: {assessment.get('subject')}")
        print(f"      Class: {assessment.get('class_level')}")
        print(f"      group_ids: {assessment.get('group_ids', [])}")
        print(f"      group_ids type: {type(assessment.get('group_ids', []))}")
        if assessment.get('group_ids'):
            print(f"      group_ids[0] type: {type(assessment.get('group_ids')[0])}")
    
    # 3. Check if teacher's groups match any assessment group_ids
    print("\n3️⃣ Checking matches...")
    print(f"   Teacher group IDs (as strings): {teacher_group_ids}")
    
    for assessment in all_assessments:
        assessment_group_ids = assessment.get('group_ids', [])
        if assessment_group_ids:
            # Check string match
            string_matches = [gid for gid in teacher_group_ids if gid in assessment_group_ids]
            if string_matches:
                print(f"   ✅ MATCH: {assessment.get('title')} - {string_matches}")
            else:
                print(f"   ❌ NO MATCH: {assessment.get('title')}")
                print(f"      Assessment group_ids: {assessment_group_ids}")
                print(f"      Teacher group_ids: {teacher_group_ids}")
    
    # 4. Test the actual query used by the backend
    print("\n4️⃣ Testing backend query...")
    
    # Build query like backend does
    criteria = []
    for g in groups:
        if g.get("class_level") and g.get("subject"):
            criteria.append({
                "class_level": g.get("class_level"),
                "subject": g.get("subject")
            })
    
    # Get admin IDs
    admins = await db.users.find({"role": "admin"}, {"user_id": 1}).to_list(length=100)
    admin_ids = [a["user_id"] for a in admins]
    
    or_queries = [{"instructor_id": teacher_id}]
    
    # Tests assigned to teacher's groups
    if teacher_group_ids:
        or_queries.append({"group_ids": {"$in": teacher_group_ids}})
    
    # Admin tests matching subject/class criteria
    if criteria and admin_ids:
        admin_tests_query = {
            "instructor_id": {"$in": admin_ids},
            "$or": criteria
        }
        or_queries.append(admin_tests_query)
    
    query = {"$or": or_queries}
    
    print(f"   Query: {query}")
    
    matching = await db.assessments.find(query).to_list(length=100)
    print(f"\n   Query returned {len(matching)} assessments:")
    for a in matching:
        print(f"   - {a.get('title')} (matched by: ", end="")
        if a.get('instructor_id') == teacher_id:
            print("own test)")
        elif a.get('group_ids') and any(gid in teacher_group_ids for gid in a.get('group_ids', [])):
            print("group assignment)")
        else:
            print("subject/class match)")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
