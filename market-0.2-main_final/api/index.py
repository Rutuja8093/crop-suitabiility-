import sys
import os
from pathlib import Path

# Add backend directory to sys.path so app modules are discoverable
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Set working directory to backend for local assets and file lookups
try:
    os.chdir(str(backend_dir))
except Exception:
    pass

from app.main import app

# Export app for Vercel Python runtime
app = app
