from fastapi import APIRouter, HTTPException
from typing import Dict, List

router = APIRouter()

# Example data, this should be replaced with actual data retrieval logic
data = {
    "total_hours": 120,
    "topics": {
        "completed": ["Topic 1", "Topic 2"],
        "in_progress": ["Topic 3"]
    },
    "weekly_activity": {
        "dates": ["2026-03-01", "2026-03-02", "2026-03-03"],
        "hours": [3, 4, 5]  # Example data
    }
}

@router.get("/statistics")
async def get_statistics() -> Dict:
    return {
        "total_hours": data["total_hours"],
        "topics": data["topics"]
    }

@router.get("/progress")
async def get_progress() -> Dict:
    return {
        "weekly_activity": data["weekly_activity"]
    }