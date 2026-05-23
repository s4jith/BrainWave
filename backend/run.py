"""
Run script for NCERT AI Learning Backend.
Start the FastAPI server with uvicorn.
"""
import sys
import os

# Get backend directory path and insert it into sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Also update PYTHONPATH environment variable so uvicorn reloader subprocesses inherit it
os.environ["PYTHONPATH"] = backend_dir + (os.pathsep + os.environ["PYTHONPATH"] if "PYTHONPATH" in os.environ else "")

# WORKAROUND: Python 3.14 compatibility fix for Google Protobuf
# Force pure-Python implementation to avoid "TypeError: Metaclasses with custom tp_new are not supported"
# when importing the C-extension module 'google._upb._message'.
sys.modules["google._upb._message"] = None
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"

# Load .env file FIRST before any other imports
# This ensures all environment variables are available via os.getenv()
from dotenv import load_dotenv
load_dotenv()

import uvicorn
from app.core.config import settings
from app.main import app  # Expose FastAPI app for `uvicorn run:app`

if __name__ == "__main__":
    print("=" * 60)
    print(f">> Starting {settings.APP_NAME}")
    print(f"   Version: {settings.APP_VERSION}")
    print(f"   Host: {settings.HOST}:{settings.PORT}")
    print(f"   Debug: {settings.DEBUG}")
    print(f"   Docs: http://{settings.HOST}:{settings.PORT}/docs")
    print("=" * 60)
    
    # You can also run: `uvicorn run:app --reload --port 8000`
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
