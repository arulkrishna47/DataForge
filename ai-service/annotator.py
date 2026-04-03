import cv2
import torch
import numpy as np
import supervision as sv
from pathlib import Path
from PIL import Image
from ultralytics import SAM
import json
import xml.etree.ElementTree as ET

class ImageAnnotator:
  def __init__(self, labels: list[str]):
    self.labels = labels
    self.device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[DEBUG] Using device: {self.device}")
    self._load_models()

  def _load_models(self):
    print(f"[DEBUG] Loading Grounding DINO on {self.device}...")
    from groundingdino.models import build_model
    from groundingdino.util.slconfig import SLConfig
    from groundingdino.util.utils import clean_state_dict
    
    config_path = "weights/groundingdino_swint_ogc.cfg.py"
    checkpoint_path = "weights/groundingdino_swint_ogc.pth"
    
    args = SLConfig.fromfile(config_path)
    args.device = self.device
    self.grounding_model = build_model(args)
    checkpoint = torch.load(checkpoint_path, map_location=self.device)
    self.grounding_model.load_state_dict(clean_state_dict(checkpoint["model"]), strict=False)
    self.grounding_model.eval()
    self.grounding_model.to(self.device)

    print(f"[DEBUG] Loading SAM on {self.device}...")
    # Load SAM for segmentation
    self.sam_model = SAM("mobile_sam.pt")
    self.sam_model.to(self.device)
    print("[DEBUG] Models loaded successfully!")

  def annotate_image(
    self, image_path: str,
    output_dir: str,
    export_format: str = "yolo"
  ) -> dict:
    from groundingdino.util.inference import load_image, predict

    image_name = Path(image_path).stem
    image_source, image = load_image(image_path)
    h, w = image_source.shape[:2]

    # Build text prompt from labels
    text_prompt = " . ".join(self.labels) + " ."

    # Run Grounding DINO detection
    boxes, logits, phrases = predict(
      model=self.grounding_model,
      image=image,
      caption=text_prompt,
      box_threshold=0.35,
      text_threshold=0.25,
      device=self.device
    )

    if len(boxes) == 0:
      return {
        "file": image_path,
        "detections": 0,
        "message": "No objects detected"
      }

    # Convert boxes to xyxy pixel format
    boxes_xyxy = boxes * torch.tensor(
      [w, h, w, h], dtype=torch.float32
    )
    boxes_xyxy[:, 0] -= boxes_xyxy[:, 2] / 2
    boxes_xyxy[:, 1] -= boxes_xyxy[:, 3] / 2
    boxes_xyxy[:, 2] += boxes_xyxy[:, 0]
    boxes_xyxy[:, 3] += boxes_xyxy[:, 1]

    # Run SAM 2 for precise segmentation masks
    sam_results = self.sam_model(
      image_path,
      bboxes=boxes_xyxy.numpy()
    )
    masks = sam_results[0].masks.data.cpu().numpy() \
      if sam_results[0].masks else None

    # Map phrases to label indices
    label_to_idx = {
      label.lower(): i for i, label in enumerate(self.labels)
    }
    class_ids = np.array([
      label_to_idx.get(p.lower(), 0) for p in phrases
    ])
    confidences = logits.numpy()

    # Draw annotated preview image
    annotated = self._draw_annotations(
      image_source, boxes_xyxy.numpy(),
      class_ids, confidences, phrases, masks
    )

    out_path = Path(output_dir)

    # Save preview image
    preview_path = out_path / "previews" / f"{image_name}_annotated.jpg"
    preview_path.parent.mkdir(exist_ok=True)
    cv2.imwrite(str(preview_path), annotated)

    # Export in chosen format
    if export_format == "yolo":
      self._export_yolo(
        image_name, boxes_xyxy.numpy(),
        class_ids, w, h, out_path
      )
    elif export_format == "coco":
      self._export_coco(
        image_name, image_path, boxes_xyxy.numpy(),
        class_ids, confidences, masks, w, h, out_path
      )
    elif export_format == "voc":
      self._export_voc(
        image_name, image_path, boxes_xyxy.numpy(),
        phrases, w, h, out_path
      )

    return {
      "file": image_path,
      "detections": len(boxes),
      "labels_found": list(set(phrases)),
      "preview": str(preview_path)
    }

  def _draw_annotations(
    self, image, boxes, class_ids,
    confidences, phrases, masks=None
  ):
    annotated = image.copy()
    colors = sv.ColorPalette.DEFAULT

    # Draw masks if available
    if masks is not None:
      mask_annotator = sv.MaskAnnotator()
      detections = sv.Detections(
        xyxy=boxes,
        mask=masks.astype(bool),
        class_id=class_ids,
        confidence=confidences
      )
      annotated = mask_annotator.annotate(annotated, detections)

    # Draw bounding boxes
    box_annotator = sv.BoxAnnotator(thickness=2)
    label_annotator = sv.LabelAnnotator()
    detections = sv.Detections(
      xyxy=boxes,
      class_id=class_ids,
      confidence=confidences
    )
    labels = [
      f"{phrase} {conf:.2f}"
      for phrase, conf in zip(phrases, confidences)
    ]
    annotated = box_annotator.annotate(annotated, detections)
    annotated = label_annotator.annotate(
      annotated, detections, labels=labels
    )
    return annotated

  def _export_yolo(
    self, name, boxes, class_ids, w, h, out_dir
  ):
    labels_dir = out_dir / "labels"
    labels_dir.mkdir(exist_ok=True)
    lines = []
    for box, cls_id in zip(boxes, class_ids):
      x1, y1, x2, y2 = box
      cx = ((x1 + x2) / 2) / w
      cy = ((y1 + y2) / 2) / h
      bw = (x2 - x1) / w
      bh = (y2 - y1) / h
      lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")
    with open(labels_dir / f"{name}.txt", "w") as f:
      f.write("\n".join(lines))

  def _export_coco(
    self, name, img_path, boxes, class_ids,
    confidences, masks, w, h, out_dir
  ):
    coco_dir = out_dir / "coco"
    coco_dir.mkdir(exist_ok=True)
    annotations = []
    for i, (box, cls_id, conf) in enumerate(
      zip(boxes, class_ids, confidences)
    ):
      x1, y1, x2, y2 = box
      ann = {
        "id": i + 1,
        "image_id": name,
        "category_id": int(cls_id),
        "bbox": [float(x1), float(y1),
                 float(x2-x1), float(y2-y1)],
        "area": float((x2-x1) * (y2-y1)),
        "score": float(conf),
        "iscrowd": 0
      }
      annotations.append(ann)

    coco_data = {
      "images": [{"id": name, "file_name": img_path,
                  "width": w, "height": h}],
      "annotations": annotations,
      "categories": [
        {"id": i, "name": label}
        for i, label in enumerate(self.labels)
      ]
    }
    with open(coco_dir / f"{name}.json", "w") as f:
      json.dump(coco_data, f, indent=2)

  def _export_voc(
    self, name, img_path, boxes, phrases, w, h, out_dir
  ):
    voc_dir = out_dir / "voc"
    voc_dir.mkdir(exist_ok=True)
    root = ET.Element("annotation")
    ET.SubElement(root, "filename").text = Path(img_path).name
    size = ET.SubElement(root, "size")
    ET.SubElement(size, "width").text = str(w)
    ET.SubElement(size, "height").text = str(h)
    ET.SubElement(size, "depth").text = "3"
    for box, phrase in zip(boxes, phrases):
      obj = ET.SubElement(root, "object")
      ET.SubElement(obj, "name").text = phrase
      ET.SubElement(obj, "difficult").text = "0"
      bndbox = ET.SubElement(obj, "bndbox")
      ET.SubElement(bndbox, "xmin").text = str(int(box[0]))
      ET.SubElement(bndbox, "ymin").text = str(int(box[1]))
      ET.SubElement(bndbox, "xmax").text = str(int(box[2]))
      ET.SubElement(bndbox, "ymax").text = str(int(box[3]))
    tree = ET.ElementTree(root)
    tree.write(str(voc_dir / f"{name}.xml"))


