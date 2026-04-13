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
from groundingdino.util.inference import Model, load_image, predict, annotate
import groundingdino.datasets.transforms as T

# CUSTOM NMS to handle crowd merging
def nms(boxes, scores, iou_threshold):
    if len(boxes) == 0: return []
    x1, y1, x2, y2 = boxes[:,0], boxes[:,1], boxes[:,2], boxes[:,3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        ovr = inter / (areas[i] + areas[order[1:]] - inter)
        inds = np.where(ovr <= iou_threshold)[0]
        order = order[inds + 1]
    return keep

# Manual Box Conversion (cxcywh -> xyxy) to avoid supervision version issues
def custom_box_convert(boxes_cxcywh):
    # boxes_cxcywh is [cx, cy, w, h]
    boxes_xyxy = torch.zeros_like(boxes_cxcywh)
    boxes_xyxy[:, 0] = boxes_cxcywh[:, 0] - boxes_cxcywh[:, 2] / 2 # x1
    boxes_xyxy[:, 1] = boxes_cxcywh[:, 1] - boxes_cxcywh[:, 3] / 2 # y1
    boxes_xyxy[:, 2] = boxes_cxcywh[:, 0] + boxes_cxcywh[:, 2] / 2 # x2
    boxes_xyxy[:, 3] = boxes_cxcywh[:, 1] + boxes_cxcywh[:, 3] / 2 # y2
    return boxes_xyxy

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
    print("[DEBUG] AI Engine Specialized for Crowds Ready!")

  def _preprocess(self, cv2_img):
    transform = T.Compose([
        T.RandomResize([800], max_size=1333),
        T.ToTensor(),
        T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    image_source = Image.fromarray(cv2.cvtColor(cv2_img, cv2.COLOR_BGR2RGB))
    image_transformed, _ = transform(image_source, None)
    return image_transformed

  def annotate_image(self, image_path: str, output_dir: str, export_format: str = "yolo") -> dict:
    try:
        image_name = Path(image_path).stem if isinstance(image_path, str) else f"frame_{np.random.randint(1000, 9999)}"
        image_source = cv2.imread(image_path) if isinstance(image_path, str) else image_path

        if image_source is None:
            return {"error": "Could not read image source"}
        
        h_orig, w_orig = image_source.shape[:2]
        all_boxes = []
        all_conf = []
        all_class_id = []

        # TILING LOGIC: Split image into 4 quadrants with 15% overlap
        tiles = [
            (0, 0, w_orig, h_orig), # Full image
            (0, 0, int(w_orig * 0.6), int(h_orig * 0.6)), # Top Left
            (int(w_orig * 0.4), 0, w_orig, int(h_orig * 0.6)), # Top Right
            (0, int(h_orig * 0.4), int(w_orig * 0.6), h_orig), # Bottom Left
            (int(w_orig * 0.4), int(h_orig * 0.4), w_orig, h_orig), # Bottom Right
        ]

        text_prompt = ". ".join(self.labels) + "."
        
        for tx, ty, tw, th in tiles:
            tile_img = image_source[ty:th, tx:tw]
            t_h, t_w = tile_img.shape[:2]
            
            processed_tile = self._preprocess(tile_img)
            boxes, logits, phrases = predict(
                model=self.model.model, 
                image=processed_tile, 
                caption=text_prompt, 
                box_threshold=self.box_threshold, 
                text_threshold=self.text_threshold,
                device=self.device
            )

            if len(boxes) > 0:
                # Convert normalized tile boxes to absolute global coordinates
                boxes_scaled = boxes * torch.Tensor([t_w, t_h, t_w, t_h])
                # CENTER-XYWH -> XYXY MANUAL
                boxes_xyxy = custom_box_convert(boxes_scaled).numpy()
                
                # Offset by tile position
                boxes_xyxy[:, [0, 2]] += tx
                boxes_xyxy[:, [1, 3]] += ty
                
                all_boxes.append(boxes_xyxy)
                all_conf.append(logits.numpy())
                
                tile_cids = []
                for p in phrases:
                    found = False
                    for idx, label in enumerate(self.labels):
                        if label.lower() in p.lower():
                            tile_cids.append(idx)
                            found = True
                            break
                    if not found: tile_cids.append(0)
                all_class_id.append(np.array(tile_cids))

        if not all_boxes:
            return {"file": image_path if isinstance(image_path, str) else "video", "detections": 0, "message": "No objects"}

        combined_boxes = np.vstack(all_boxes)
        combined_conf = np.concatenate(all_conf)
        combined_cids = np.concatenate(all_class_id)
        
        keep_indices = nms(combined_boxes, combined_conf, 0.45) 
        
        final_boxes = combined_boxes[keep_indices]
        final_conf = combined_conf[keep_indices]
        final_cids = combined_cids[keep_indices]

        final_boxes[:, [0, 2]] = np.clip(final_boxes[:, [0, 2]], 0, w_orig)
        final_boxes[:, [1, 3]] = np.clip(final_boxes[:, [1, 3]], 0, h_orig)

        image_rgb = cv2.cvtColor(image_source, cv2.COLOR_BGR2RGB)
        sam_results = self.sam_model(image_rgb, bboxes=final_boxes, verbose=False)
        
        masks = None
        if sam_results[0].masks is not None:
            mask_data = sam_results[0].masks.data 
            resized_masks = []
            for mask in mask_data:
                mask_np = mask.cpu().numpy().astype(np.float32)
                resized = cv2.resize(mask_np, (w_orig, h_orig), interpolation=cv2.INTER_LINEAR)
                resized_masks.append(resized > 0.5)
            masks = np.array(resized_masks)

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
        print(f"[FATAL AI ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"AI Brain Error: {str(e)}"}

  def _draw_annotations(self, image, boxes, class_ids, confidences, phrases, masks=None):
    annotated = image.copy()
    COLORS = [(255, 56, 56), (56, 255, 56), (56, 56, 255), (255, 255, 56), (255, 56, 255), (56, 255, 255)]
    try:
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
            cv2.putText(annotated, label, (x1 + 5, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    except: pass
    return annotated

  def _export_yolo(self, name, boxes, class_ids, w, h, out_dir):
    Path(out_dir / "labels").mkdir(exist_ok=True, parents=True)
    lines = [f"{int(cid)} {(b[0]+b[2])/2/w} {(b[1]+b[3])/2/h} {(b[2]-b[0])/w} {(b[3]-b[1])/h}" for b, cid in zip(boxes, class_ids)]
    with open(out_dir / "labels" / f"{name}.txt", "w") as f: f.write("\n".join(lines))

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
