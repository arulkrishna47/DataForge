import os
# Force offline modes to prevent hangs on HuggingFace checks
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"

from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import uvicorn
import asyncio
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
    try:
        if GLOBAL_ENGINE is None:
            print("[SYSTEM] Lazy Loading AI Brain into VRAM...")
            # Start with default labels to pre-load weights
            GLOBAL_ENGINE = ImageAnnotator(labels=["person"], box_threshold=0.20, text_threshold=0.20)
            
            # SHARE the same engine instance to save VRAM and fix 'NoneType' error
            print("[SYSTEM] Initializing Video Subsystem...")
            VIDEO_ENGINE = VideoAnnotator(GLOBAL_ENGINE)
            print("[SYSTEM] All AI Engines Online.")
        return GLOBAL_ENGINE, VIDEO_ENGINE
    except Exception as e:
        print(f"[ERROR] Engine loading failed: {e}")
        import traceback
        traceback.print_exc()
        return None, None

@app.get("/health")
async def health():
  return {"status": "ok", "service": "Cortexa AI", "brain_loaded": GLOBAL_ENGINE is not None}

@app.post("/test-labels")
async def test_labels(labels: str = Form(...)):
  parsed = []
  try:
    import json as _json
    parsed = _json.loads(labels)
    if not isinstance(parsed, list): parsed = []
  except: pass
  if not parsed:
    parsed = [l.strip().lower() for l in labels.split(",") if l.strip()]
  
  prompt = " . ".join(parsed) + " ." if parsed else ""
  return {
    "received": labels,
    "parsed": parsed,
    "prompt": prompt,
    "valid": len(parsed) > 0
  }

@app.post("/annotate")
async def start_annotation(
  background_tasks: BackgroundTasks,
  files: List[UploadFile] = File(...),
  labels: str = Form(...),
  export_format: str = Form("yolo"),
  box_threshold: float = Form(0.20),
  text_threshold: float = Form(0.20),
  sample_fps: float = Form(0.0),
  job_id: str = Form(None),
):
  job_id = job_id or str(uuid.uuid4())
  
  # Parse labels string into clean list
  parsed_labels = []
  try:
    import json as _json
    parsed = _json.loads(labels)
    if isinstance(parsed, list):
      parsed_labels = [str(l).strip().lower() for l in parsed if str(l).strip()]
  except: pass
  
  if not parsed_labels:
    parsed_labels = [l.strip().lower() for l in labels.split(",") if l.strip()]
  
  if not parsed_labels:
    return JSONResponse(status_code=400, content={"error": "No valid labels provided"})
  
  print(f"Job {job_id}: labels={parsed_labels}")
  
  job_dir = UPLOAD_DIR / job_id
  job_dir.mkdir(exist_ok=True)

  saved_files = []
  for file in files:
    path = job_dir / file.filename
    content = await file.read()
    with open(path, "wb") as f:
      f.write(content)
    saved_files.append(str(path))

  jobs[job_id] = {
    "status": "queued",
    "progress": 0,
    "total": len(saved_files),
    "message": "Starting...",
    "results": [],
    "error": None
  }

  background_tasks.add_task(
    run_annotation_job,
    job_id, saved_files, parsed_labels, export_format, box_threshold, text_threshold, sample_fps
  )

  return {"job_id": job_id, "status": "queued", "total_files": len(saved_files), "labels": parsed_labels}

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

