"""Transcode Pecu's existing 3D render for Android. Requires ffmpeg and libwebp."""
from pathlib import Path
import subprocess
import tempfile

android = Path(__file__).resolve().parents[1]
source = android.parent / "stocks/src/assets/mascot/idle.webm"
destination = android / "app/src/main/res/raw/pecu_login_motion.webp"
with tempfile.TemporaryDirectory(prefix="pecu-login-") as work:
    frames = Path(work)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-c:v", "libvpx-vp9",
        "-i", str(source), "-vf", "fps=24,scale=480:360:flags=lanczos",
        str(frames / "frame-%03d.png"),
    ], check=True)
    command = ["img2webp", "-loop", "0", "-lossy", "-q", "82", "-m", "4"]
    for index, frame in enumerate(sorted(frames.glob("frame-*.png"))):
        command.extend(["-d", str(41 if index % 3 == 2 else 42), str(frame)])
    subprocess.run(command + ["-o", str(destination)], check=True)
