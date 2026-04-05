import os
import cv2
import torch
import numpy as np
import supervision as sv
from pathlib import Path
from PIL import Image
from ultralytics import SAM
import json
import xml.etree.ElementTree as ET
from groundingdino.util.inference import Model

class ImageAnnotator:
  def __init__(self, labels: list[str]):
    self.labels = labels
    self.device = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Use the official High-Level Model wrapper for perfect coordinate mapping
    config_path = "weights/groundingdino_swint_ogc.cfg.py"
    checkpoint_path = "weights/groundingdino_swint_ogc.pth"
    
    # Check if files exist locally or in subfolder
    if not os.path.exists(config_path):
        config_path = os.path.join("ai-service", config_path)
        checkpoint_path = os.path.join("ai-service", checkpoint_path)

    print(f"[DEBUG] Initializing GroundingDINO Model on {self.device}...")
    self.model = Model(
        model_config_path=config_path, 
        model_checkpoint_path=checkpoint_path, 
        device=self.device
    )

    print(f"[DEBUG] Loading SAM on {self.device}...")
    sam_path = "mobile_sam.pt"
    if not os.path.exists(sam_path):
        sam_path = os.path.join("ai-service", sam_path)
        
    self.sam_model = SAM(sam_path)
    self.sam_model.to(self.device)
    print("[DEBUG] All models ready!")

  def annotate_image(
    self, image_path: str,
    output_dir: str,
    export_format: str = "yolo"
  ) -> dict:
    image_name = Path(image_path).stem
    
    # Load image for both model and drawing
    image_source = cv2.imread(image_path)
    if image_source is None:
        return {"error": "Could not read image"}
    
    # GroundingDINO Model expect BGR input for predict_with_classes but internally converts
    # To be safe and compatible with our SAM rendering, we match its expected flow
    h_orig, w_orig = image_source.shape[:2]

    # Run Detection using the High-Level API
    # This handled the ARR (Aspect Ratio Resize) correctly
    detections = self.model.predict_with_classes(
        image=image_source,
        classes=self.labels,
        box_threshold=0.35,
        text_threshold=0.25
    )

    if len(detections.xyxy) == 0:
      return {"file": image_path, "detections": 0, "message": "No objects detected"}

    # Process Segmentation Masks via SAM
    # Re-convert to RGB for SAM as it uses PIL-style internally
    image_rgb = cv2.cvtColor(image_source, cv2.COLOR_BGR2RGB)
    sam_results = self.sam_model(image_rgb, bboxes=detections.xyxy, verbose=False)
    
    masks = None
    if sam_results[0].masks is not None:
        import torch.nn.functional as F
        mask_data = sam_results[0].masks.data 
        if self.device == "cpu": mask_data = mask_data.float()
        
        mask_data = F.interpolate(
            mask_data.unsqueeze(1),
            size=(h_orig, w_orig),
            mode="bilinear",
            align_corners=False
        ).squeeze(1)
        masks = (mask_data > 0.5).cpu().numpy()

    # Create the preview
    phrases = [self.labels[cid] if cid is not None else "object" for cid in detections.class_id]
    annotated = self._draw_annotations(
      image_rgb, detections.xyxy,
      detections.class_id, detections.confidence, phrases, masks
    )

    out_path = Path(output_dir)
    preview_path = out_path / "previews" / f"{image_name}_annotated.jpg"
    preview_path.parent.mkdir(exist_ok=True, parents=True)
    # Save as BGR for imwrite
    cv2.imwrite(str(preview_path), cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR))

    # Export Logic
    if export_format.lower() == "yolo":
      self._export_yolo(image_name, detections.xyxy, detections.class_id, w_orig, h_orig, out_path)
    elif export_format.lower() == "coco":
      self._export_coco(image_name, image_path, detections.xyxy, detections.class_id, detections.confidence, masks, w_orig, h_orig, out_path)
    elif export_format.lower() == "voc":
      self._export_voc(image_name, image_path, detections.xyxy, phrases, w_orig, h_orig, out_path)

    return {
      "file": image_path,
      "detections": len(detections.xyxy),
      "labels_found": list(set(phrases)),
      "preview": str(preview_path)
    }

  def _draw_annotations(self, image, boxes, class_ids, confidences, phrases, masks=None):
    annotated = image.copy()
    try:
        if masks is not None:
            mask_color = np.array([0, 255, 0], dtype=np.uint8) # Neon Green
            for m in masks:
                bool_mask = m > 0
                blend = annotated.copy()
                blend[bool_mask] = blend[bool_mask] * 0.5 + mask_color * 0.5
                annotated = blend

        for i, box in enumerate(boxes):
            x1, y1, x2, y2 = map(int, box)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
            label = f"{phrases[i]} {confidences[i]:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(annotated, (x1, max(y1-th-5, 0)), (x1+tw, y1), (0, 255, 0), -1)
            cv2.putText(annotated, label, (x1, max(y1-5, 0)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,0), 1, cv2.LINE_AA)
            
    except Exception as e:
        print(f"Draw error: {e}")
    return annotated

  def _export_yolo(self, name, boxes, class_ids, w, h, out_dir):
    Path(out_dir / "labels").mkdir(exist_ok=True, parents=True)
    lines = []
    for box, cid in zip(boxes, class_ids):
      x1, y1, x2, y2 = box
      cx, cy = (x1+x2)/2/w, (y1+y2)/2/h
      bw, bh = (x2-x1)/w, (y2-y1)/h
      lines.append(f"{cid if cid is not None else 0} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")
    with open(out_dir / "labels" / f"{name}.txt", "w") as f: f.write("\n".join(lines))

  def _export_coco(self, name, img_path, boxes, class_ids, confs, masks, w, h, out_dir):
    Path(out_dir / "coco").mkdir(exist_ok=True, parents=True)
    anns = [{"id": i+1, "image_id": name, "category_id": int(cid or 0), "bbox": [float(b[0]), float(b[1]), float(b[2]-b[0]), float(b[3]-b[1])], "area": float((b[2]-b[0])*(b[3]-b[1])), "score": float(c), "iscrowd": 0} for i, (b, cid, c) in enumerate(zip(boxes, class_ids, confs))]
    with open(out_dir / "coco" / f"{name}.json", "w") as f: 
        json.dump({"images":[{"id": name, "file_name": Path(img_path).name, "width": w, "height": h}], "annotations": anns, "categories": [{"id": i, "name": l} for i, l in enumerate(self.labels)]}, f)

  def _export_voc(self, name, img_path, boxes, phrases, w, h, out_dir):
    Path(out_dir / "voc").mkdir(exist_ok=True, parents=True)
    root = ET.Element("annotation")
    ET.SubElement(root, "filename").text = Path(img_path).name
    size = ET.SubElement(root, "size")
    ET.SubElement(size, "width").text, ET.SubElement(size, "height").text = str(w), str(h)
    for box, p in zip(boxes, phrases):
      obj = ET.SubElement(root, "object")
      ET.SubElement(obj, "name").text = p
      b = ET.SubElement(obj, "bndbox")
      for k, v in zip(["xmin", "ymin", "xmax", "ymax"], map(int, box)): ET.SubElement(b, k).text = str(v)
    ET.ElementTree(root).write(str(out_dir / "voc" / f"{name}.xml"))

