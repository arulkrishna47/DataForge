import os
import cv2
import torch
import numpy as np
import json
from pathlib import Path
from PIL import Image
from ultralytics import SAM
from groundingdino.util.inference import load_model, load_image, predict
import groundingdino.datasets.transforms as T
import torchvision.ops as ops

class ImageAnnotator:
    def __init__(self, labels, box_threshold: float = 0.20, text_threshold: float = 0.20):
        # Sanitize labels — handle both string and list
        if isinstance(labels, str):
            # "person,car,dog" → ["person", "car", "dog"]
            self.labels = [l.strip().lower() for l in labels.split(",") if l.strip()]
        elif isinstance(labels, list):
            self.labels = [str(l).strip().lower() for l in labels if str(l).strip()]
        else:
            self.labels = []
        
        # Remove duplicates while preserving order
        seen = set()
        unique_labels = []
        for l in self.labels:
            if l not in seen:
                seen.add(l)
                unique_labels.append(l)
        self.labels = unique_labels
        
        if not self.labels:
            raise ValueError("No valid labels provided. Please select at least one class.")
        
        print(f"Labels loaded: {self.labels}")
        
        self.box_threshold = float(box_threshold)
        self.text_threshold = float(text_threshold)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        config_path = self._find_file("weights/groundingdino_swint_ogc.cfg.py")
        checkpoint_path = self._find_file("weights/groundingdino_swint_ogc.pth")
        
        print(f"Loading GroundingDINO on {self.device}...")
        self.grounding_model = load_model(config_path, checkpoint_path)
        self.grounding_model = self.grounding_model.to(self.device)
        
        print("Loading MobileSAM...")
        sam_path = self._find_file("mobile_sam.pt")
        self.sam_model = SAM(sam_path)
        self.sam_model.to(self.device)
        print("All models ready!")

    def _find_file(self, relative_path: str) -> str:
        paths = [
            relative_path,
            os.path.join("ai-service", relative_path),
            os.path.join(os.path.dirname(__file__), relative_path),
            os.path.join(os.path.dirname(__file__), "..", relative_path),
        ]
        for p in paths:
            if os.path.exists(p):
                return p
        raise FileNotFoundError(f"Cannot find {relative_path}. Searched: {paths}")

    def _detect_objects(self, image_path, image_bgr):
        if not self.labels:
            raise ValueError("No labels to detect")
        
        # Build prompt safely: "label1 . label2 . label3 ."
        clean_labels = [str(l).strip() for l in self.labels if str(l).strip()]
        text_prompt = " . ".join(clean_labels) + " ."
        print(f"Detection prompt: '{text_prompt}'")
        
        # Load image in GroundingDINO format
        _, image_tensor = load_image(image_path)
        image_tensor = image_tensor.to(self.device)
        
        # Detection
        boxes, logits, phrases = predict(
            model=self.grounding_model,
            image=image_tensor,
            caption=text_prompt,
            box_threshold=self.box_threshold,
            text_threshold=self.text_threshold,
            device=self.device
        )
        return boxes, logits, phrases

    def _detect_from_array(self, image_bgr):
        import uuid
        # Use unique temp path to prevent parallel processing clashes
        temp_path = f"temp_detect_{uuid.uuid4().hex[:8]}.jpg"
        try:
            cv2.imwrite(temp_path, image_bgr)
            boxes, logits, phrases = self._detect_objects(temp_path, image_bgr)
            return boxes, logits, phrases
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def _process_detections(self, image_bgr, detections, output_dir, image_name):
        boxes_norm, logits, phrases = detections
        h, w = image_bgr.shape[:2]
        
        if len(boxes_norm) == 0:
            return {"file": image_name, "detections": 0}

        boxes_xyxy = self._boxes_to_xyxy(boxes_norm, w, h)
        scores = logits.cpu().numpy()
        
        if len(boxes_xyxy) == 0: return {"file": image_name, "detections": 0}
        
        boxes_xyxy, scores, keep_idx = self._apply_nms(boxes_xyxy, scores, iou_threshold=0.45)
        phrases = [phrases[i] for i in keep_idx]
        class_ids = np.array([self._phrase_to_label_idx(p) for p in phrases])
        
        # Simple export for now (YOLO)
        self._export_yolo(image_name.replace(".jpg",""), boxes_xyxy, class_ids, w, h, Path(output_dir))
        
        # Preview
        annotated = self._draw_annotations(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB), boxes_xyxy, class_ids, scores, phrases)
        preview_path = Path(output_dir) / "previews" / image_name
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(preview_path), cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR))
        
        return {"file": image_name, "detections": len(boxes_xyxy), "preview": str(preview_path)}

    def _boxes_to_xyxy(self, boxes, img_w, img_h):
        if len(boxes) == 0:
            return np.array([])
        
        boxes_np = boxes.cpu().numpy()
        xyxy = []
        for box in boxes_np:
            cx, cy, w, h = box
            x1 = (cx - w/2) * img_w
            y1 = (cy - h/2) * img_h
            x2 = (cx + w/2) * img_w
            y2 = (cy + h/2) * img_h
            
            # Clip to image boundaries
            x1 = max(0, min(x1, img_w))
            y1 = max(0, min(y1, img_h))
            x2 = max(0, min(x2, img_w))
            y2 = max(0, min(y2, img_h))
            
            # Skip tiny boxes (noise)
            if (x2 - x1) > 5 and (y2 - y1) > 5:
                xyxy.append([x1, y1, x2, y2])
        return np.array(xyxy)

    def _apply_nms(self, boxes_xyxy, scores, iou_threshold=0.5):
        if len(boxes_xyxy) == 0:
            return boxes_xyxy, scores, list(range(len(boxes_xyxy)))
        
        boxes_t = torch.tensor(boxes_xyxy, dtype=torch.float32)
        scores_t = torch.tensor(scores, dtype=torch.float32)
        
        keep = ops.nms(boxes_t, scores_t, iou_threshold).numpy()
        return boxes_xyxy[keep], scores[keep], keep

    def _phrase_to_label_idx(self, phrase: str) -> int:
        phrase_lower = phrase.lower().strip()
        for i, label in enumerate(self.labels):
            if label.lower() == phrase_lower: return i
        for i, label in enumerate(self.labels):
            if label.lower() in phrase_lower: return i
        for i, label in enumerate(self.labels):
            if phrase_lower in label.lower(): return i
        return -1 # Return -1 to indicate NO MATCH

    def annotate_image(self, image_path: str, output_dir: str, export_format: str = "yolo") -> dict:
        image_name = Path(image_path).stem
        image_bgr = cv2.imread(image_path)
        if image_bgr is None: return {"file": image_path, "error": "Cannot read image"}
        
        h_orig, w_orig = image_bgr.shape[:2]
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        
        boxes_norm, logits, phrases = self._detect_objects(image_path, image_bgr)
        
        if len(boxes_norm) == 0:
            return {"file": image_path, "detections": 0, "message": "No objects detected"}
        
        boxes_xyxy = self._boxes_to_xyxy(boxes_norm, w_orig, h_orig)
        scores = logits.cpu().numpy()
        
        if len(boxes_xyxy) == 0: return {"file": image_path, "detections": 0, "message": "Noise filtered"}
        
        boxes_xyxy, scores, keep_idx = self._apply_nms(boxes_xyxy, scores, iou_threshold=0.45)
        phrases = [phrases[i] for i in keep_idx]
        
        # Filter classes that don't match our requested labels
        final_boxes, final_phrases, final_class_ids, final_scores = [], [], [], []
        for i, p in enumerate(phrases):
            idx = self._phrase_to_label_idx(p)
            if idx != -1:
                final_boxes.append(boxes_xyxy[i])
                final_phrases.append(self.labels[idx])
                final_class_ids.append(idx)
                final_scores.append(scores[i])
        
        if not final_boxes:
            return {"file": image_path, "detections": 0, "message": "No matching labels found"}
            
        boxes_xyxy = np.array(final_boxes)
        phrases = final_phrases
        class_ids = np.array(final_class_ids)
        scores = np.array(final_scores)
        
        masks = None
        try:
            sam_results = self.sam_model(image_path, bboxes=boxes_xyxy, verbose=False)
            if sam_results and sam_results[0].masks is not None:
                mask_data = sam_results[0].masks.data
                resized = []
                for m in mask_data.cpu().numpy():
                    r = cv2.resize(m.astype(np.float32), (w_orig, h_orig), interpolation=cv2.INTER_LINEAR)
                    resized.append(r > 0.5)
                masks = np.array(resized)
        except Exception as e:
            print(f"SAM warning: {e}")

        annotated = self._draw_annotations(image_rgb, boxes_xyxy, class_ids, scores, phrases, masks)
        out_path = Path(output_dir)
        preview_dir = out_path / "previews"
        preview_dir.mkdir(parents=True, exist_ok=True)
        preview_path = preview_dir / f"{image_name}_annotated.jpg"
        cv2.imwrite(str(preview_path), cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR))
        
        with open(out_path / "classes.txt", "w") as f: f.write("\n".join(self.labels))
        
        fmt = export_format.lower()
        if fmt == "yolo":
            self._export_yolo(image_name, boxes_xyxy, class_ids, w_orig, h_orig, out_path)
        elif fmt == "coco":
            self._export_coco(image_name, image_path, boxes_xyxy, class_ids, scores, masks, w_orig, h_orig, out_path)
        elif fmt == "voc":
            self._export_voc(image_name, image_path, boxes_xyxy, phrases, w_orig, h_orig, out_path)
        
        return {"file": image_path, "detections": len(boxes_xyxy), "labels_found": list(set(phrases)), "preview": str(preview_path)}

    def _export_coco(self, name, path, boxes, class_ids, scores, masks, w, h, out_dir):
        (out_dir / "coco").mkdir(exist_ok=True, parents=True)
        coco_file = out_dir / "coco" / "annotations.json"
        
        data = {"images": [], "annotations": [], "categories": []}
        if coco_file.exists():
            with open(coco_file, "r") as f: data = json.load(f)
        
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

