"""
MongoDB Reset Script — Clears all data EXCEPT admin users and platform settings.

What it KEEPS:
  - Admin users (role="admin") in the 'users' collection
  - Platform settings (admin configuration)
  - Subjects (curriculum structure)
  - Books & book_chapters (uploaded book metadata)
  - Pinecone data is NOT touched at all

What it DELETES:
  - All non-admin users (teachers, heads, students)
  - All student/teacher counters
  - Chat sessions, evaluations, notes, annotations
  - Tests, test submissions, test sessions
  - Question papers, question bank, generated questions
  - Assessments, submissions, gradebook data
  - Notifications, support tickets, queries, suggestions, feedback
  - LLM cache (gemini_quota_tracker)
  - All other transactional/session data

Usage:
  cd backend
  python -m scripts.reset_mongodb
  
  # Or with --dry-run to preview without deleting:
  python -m scripts.reset_mongodb --dry-run
"""

import sys
import os

# Add backend to path so app imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from app.core.config import settings

# ---------------------------------------------------------------------------
# Collections to DROP entirely (all documents removed, collection deleted)
# ---------------------------------------------------------------------------
COLLECTIONS_TO_DROP = [
    # === User-related (non-admin) ===
    "student_counters",
    "teacher_counters",
    "head_counters",
    "user_activities",
    "students",                    # student_level data
    "password_resets",

    # === Chat & AI cache ===
    "chat_sessions",
    "gemini_quota_tracker",

    # === Notes & Annotations ===
    "notes",
    "smart_notes",
    "flashcard_sets",
    "annotation_history",
    "evaluations",

    # === Tests & Assessments ===
    "tests",
    "test_submissions",
    "test_sessions",
    "staff_tests",
    "assessments",
    "submissions",

    # === Question Bank ===
    "questions",
    "question_delete_requests",
    "question_papers",
    "question_answer_pairs",
    "generated_questions",
    "topic_question_bank",
    "top_questions",

    # === Student Progress ===
    "student_topic_performance",
    "student_subject_progress",

    # === Groups ===
    "groups",
    "head_assignments",

    # === Communication ===
    "notifications",
    "dismissed_notifications",
    "queries",
    "suggestions",
    "support_tickets",
    "contact_messages",
    "feedback",
    "faqs",

    # === Courses & Curriculum (transactional) ===
    "courses",
    "pending_curriculum",
]

# ---------------------------------------------------------------------------
# Collections to PARTIALLY clean (keep admin rows, delete rest)
# ---------------------------------------------------------------------------
# "users" — delete all where role != "admin"

# ---------------------------------------------------------------------------
# Collections to KEEP completely untouched
# ---------------------------------------------------------------------------
COLLECTIONS_TO_KEEP = [
    "users",               # admin users preserved (non-admins deleted separately)
    "platform_settings",   # admin configuration
    "subjects",            # curriculum structure (Maths, Physics, etc.)
    "books",               # uploaded book metadata
    "book_chapters",       # chapter metadata
]


def reset_mongodb(dry_run: bool = False):
    """
    Reset MongoDB — delete all data except admin users and config.
    
    Args:
        dry_run: If True, only print what would be deleted without actually deleting.
    """
    print("=" * 60)
    print("  MongoDB Reset Script")
    print("  Database:", settings.MONGO_URI.split("@")[-1].split("/")[0] if "@" in settings.MONGO_URI else "local")
    print("  Mode:", "DRY RUN (no changes)" if dry_run else "LIVE — WILL DELETE DATA")
    print("=" * 60)
    print()

    client = MongoClient(settings.MONGO_URI)
    db = client.ncert_learning_db

    # Get all existing collections
    existing_collections = set(db.list_collection_names())
    print(f"Found {len(existing_collections)} collections in database\n")

    # --- Step 1: Clean users (keep only admins) ---
    users_col = db["users"]
    total_users = users_col.count_documents({})
    admin_count = users_col.count_documents({"role": "admin"})
    non_admin_count = total_users - admin_count

    print(f"[users] Total: {total_users} | Admins (KEEP): {admin_count} | Non-admins (DELETE): {non_admin_count}")

    if not dry_run and non_admin_count > 0:
        result = users_col.delete_many({"role": {"$ne": "admin"}})
        print(f"  -> Deleted {result.deleted_count} non-admin users")
    print()

    # --- Step 2: Drop entire collections ---
    dropped = 0
    skipped = 0
    print("Dropping collections:")
    print("-" * 40)

    for col_name in sorted(COLLECTIONS_TO_DROP):
        if col_name in existing_collections:
            doc_count = db[col_name].count_documents({})
            print(f"  DROP  {col_name:40s}  ({doc_count:,} documents)")
            if not dry_run:
                db[col_name].drop()
            dropped += 1
        else:
            skipped += 1

    print()

    # --- Step 3: Report kept collections ---
    print("Kept (untouched):")
    print("-" * 40)
    for col_name in COLLECTIONS_TO_KEEP:
        if col_name in existing_collections:
            doc_count = db[col_name].count_documents({})
            label = f"(admins only: {admin_count})" if col_name == "users" else f"({doc_count:,} documents)"
            print(f"  KEEP  {col_name:40s}  {label}")
    print()

    # --- Step 4: Check for unknown collections ---
    known = set(COLLECTIONS_TO_DROP) | set(COLLECTIONS_TO_KEEP)
    unknown = existing_collections - known - {"system.version"}
    if unknown:
        print("Unknown collections (not in script — left untouched):")
        print("-" * 40)
        for col_name in sorted(unknown):
            doc_count = db[col_name].count_documents({})
            print(f"  ???   {col_name:40s}  ({doc_count:,} documents)")
        print()

    # --- Summary ---
    print("=" * 60)
    print(f"  Collections dropped: {dropped}")
    print(f"  Collections skipped (not in DB): {skipped}")
    print(f"  Non-admin users deleted: {non_admin_count}")
    print(f"  Admin users preserved: {admin_count}")
    print(f"  Pinecone: NOT TOUCHED")
    if dry_run:
        print("\n  *** DRY RUN — no changes were made ***")
    else:
        print("\n  DONE — Database has been reset.")
    print("=" * 60)

    client.close()


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv

    if not dry_run:
        print("\n WARNING: This will DELETE all MongoDB data except admin users!")
        print("  Run with --dry-run first to preview.\n")
        confirm = input("  Type 'YES' to proceed: ")
        if confirm.strip() != "YES":
            print("  Aborted.")
            sys.exit(0)
        print()

    reset_mongodb(dry_run=dry_run)
