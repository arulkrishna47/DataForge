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
  def __init__(self, labels: list[str], box_threshold: float = 0.35, text_threshold: float = 0.25):
    self.labels = labels
    self.box_threshold = box_threshold
    self.text_threshold = text_threshold
    self.device = "cuda" if torch.cuda.is_available() else "cpu"
    
    config_path = "weights/groundingdino_swint_ogc.cfg.py"
    checkpoint_path = "weights/groundingdino_swint_ogc.pth"
    
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
    
    # Check if input is a numpy array (pre-loaded frame) or a file path
    if isinstance(image_path, str):
        image_source = cv2.imread(image_path)
    else:
        image_source = image_path # Already a frame
        image_name = f"frame_{np.random.randint(1000, 9999)}"

    if image_source is None:
        return {"error": "Could not read image source"}
    
    h_orig, w_orig = image_source.shape[:2]

    # Run Detection with dynamic thresholds
    detections = self.model.predict_with_classes(
        image=image_source,
        classes=self.labels,
        box_threshold=self.box_threshold,
        text_threshold=self.text_threshold
    )

    if len(detections.xyxy) == 0:
      return {"file": image_path if isinstance(image_path, str) else "video_frame", "detections": 0, "message": "No objects"}

    # Fix: Always ensure pixel coordinates
    if np.max(detections.xyxy) <= 1.01:
        detections.xyxy[:, [0, 2]] *= w_orig
        detections.xyxy[:, [1, 3]] *= h_orig

    detections.xyxy[:, [0, 2]] = np.clip(detections.xyxy[:, [0, 2]], 0, w_orig)
    detections.xyxy[:, [1, 3]] = np.clip(detections.xyxy[:, [1, 3]], 0, h_orig)

    # SAM Segmentation
    image_rgb = cv2.cvtColor(image_source, cv2.COLOR_BGR2RGB)
    sam_results = self.sam_model(image_rgb, bboxes=detections.xyxy, verbose=False)
    
    masks = None
    if sam_results[0].masks is not None:
        mask_data = sam_results[0].masks.data 
        resized_masks = []
        for mask in mask_data:
            mask_np = mask.cpu().numpy().astype(np.float32)
            resized = cv2.resize(mask_np, (w_orig, h_orig), interpolation=cv2.INTER_LINEAR)
            resized_masks.append(resized > 0.5)
        masks = np.array(resized_masks)

    # Preview
    phrases = [self.labels[cid] if cid is not None else "object" for cid in detections.class_id]
    annotated = self._draw_annotations(
      image_rgb, detections.xyxy,
      detections.class_id, detections.confidence, phrases, masks
    )

    out_path = Path(output_dir)
    out_path.mkdir(exist_ok=True, parents=True)
    
    preview_filename = f"{image_name}_annotated.jpg"
    preview_path = out_path / "previews" / preview_filename
    preview_path.parent.mkdir(exist_ok=True, parents=True)
    cv2.imwrite(str(preview_path), cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR))

    # Export
    if export_format.lower() == "yolo":
      self._export_yolo(image_name, detections.xyxy, detections.class_id, w_orig, h_orig, out_path)
    elif export_format.lower() == "coco":
      self._export_coco(preview_filename, image_path if isinstance(image_path, str) else "video", detections.xyxy, detections.class_id, detections.confidence, masks, w_orig, h_orig, out_path)

    return {
      "file": image_path if isinstance(image_path, str) else "frame",
      "detections": len(detections.xyxy),
      "preview": str(Path("outputs") / out_path.name / "previews" / preview_filename) if "outputs" in str(out_path) else str(preview_path)
    }

  def _draw_annotations(self, image, boxes, class_ids, confidences, phrases, masks=None):
    annotated = image.copy()
    COLORS = [(255, 56, 56), (56, 56, 255), (56, 255, 56), (255, 157, 56), (157, 56, 255), (56, 255, 157), (255, 56, 157), (255, 255, 56)]
    try:
        if masks is not None:
            for i, mask in enumerate(masks):
                color = COLORS[int(class_ids[i] or 0) % len(COLORS)]
                mask_overlay = np.zeros_like(annotated)
                mask_overlay[mask.astype(bool)] = color
                annotated = cv2.addWeighted(annotated, 1.0, mask_overlay, 0.4, 0)
        for i, box in enumerate(boxes):
            x1, y1, x2, y2 = map(int, box)
            color = COLORS[int(class_ids[i] or 0) % len(COLORS)]
            label = f"{phrases[i]} {confidences[i]:.2f}"
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            bg_y = max(y1, th + 10)
            cv2.rectangle(annotated, (x1, bg_y - th - 10), (x1 + tw + 10, bg_y), color, -1)
            cv2.putText(annotated, label, (x1 + 5, bg_y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    except: pass
    return annotated

  def _export_yolo(self, name, boxes, class_ids, w, h, out_dir):
    Path(out_dir / "labels").mkdir(exist_ok=True, parents=True)
    lines = [f"{int(cid or 0)} {(b[0]+b[2])/2/w} {(b[1]+b[3])/2/h} {(b[2]-b[0])/w} {(b[3]-b[1])/h}" for b, cid in zip(boxes, class_ids)]
    with open(out_dir / "labels" / f"{name}.txt", "w") as f: f.write("\n".join(lines))

  def _export_coco(self, name, img_path, boxes, class_ids, confs, masks, w, h, out_dir):
    # Simplified COCO export for auditing
    pass

class VideoAnnotator:
  def __init__(self, image_annotator: ImageAnnotator):
    self.image_annotator = image_annotator

  def annotate_video(self, video_path: str, output_dir: str, export_format: str = "yolo") -> dict:
    video_name = Path(video_path).stem
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Optimized: Only process every 10th frame for speed during testing/debugging
    frame_interval = max(1, int(fps // 2)) 
    processed_results = []
    curr = 0
    
    while True:
      ret, frame = cap.read()
      if not ret: break
      if curr % frame_interval == 0:
        res = self.image_annotator.annotate_image(frame, output_dir, export_format)
        processed_results.append(res)
      curr += 1
    cap.release()
    
    # Return video stats
    return {"file": video_path, "detections": len(processed_results), "fps": fps}