async def run_annotation_job(job_id, file_paths, labels, export_format, box_th, text_th, sample_fps):
  try:
    jobs[job_id]["status"] = "processing"
    jobs[job_id]["message"] = "Waking up AI Brain... (may take 2 mins)"
    await sio.emit("job_progress", {"job_id": job_id, "progress": 0, "message": jobs[job_id]["message"]})
    
    # Lazy load the models only when needed
    image_engine, video_engine = get_engine()
    
    if not image_engine or not video_engine:
        raise RuntimeError("AI Engines failed to initialize. Check VRAM/logs.")
    
    # Ensure they use the latest parameters and sterilized labels
    image_engine.labels = labels
    image_engine.box_threshold = float(box_th)
    image_engine.text_threshold = float(text_th)
    
    # Sync video engine settings
    video_engine.labels = labels
    video_engine.box_threshold = float(box_th)
    video_engine.text_threshold = float(text_th)
    video_engine.sample_fps = float(sample_fps)
    
    # Also sync the underlying image annotator inside the video engine
    video_engine.image_annotator.labels = labels
    video_engine.image_annotator.box_threshold = float(box_th)
    video_engine.image_annotator.text_threshold = float(text_th)
    
    jobs[job_id]["message"] = "AI Brain Online. Starting Analysis..."
    await sio.emit("job_progress", {"job_id": job_id, "progress": 5, "message": jobs[job_id]["message"]})
    
    output_dir = OUTPUT_DIR / job_id
    output_dir.mkdir(exist_ok=True)
    
    video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'}
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff'}
    
    # Filter and robustly extract
    all_files = []
    for fp in file_paths:
      p = Path(fp)
      if p.suffix.lower() == '.zip':
        extract_dir = p.parent / "extracted"
        extract_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(fp, 'r') as z:
          z.extractall(extract_dir)
        # Deep recursive search for images/videos
        for f in extract_dir.rglob("*"):
          if f.is_file() and f.suffix.lower() in (image_extensions | video_extensions):
            all_files.append(str(f))
      elif p.suffix.lower() in (image_extensions | video_extensions):
        all_files.append(fp)

    total = len(all_files)
    jobs[job_id]["total"] = total
    
    loop = asyncio.get_running_loop()
    
    for i, fp in enumerate(all_files):
      ext = Path(fp).suffix.lower()
      fname = Path(fp).name
      msg = f"Analyzing {fname} ({i+1}/{total})"
      jobs[job_id]["message"] = msg
      await sio.emit("job_progress", {"job_id": job_id, "progress": jobs[job_id]["progress"], "message": msg})
      
      if ext in video_extensions:
        def on_vid_progress(p):
            current_unit_progress = int((i / total) * 95)
            frame_progress = (p / 100.0) * (95.0 / total)
            global_progress = int(current_unit_progress + frame_progress)
            
            if global_progress > jobs[job_id]["progress"]:
                jobs[job_id]["progress"] = global_progress
                # Send update back to main loop to emit
                loop.call_soon_threadsafe(
                    lambda: asyncio.create_task(sio.emit("job_progress", {
                        "job_id": job_id, 
                        "progress": global_progress, 
                        "message": f"Analyzing {fname} ({global_progress}%)"
                    }))
                )

        # Run blocking video process in thread
        res = await loop.run_in_executor(None, video_engine.annotate_video, fp, str(output_dir), export_format, on_vid_progress)
      else:
        # Run blocking image process in thread
        res = await loop.run_in_executor(None, image_engine.annotate_image, fp, str(output_dir), export_format)
        
      if "error" in res:
        print(f"File error: {res['error']}")
        continue

      jobs[job_id]["progress"] = int(((i+1)/total)*95)
      jobs[job_id]["results"].append(res)
      await sio.emit("job_progress", {"job_id": job_id, "progress": jobs[job_id]["progress"], "message": f"Done {fname}"})

    # Save classes.txt explicitly
    with open(output_dir / "classes.txt", "w") as f:
      f.write("\n".join(labels))

    # ZIP Results
    zip_path = OUTPUT_DIR / f"{job_id}.zip"
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
      for item in output_dir.rglob("*"):
        if item.is_file():
          z.write(item, item.relative_to(output_dir))

    jobs[job_id].update({"status": "completed", "progress": 100, "message": "All items completed!"})
    await sio.emit("job_progress", {"job_id": job_id, "status": "completed", "progress": 100})

  except Exception as e:
    import traceback
    tb = traceback.format_exc()
    print(f"[CRITICAL ERROR] Job {job_id} failed: {e}\n{tb}")
    jobs[job_id].update({"status": "failed", "error": str(e), "message": f"Pipeline error: {str(e)}", "progress": 0})
    await sio.emit("job_progress", {"job_id": job_id, "status": "failed", "error": str(e)})
  finally:
    # Cleanup uploads
    job_upload_dir = UPLOAD_DIR / job_id
    if job_upload_dir.exists():
        try:
            shutil.rmtree(job_upload_dir)
        except: pass

if __name__ == "__main__":
  # Use port 7860 for Hugging Face compatibility
  uvicorn.run(socket_app, host="0.0.0.0", port=7860)
