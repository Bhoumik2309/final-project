from typing import Optional
from fastapi import APIRouter, Query
from app.services.google_sheets import sheets_service

router = APIRouter(prefix="/api/results", tags=["Results"])


@router.get("/")
async def get_all_results(
    section: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    subject_code: Optional[str] = Query(None),
):
    results = sheets_service.get_results_by_filter(section, academic_year, subject_code)
    return {"success": True, "results": results, "total": len(results)}


@router.get("/student/{register_number}")
async def get_student_results(register_number: str):
    all_results = sheets_service.get_all_results()
    student_results = [
        r for r in all_results
        if str(r.get("Register Number", "")).upper() == register_number.upper()
    ]
    return {"success": True, "results": student_results, "total": len(student_results)}


@router.get("/dashboard")
async def get_dashboard_stats(
    section: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    subject_code: Optional[str] = Query(None),
):
    stats = sheets_service.get_dashboard_stats(section, academic_year, subject_code)
    return {"success": True, "stats": stats}


@router.get("/sheets")
async def list_sheets_with_stats():
    """List all result sheets with basic stats."""
    sheets = sheets_service.list_results_worksheets()
    return {"success": True, "sheets": sheets, "total": len(sheets)}


@router.get("/sheets/{sheet_name}/results")
async def get_sheet_results(sheet_name: str):
    """Get all student results from a specific sheet."""
    results = sheets_service.get_sheet_results(sheet_name)
    return {"success": True, "results": results, "total": len(results)}


@router.get("/sheets/{sheet_name}/stats")
async def get_sheet_stats(sheet_name: str):
    """Get pass/fail/average stats for a specific sheet."""
    stats = sheets_service.get_sheet_stats(sheet_name)
    return {"success": True, "stats": stats}
