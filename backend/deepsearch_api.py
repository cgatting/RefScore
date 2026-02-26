from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware
from functools import lru_cache
from typing import List
import json
import asyncio
import os
import logging
from contextlib import asynccontextmanager
from .DEEPSEARCH import DocumentRefiner, DEFAULT_SETTINGS, NLPProcessor
from copy import deepcopy


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()


class BroadcastingView:
    def show_error(self, msg: str):
        asyncio.create_task(manager.broadcast(json.dumps({
            "type": "error",
            "message": msg
        })))

    def update_progress(self, percent: float, status: str):
        asyncio.create_task(manager.broadcast(json.dumps({
            "type": "progress",
            "progress": percent,
            "message": status
        })))


class RefineRequest(BaseModel):
    manuscriptText: str
    maxResults: int | None = None
    noCache: bool | None = None


class RefineResponse(BaseModel):
    processedText: str
    bibliographyText: str
    bibtex: str


# Global NLP Processor to avoid reloading models on every request
nlp_processor = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global nlp_processor
    preload = os.environ.get("REFSCORE_PRELOAD_NLP", "0")
    if preload == "1":
        try:
            nlp_processor = NLPProcessor(DEFAULT_SETTINGS)
        except Exception as e:
            logging.error(f"Failed to initialize NLP processor: {e}")
            nlp_processor = None
    else:
        nlp_processor = None
    yield
    # Cleanup if needed

app = FastAPI(lifespan=lifespan)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_refiner(settings=None):
    settings = settings or DEFAULT_SETTINGS
    view = BroadcastingView()
    if nlp_processor is None:
        try:
            processor = NLPProcessor(settings)
            globals()["nlp_processor"] = processor
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"NLP processor unavailable: {e}")
    else:
        processor = nlp_processor
    return DocumentRefiner(settings, view, nlp_processor=processor)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({
                    "type": "ping"
                }))
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/refine", response_model=RefineResponse)
async def refine(req: RefineRequest):
    if not req.manuscriptText or not req.manuscriptText.strip():
        return RefineResponse(processedText="", bibliographyText="", bibtex="")
    settings = deepcopy(DEFAULT_SETTINGS)
    if isinstance(req.maxResults, int) and req.maxResults > 0:
        try:
            settings['search_settings']['max_results'] = int(req.maxResults)
        except Exception:
            pass
    if isinstance(req.noCache, bool) and req.noCache:
        try:
            settings['privacy_settings']['cache_enabled'] = False
        except Exception:
            pass
    refiner = get_refiner(settings)
    try:
        refiner.view.update_progress(0.0, "Starting DeepSearch refinement...")
        processed = await refiner.refine_document(req.manuscriptText)
        refiner.view.update_progress(0.98, "Generating bibliography and BibTeX...")
        bibliography_text = refiner.generate_bibliography_text()
        bibtex = refiner.generate_bibtex_content()
        refiner.view.update_progress(1.0, "DeepSearch complete")
        return RefineResponse(
            processedText=processed,
            bibliographyText=bibliography_text,
            bibtex=bibtex,
        )
    except HTTPException:
        raise
    except Exception as e:
        try:
            refiner.view.show_error(f"Refinement failed: {e}")
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))

# Serve static files for React frontend
if os.path.exists("dist") and os.environ.get("REFSCORE_SERVE_DIST", "1") == "1":
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        potential_path = os.path.join("dist", full_path)
        if os.path.isfile(potential_path):
            return FileResponse(potential_path)
        return FileResponse("dist/index.html")