class VideoAnnotator:
  def __init__(self, labels: list[str]):
    self.labels = labels
    self.image_annotator = ImageAnnotator(labels)

  def annotate_video(
    self, video_path: str,
    output_dir: str,
    export_format: str = "yolo"
  ) -> dict:
    video_name = Path(video_path).stem
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    frames_dir = Path(output_dir) / "frames" / video_name
    frames_dir.mkdir(parents=True, exist_ok=True)

    # Extract every Nth frame (process 1 per second)
    frame_interval = max(1, int(fps))
    frame_count = 0
    saved_frames = []

    while True:
      ret, frame = cap.read()
      if not ret:
        break
      if frame_count % frame_interval == 0:
        frame_path = frames_dir / f"frame_{frame_count:06d}.jpg"
        cv2.imwrite(str(frame_path), frame)
        saved_frames.append(str(frame_path))
      frame_count += 1
    cap.release()

    # Annotate each extracted frame
    all_results = []
    for frame_path in saved_frames:
      result = self.image_annotator.annotate_image(
        frame_path, output_dir, export_format
      )
      all_results.append(result)

    # Create annotated video from previews
    self._create_annotated_video(
      saved_frames, output_dir, video_name, fps, w, h
    )

    return {
      "file": video_path,
      "frames_processed": len(saved_frames),
      "total_frames": total_frames,
      "fps": fps
    }

  def _create_annotated_video(
    self, frame_paths, output_dir,
    video_name, fps, w, h
  ):
    out_video_path = Path(output_dir) / f"{video_name}_annotated.mp4"
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(
      str(out_video_path), fourcc, fps, (w, h)
    )
    for fp in frame_paths:
      preview = Path(output_dir) / "previews" / \
        f"{Path(fp).stem}_annotated.jpg"
      if preview.exists():
        frame = cv2.imread(str(preview))
        if frame is not None:
          writer.write(frame)
    writer.release()
