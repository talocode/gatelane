#!/usr/bin/env python3
"""Generate GateLane demo video using Pillow and ffmpeg."""

import subprocess
import sys
import os
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1280, 720
FPS = 30
FONT_SIZE = 20
FONT_BIG = 48
FONT_HUGE = 64
COLORS = {
    'bg': (28, 28, 28),
    'fg': (200, 200, 200),
    'green': (131, 193, 103),
    'cyan': (88, 196, 221),
    'yellow': (255, 255, 0),
    'red': (255, 107, 107),
    'muted': (136, 136, 136),
    'white': (255, 255, 255),
    'blue': (61, 133, 222),
}

font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf", FONT_SIZE)
font_big = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf", FONT_BIG)
font_huge = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf", FONT_HUGE)

class Scene:
    def __init__(self, duration_sec):
        self.duration_frames = int(duration_sec * FPS)
        self.frames_drawn = 0

    def draw(self, frame_idx):
        img = Image.new('RGB', (WIDTH, HEIGHT), COLORS['bg'])
        return img

class TextScene(Scene):
    def __init__(self, duration_sec, lines):
        super().__init__(duration_sec)
        self.lines = lines

    def draw(self, frame_idx):
        img = Image.new('RGB', (WIDTH, HEIGHT), COLORS['bg'])
        draw = ImageDraw.Draw(img)
        y = 60
        for text, color_key, is_big in self.lines:
            f = font_big if is_big else font
            draw.text((60, y), text, fill=COLORS.get(color_key, COLORS['fg']), font=f)
            y += 42 if is_big else 28
        return img

def cmd_line(cmd, color='fg'):
    return (f"$ {cmd}", color, False)

def output_line(text, color='fg'):
    return (f"  {text}", color, False)

SCENE_LINES = {
    'hook': [
        ("gatelane call memorylane.memorylane_recall", 'cyan', False),
        ("  --input '{\"query\":\"Hello world\"}'", 'muted', False),
        ("", None, False),
        ('{"result": "Hello! How can I help you today?"}', 'green', False),
        ('{"duration_ms": 42, "status": "completed"}', 'green', False),
    ],
    'what': [
        ("GateLane", 'white', True),
        ("Open-source MCP gateway and agent tool control plane", 'cyan', False),
        ("", None, False),
        ("Agent → GateLane → Tools", 'yellow', False),
        ("", None, False),
        ("  Auth | Policies | Rate Limits | Audit", 'muted', False),
    ],
    'install': [
        ("# Install GateLane", None, False),
        cmd_line("npm install -g @talocode/gatelane"),
        ("+ @talocode/gatelane@0.1.0", 'green', False),
        cmd_line("gatelane init"),
        ("✓ Config initialized at ~/.gatelane", 'green', False),
        cmd_line("gatelane servers add memorylane --type mock"),
        ("✓ Server 'memorylane' registered", 'green', False),
    ],
    'discover': [
        cmd_line("gatelane tools discover"),
        ("memorylane.memorylane_recall  Recall memories", 'cyan', False),
        ("memorylane.memorylane_store    Store a new memory", 'cyan', False),
        ("memorylane.memorylane_forget   Delete a memory", 'cyan', False),
        ("memorylane.memorylane_list     List all memories", 'cyan', False),
        ("  → 4 tools discovered", 'green', False),
    ],
    'policy': [
        cmd_line("gatelane policy allow memorylane.memorylane_recall"),
        ("✓ Policy created (allow)", 'green', False),
        cmd_line("gatelane policy deny memorylane.memorylane_forget"),
        ("✓ Policy created (deny)", 'red', False),
        cmd_line("gatelane policy list"),
        ("  allow  memorylane.memorylane_recall", 'green', False),
        ("  deny   memorylane.memorylane_forget", 'red', False),
    ],
    'audit': [
        cmd_line("gatelane logs list"),
        ("  2026-07-11  memorylane_recall  completed  42ms", 'cyan', False),
        ("  2026-07-11  memorylane_store   completed  15ms", 'cyan', False),
        ("  2026-07-11  memorylane_recall  allowed     0ms", 'green', False),
        ("  2026-07-11  memorylane_forget  blocked     0ms", 'red', False),
        ("  → 4 entries (2 allowed, 1 blocked, 1 completed)", 'muted', False),
    ],
    'api': [
        ("HTTP API — port 3050", 'white', False),
        ("", None, False),
        ("POST /v1/gatelane/call", 'cyan', False),
        ('  {"tool": "memorylane_recall", "input": {"query":"Hi"}}', 'muted', False),
        ("", None, False),
        ("  SDK: GateLaneClient", 'yellow', False),
        ("  MCP: 11 management tools on port 3052", 'yellow', False),
    ],
    'cta': [
        ("GateLane v0.1.0", 'white', True),
        ("", None, False),
        ("npm install -g @talocode/gatelane", 'cyan', False),
        ("github.com/talocode/gatelane", 'cyan', False),
        ("", None, False),
        ("MCP gateway · Policies · Rate limits", 'muted', False),
        ("Audit logs · Discovery · Routing", 'muted', False),
    ],
}

def make_text_scene(duration, lines_key):
    lines = SCENE_LINES[lines_key]
    return TextScene(duration, lines)

scenes = [
    make_text_scene(4, 'hook'),
    make_text_scene(4, 'what'),
    make_text_scene(5, 'install'),
    make_text_scene(4, 'discover'),
    make_text_scene(5, 'policy'),
    make_text_scene(4, 'audit'),
    make_text_scene(4, 'api'),
    make_text_scene(5, 'cta'),
]

def render():
    total_frames = sum(s.duration_frames for s in scenes)
    frame_count = 0

    ffmpeg = subprocess.Popen([
        'ffmpeg', '-y', '-f', 'rawvideo',
        '-vcodec', 'rawvideo', '-s', f'{WIDTH}x{HEIGHT}',
        '-pix_fmt', 'rgb24', '-r', str(FPS),
        '-i', '-', '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p', '-preset', 'fast',
        '-crf', '23', '-movflags', '+faststart',
        '/workspace/projects/gatelane/gatelane-demo.mp4'
    ], stdin=subprocess.PIPE)

    for scene in scenes:
        for i in range(scene.duration_frames):
            img = scene.draw(i)
            raw_bytes = img.tobytes()
            ffmpeg.stdin.write(raw_bytes)
            frame_count += 1
            if frame_count % 30 == 0:
                pct = int(frame_count / total_frames * 100)
                sys.stderr.write(f"\rRendering: {frame_count}/{total_frames} frames ({pct}%)")
                sys.stderr.flush()

    ffmpeg.stdin.close()
    ffmpeg.wait()
    sys.stderr.write(f"\nDone! {frame_count} frames rendered.\n")

if __name__ == '__main__':
    render()
