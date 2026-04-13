from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from app.services.google_sheets import sheets_service
from app.services.student_db import student_db

router = APIRouter(prefix="/api/students", tags=["Students"])


class CreateResultsSheetRequest(BaseModel):
    subject_name: str
    subject_code: str
    total_marks: int


# ── Student Excel upload (MongoDB) ──

@router.post("/upload-excel/{session_id}")
async def upload_student_excel(session_id: str, file: UploadFile = File(...)):
    """Upload an Excel file of students for a scanning session. Stored in MongoDB."""
    try:
        content = await file.read()
        result = student_db.upload_excel(session_id, content, file.filename)
        return result
    except Exception as e:
        return {"success": False, "message": f"Upload error: {str(e)}", "count": 0}


@router.get("/session/{session_id}")
async def get_session_students(session_id: str):
    """Get all students uploaded for a session."""
    students = student_db.get_all_students(session_id)
    return {"success": True, "students": students, "total": len(students)}


@router.get("/session/{session_id}/count")
async def get_session_student_count(session_id: str):
    count = student_db.get_student_count(session_id)
    return {"success": True, "count": count}


@router.get("/session/{session_id}/find/{register_number}")
async def find_student_in_session(session_id: str, register_number: str):
    student = student_db.find_student(session_id, register_number)
    if not student:
        return {"success": False, "message": "Student not found"}
    return {"success": True, "student": student}


# ── Results worksheet management (Google Sheets) ──

@router.get("/worksheets/list")
async def list_results_worksheets():
    sheets = sheets_service.list_results_worksheets()
    return {"success": True, "worksheets": sheets}


@router.post("/worksheets/create")
async def create_results_worksheet(req: CreateResultsSheetRequest):
    result = sheets_service.create_results_worksheet(req.subject_name, req.subject_code, req.total_marks)
    return result


@router.post("/restyle-all")
async def restyle_all_sheets():
    result = sheets_service.restyle_all_sheets()
    return result
