# ExamScan AI - Exam Sheet Scanner & Grading System

An AI-powered exam paper scanning, OCR-based marks extraction, and automated grading system built with **FastAPI** (Python) + **React** (Vite + TailwindCSS) + **Google Sheets API**.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   React Frontend │ ──► │  FastAPI Backend  │ ──► │  Google Sheets API  │
│  (Vite + Tailwind)│     │  (OCR + AI Pipeline)│     │  (Main DB + Results)│
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

## Features

- **Exam Session Workflow**: Configure exam (section, branch, year, subject, marks) → Upload sheets → OCR extract → Review → Save
- **OCR Pipeline**: Tesseract-based text extraction with image preprocessing (grayscale, denoising, adaptive thresholding)
- **Registration Number Detection**: Regex-based extraction from first page of exam sheet
- **Marks Extraction**: AI-powered marks detection from handwritten/printed exam sheets
- **Google Sheets Integration**: Main student DB + Results DB (auto-populated)
- **Admin Dashboard**: Pass/fail stats, section-wise analysis, branch-wise charts, filters
- **CSV Export**: Download filtered results as CSV
- **Session Management**: Track all scanning sessions with history

## Prerequisites

1. **Python 3.9+**
2. **Node.js 18+**
3. **Tesseract OCR** - [Download](https://github.com/UB-Mannheim/tesseract/wiki)
4. **Google Cloud Service Account** with Sheets API enabled

## Google Sheets Setup

### 1. Create a Google Cloud Service Account
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project or select existing
- Enable **Google Sheets API** and **Google Drive API**
- Create a **Service Account** → Download the JSON key file
- Rename it to `credentials.json` and place in `backend/` folder

### 2. Create Google Sheets

**Main DB Sheet** (Student Database):
| RegisterNumber | StudentName | Email | Section | Branch | Year |
|---|---|---|---|---|---|
| CSE21001 | John Doe | john@email.com | A | CSE | 3 |
| CSE21002 | Jane Smith | jane@email.com | B | CSE | 3 |

**Results DB Sheet** (Auto-populated - just create an empty sheet):
- Headers will be auto-created on first run

### 3. Share Both Sheets
- Share both Google Sheets with the service account email (found in `credentials.json` → `client_email`)
- Give **Editor** access

### 4. Get Sheet IDs
- Open each sheet in browser
- URL format: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
- Copy the `{SHEET_ID}` part

## Installation & Setup

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Edit .env file with your Google Sheet IDs
```

Update `backend/.env`:
```
GOOGLE_SHEETS_CREDENTIALS_FILE=credentials.json
MAIN_DB_SHEET_ID=your_main_sheet_id_here
RESULTS_DB_SHEET_ID=your_results_sheet_id_here
```

Place your `credentials.json` in the `backend/` folder.

### Frontend

```bash
cd frontend
npm install
```

## Running

### Start Backend (Terminal 1)
```bash
cd backend
venv\Scripts\activate
python main.py
```
Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### Start Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
Frontend runs at: http://localhost:3000

## Workflow

1. **Admin opens "Scan Exam" page**
2. **Configures exam**: Section, Branch, Year, Subject Name, Subject Code, Total Marks, Pass Marks
3. **Starts Session** → Backend creates a scanning session
4. **Uploads exam pages** (images of one student's answer sheet)
   - First page should have the student's Registration Number
   - OCR processes and extracts registration number + marks
5. **Reviews OCR results** → Can manually correct if needed
6. **Clicks "Save & Next Student"**:
   - Looks up student in Main DB (Google Sheet) by registration number
   - Calculates PASS/FAIL based on pass marks
   - Saves full result to Results DB (Google Sheet)
7. **Repeats** for next student
8. **Ends Session** when all sheets are processed

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py          # Environment config
│   │   ├── models.py          # Pydantic models
│   │   ├── routes/
│   │   │   ├── exam.py        # Exam scanning endpoints
│   │   │   ├── students.py    # Student lookup endpoints
│   │   │   └── results.py     # Results & dashboard endpoints
│   │   └── services/
│   │       ├── google_sheets.py  # Google Sheets CRUD
│   │       └── ocr_engine.py     # OCR + AI pipeline
│   ├── main.py                # FastAPI app entry
│   ├── .env                   # Environment variables
│   ├── .env.example           # Example env file
│   └── requirements.txt       # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # React entry
│   │   ├── App.jsx            # Router setup
│   │   ├── api.js             # API client (axios)
│   │   ├── index.css          # TailwindCSS
│   │   ├── components/
│   │   │   └── Layout.jsx     # Sidebar layout
│   │   └── pages/
│   │       ├── Dashboard.jsx  # Stats & charts
│   │       ├── ScanExam.jsx   # Upload & process workflow
│   │       ├── Results.jsx    # Results table with filters
│   │       ├── Students.jsx   # Student database view
│   │       └── Sessions.jsx   # Session history
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/exam/start-session` | Start scanning session |
| POST | `/api/exam/upload-pages/{session_id}` | Upload exam pages |
| POST | `/api/exam/complete-student/{session_id}` | Save student marks |
| GET | `/api/exam/session/{session_id}` | Get session info |
| POST | `/api/exam/end-session/{session_id}` | End session |
| GET | `/api/students/` | Get all students |
| GET | `/api/students/{reg_no}` | Get student by reg no |
| GET | `/api/results/` | Get results (with filters) |
| GET | `/api/results/dashboard` | Get dashboard stats |

## Tech Stack

- **Backend**: FastAPI, Python, Tesseract OCR, OpenCV, Google Sheets API
- **Frontend**: React 18, Vite, TailwindCSS, Recharts, Lucide Icons
- **Database**: Google Sheets (Main DB + Results DB)
- **AI/ML**: Tesseract OCR, OpenCV image preprocessing, Regex-based extraction
