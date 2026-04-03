from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import asyncio
import json
import os
import uuid
import zipfile
import shutil
from pathlib import Path
from typing import List
import socketio

app = FastAPI(title="Cortexa AI Annotation Service")
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# In-memory job tracker
jobs = {}

@app.get("/health")
async def health():
  return {"status": "ok", "service": "Cortexa AI Service"}

@app.post("/annotate")
async def start_annotation(
  background_tasks: BackgroundTasks,
  files: List[UploadFile] = File(...),
  labels: str = Form(...),
  export_format: str = Form("yolo"),
  job_id: str = Form(None),
):
  job_id = job_id or str(uuid.uuid4())
  label_list = [l.strip() for l in labels.split(",") if l.strip()]

  # Save uploaded files
  job_dir = UPLOAD_DIR / job_id
  job_dir.mkdir(exist_ok=True)

  saved_files = []
  for file in files:
    path = job_dir / file.filename
    with open(path, "wb") as f:
      f.write(await file.read())
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
    job_id, saved_files, label_list, export_format
  )

  return {"job_id": job_id, "status": "queued", 
          "total_files": len(saved_files)}

@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
  if job_id not in jobs:
    return {"error": "Job not found"}
  return jobs[job_id]

@app.get("/download/{job_id}")
async def download_results(job_id: str):
  output_zip = OUTPUT_DIR / f"{job_id}.zip"
  if not output_zip.exists():
    return {"error": "Results not ready"}
  return FileResponse(
    str(output_zip),
    media_type="application/zip",
    filename=f"cortexa_annotations_{job_id[:8]}.zip"
  )

async def run_annotation_job(
  job_id: str,
  file_paths: List[str],
  labels: List[str],
  export_format: str
):
  try:
    jobs[job_id]["status"] = "processing"
    await sio.emit("job_progress", {
      "job_id": job_id, "status": "processing",
      "progress": 0, "message": "Loading AI models..."
    })

    # Detect if any file is a video
    video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}
    image_paths = []
    video_paths = []

    for fp in file_paths:
      ext = Path(fp).suffix.lower()
      if ext in video_extensions:
        video_paths.append(fp)
      elif ext == '.zip':
        # Extract ZIP
        extract_dir = Path(fp).parent / "extracted"
        extract_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(fp, 'r') as z:
          z.extractall(extract_dir)
        for f in extract_dir.rglob("*"):
          if f.suffix.lower() in {'.jpg','.jpeg','.png','.bmp'}:
            image_paths.append(str(f))
      else:
        image_paths.append(fp)

    output_dir = OUTPUT_DIR / job_id
    output_dir.mkdir(exist_ok=True)

    all_annotations = []
    processed = 0
    total = len(image_paths) + len(video_paths)

    # Process images
    if image_paths:
      results = await annotate_images(
        job_id, image_paths, labels,
        output_dir, export_format
      )
      all_annotations.extend(results)
      processed += len(image_paths)
      jobs[job_id]["progress"] = int((processed/total)*100)

    # Process videos
    if video_paths:
      for vp in video_paths:
        results = await annotate_video(
          job_id, vp, labels,
          output_dir, export_format
        )
        all_annotations.extend(results)
        processed += 1
        jobs[job_id]["progress"] = int((processed/total)*100)
        await sio.emit("job_progress", {
          "job_id": job_id,
          "progress": jobs[job_id]["progress"],
          "message": f"Processing video {processed}/{len(video_paths)}"
        })

    # Create downloadable ZIP
    zip_path = OUTPUT_DIR / f"{job_id}.zip"
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
      for item in output_dir.rglob("*"):
        if item.is_file():
          zf.write(item, item.relative_to(output_dir))

    jobs[job_id].update({
      "status": "completed",
      "progress": 100,
      "results": all_annotations,
      "download_url": f"/download/{job_id}"
    })

    await sio.emit("job_progress", {
      "job_id": job_id,
      "status": "completed",
      "progress": 100,
      "download_url": f"/download/{job_id}",
      "message": "Annotation complete!"
    })

  except Exception as e:
    jobs[job_id]["status"] = "failed"
    jobs[job_id]["error"] = str(e)
    await sio.emit("job_progress", {
      "job_id": job_id,
      "status": "failed",
      "error": str(e)
    })

async def annotate_images(
  job_id, image_paths, labels,
  output_dir, export_format
):
  from annotator import ImageAnnotator
  annotator = ImageAnnotator(labels)
  results = []

  for i, img_path in enumerate(image_paths):
    result = annotator.annotate_image(
      img_path, str(output_dir), export_format
    )
    results.append(result)
    progress = int(((i+1)/len(image_paths))*90)
    jobs[job_id]["progress"] = progress
    await sio.emit("job_progress", {
      "job_id": job_id,
      "progress": progress,
      "message": f"Annotating image {i+1}/{len(image_paths)}: {Path(img_path).name}"
    })

  return results

async def annotate_video(
  job_id, video_path, labels,
  output_dir, export_format
):
  from annotator import VideoAnnotator
  annotator = VideoAnnotator(labels)
  result = annotator.annotate_video(
    video_path, str(output_dir), export_format
  )
  return [result]

if __name__ == "__main__":
  uvicorn.run(socket_app, host="0.0.0.0", port=8000)
