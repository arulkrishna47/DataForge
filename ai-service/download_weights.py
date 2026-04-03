import os
from pathlib import Path

def download_weights():
  weights_dir = Path("weights")
  weights_dir.mkdir(exist_ok=True)

  # Download Grounding DINO weights
  gdino_url = "https://github.com/IDEA-Research/GroundingDINO/releases/download/v0.1.0-alpha/groundingdino_swint_ogc.pth"
  gdino_cfg = "https://raw.githubusercontent.com/IDEA-Research/GroundingDINO/main/groundingdino/config/GroundingDINO_SwinT_OGC.py"

  # Use powershell equivalent for wget since we are on Windows
  import platform
  if platform.system() == "Windows":
    os.system(f"powershell -Command \"Invoke-WebRequest -Uri '{gdino_url}' -OutFile 'weights/groundingdino_swint_ogc.pth'\"")
    os.system(f"powershell -Command \"Invoke-WebRequest -Uri '{gdino_cfg}' -OutFile 'weights/groundingdino_swint_ogc.cfg.py'\"")
  else:
    os.system(f"wget -q -O weights/groundingdino_swint_ogc.pth {gdino_url}")
    os.system(f"wget -q -O weights/groundingdino_swint_ogc.cfg.py {gdino_cfg}")

  # SAM 2 downloads automatically via ultralytics
  print("Weights downloaded successfully!")

if __name__ == "__main__":
  download_weights()
