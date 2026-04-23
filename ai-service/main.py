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
from contextlib import asynccontextmanager
from annotator import ImageAnnotator, VideoAnnotator

# FIX 6 & 8: Lifespan events for warmup and directory setup
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events"""
    # Create temp directory for fast I/O
    Path("/tmp/cortexa_frames").mkdir(
      parents=True, exist_ok=True
    )
    # Pre-load models in background
    asyncio.create_task(warmup_models())
    yield
    # Shutdown logic if needed

app = FastAPI(
  title="Cortexa AI Annotation Service",
  lifespan=lifespan
)
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
            
            # SHARE the same engine instance to save VRAM
            print("[SYSTEM] Initializing Video Subsystem...")
            VIDEO_ENGINE = VideoAnnotator(GLOBAL_ENGINE)
            print("[SYSTEM] All AI Engines Online.")
        return GLOBAL_ENGINE, VIDEO_ENGINE
    except Exception as e:
        print(f"[ERROR] Engine loading failed: {e}")
        import traceback
        traceback.print_exc()
        return None, None

async def warmup_models():
  """Load AI models in background at startup"""
  await asyncio.sleep(2)  # Let server start first
  print("[STARTUP] Pre-loading AI models...")
  try:
    # Run in thread so we don't block event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, get_engine)
    print("[STARTUP] Models pre-loaded successfully!")
  except Exception as e:
    print(f"[STARTUP] Model pre-load failed: {e}")
    print("[STARTUP] Models will load on first request")

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

async def run_annotation_job(
  job_id, file_paths, labels,
  export_format, box_th, text_th, sample_fps
):
  try:
    jobs[job_id]["status"] = "processing"
    jobs[job_id]["message"] = \
      "Loading AI models... (first load ~2 min)"
    await sio.emit("job_progress", {
      "job_id": job_id,
      "progress": 0,
      "message": jobs[job_id]["message"]
    })
    
    # Get or create global engine
    image_engine, video_engine = get_engine()
    
    if not image_engine:
      raise RuntimeError(
        "AI Engine failed to load. "
        "Check server logs."
      )
    
    # FIX 5: Update labels and thresholds for this job
    # (single-user assumption for now)
    image_engine.labels = list(labels)
    image_engine.box_threshold = float(box_th)
    image_engine.text_threshold = float(text_th)
    image_engine._last_prompt = None  # Reset cache (FIX 1)
    
    video_engine.labels = list(labels)
    video_engine.box_threshold = float(box_th)
    video_engine.text_threshold = float(text_th)
    video_engine.sample_fps = float(sample_fps)
    video_engine.image_annotator.labels = list(labels)
    video_engine.image_annotator.box_threshold = float(box_th)
    video_engine.image_annotator.text_threshold = float(text_th)
    video_engine.image_annotator._last_prompt = None
    
    jobs[job_id]["message"] = \
      f"Processing {len(file_paths)} file(s) with labels: {labels}"
    await sio.emit("job_progress", {
      "job_id": job_id,
      "progress": 5,
      "message": jobs[job_id]["message"]
    })
    
    output_dir = OUTPUT_DIR / job_id
    output_dir.mkdir(exist_ok=True)
    
    video_ext = {
      '.mp4', '.avi', '.mov',
      '.mkv', '.webm', '.flv'
    }
    image_ext = {
      '.jpg', '.jpeg', '.png',
      '.bmp', '.webp', '.tiff'
    }
    
    # Expand ZIP files
    all_files = []
    for fp in file_paths:
      p = Path(fp)
      if p.suffix.lower() == '.zip':
        extract_dir = p.parent / "extracted"
        extract_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(fp, 'r') as z:
          z.extractall(extract_dir)
        for f in extract_dir.rglob("*"):
          if f.is_file() and f.suffix.lower() \
             in (image_ext | video_ext):
            all_files.append(str(f))
      elif p.suffix.lower() in (image_ext | video_ext):
        all_files.append(fp)
    
    total = len(all_files)
    jobs[job_id]["total"] = total
    print(f"Processing {total} files")
    
    loop = asyncio.get_running_loop()
    
    for i, fp in enumerate(all_files):
      ext = Path(fp).suffix.lower()
      fname = Path(fp).name
      
      jobs[job_id]["message"] = \
        f"Annotating: {fname} ({i+1}/{total})"
      await sio.emit("job_progress", {
        "job_id": job_id,
        "progress": jobs[job_id]["progress"],
        "message": jobs[job_id]["message"]
      })
      
      try:
        if ext in video_ext:
          # Video progress callback (FIX 5 update)
          def make_callback(file_idx, file_total):
            def cb(frame_pct):
              base = int((file_idx / file_total) * 90)
              step = int((1 / file_total) * 90)
              prog = base + int((frame_pct / 100) * step)
              jobs[job_id]["progress"] = prog
              asyncio.run_coroutine_threadsafe(
                sio.emit("job_progress", {
                  "job_id": job_id,
                  "progress": prog,
                  "message": f"Video frame {frame_pct}%: {fname}"
                }),
                loop
              )
            return cb
          
          res = await loop.run_in_executor(
            None,
            video_engine.annotate_video,
            fp, str(output_dir), export_format,
            make_callback(i, total)
          )
        else:
          res = await loop.run_in_executor(
            None,
            image_engine.annotate_image,
            fp, str(output_dir), export_format
          )
        
        if res.get("error"):
          print(f"Error on {fname}: {res['error']}")
        else:
          jobs[job_id]["results"].append(res)
          det = res.get("detections", 0)
          print(f"Done {fname}: {det} detections")
      
      except Exception as file_err:
        print(f"Failed {fname}: {file_err}")
        jobs[job_id]["results"].append({
          "file": fp,
          "error": str(file_err),
          "detections": 0
        })
      
      jobs[job_id]["progress"] = int(((i + 1) / total) * 90)
      await sio.emit("job_progress", {
        "job_id": job_id,
        "progress": jobs[job_id]["progress"],
        "message": f"Completed {i+1}/{total}: {fname}"
      })

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
