# main.py
import os
import json
import base64
import asyncio
from typing import Dict, Optional, Set
from dataclasses import dataclass, field

import numpy as np
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# =========================
# Config
# =========================
SAMPLE_RATE = 16000                       # FE sends 16kHz PCM16 mono
ASSEMBLYAI_URL = f"wss://api.assemblyai.com/v2/realtime/ws?sample_rate={SAMPLE_RATE}"
ASSEMBLYAI_TOKEN = os.getenv("ASSEMBLYAI_TOKEN", "2a385e5176fb4bc3928c21be7dbddac1").strip()

if not ASSEMBLYAI_TOKEN:
    print("[WARN] ASSEMBLYAI_TOKEN is not set; student connections will fail to open upstream AAI WS.")

# =========================
# State
# =========================
@dataclass
class StudentState:
    ws: WebSocket
    student_id: str
    device_label: str = ""
    db: float = -120.0
    speaking: bool = False
    aai_ws: Optional[websockets.WebSocketClientProtocol] = None
    aai_reader_task: Optional[asyncio.Task] = None

admins: Set[WebSocket] = set()
students_by_ws: Dict[WebSocket, StudentState] = {}
students_by_id: Dict[str, StudentState] = {}

# =========================
# Helpers
# =========================
async def safe_send_json(ws: WebSocket, obj: dict):
    try:
        await ws.send_text(json.dumps(obj))
    except Exception:
        pass

async def broadcast_admin(obj: dict):
    dead = []
    for a in list(admins):
        try:
            await a.send_text(json.dumps(obj))
        except Exception:
            dead.append(a)
    for d in dead:
        admins.discard(d)

def ranking_payload():
    """Closest = speaking + highest dB. If no one speaking, use highest dB."""
    vals = list(students_by_id.values())
    if not vals:
        return []
    speaking = [s for s in vals if s.speaking]
    arr = speaking if speaking else vals
    arr.sort(key=lambda s: s.db, reverse=True)
    return [{"studentId": s.student_id, "db": round(s.db, 1)} for s in arr]

# =========================
# AssemblyAI pipe
# =========================
async def pipe_aai_to_admins(aai_ws: websockets.WebSocketClientProtocol, student_id: str):
    """
    Reads messages from AssemblyAI realtime WS and fans out transcripts to admins.
    We tag each transcript with the originating student_id.
    """
    try:
        async for raw in aai_ws:
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            mtype = msg.get("message_type")
            # AssemblyAI commonly sends "PartialTranscript" & "FinalTranscript"
            if mtype in ("PartialTranscript", "FinalTranscript"):
                text = (msg.get("text") or "").strip()
                if text:
                    await broadcast_admin({
                        "type": "transcript",
                        "studentId": student_id,
                        "text": text,
                        "final": (mtype == "FinalTranscript"),
                    })
    except Exception:
        # Reader ends on socket close or error; that's fine
        pass

async def open_aai_ws(student_id: str) -> websockets.WebSocketClientProtocol:
    """
    Opens a client websocket to AssemblyAI realtime with Authorization header.
    """
    headers = (("Authorization", ASSEMBLYAI_TOKEN),)
    aai_ws = await websockets.connect(ASSEMBLYAI_URL, extra_headers=headers, max_size=2**23)
    # Optionally send a config message (punctuation, language, etc.)
    # Some accounts accept audio right away without extra config.
    try:
        config = {"config": {"punctuate": True}}
        await aai_ws.send(json.dumps(config))
    except Exception:
        pass
    return aai_ws

# =========================
# FastAPI app
# =========================
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True,
)

@app.get("/")
async def root():
    return {"ok": True, "realtime": "assemblyai", "sample_rate": SAMPLE_RATE}

