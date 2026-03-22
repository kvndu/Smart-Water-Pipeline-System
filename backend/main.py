from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.db import supabase
from backend.risk_engine import calculate_risk

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Backend is working"}


@app.get("/pipelines")
def get_pipelines(limit: int = 100):
    response = supabase.table("pipelines").select("*").limit(limit).execute()
    return response.data


@app.get("/pipelines/{pipeline_id}")
def get_pipeline(pipeline_id: str):
    response = (
        supabase
        .table("pipelines")
        .select("*")
        .eq("pipeline_id", pipeline_id)
        .execute()
    )

    if response.data:
        return response.data[0]

    return {"error": "Pipeline not found"}


@app.get("/predict/{pipeline_id}")
def predict_pipeline(pipeline_id: str):
    response = (
        supabase
        .table("pipelines")
        .select("*")
        .eq("pipeline_id", pipeline_id)
        .execute()
    )

    if not response.data:
        return {"error": "Pipeline not found"}

    pipeline = response.data[0]
    risk = calculate_risk(pipeline)

    return {
        "pipeline_id": pipeline_id,
        "risk_score": risk["risk_score"],
        "risk_level": risk["risk_level"],
        "recommendation": risk["recommendation"],
    }


@app.get("/pipelines-with-risk")
def get_pipelines_with_risk(limit: int = 100):
    response = supabase.table("pipelines").select("*").limit(limit).execute()
    pipelines = response.data or []

    results = []
    for pipeline in pipelines:
        risk = calculate_risk(pipeline)
        results.append({
            **pipeline,
            "risk_score": risk["risk_score"],
            "risk_level": risk["risk_level"],
            "recommendation": risk["recommendation"],
        })

    return results