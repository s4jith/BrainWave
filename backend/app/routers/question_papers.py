from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from typing import Optional, List
from app.db.mongo import mongodb
from app.core.permissions import get_current_user, require_role
from app.models.rbac_models import UserRole, TokenData
from pydantic import BaseModel, Field
from bson import ObjectId
from datetime import datetime
import google.generativeai as genai
from app.services.gemini_key_manager import gemini_key_manager
import json
import re
import logging
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/question-papers", tags=["question-papers"])


class ManualQuestion(BaseModel):
    text: str
    type: str = Field(..., pattern="^(mcq|fillup|true_false|short_answer|long_answer)$")
    marks: int = Field(..., ge=1)
    options: List[str] = []
    correct_answer: str = ""
    section: str = ""


class CreatePaperManual(BaseModel):
    title: str
    paper_type: str
    class_level: int = Field(..., ge=1, le=12)
    subject: str
    year: int = Field(..., ge=2000, le=2099)
    questions: List[ManualQuestion]


class UpdatePaperData(BaseModel):
    title: Optional[str] = None
    paper_type: Optional[str] = None
    class_level: Optional[int] = None
    subject: Optional[str] = None
    year: Optional[int] = None
    questions: Optional[List[ManualQuestion]] = None


@router.get("/metadata")
async def get_metadata(
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.HEAD]))
):
    from app.db.mongo import db

    def normalize_subject(s):
        return "Maths" if s.lower() == "mathematics" else s

    def build_subjects_data(subject_class_map):
        result = []
        for subj in sorted(subject_class_map.keys()):
            result.append({
                "subject": normalize_subject(subj),
                "class_levels": sorted(list(subject_class_map[subj]))
            })
        return result

    def get_years_and_types():
        try:
            years = list(db.question_papers.distinct("year"))
            types = list(db.question_papers.distinct("paper_type"))
        except Exception:
            years, types = [], []
        return sorted([y for y in years if y], reverse=True), sorted([t for t in types if t])

    if current_user.role == UserRole.TEACHER:
        teacher_user = db.users.find_one({"user_id": current_user.user_id})
        teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None

        group_query = {
            "$or": [
                {"teacher_id": current_user.user_id},
                {"teacher_ids": current_user.user_id}
            ]
        }
        if teacher_mongo_id and teacher_mongo_id != current_user.user_id:
            group_query["$or"].extend([
                {"teacher_id": teacher_mongo_id},
                {"teacher_ids": teacher_mongo_id}
            ])

        teacher_groups = list(db.groups.find(group_query, {"subject": 1, "class_level": 1}))
        subject_class_map = {}
        for g in teacher_groups:
            subj = g.get("subject")
            cl = g.get("class_level")
            if subj and cl:
                if subj not in subject_class_map:
                    subject_class_map[subj] = set()
                subject_class_map[subj].add(cl)

        years, types = get_years_and_types()
        return {"subjects": build_subjects_data(subject_class_map), "years": years, "paper_types": types}

    if current_user.role == UserRole.HEAD:
        head_user = db.users.find_one({"user_id": current_user.user_id})
        assignment_type = head_user.get("assignment_type", "class") if head_user else "class"
        assigned_classes = head_user.get("assigned_classes", []) if head_user else []
        assigned_subjects = head_user.get("assigned_subjects", []) if head_user else []

        q_pipeline = list(db.questions.aggregate([
            {"$group": {"_id": {"subject": "$subject", "class_level": "$class_level"}}},
        ]))
        b_pipeline = list(db.books.aggregate([
            {"$group": {"_id": {"subject": "$subject", "class_level": "$class_level"}}},
        ]))

        subject_class_map = {}
        for item in q_pipeline + b_pipeline:
            subj = item["_id"].get("subject")
            cl = item["_id"].get("class_level")
            if subj and cl:
                if subj not in subject_class_map:
                    subject_class_map[subj] = set()
                subject_class_map[subj].add(cl)

        subjects_data = []
        for subj in sorted(subject_class_map.keys()):
            normalized = normalize_subject(subj)
            all_levels = sorted(list(subject_class_map[subj]))
            if assignment_type == "subject":
                # Filter to assigned subjects (check both raw and normalized name)
                if assigned_subjects and subj not in assigned_subjects and normalized not in assigned_subjects:
                    continue
                subjects_data.append({"subject": normalized, "class_levels": all_levels})
            else:
                # Filter class_levels to assigned ones
                if assigned_classes:
                    filtered_levels = [cl for cl in all_levels if cl in assigned_classes]
                    if not filtered_levels:
                        continue
                    subjects_data.append({"subject": normalized, "class_levels": filtered_levels})
                else:
                    subjects_data.append({"subject": normalized, "class_levels": all_levels})

        years, types = get_years_and_types()
        return {"subjects": subjects_data, "years": years, "paper_types": types}

    # Admin: all subjects from questions + books
    q_pipeline = list(db.questions.aggregate([
        {"$group": {"_id": {"subject": "$subject", "class_level": "$class_level"}}},
    ]))
    b_pipeline = list(db.books.aggregate([
        {"$group": {"_id": {"subject": "$subject", "class_level": "$class_level"}}},
    ]))

    subject_class_map = {}
    for item in q_pipeline + b_pipeline:
        subj = item["_id"].get("subject")
        cl = item["_id"].get("class_level")
        if subj and cl:
            normalized = normalize_subject(subj)
            if normalized not in subject_class_map:
                subject_class_map[normalized] = set()
            subject_class_map[normalized].add(cl)

    subjects_data = []
    for subj in sorted(subject_class_map.keys()):
        subjects_data.append({
            "subject": subj,
            "class_levels": sorted(list(subject_class_map[subj]))
        })

    years, types = get_years_and_types()
    return {"subjects": subjects_data, "years": years, "paper_types": types}



