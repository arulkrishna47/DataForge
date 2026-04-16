import os
import cv2
import torch
import numpy as np
import json
from pathlib import Path
from PIL import Image

class ImageAnnotator:
  def __init__(self, labels, box_threshold=0.20, text_threshold=0.20):
    import torch as _torch
    from groundingdino.util.inference import load_model
    from ultralytics import SAM
    
    # Sanitize labels
    if isinstance(labels, str):
      self.labels = [
        l.strip().lower() 
        for l in labels.split(",") 
        if l.strip()
      ]
    elif isinstance(labels, list):
      self.labels = [
        str(l).strip().lower() 
        for l in labels if str(l).strip()
      ]
    else:
      self.labels = []
    
    # Remove duplicates
    seen = set()
    unique = []
    for l in self.labels:
      if l not in seen:
        seen.add(l)
        unique.append(l)
    self.labels = unique
    
    if not self.labels:
      raise ValueError("No valid labels provided")
    
    self.box_threshold = float(box_threshold)
    self.text_threshold = float(text_threshold)
    self.device = "cuda" if _torch.cuda.is_available() else "cpu"
    
    print(f"Labels: {self.labels}")
    print(f"Device: {self.device}")
    
    cfg = self._find_file("weights/groundingdino_swint_ogc.cfg.py")
    ckpt = self._find_file("weights/groundingdino_swint_ogc.pth")
    print(f"Loading GroundingDINO...")
    self.grounding_model = load_model(cfg, ckpt)
    self.grounding_model = self.grounding_model.to(self.device)
    
    sam_path = self._find_file("mobile_sam.pt")
    print(f"Loading SAM from {sam_path}...")
    self.sam_model = SAM(sam_path)
    self.sam_model.to(self.device)
    print("Models ready!")

  def _find_file(self, relative_path: str) -> str:
    """Find a file by trying multiple paths"""
    import os
    search_paths = [
      relative_path,
      os.path.join("ai-service", relative_path),
      os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path),
      os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", relative_path),
    ]
    for p in search_paths:
      if os.path.exists(p):
        return os.path.abspath(p)
    raise FileNotFoundError(
      f"Cannot find: {relative_path}\nSearched in: {search_paths}"
    )

  def _detect_objects(self, image_path: str, image_bgr):
    """Run GroundingDINO detection"""
    from groundingdino.util.inference import load_image, predict
    clean = [
      str(l).strip() 
      for l in self.labels 
      if str(l).strip()
    ]
    if not clean:
      raise ValueError("No valid labels")
    
    text_prompt = " . ".join(clean) + " ."
    print(f"Prompt: '{text_prompt}'")
    
    _, image_tensor = load_image(image_path)
    image_tensor = image_tensor.to(self.device)
    
    boxes, logits, phrases = predict(
      model=self.grounding_model,
      image=image_tensor,
      caption=text_prompt,
      box_threshold=self.box_threshold,
      text_threshold=self.text_threshold,
      device=self.device
    )
    return boxes, logits, phrases

  def _boxes_to_xyxy(self, boxes, img_w, img_h):
    """Convert normalized cx,cy,w,h boxes to pixel x1,y1,x2,y2"""
    if boxes is None or len(boxes) == 0:
      return np.array([]).reshape(0, 4)
    
    try:
      boxes_np = boxes.cpu().numpy() if hasattr(boxes, 'cpu') else np.array(boxes)
      
      if boxes_np.ndim == 1:
        boxes_np = boxes_np.reshape(1, -1)
      
      xyxy = []
      for box in boxes_np:
        if len(box) < 4:
          continue
        cx, cy, w, h = float(box[0]), float(box[1]), float(box[2]), float(box[3])
        x1 = (cx - w / 2) * img_w
        y1 = (cy - h / 2) * img_h
        x2 = (cx + w / 2) * img_w
        y2 = (cy + h / 2) * img_h
        x1 = max(0.0, min(float(x1), float(img_w)))
        y1 = max(0.0, min(float(y1), float(img_h)))
        x2 = max(0.0, min(float(x2), float(img_w)))
        y2 = max(0.0, min(float(y2), float(img_h)))
        if (x2 - x1) > 2 and (y2 - y1) > 2:
          xyxy.append([x1, y1, x2, y2])
      
      return np.array(xyxy) if xyxy else np.array([]).reshape(0, 4)
    except Exception as e:
      print(f"_boxes_to_xyxy error: {e}")
      return np.array([]).reshape(0, 4)

  def _apply_nms(self, boxes_xyxy, scores, iou_threshold=0.45):
    """Remove duplicate overlapping boxes"""
    if boxes_xyxy is None or len(boxes_xyxy) == 0:
      return (np.array([]).reshape(0, 4), np.array([]), [])
    try:
      import torch
      boxes_t = torch.tensor(boxes_xyxy, dtype=torch.float32)
      scores_t = torch.tensor(scores, dtype=torch.float32)
      keep = torch.ops.torchvision.nms(boxes_t, scores_t, iou_threshold).numpy().tolist()
      return boxes_xyxy[keep], scores[keep], keep
    except Exception as e:
      print(f"NMS error (skipping): {e}")
      keep = list(range(len(boxes_xyxy)))
      return boxes_xyxy, scores, keep

  def _phrase_to_label_idx(self, phrase: str) -> int:
    """Map detected phrase to user label index"""
    if not self.labels:
      return 0
    p = phrase.lower().strip()
    # Priority 1: Exact match
    for i, label in enumerate(self.labels):
      if label.lower() == p:
        return i
    # Priority 2: Substring
    for i, label in enumerate(self.labels):
      if label.lower() in p or p in label.lower():
        return i
    return 0

  def _prepare_image(self, image_input):
    """Handle both path and numpy array"""
    if isinstance(image_input, str):
      image_bgr = cv2.imread(image_input)
      image_path = image_input
    else:
      image_bgr = image_input
      image_path = "frame_in_memory.jpg" # Dummy path for GroundingDINO helper
      # Save dummy to temp if GroundingDINO load_image requires a file
      # Actually GroundingDINO load_image usually takes a path.
    return image_bgr, image_path

  def annotate_image(self, image_input, output_dir: str, export_format: str = "yolo", save_preview=True) -> dict:
    image_bgr, image_path = self._prepare_image(image_input)
    image_name = Path(image_path).stem if isinstance(image_input, str) else "frame"
    
    if image_bgr is None:
      return {"file": image_path, "error": "Invalid image input"}
    
    h_orig, w_orig = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    
    # GroundingDINO requires a file path for its internal load_image (unfortunately)
    # If we have an array, we save it temporarily
    temp_path = None
    if not isinstance(image_input, str):
        import uuid
        temp_path = f"temp_{uuid.uuid4()}.jpg"
        cv2.imwrite(temp_path, image_bgr)
        proc_path = temp_path
    else:
        proc_path = image_path

    try:
      boxes_norm, logits, phrases = self._detect_objects(proc_path, image_bgr)
    finally:
      if temp_path and os.path.exists(temp_path):
        os.remove(temp_path)
    
    if boxes_norm is None or len(boxes_norm) == 0:
      return {"file": image_path, "detections": 0, "message": "No objects detected"}
    
    boxes_xyxy = self._boxes_to_xyxy(boxes_norm, w_orig, h_orig)
    if len(boxes_xyxy) == 0:
      return {"file": image_path, "detections": 0, "message": "No valid boxes"}
    
    scores = logits.cpu().numpy() if hasattr(logits, 'cpu') else np.array(logits)
    boxes_xyxy, scores, keep_idx = self._apply_nms(boxes_xyxy, scores)
    phrases_kept = [phrases[i] for i in keep_idx]
    class_ids = np.array([self._phrase_to_label_idx(p) for p in phrases_kept])
    
    masks = None
    # Only run SAM for static images or if specifically enabled
    if getattr(self, "sam_model", None) is not None:
      try:
        sam_results = self.sam_model(proc_path if isinstance(image_input, str) else image_bgr, bboxes=boxes_xyxy, verbose=False)
        if sam_results and sam_results[0].masks is not None:
          resized = []
          for m in sam_results[0].masks.data.cpu().numpy():
            r = cv2.resize(m.astype(np.float32), (w_orig, h_orig), interpolation=cv2.INTER_LINEAR)
            resized.append(r > 0.5)
          masks = np.array(resized)
      except: pass
    
    annotated = self._draw_annotations(image_rgb, boxes_xyxy, class_ids, scores, phrases_kept, masks)
    
    res = {"file": image_path, "detections": len(boxes_xyxy), "labels_found": list(set(phrases_kept))}
    
    if save_preview:
        out_path = Path(output_dir)
        prev_dir = out_path / "previews"
        prev_dir.mkdir(parents=True, exist_ok=True)
        preview_path = prev_dir / f"{image_name}_annotated.jpg"
        cv2.imwrite(str(preview_path), cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR))
        res["preview"] = str(preview_path)

    # Exporting logic... (simplified for internal use if needed)
    return res

  def _draw_annotations(self, image, boxes, class_ids, confidences, phrases, masks=None):
    annotated = image.copy()
    COLORS = [(0, 255, 255), (255, 0, 255), (255, 255, 0), (0, 255, 0), (255, 0, 0), (0, 0, 255)]
    if masks is not None:
      for i, mask in enumerate(masks):
        color = COLORS[int(class_ids[i]) % len(COLORS)]
        overlay = np.zeros_like(annotated)
        overlay[mask.astype(bool)] = color
        annotated = cv2.addWeighted(annotated, 1.0, overlay, 0.4, 0)
    for i, box in enumerate(boxes):
      x1, y1, x2, y2 = map(int, box)
      color = COLORS[int(class_ids[i]) % len(COLORS)]
      label = f"{self.labels[class_ids[i]]} {confidences[i]:.2f}"
      cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
      (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
      cv2.rectangle(annotated, (x1, y1 - th - 10), (x1 + tw + 10, y1), color, -1)
      cv2.putText(annotated, label, (x1 + 5, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    return annotated

  def _export_yolo(self, name, boxes, class_ids, w, h, out_dir):
    (out_dir / "labels").mkdir(exist_ok=True, parents=True)
    lines = []
    for b, cid in zip(boxes, class_ids):
      xc, yc = ((b[0]+b[2])/2)/w, ((b[1]+b[3])/2)/h
      bw, bh = (b[2]-b[0])/w, (b[3]-b[1])/h
      lines.append(f"{int(cid)} {xc:.6f} {yc:.6f} {bw:.6f} {bh:.6f}")
    with open(out_dir / "labels" / f"{name}.txt", "w") as f: f.write("\n".join(lines))

  def _export_coco(self, name, path, boxes, class_ids, scores, masks, w, h, out_dir):
    (out_dir / "coco").mkdir(exist_ok=True, parents=True)
    coco_file = out_dir / "coco" / "annotations.json"
    data = {"images": [], "annotations": [], "categories": []}
    if coco_file.exists() and os.path.getsize(coco_file) > 0:
      try:
        with open(coco_file, "r") as f: data = json.load(f)
      except: pass
    img_id = len(data["images"]) + 1
    data["images"].append({"id": img_id, "file_name": Path(path).name, "width": w, "height": h})
    if not data["categories"]:
      for i, label in enumerate(self.labels):
        data["categories"].append({"id": i, "name": label, "supercategory": "none"})
    for i, (box, cid, score) in enumerate(zip(boxes, class_ids, scores)):
      bw, bh = box[2]-box[0], box[3]-box[1]
      ann = {
        "id": len(data["annotations"]) + 1,
        "image_id": img_id,
        "category_id": int(cid),
        "bbox": [float(box[0]), float(box[1]), float(bw), float(bh)],
        "area": float(bw * bh),
        "segmentation": [],
        "iscrowd": 0,
        "score": float(score)
      }
      data["annotations"].append(ann)
    with open(coco_file, "w") as f: json.dump(data, f, indent=2)

  def _export_voc(self, name, path, boxes, phrases, w, h, out_dir):
    (out_dir / "voc").mkdir(exist_ok=True, parents=True)
    from xml.etree.ElementTree import Element, SubElement, tostring
    from xml.dom import minidom
    top = Element('annotation')
    SubElement(top, 'filename').text = Path(path).name
    size = SubElement(top, 'size')
    SubElement(size, 'width').text = str(w); SubElement(size, 'height').text = str(h); SubElement(size, 'depth').text = '3'
    for box, phrase in zip(boxes, phrases):
      obj = SubElement(top, 'object')
      SubElement(obj, 'name').text = phrase
      SubElement(obj, 'pose').text = 'Unspecified'; SubElement(obj, 'truncated').text = '0'; SubElement(obj, 'difficult').text = '0'
      bbox = SubElement(obj, 'bndbox')
      SubElement(bbox, 'xmin').text = str(int(box[0])); SubElement(bbox, 'ymin').text = str(int(box[1]))
      SubElement(bbox, 'xmax').text = str(int(box[2])); SubElement(bbox, 'ymax').text = str(int(box[3]))
    xml_str = minidom.parseString(tostring(top)).toprettyxml(indent="   ")
    with open(out_dir / "voc" / f"{name}.xml", "w") as f: f.write(xml_str)


class VideoAnnotator:
  def __init__(self, labels_or_engine, box_threshold=0.20, text_threshold=0.20, sample_fps=0):
    if hasattr(labels_or_engine, 'grounding_model'):
      # We were passed an existing ImageAnnotator engine
      print("[SYSTEM] Shared AI Engine detected. Using existing brain.")
      self.image_annotator = labels_or_engine
      self.labels = self.image_annotator.labels
    else:
      # We were passed a label list/string
      if isinstance(labels_or_engine, str):
        self.labels = [
          l.strip().lower() 
          for l in labels_or_engine.split(",") 
          if l.strip()
        ]
      else:
        self.labels = [
          str(l).strip().lower() 
          for l in labels_or_engine if str(l).strip()
        ]
      
      print(f"Loading new models for video engine (Labels: {self.labels})")
      self.image_annotator = ImageAnnotator(
        self.labels, box_threshold, text_threshold
      )
    
    self.box_threshold = float(box_threshold)
    self.text_threshold = float(text_threshold)
    self.sample_fps = float(sample_fps)
    print("Video Engine Ready.")

  def annotate_video(self, video_path: str, output_dir: str, export_format: str = "yolo", progress_callback=None) -> dict:
    video_name = Path(video_path).stem
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
      return {
        "file": video_path,
        "error": "Cannot open video file"
      }
    
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration_sec = total_frames / fps if fps > 0 else 0
    
    print(f"Video: {duration_sec:.1f}s @ {fps}fps, {total_frames} frames, {w}x{h}")
    
    # SPEED OPTIMIZATION:
    # Determine how many frames to skip
    # Goal: process max 60 frames per video for reasonable speed
    MAX_FRAMES = 60
    
    if self.sample_fps > 0:
      frame_interval = max(1, int(fps / self.sample_fps))
    elif duration_sec <= 10:
      frame_interval = max(1, int(total_frames / MAX_FRAMES))
    elif duration_sec <= 30:
      frame_interval = max(1, int(fps / 3))
    elif duration_sec <= 120:
      frame_interval = max(1, int(fps / 2))
    else:
      frame_interval = max(1, int(fps))
    
    effective_fps = fps / frame_interval
    est_frames = total_frames // frame_interval
    
    print(f"Sampling every {frame_interval} frames (~{effective_fps:.1f} FPS effective, ~{est_frames} frames to process)")
    
    frames_dir = Path(output_dir) / "frames" / video_name
    frames_dir.mkdir(parents=True, exist_ok=True)
    
    saved_frames = []
    curr = 0
    
    while True:
      ret, frame = cap.read()
      if not ret:
        break
      if curr % frame_interval == 0:
        fp = frames_dir / f"frame_{curr:06d}.jpg"
        cv2.imwrite(str(fp), frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        saved_frames.append(str(fp))
      curr += 1
    cap.release()
    
    print(f"Extracted {len(saved_frames)} frames")
    
    all_results = []
    # Temporarily disable SAM for speed in video frames as per "asap" requirement
    original_sam = getattr(self.image_annotator, 'sam_model', None)
    if hasattr(self.image_annotator, 'sam_model'):
        self.image_annotator.sam_model = None

    try:
        for i, fp in enumerate(saved_frames):
            print(f"Analyzing {Path(fp).name} ({i+1}/{len(saved_frames)})")
            # Result already saves preview to disk for _build_video to pick up
            result = self.image_annotator.annotate_image(fp, output_dir, export_format, save_preview=True)
            all_results.append(result)
            if progress_callback:
                progress_callback(int(((i+1) / len(saved_frames)) * 100))
    finally:
        # Restore SAM for subsequent image requests
        if hasattr(self.image_annotator, 'sam_model'):
            self.image_annotator.sam_model = original_sam
    
    out_video = self._build_video(saved_frames, output_dir, video_name, fps, w, h)
    
    timeline = self._build_timeline(all_results, saved_frames, fps)
    timeline_path = Path(output_dir) / f"{video_name}_timeline.json"
    with open(str(timeline_path), "w") as f:
      json.dump(timeline, f, indent=2)
    
    total_det = sum(r.get("detections", 0) for r in all_results)
    
    return {
      "file": video_path,
      "frames_processed": len(saved_frames),
      "total_frames": total_frames,
      "duration_seconds": round(duration_sec, 1),
      "total_detections": total_det,
      "annotated_video": str(out_video),
      "timeline": str(timeline_path)
    }

  def _build_video(self, frame_paths, output_dir, video_name, fps, w, h) -> str:
    out = str(Path(output_dir) / f"{video_name}_annotated.mp4")
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(out, fourcc, min(fps, 30), (w, h))
    for fp in frame_paths:
      stem = Path(fp).stem
      prev = Path(output_dir) / "previews" / f"{stem}_annotated.jpg"
      src = str(prev) if prev.exists() else fp
      frame = cv2.imread(src)
      if frame is not None:
        if frame.shape[1] != w or frame.shape[0] != h:
          frame = cv2.resize(frame, (w, h))
        writer.write(frame)
    writer.release()
    return out

  def _build_timeline(self, results, frame_paths, fps) -> dict:
    timeline = {"fps": fps, "frames": []}
    for result, fp in zip(results, frame_paths):
      stem = Path(fp).stem
      try:
        fn = int(stem.replace("frame_", ""))
      except:
        fn = 0
      ts = fn / fps if fps > 0 else 0
      mins = int(ts // 60)
      secs = ts % 60
      timeline["frames"].append({
        "frame_number": fn,
        "timestamp_seconds": round(ts, 3),
        "timestamp": f"{mins:02d}:{secs:05.2f}",
        "detections": result.get("detections", 0),
        "labels_found": result.get("labels_found", []),
      })
    return timeline