@app.websocket("/asr")
async def asr_ws(ws: WebSocket):
    await ws.accept()
    role: Optional[str] = None
    state: Optional[StudentState] = None

    try:
        while True:
            msg = await ws.receive()

            # -------------------------
            # TEXT frames (JSON)
            # -------------------------
            if "text" in msg and msg["text"]:
                try:
                    data = json.loads(msg["text"])
                except Exception:
                    continue

                mtype = data.get("type")

                if mtype == "hello":
                    role = data.get("role")

                    if role == "admin":
                        admins.add(ws)
                        # Push a full snapshot
                        await safe_send_json(ws, {"type": "reset"})
                        for s in students_by_id.values():
                            await safe_send_json(ws, {
                                "type": "hello", "role": "student",
                                "studentId": s.student_id, "deviceLabel": s.device_label
                            })
                        await safe_send_json(ws, {"type": "ranking", "order": ranking_payload()})
                        continue

                    if role == "student":
                        sid = str(data.get("studentId") or "student")
                        label = str(data.get("deviceLabel") or "")
                        st = StudentState(ws=ws, student_id=sid, device_label=label)
                        students_by_ws[ws] = st
                        students_by_id[sid] = st
                        state = st

                        # Notify admins a new student arrived
                        await broadcast_admin({
                            "type": "hello", "role": "student",
                            "studentId": sid, "deviceLabel": label
                        })
                        await broadcast_admin({"type": "ranking", "order": ranking_payload()})

                        # Open upstream AssemblyAI WS
                        if ASSEMBLYAI_TOKEN:
                            try:
                                st.aai_ws = await open_aai_ws(sid)
                                st.aai_reader_task = asyncio.create_task(
                                    pipe_aai_to_admins(st.aai_ws, sid)
                                )
                            except Exception as e:
                                await broadcast_admin({
                                    "type": "transcript", "studentId": sid,
                                    "text": f"[AAI open error: {e}]"
                                })
                        else:
                            await broadcast_admin({
                                "type": "transcript", "studentId": sid,
                                "text": "[Server missing ASSEMBLYAI_TOKEN]"
                            })
                        continue

                # Metrics from students
                if role == "student" and mtype == "metrics" and state:
                    try:
                        state.db = float(data.get("db", -120.0))
                    except Exception:
                        state.db = -120.0
                    state.speaking = bool(data.get("speaking", False))

                    # Fan-out metrics + ranking to admins
                    await broadcast_admin({
                        "type": "metrics",
                        "studentId": state.student_id,
                        "db": round(state.db, 1),
                        "speaking": state.speaking
                    })
                    await broadcast_admin({
                        "type": "ranking",
                        "order": ranking_payload()
                    })
                    continue

            # -------------------------
            # BINARY frames (PCM16 @ 16kHz from students)
            # -------------------------
            if "bytes" in msg and msg["bytes"] and role == "student" and state:
                pcm: bytes = msg["bytes"]
                if not state.aai_ws:
                    # if AAI isn't connected, just ignore audio
                    continue
                try:
                    # AssemblyAI expects base64 audio chunks (ideally ~100ms windows)
                    b64 = base64.b64encode(pcm).decode("ascii")
                    payload = json.dumps({"audio_data": b64})
                    await state.aai_ws.send(payload)
                except Exception as e:
                    await broadcast_admin({
                        "type": "transcript",
                        "studentId": state.student_id,
                        "text": f"[AAI send error: {e}]"
                    })
                continue

            # else: ping/pong/close handled by server

    except WebSocketDisconnect:
        pass
    except Exception:
        # swallow unexpected WS receive errors
        pass
    finally:
        # Cleanup on disconnect
        try:
            if role == "admin":
                admins.discard(ws)

            elif role == "student" and state:
                # Close upstream AAI WS
                try:
                    if state.aai_reader_task:
                        state.aai_reader_task.cancel()
                    if state.aai_ws:
                        await state.aai_ws.close()
                except Exception:
                    pass

                # Drop from maps
                students_by_ws.pop(ws, None)
                if students_by_id.get(state.student_id) is state:
                    students_by_id.pop(state.student_id, None)

                # Recompute ranking for admins
                await broadcast_admin({"type": "ranking", "order": ranking_payload()})
        except Exception:
            pass
