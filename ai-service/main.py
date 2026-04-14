from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import asyncio
import os
import uuid
import zipfile
import shutil
from pathlib import Path
from typing import List
import socketio
from annotator import ImageAnnotator, VideoAnnotator

app = FastAPI(title="Cortexa AI Annotation Service")
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Global Job Storage and Engine State
jobs = {}
GLOBAL_ENGINE = None
VIDEO_ENGINE = None

def get_engine():
    global GLOBAL_ENGINE, VIDEO_ENGINE
    if GLOBAL_ENGINE is None:
        print("[SYSTEM] Lazy Loading AI Brain into VRAM...")
        # Start with dummy labels to pre-load weights
        GLOBAL_ENGINE = ImageAnnotator(labels=["person"], box_threshold=0.35, text_threshold=0.25)
        VIDEO_ENGINE = VideoAnnotator(GLOBAL_ENGINE)
        print("[SYSTEM] Brain Online.")
    return GLOBAL_ENGINE, VIDEO_ENGINE

@app.get("/health")
async def health():
  return {"status": "ok", "service": "Cortexa AI", "brain_loaded": GLOBAL_ENGINE is not None}

@app.post("/annotate")
async def start_annotation(
  background_tasks: BackgroundTasks,
  files: List[UploadFile] = File(...),
  labels: str = Form(...),
  export_format: str = Form("yolo"),
  box_threshold: float = Form(0.35),
  text_threshold: float = Form(0.25),
  job_id: str = Form(None),
):
  job_id = job_id or str(uuid.uuid4())
  label_list = [l.strip() for l in labels.split(",") if l.strip()]
  
  job_dir = UPLOAD_DIR / job_id
  job_dir.mkdir(exist_ok=True)

  saved_files = []
  for file in files:
    path = job_dir / file.filename
    with open(path, "wb") as f:
      content = await file.read()
      f.write(content)
    saved_files.append(str(path))

  jobs[job_id] = {
    "status": "queued",
    "progress": 0,
    "total": len(saved_files),
    "results": [],
    "error": None
  }

  background_tasks.add_task(
    run_annotation_job,
    job_id, saved_files, label_list, export_format, box_threshold, text_threshold
  )

  return {"job_id": job_id, "status": "queued", "total_files": len(saved_files)}

@app.get("/annotate/status/{job_id}")
async def get_job_status(job_id: str):
  return jobs.get(job_id, {"error": "Job not found"})

@app.get("/annotate/download/{job_id}")
async def download_results(job_id: str):
  zip_path = OUTPUT_DIR / f"{job_id}.zip"
  if not zip_path.exists():
    return {"error": "Not ready or failed"}
  return FileResponse(str(zip_path), media_type="application/zip", filename=f"cortexa_annotations_{job_id[:8]}.zip")

@app.get("/annotate/preview/{job_id}/{filename}")
async def get_preview(job_id: str, filename: str):
  path = OUTPUT_DIR / job_id / "previews" / filename
  if not path.exists():
    return {"error": "File not found"}
  return FileResponse(str(path))

async def run_annotation_job(job_id, file_paths, labels, export_format, box_th, text_th):
  try:
    jobs[job_id]["status"] = "processing"
    jobs[job_id]["message"] = "Waking up AI Brain... (may take 2 mins)"
    await sio.emit("job_progress", {"job_id": job_id, "progress": 0, "message": jobs[job_id]["message"]})
    
    # Lazy load the models only when needed
    image_engine, video_engine = get_engine()
    
    jobs[job_id]["message"] = "AI Brain Online. Starting Analysis..."
    await sio.emit("job_progress", {"job_id": job_id, "progress": 5, "message": jobs[job_id]["message"]})
    
    # Update engine parameters for THIS specific job
    image_engine.labels = labels
    image_engine.box_threshold = box_th
    image_engine.text_threshold = text_th
    
    output_dir = OUTPUT_DIR / job_id
    output_dir.mkdir(exist_ok=True)
    
    video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}
    
    for i, fp in enumerate(file_paths):
      ext = Path(fp).suffix.lower()
      msg = f"Analyzing {Path(fp).name} ({i+1}/{len(file_paths)})"
      jobs[job_id]["message"] = msg
      
      await sio.emit("job_progress", {"job_id": job_id, "progress": jobs[job_id]["progress"], "message": msg})
      
      if ext in video_extensions:
        res = video_engine.annotate_video(fp, str(output_dir), export_format)
      else:
        res = image_engine.annotate_image(fp, str(output_dir), export_format)
        
      if "error" in res: raise Exception(res["error"])

      jobs[job_id]["progress"] = int(((i+1)/len(file_paths))*95)
      jobs[job_id]["results"].append(res)

    # ZIP Results
    zip_path = OUTPUT_DIR / f"{job_id}.zip"
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
      for item in output_dir.rglob("*"):
        if item.is_file():
          z.write(item, item.relative_to(output_dir))

    jobs[job_id].update({"status": "completed", "progress": 100})
    await sio.emit("job_progress", {"job_id": job_id, "status": "completed", "progress": 100})

  except Exception as e:
    print(f"[CRITICAL ERROR] Job {job_id} failed: {e}")
    jobs[job_id].update({"status": "failed", "error": str(e)})
    await sio.emit("job_progress", {"job_id": job_id, "status": "failed", "error": str(e)})
  finally:
    # Cleanup uploads
    job_upload_dir = UPLOAD_DIR / job_id
    if job_upload_dir.exists():
        shutil.rmtree(job_upload_dir)

if __name__ == "__main__":
  # Use port 7860 for Hugging Face compatibility
  uvicorn.run(socket_app, host="0.0.0.0", port=7860)
