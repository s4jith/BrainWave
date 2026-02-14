# Staged Hybrid Filtering - Implementation Plan

## Status: PENDING REVIEW

## The Problem

Currently, `enhanced_rag_service.py` queries Pinecone **without any metadata filters** — only by namespace (subject). This means:

1. A Class 10 student asking about "quadratic equations" searches **all** vectors in the `mathematics` namespace
2. Gets back chunks from Class 6, 7, 8, 9, 10, 11, 12 — mixed together
3. Irrelevant chunks dilute results → low similarity scores → 0 chunks pass threshold
4. Logs show: `"Querying namespace: mathematics without metadata filters"` → `"5 matches found"` → `"0 chunks passed threshold"`

The old `retrieval_service.py` **had** proper metadata filtering (`{"class": class_level}`) but `enhanced_rag_service.py` removed it with the comment "SIMPLIFIED: Query ALL vectors in namespace without class_level filter".

---

## The Solution: 3-Stage Hybrid Filtering

### Stage 1: Pre-Filter (Indexed Metadata)
> **Filter BEFORE vector search** — uses Pinecone's native metadata filtering

- **Filter by**: `class` (student's class level + prerequisite classes)
- **Optional**: `chapter_number` / `chapter` (if student is in a specific chapter context)
- **Effect**: 100K+ vectors → narrowed to ~500-2000 relevant vectors
- **Cost**: Near-zero — Pinecone does this at index level, no extra latency

**What changes:**
```python
# BEFORE (current - broken)
results = self.textbook_db.index.query(
    namespace=namespace,
    vector=query_embedding,
    top_k=5,
    include_metadata=True
)

# AFTER (with pre-filter)
metadata_filter = {
    "class": {"$in": [str(c) for c in classes_to_search]}
}
# Optional: add chapter filter if provided
if chapter:
    metadata_filter["chapter_number"] = chapter

results = self.textbook_db.index.query(
    namespace=namespace,
    vector=query_embedding,
    top_k=5,
    include_metadata=True,
    filter=metadata_filter
)
```

### Stage 2: ANN Vector Search (Semantic Ranking)
> **Already implemented** — Pinecone's approximate nearest neighbor search

- Runs on the **pre-filtered subset** from Stage 1
- Returns top-K vectors ranked by cosine similarity
- No code changes needed — Pinecone handles this automatically when `filter` + `vector` are both provided

### Stage 3: Post-Filter (Score Threshold + Validation)
> **Already implemented** — Python-side filtering after results come back

- Score threshold: `0.3` for basic mode, `0.2` for deep-dive
- Validates chunk has text content
- Sorts by score descending

**Minor improvement**: Add class-level weighting so chunks from the student's exact class rank higher:
```python
# Boost score for exact class match
if chunk_class == student_class:
    effective_score = score * 1.1  # 10% boost for exact class
else:
    effective_score = score
```

---

## Files to Modify

### 1. `backend/app/services/enhanced_rag_service.py`

**Method**: `query_multi_class()` (lines ~190-265)

**Changes**:
- Add `filter` parameter to Pinecone query with `class` metadata
- Handle metadata key inconsistency (`class` vs `class_level` — data uses `class`)
- Keep Python-side fallback: if filtered query returns 0 results, retry without filter
- Add optional `chapter` filter parameter

### 2. No other files need changes
- `annotation.py` calls `answer_annotation_basic()` which calls `query_multi_class()` — inherits the fix
- `chat.py` streaming endpoint calls `query_multi_class()` — inherits the fix
- Upload scripts don't change — metadata already exists in Pinecone

---

## Known Metadata Key Issue

Different upload scripts stored metadata with different key names:

| Upload Script | Class Key | Chapter Key | Page Key |
|---|---|---|---|
| `upload_pdfs_to_pinecone.py` | `class` (string "6") | `lesson_number` | — |
| `process_ncert_maths.py` | `class` (int) | `chapter` | `page` |
| `process_ncert_physics.py` | `class` (int) | `chapter` | `page` |
| `enhanced_rag_service.py` reads | `class_level` ❌ | `chapter_number` | `page_number` |

**Fix**: Query filter should use `class` (the actual stored key). The read-side code already tries both:
```python
chunk_class = metadata.get('class_level', metadata.get('class', 0))
```
But the filter must use the correct key that exists in the index.

**Important**: `class` values may be stored as strings in some uploads and ints in others. The filter should handle both:
```python
# Handle mixed types: try both int and string
class_values = []
for c in classes_to_search:
    class_values.extend([c, str(c)])

metadata_filter = {"class": {"$in": class_values}}
```

---

## Implementation Steps

1. **Update `query_multi_class()`** to add metadata filter with `class` key
2. **Add fallback**: If filtered query returns 0 results, retry without filter (safety net)
3. **Fix metadata reading**: Use `class` instead of `class_level` as primary key
4. **Add chapter filter**: Accept optional `chapter` parameter for annotation context
5. **Add class-boost scoring**: Slightly prefer chunks from exact class level
6. **Test**: Verify with actual queries that chunks now pass threshold

---

## Expected Impact

| Metric | Before | After |
|---|---|---|
| Chunks passing threshold | 0 of 5 | 3-5 of 5 |
| Answer quality | Fallback/general knowledge | Textbook-grounded |
| Query latency | Same | Same or faster (smaller search space) |
| Cache hit rate | Low (bad answers stored) | Higher (good answers cached) |

---

## Risk Assessment

- **Low risk**: Pinecone natively supports metadata filtering — well-documented, no performance penalty
- **Fallback safety**: If filter is too restrictive (0 results), retry without filter
- **No data migration needed**: Metadata already exists in Pinecone, just not being used
- **Backward compatible**: No API changes, no frontend changes

---

## Verdict

**YES, this works perfectly for the NCERT system.** The staged hybrid filtering approach directly solves the core retrieval problem. The metadata pre-filter is the critical missing piece — the data already has `class` metadata stored, we just need to use it in queries.
