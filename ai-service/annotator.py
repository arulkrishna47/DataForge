import os
import cv2
import torch
import numpy as np
from pathlib import Path
from PIL import Image
from ultralytics import SAM
import json
import xml.etree.ElementTree as ET
from groundingdino.util.inference import Model, load_image, predict, annotate
import groundingdino.datasets.transforms as T

# Manual Box Conversion (cxcywh -> xyxy)
def cxcywh_to_xyxy(boxes_cxcywh, w, h):
    # Scale normalized to absolute
    boxes_scaled = boxes_cxcywh * torch.Tensor([w, h, w, h])
    boxes_xyxy = torch.zeros_like(boxes_scaled)
    boxes_xyxy[:, 0] = boxes_scaled[:, 0] - boxes_scaled[:, 2] / 2 # x1
    boxes_xyxy[:, 1] = boxes_scaled[:, 1] - boxes_scaled[:, 3] / 2 # y1
    boxes_xyxy[:, 2] = boxes_scaled[:, 0] + boxes_scaled[:, 2] / 2 # x2
    boxes_xyxy[:, 3] = boxes_scaled[:, 1] + boxes_scaled[:, 3] / 2 # y2
    return boxes_xyxy.numpy()

class ImageAnnotator:
  def __init__(self, labels: list[str], box_threshold: float = 0.3, text_threshold: float = 0.25):
    self.labels = labels
    self.box_threshold = box_threshold
    self.text_threshold = text_threshold
    self.device = "cuda" if torch.cuda.is_available() else "cpu"
    
    config_path = "weights/groundingdino_swint_ogc.cfg.py"
    checkpoint_path = "weights/groundingdino_swint_ogc.pth"
    
    # Handle both local and relative paths
    if not os.path.exists(config_path):
        config_path = os.path.join("ai-service", config_path)
        checkpoint_path = os.path.join("ai-service", checkpoint_path)

    print(f"[DEBUG] Initializing GroundingDINO on {self.device}...")
    self.model = Model(
        model_config_path=config_path, 
        model_checkpoint_path=checkpoint_path, 
        device=self.device
    )

    print(f"[DEBUG] Loading MobileSAM...")
    sam_path = "mobile_sam.pt"
    if not os.path.exists(sam_path):
        sam_path = os.path.join("ai-service", sam_path)
    self.sam_model = SAM(sam_path)
    self.sam_model.to(self.device)

  def annotate_image(self, image_path: str, output_dir: str, export_format: str = "yolo") -> dict:
    try:
        image_name = Path(image_path).stem if isinstance(image_path, str) else f"frame_{np.random.randint(1000, 9999)}"
        image_source = cv2.imread(image_path) if isinstance(image_path, str) else image_path

        if image_source is None:
            return {"error": "Could not read image source"}
        
        h_orig, w_orig = image_source.shape[:2]
        
        # 1. Prediction using the high-level Model.predict (Handles scaling automatically)
        # We combine labels into one prompt
        text_prompt = ", ".join(self.labels)
        
        # Model.predict expects a BGR image (standard for cv2)
        boxes, logits, phrases = self.model.predict(
            image=image_source,
            caption=text_prompt,
            box_threshold=self.box_threshold,
            text_threshold=self.text_threshold
        )

        if len(boxes) == 0:
            return {"file": image_path if isinstance(image_path, str) else "video", "detections": 0, "message": "No objects detected"}

        # 2. Convert normalized cxcywh to absolute xyxy
        final_boxes = cxcywh_to_xyxy(boxes, w_orig, h_orig)
        final_conf = logits.numpy()
        
        # Map phrases back to class IDs
        final_cids = []
        for p in phrases:
            found_id = 0
            for idx, label in enumerate(self.labels):
                if label.lower() in p.lower():
                    found_id = idx
                    break
            final_cids.append(found_id)
        final_cids = np.array(final_cids)

        # 3. SAM Segmentation for 100% boundary accuracy
        image_rgb = cv2.cvtColor(image_source, cv2.COLOR_BGR2RGB)
        sam_results = self.sam_model(image_rgb, bboxes=final_boxes, verbose=False)
        
        masks = None
        if sam_results[0].masks is not None:
            masks = sam_results[0].masks.data.cpu().numpy()
            # If masks are smaller than original, resize them
            if masks.shape[1:] != (h_orig, w_orig):
                resized_masks = []
                for m in masks:
                    resized_masks.append(cv2.resize(m, (w_orig, h_orig), interpolation=cv2.INTER_LINEAR) > 0.5)
                masks = np.array(resized_masks)

        # 4. Rendering and Export
        final_phrases = [self.labels[cid] for cid in final_cids]
        annotated = self._draw_annotations(image_rgb, final_boxes, final_cids, final_conf, final_phrases, masks)

        out_path = Path(output_dir)
        out_path.mkdir(exist_ok=True, parents=True)
        preview_filename = f"{image_name}_annotated.jpg"
        preview_path = out_path / "previews" / preview_filename
        preview_path.parent.mkdir(exist_ok=True, parents=True)
        cv2.imwrite(str(preview_path), cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR))

        if export_format.lower() == "yolo":
          self._export_yolo(image_name, final_boxes, final_cids, w_orig, h_orig, out_path)

        return {
          "file": image_path if isinstance(image_path, str) else "frame",
          "detections": len(final_boxes),
          "preview": f"/dashboard/auto-preview?path={str(preview_path)}"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"AI Brain Error: {str(e)}"}

  def _draw_annotations(self, image, boxes, class_ids, confidences, phrases, masks=None):
    annotated = image.copy()
    COLORS = [(0, 255, 255), (255, 0, 255), (255, 255, 0), (0, 255, 0), (255, 0, 0), (0, 0, 255)]
    
    if masks is not None:
        for i, mask in enumerate(masks):
            color = COLORS[int(class_ids[i]) % len(COLORS)]
            mask_overlay = np.zeros_like(annotated)
            mask_overlay[mask.astype(bool)] = color
            annotated = cv2.addWeighted(annotated, 1.0, mask_overlay, 0.4, 0)

    for i, box in enumerate(boxes):
        x1, y1, x2, y2 = map(int, box)
        color = COLORS[int(class_ids[i]) % len(COLORS)]
        label = f"{phrases[i]} {confidences[i]:.2f}"
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(annotated, (x1, y1 - th - 10), (x1 + tw + 10, y1), color, -1)
        cv2.putText(annotated, label, (x1 + 5, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        
    return annotated

  def _export_yolo(self, name, boxes, class_ids, w, h, out_dir):
    Path(out_dir / "labels").mkdir(exist_ok=True, parents=True)
    lines = []
    for b, cid in zip(boxes, class_ids):
        # YOLO: class x_center y_center width height (all normalized)
        xc = ((b[0] + b[2]) / 2) / w
        yc = ((b[1] + b[3]) / 2) / h
        bw = (b[2] - b[0]) / w
        bh = (b[3] - b[1]) / h
        lines.append(f"{int(cid)} {xc:.6f} {yc:.6f} {bw:.6f} {bh:.6f}")
        
    with open(out_dir / "labels" / f"{name}.txt", "w") as f:
        f.write("\n".join(lines))

class VideoAnnotator:
  def __init__(self, image_annotator: ImageAnnotator):
    self.image_annotator = image_annotator

  def annotate_video(self, video_path: str, output_dir: str, export_format: str = "yolo") -> dict:
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    frame_interval = max(1, int(fps // 2)) 
    processed_count = 0
    curr = 0
    while True:
      ret, frame = cap.read()
      if not ret: break
      if curr % frame_interval == 0:
        res = self.image_annotator.annotate_image(frame, output_dir, export_format)
        if "error" not in res: processed_count += 1
      curr += 1
    cap.release()
    return {"file": video_path, "detections": processed_count, "fps": fps}