class VideoAnnotator:
    def __init__(self, labels_or_annotator, box_threshold=0.20, text_threshold=0.20, sample_fps=0):
        if isinstance(labels_or_annotator, ImageAnnotator):
            self.image_annotator = labels_or_annotator
        else:
            self.image_annotator = ImageAnnotator(labels_or_annotator, box_threshold, text_threshold)
        
        self.labels = self.image_annotator.labels
        self.sample_fps = float(sample_fps)

    def annotate_video(self, video_path: str, output_dir: str, export_format: str = "yolo", progress_callback=None) -> dict:
        video_name = Path(video_path).stem
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = total_frames / fps
        frames_dir = Path(output_dir) / "frames" / video_name
        frames_dir.mkdir(parents=True, exist_ok=True)

        if self.sample_fps > 0: sample_fps = self.sample_fps
        else:
            # Optimized Auto-Smart: Don't process every frame even for short clips
            if duration < 60: sample_fps = 5  # 5 FPS is plenty for most motion
            elif duration < 300: sample_fps = 2
            else: sample_fps = 1
        
        frame_interval = max(1, int(fps / sample_fps))
        all_results, saved_frames, curr = [], [], 0
        
        while True:
            ret, frame = cap.read()
            if not ret: break
            
            if curr % frame_interval == 0:
                f_name = f"frame_{curr:06d}.jpg"
                f_path = frames_dir / f_name
                
                # Detect and process in one flow
                detections = self.image_annotator._detect_from_array(frame)
                res = self.image_annotator._process_detections(frame, detections, output_dir, f_name)
                
                # Save raw image for final storage
                cv2.imwrite(str(f_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
                saved_frames.append(str(f_path))
                all_results.append(res)
                
                if progress_callback:
                    progress_callback(int((curr / total_frames) * 100))
                    
            curr += 1
        cap.release()
        
        annotated_video_path = self._build_output_video(saved_frames, output_dir, video_name, fps, w, h)
        timeline = self._build_timeline(all_results, saved_frames, fps)
        with open(Path(output_dir) / f"{video_name}_timeline.json", "w") as f: json.dump(timeline, f, indent=2)
        
        return {
            "file": video_path, "frames_processed": len(saved_frames), "total_detections": sum(r.get("detections", 0) for r in all_results),
            "annotated_video": str(annotated_video_path), "timeline": str(Path(output_dir) / f"{video_name}_timeline.json")
        }

    def _build_output_video(self, frame_paths, output_dir, video_name, fps, w, h):
        out_path = str(Path(output_dir) / f"{video_name}_annotated.mp4")
        writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h))
        for fp in frame_paths:
            prev = Path(output_dir) / "previews" / (Path(fp).stem + "_annotated.jpg")
            frame = cv2.imread(str(prev)) if prev.exists() else cv2.imread(fp)
            if frame is not None:
                if frame.shape[1] != w or frame.shape[0] != h: frame = cv2.resize(frame, (w, h))
                writer.write(frame)
        writer.release()
        return out_path

    def _build_timeline(self, results, frame_paths, fps):
        timeline = {"fps": fps, "frames": []}
        for r, fp in zip(results, frame_paths):
            f_num = int(Path(fp).stem.replace("frame_", ""))
            ts = f_num / fps
            timeline["frames"].append({
                "frame_number": f_num, "timestamp_seconds": round(ts, 3),
                "timestamp_formatted": f"{int(ts//60):02d}:{ts%60:05.2f}",
                "detections": r.get("detections", 0), "labels_found": r.get("labels_found", [])
            })
        return timeline