@router.get("")
async def list_papers(
    class_level: Optional[int] = Query(None),
    subject: Optional[str] = Query(None),
    paper_type: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.HEAD]))
):
    # Build explicit filters (applied on top of visibility)
    filter_conditions = {}
    if class_level:
        filter_conditions["class_level"] = class_level
    if subject:
        filter_conditions["subject"] = {"$regex": f"^{subject}$", "$options": "i"}
    if paper_type:
        filter_conditions["paper_type"] = paper_type
    if year:
        filter_conditions["year"] = year
    if status:
        filter_conditions["status"] = status

    if current_user.role == UserRole.TEACHER:
        # Teacher sees: only papers (own or others) matching their assigned groups' class+subject
        # Look up teacher's mongo _id too — teacher_ids may store either user_id or mongo _id
        from app.db.mongo import db as sync_db
        teacher_doc = sync_db.users.find_one({"user_id": current_user.user_id})
        teacher_mongo_id = str(teacher_doc["_id"]) if teacher_doc else None

        group_or_conditions = [
            {"teacher_id": current_user.user_id},
            {"teacher_ids": current_user.user_id},
        ]
        if teacher_mongo_id and teacher_mongo_id != current_user.user_id:
            group_or_conditions.extend([
                {"teacher_id": teacher_mongo_id},
                {"teacher_ids": teacher_mongo_id},
            ])

        teacher_groups = await mongodb.db.groups.find(
            {"$or": group_or_conditions},
            {"subject": 1, "class_level": 1}
        ).to_list(None)

        visibility_or = []
        for g in teacher_groups:
            subj = g.get("subject")
            cl = g.get("class_level")
            if subj and cl:
                # Own papers (any status) only for their assigned class+subject
                visibility_or.append({
                    "created_by": current_user.user_id,
                    "subject": subj,
                    "class_level": cl
                })
                # Other approved papers for their assigned class+subject
                visibility_or.append({
                    "status": "approved",
                    "subject": subj,
                    "class_level": cl
                })

        if not visibility_or:
            # Teacher has no group assignments — return nothing
            return {"papers": [], "total": 0, "page": 1, "pages": 0}

        if filter_conditions:
            query = {"$and": [filter_conditions, {"$or": visibility_or}]}
        else:
            query = {"$or": visibility_or}
    else:
        # Admin sees everything
        query = filter_conditions

    logger.info(f"list_papers query for {current_user.user_id} (role={current_user.role}): {query}")
    total = await mongodb.db.question_papers.count_documents(query)
    cursor = mongodb.db.question_papers.find(query).sort("created_at", -1).skip(offset).limit(limit)
    papers = []
    async for doc in cursor:
        papers.append({
            "id": str(doc["_id"]),
            "title": doc.get("title"),
            "paper_type": doc.get("paper_type"),
            "class_level": doc.get("class_level"),
            "subject": doc.get("subject"),
            "year": doc.get("year"),
            "question_count": len(doc.get("questions", [])),
            "created_by": doc.get("created_by"),
            "created_at": doc.get("created_at"),
            "source": doc.get("source", "manual"),
            "status": doc.get("status", "approved"),
        })

    return {
        "papers": papers,
        "total": total,
        "page": (offset // limit) + 1,
        "pages": (total + limit - 1) // limit
    }


@router.get("/{paper_id}")
async def get_paper(
    paper_id: str,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.HEAD]))
):
    if not ObjectId.is_valid(paper_id):
        raise HTTPException(status_code=400, detail="Invalid paper ID")

    doc = await mongodb.db.question_papers.find_one({"_id": ObjectId(paper_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Paper not found")

    return {
        "id": str(doc["_id"]),
        "title": doc.get("title"),
        "paper_type": doc.get("paper_type"),
        "class_level": doc.get("class_level"),
        "subject": doc.get("subject"),
        "year": doc.get("year"),
        "questions": doc.get("questions", []),
        "created_by": doc.get("created_by"),
        "created_at": doc.get("created_at"),
        "source": doc.get("source", "manual"),
        "status": doc.get("status", "approved"),
    }


@router.post("")
async def create_paper_manual(
    data: CreatePaperManual,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    questions = []
    for i, q in enumerate(data.questions):
        questions.append({
            "order": i + 1,
            "text": q.text,
            "type": q.type,
            "marks": q.marks,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "section": q.section,
        })

    doc = {
        "title": data.title,
        "paper_type": data.paper_type,
        "class_level": data.class_level,
        "subject": data.subject,
        "year": data.year,
        "questions": questions,
        "source": "manual",
        "status": "approved" if current_user.role in (UserRole.ADMIN, UserRole.HEAD) else "pending",
        "teacher_id": current_user.user_id if current_user.role == UserRole.TEACHER else None,
        "created_by": current_user.user_id,
        "created_at": datetime.utcnow().isoformat(),
    }

    result = await mongodb.db.question_papers.insert_one(doc)
    
    if current_user.role == UserRole.TEACHER:
        return {"id": str(result.inserted_id), "message": "Question paper submitted for approval"}
    return {"id": str(result.inserted_id), "message": "Question paper created successfully"}


@router.post("/extract-pdf")
async def extract_from_pdf(
    pdf_file: UploadFile = File(...),
    title: str = Form(...),
    paper_type: str = Form(...),
    class_level: int = Form(...),
    subject: str = Form(...),
    year: int = Form(...),
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    if not pdf_file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    content = await pdf_file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF file too large (max 20MB)")

    try:
        api_key = gemini_key_manager.get_available_key()
        if not api_key:
            raise HTTPException(status_code=503, detail="All Gemini API keys exhausted")

        genai.configure(api_key=api_key)

        # Extract text locally with PyMuPDF — much faster than sending
        # binary PDF to Gemini, and avoids 504 timeouts.
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            pdf_text = "\n".join(page.get_text() for page in doc)
            doc.close()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")

        if not pdf_text.strip():
            raise HTTPException(status_code=400, detail="PDF appears to be scanned/image-only. Please use a text-based PDF.")

        prompt = f"""Analyze this question paper text for Class {class_level} {subject}.

QUESTION PAPER TEXT:
{pdf_text[:15000]}

---

Extract ALL questions from the paper and organize them into a structured JSON array.

For each question, determine:
1. "text": The complete question text
2. "type": One of: "mcq", "fillup", "true_false", "short_answer", "long_answer"
3. "marks": The mark value (1, 2, 3, 5, etc.) - infer from section headers if not explicit
4. "options": Array of option strings (for MCQ only, e.g. ["Option A text", "Option B text", "Option C text", "Option D text"])
5. "correct_answer": The correct answer if visible in the paper, otherwise empty string
6. "section": Section label from the paper (e.g. "Section A - 1 Mark", "Section B - 2 Marks")

Rules:
- Preserve the original question numbering in the text
- For fill-in-the-blank questions, keep the blank as _______
- For true/false, set type as "true_false"
- MCQ must have options array with the actual option texts
- If marks are mentioned in section headers (e.g. "1 mark questions"), apply to all questions in that section
- Extract every single question, do not skip any

Return ONLY a valid JSON array. No markdown, no explanation.
Example: [{{"text":"What is photosynthesis?","type":"short_answer","marks":2,"options":[],"correct_answer":"","section":"Section B"}}]

JSON:"""

        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(
            prompt,
            generation_config={"temperature": 0.2, "max_output_tokens": 16384}
        )

        text = response.text.strip()

        try:
            questions = json.loads(text)
        except json.JSONDecodeError:
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            text = re.sub(r",\s*([}\]])", r"\1", text)
            text = re.sub(r"[\x00-\x1f]", " ", text)
            questions = json.loads(text)

        if not isinstance(questions, list):
            raise HTTPException(status_code=500, detail="Failed to parse questions from PDF")

        cleaned_questions = []
        for i, q in enumerate(questions):
            q_type = q.get("type", "short_answer").lower().replace(" ", "_")
            valid_types = ["mcq", "fillup", "true_false", "short_answer", "long_answer"]
            if q_type in ("fill_in_the_blank", "fill_up"):
                q_type = "fillup"
            if q_type not in valid_types:
                q_type = "short_answer"

            cleaned_questions.append({
                "order": i + 1,
                "text": q.get("text", ""),
                "type": q_type,
                "marks": q.get("marks", 1),
                "options": q.get("options", []),
                "correct_answer": q.get("correct_answer", ""),
                "section": q.get("section", ""),
            })

        doc = {
            "title": title,
            "paper_type": paper_type,
            "class_level": class_level,
            "subject": subject,
            "year": year,
            "questions": cleaned_questions,
            "source": "pdf_extracted",
            "status": "approved" if current_user.role in (UserRole.ADMIN, UserRole.HEAD) else "pending",
            "teacher_id": current_user.user_id if current_user.role == UserRole.TEACHER else None,
            "original_filename": pdf_file.filename,
            "created_by": current_user.user_id,
            "created_at": datetime.utcnow().isoformat(),
        }

        result = await mongodb.db.question_papers.insert_one(doc)

        if current_user.role in (UserRole.ADMIN, UserRole.HEAD):
            msg = f"Extracted {len(cleaned_questions)} questions. Paper saved and approved."
        else:
            msg = f"Extracted {len(cleaned_questions)} questions. Paper submitted for head approval."

        return {
            "id": str(result.inserted_id),
            "question_count": len(cleaned_questions),
            "questions": cleaned_questions,
            "message": msg
        }

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error during PDF extraction: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse Gemini response as JSON")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract questions: {str(e)}")


@router.post("/{paper_id}/approve")
async def approve_paper(
    paper_id: str,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.HEAD]))
):
    # Only Head and Admin can approve papers
    if not ObjectId.is_valid(paper_id):
        raise HTTPException(status_code=400, detail="Invalid paper ID")

    result = await mongodb.db.question_papers.update_one(
        {"_id": ObjectId(paper_id)},
        {"$set": {"status": "approved", "approved_by": current_user.user_id, "approved_at": datetime.utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paper not found")

    return {"message": "Paper approved successfully"}


@router.post("/{paper_id}/reject")
async def reject_paper(
    paper_id: str,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.HEAD]))
):
    # Only Head and Admin can reject papers
    if not ObjectId.is_valid(paper_id):
        raise HTTPException(status_code=400, detail="Invalid paper ID")

    result = await mongodb.db.question_papers.update_one(
        {"_id": ObjectId(paper_id)},
        {"$set": {"status": "rejected", "rejected_by": current_user.user_id, "rejected_at": datetime.utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paper not found")

    return {"message": "Paper rejected"}


@router.put("/{paper_id}")
async def update_paper(
    paper_id: str,
    data: UpdatePaperData,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    if not ObjectId.is_valid(paper_id):
        raise HTTPException(status_code=400, detail="Invalid paper ID")

    update_fields = {}
    if data.title is not None:
        update_fields["title"] = data.title
    if data.paper_type is not None:
        update_fields["paper_type"] = data.paper_type
    if data.class_level is not None:
        update_fields["class_level"] = data.class_level
    if data.subject is not None:
        update_fields["subject"] = data.subject
    if data.year is not None:
        update_fields["year"] = data.year
    if data.questions is not None:
        questions = []
        for i, q in enumerate(data.questions):
            questions.append({
                "order": i + 1,
                "text": q.text,
                "type": q.type,
                "marks": q.marks,
                "options": q.options,
                "correct_answer": q.correct_answer,
                "section": q.section,
            })
        update_fields["questions"] = questions

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updated_at"] = datetime.utcnow().isoformat()

    result = await mongodb.db.question_papers.update_one(
        {"_id": ObjectId(paper_id)}, {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paper not found")

    return {"message": "Paper updated successfully"}


@router.delete("/{paper_id}")
async def delete_paper(
    paper_id: str,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    if not ObjectId.is_valid(paper_id):
        raise HTTPException(status_code=400, detail="Invalid paper ID")

    result = await mongodb.db.question_papers.delete_one({"_id": ObjectId(paper_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paper not found")

    return {"message": "Paper deleted successfully"}


@router.post("/{paper_id}/add-to-bank")
async def add_paper_questions_to_bank(
    paper_id: str,
    current_user: TokenData = Depends(require_role([UserRole.ADMIN, UserRole.TEACHER]))
):
    if not ObjectId.is_valid(paper_id):
        raise HTTPException(status_code=400, detail="Invalid paper ID")

    doc = await mongodb.db.question_papers.find_one({"_id": ObjectId(paper_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Paper not found")

    if doc.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Only approved papers can be added to the question bank")

    questions = doc.get("questions", [])
    if not questions:
        raise HTTPException(status_code=400, detail="No questions in this paper")

    now = datetime.utcnow().isoformat()
    added = 0
    for q in questions:
        if not q.get("text"):
            continue
        q_doc = {
            "text": q["text"],
            "subject": doc["subject"],
            "class_level": doc["class_level"],
            "chapter": 0,
            "type": q.get("type", "short_answer"),
            "difficulty": "medium",
            "marks": q.get("marks", 1),
            "options": q.get("options", []),
            "correct_answer": q.get("correct_answer", ""),
            "status": "pending",
            "created_by": current_user.user_id,
            "created_role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
            "created_at": now,
            "source_paper": str(doc["_id"]),
            "source_paper_title": doc.get("title", ""),
        }
        await mongodb.db.questions.insert_one(q_doc)
        added += 1

    return {"message": f"Added {added} questions to the question bank (pending approval)", "count": added}