class VideoAnnotator:
  def __init__(self, labels: list[str]):
    self.labels = labels
    self.image_annotator = ImageAnnotator(labels)

  def annotate_video(self, video_path: str, output_dir: str, export_format: str = "yolo") -> dict:
    video_name = Path(video_path).stem
    cap = cv2.VideoCapture(video_path)
    fps, count = cap.get(cv2.CAP_PROP_FPS), int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frames_dir = Path(output_dir) / "frames" / video_name
    frames_dir.mkdir(parents=True, exist_ok=True)
    
    frame_interval, saved = max(1, int(fps)), []
    curr = 0
    while True:
      ret, frame = cap.read()
      if not ret: break
      if curr % frame_interval == 0:
        p = frames_dir / f"frame_{curr:06d}.jpg"
        cv2.imwrite(str(p), frame); saved.append(str(p))
      curr += 1
    cap.release()

    for p in saved: self.image_annotator.annotate_image(p, output_dir, export_format)
    
    out_video = Path(output_dir) / f"{video_name}_annotated.mp4"
    writer = cv2.VideoWriter(str(out_video), cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h))
    for p in saved:
      prev = Path(output_dir) / "previews" / f"{Path(p).stem}_annotated.jpg"
      if prev.exists(): writer.write(cv2.imread(str(prev)))
    writer.release()
    return {"file": video_path, "frames": len(saved), "total": count}
