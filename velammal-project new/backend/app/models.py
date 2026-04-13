from pydantic import BaseModel
from typing import Optional, List, Dict


# ── Exam format templates based on total marks ──
# 100-mark Mid Term format
FORMAT_MIDTERM = {
    "exam_type": "Mid Term",
    "total_marks": 100,
    "part_a": {
        "label": "PART - A",
        "questions": 10,         # Q1..Q10
        "marks_each": 2,
        "max_marks": 20,
    },
    "part_bc": {
        "label": "PART - B & C",
        "questions_start": 11,   # Q11..Q16
        "questions_end": 16,
        "sub_parts": ["a", "b"],
        "mark_columns": ["i", "ii", "iii"],
        "max_marks": 80,
    },
    "course_outcomes": {
        "count": 5,
        "labels": ["CO-1", "CO-2", "CO-3", "CO-4", "CO-5"],
        "columns": ["PART A", "PART B", "PART C", "TOTAL"],
    },
}

# 100-mark Model Exam format
FORMAT_MODEL = {
    "exam_type": "Model",
    "total_marks": 100,
    "part_a": {
        "label": "PART - A",
        "questions": 10,         # Q1..Q10
        "marks_each": 2,
        "max_marks": 20,
    },
    "part_bc": {
        "label": "PART - B & C",
        "questions_start": 11,   # Q11..Q16
        "questions_end": 16,
        "sub_parts": ["a", "b"],
        "mark_columns": ["i", "ii", "iii"],
        "max_marks": 80,
    },
    "course_outcomes": {
        "count": 5,
        "labels": ["CO-1", "CO-2", "CO-3", "CO-4", "CO-5"],
        "columns": ["PART A", "PART B", "PART C", "TOTAL"],
    },
}


def get_exam_format(total_marks: int, exam_type: Optional[str] = None) -> dict:
    """Return the exam section template for a given total marks and type."""
    if exam_type == "Mid Term":
        return FORMAT_MIDTERM
    if exam_type == "Model":
        return FORMAT_MODEL
    
    # Fallback based on marks
    if total_marks >= 100:
        return FORMAT_MODEL
    return FORMAT_MIDTERM


class ExamConfig(BaseModel):
    section: str
    branch: str
    year: str                 # batch year e.g. "2022"
    academic_year: str = ""   # "1st Year", "2nd Year", etc.
    subject_name: str
    subject_code: str
    total_marks: int          # 60 or 100
    pass_marks: int
    exam_type: str = ""
    result_sheet: str = ""
    reg_prefix: str = ""


class StudentInfo(BaseModel):
    register_number: str
    student_name: str
    email: str
    section: str
    branch: str
    year: str


class SectionMarks(BaseModel):
    """Holds section-wise marks for a single student."""
    part_a_questions: Dict[str, int] = {}   # {"Q1": 2, "Q2": 1, ...}
    part_a_total: int = 0
    part_bc_questions: Dict[str, int] = {}  # {"Q6a_i": 5, "Q6a_ii": 3, ...}
    part_bc_total: int = 0
    grand_total: int = 0
    course_outcomes: Dict[str, Dict[str, int]] = {}  # {"CO-1": {"PART A": 4, ...}}


class ExamResult(BaseModel):
    register_number: str
    student_name: str
    email: str = ""
    section: str
    academic_year: str = ""
    year: str = ""            # batch year
    branch: str = ""
    subject_name: str
    subject_code: str
    total_marks: int
    marks_obtained: int
    pass_marks: int
    status: str
    part_a_total: int = 0
    part_bc_total: int = 0
    section_marks_json: str = "{}"


class SheetProcessingResult(BaseModel):
    register_number: str
    marks_obtained: int
    page_count: int
    confidence: float


class ProcessingResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class DashboardStats(BaseModel):
    total_students: int
    total_passed: int
    total_failed: int
    pass_percentage: float
    average_marks: float
    highest_marks: int
    lowest_marks: int
    section_wise: dict
    branch_wise: dict
