"""Scanner API routes for direct USB scanner control."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services import scanner_service

router = APIRouter(prefix="/api/scanner", tags=["scanner"])


class ScanRequest(BaseModel):
    scanner_id: Optional[str] = None
    color_mode: str = "color"  # "color" or "grayscale"
    dpi: int = 200


@router.get("/list")
async def list_scanners():
    """Get list of connected scanners."""
    scanners = scanner_service.get_available_scanners()
    return {
        "success": True,
        "scanners": scanners,
        "count": len(scanners)
    }


@router.get("/check")
async def check_scanner():
    """Check if any scanner is available."""
    available = scanner_service.is_scanner_available()
    scanners = scanner_service.get_available_scanners() if available else []
    return {
        "available": available,
        "scanners": scanners
    }


@router.post("/scan")
async def scan_document(request: ScanRequest):
    """Scan a document from the connected scanner."""
    result = scanner_service.scan_document(
        scanner_id=request.scanner_id,
        color_mode=request.color_mode,
        dpi=request.dpi
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {
        "success": True,
        "file_path": result["file_path"],
        "message": "Document scanned successfully"
    }
