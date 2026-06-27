from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
from datetime import datetime
from typing import List

app = FastAPI(title="Random Number Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

history: List[dict] = []


class GenerateResponse(BaseModel):
    number: int
    min: int
    max: int
    timestamp: str


class HistoryResponse(BaseModel):
    history: List[GenerateResponse]
    total: int


@app.get("/")
def root():
    return {"status": "ok", "service": "random-number-generator"}


@app.get("/generate", response_model=GenerateResponse)
def generate(
    min: int = Query(default=1, description="Minimum value (inclusive)"),
    max: int = Query(default=100, description="Maximum value (inclusive)"),
):
    if min >= max:
        raise HTTPException(
            status_code=400, detail="min must be strictly less than max"
        )
    if max - min > 1_000_000:
        raise HTTPException(
            status_code=400, detail="Range cannot exceed 1,000,000"
        )

    number = random.randint(min, max)
    entry = {
        "number": number,
        "min": min,
        "max": max,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    history.append(entry)

    if len(history) > 50:
        history.pop(0)

    return entry


@app.get("/history", response_model=HistoryResponse)
def get_history():
    return {"history": list(reversed(history)), "total": len(history)}


@app.delete("/history")
def clear_history():
    history.clear()
    return {"message": "History cleared"}
