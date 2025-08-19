from fastapi import FastAPI, File, UploadFile, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import uvicorn

from src.helper import extract_text_from_pdf, ask_groq, pdf_qa
from src.job_api import fetch_linkedin_jobs

app = FastAPI(
    title="AI Job Recommender",
    description="Upload your resume and get AI-powered insights with job recommendations",
    version="1.0.0"
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ---------------------------
# Models
# ---------------------------
class ResumeAnalysis(BaseModel):
    summary: str
    skill_gaps: str
    career_roadmap: str
    job_keywords: str

class JobRecommendationRequest(BaseModel):
    keywords: str

class QARequest(BaseModel):
    question: str

class JobMatchRequest(BaseModel):
    job_description: str

# ---------------------------
# Storage (replace with DB in production)
# ---------------------------
stored_resume_data = {}

# ---------------------------
# Routes
# ---------------------------
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    try:
        file_content = await file.read()
        resume_text = extract_text_from_pdf(file_content)

        # Store resume
        stored_resume_data.update({
            "text": resume_text,
            "file_content": file_content,
            "filename": file.filename
        })

        # Prompts
        summary_prompt = f"""
You are a professional career analyst. Read the following resume and produce a structured summary. 
Separate sections into Education, Technical Skills, Work Experience, and Strengths.
Resume:
{resume_text}
        """
        gaps_prompt = f"""
You are a senior career consultant. Identify skill gaps in the resume.
Classify missing skills into Technical, Soft Skills, Certifications, and Industry Exposure.
Resume:
{resume_text}
        """
        roadmap_prompt = f"""
You are a career coach. Design a personalized career roadmap based on the resume.
Include Skills to Learn, Recommended Certifications, Practical Experience, and Career Path Guidance.
Resume:
{resume_text}
        """
        keyword_prompt = f"""
You are a recruiter. Generate a comma-separated list of relevant job titles and keywords for the resume:
{resume_text}
        """

        # Generate outputs
        summary = ask_groq(summary_prompt, max_tokens=500)
        gaps = ask_groq(gaps_prompt, max_tokens=400)
        roadmap = ask_groq(roadmap_prompt, max_tokens=400)
        keywords = ask_groq(keyword_prompt, max_tokens=120).replace("\n", "").strip()

        analysis = ResumeAnalysis(
            summary=summary,
            skill_gaps=gaps,
            career_roadmap=roadmap,
            job_keywords=keywords
        )

        return {
            "message": "Resume uploaded and analyzed successfully",
            "filename": file.filename,
            "analysis": analysis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing resume: {str(e)}")

# ---------------------------
# Resume Score
# ---------------------------
@app.get("/resume-score")
async def resume_score():
    if not stored_resume_data.get("text"):
        raise HTTPException(status_code=400, detail="No resume uploaded")
    prompt = f"""
You are an expert career consultant.
Score this resume (0-100) based on clarity, technical skills, experience, and impact.
Provide a short justification.
Resume:
{stored_resume_data['text'][:7000]}
    """
    score_result = ask_groq(prompt, max_tokens=200)
    return {"resume_score": score_result}

# ---------------------------
# Job Matching Score
# ---------------------------
@app.post("/job-match-score")
async def job_match_score(request: JobMatchRequest):
    if not stored_resume_data.get("text"):
        raise HTTPException(status_code=400, detail="No resume uploaded")
    prompt = f"""
You are a career advisor.
Compare the resume below to the job description.
Provide a fit score (0-100%) and explain why:
Resume:
{stored_resume_data['text'][:7000]}
Job Description:
{request.job_description[:2000]}
    """
    match_result = ask_groq(prompt, max_tokens=300)
    return {"job_match_score": match_result}

# ---------------------------
# Job Recommendations
# ---------------------------
@app.post("/get-job-recommendations")
async def get_job_recommendations(request: JobRecommendationRequest):
    try:
        linkedin_jobs_raw = fetch_linkedin_jobs(request.keywords, rows=60)
        linkedin_jobs = [
            {
                "company_name": job.get("company_name", ""),
                "job_title": job.get("job_title", ""),
                "job_url": job.get("job_url", ""),
                "location": job.get("location", ""),
                "time_posted": job.get("time_posted", ""),
                "employment_type": job.get("employment_type", ""),
                "salary_range": job.get("salary_range", "")
            }
            for job in linkedin_jobs_raw
        ]
        return {
            "keywords": request.keywords,
            "linkedin_jobs": linkedin_jobs[:20],
            "total_found": len(linkedin_jobs)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching jobs: {str(e)}")

# ---------------------------
# PDF Q&A
# ---------------------------
@app.post("/ask-question")
async def ask_question(request: QARequest):
    if not stored_resume_data.get("text"):
        raise HTTPException(status_code=400, detail="No resume uploaded")
    file_content = stored_resume_data.get("file_content")
    if file_content:
        answer = pdf_qa(file_content, request.question)
    else:
        answer = stored_resume_data["text"][:1000]
    return {"question": request.question, "answer": answer}

# ---------------------------
# Run Server
# ---------------------------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
