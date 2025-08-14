import os
import json
import base64
import asyncio
import logging
from typing import Dict, Optional, Set, List
from dataclasses import dataclass, field

import websockets
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

# =========================
# Logging
# =========================
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("asr_server")

# =========================
# Config (AAI Universal-Streaming v3)
# =========================
SAMPLE_RATE = 16000
ENCODING = "pcm_s16le"   # 16-bit PCM, mono
FRAME_MS = 50            # 50ms frames recommended
SAMPLES_PER_FRAME = int(SAMPLE_RATE * FRAME_MS / 1000)  # 800 samples
BYTES_PER_FRAME = SAMPLES_PER_FRAME * 2                 # 1600 bytes

AIAI_API_KEY = os.getenv("ASSEMBLYAI_TOKEN", "2a385e5176fb4bc3928c21be7dbddac1").strip()
AIAI_TOKEN_ENDPOINT = "https://streaming.assemblyai.com/v3/token"
AIAI_WS_BASE = "wss://streaming.assemblyai.com/v3/ws"

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
    carry: bytearray = field(default_factory=bytearray)

admins: Set[WebSocket] = set()
students_by_ws: Dict[WebSocket, StudentState] = {}
students_by_id: Dict[str, StudentState] = {}

# Ring buffer for transcripts (per student)
TRANSCRIPT_BUFFER_LIMIT = 5000
transcripts: List[dict] = []  # each: {studentId, text, final, ts}

# =========================
# Helpers
# =========================
async def safe_send_json(ws: WebSocket, obj: dict):
    try:
        await ws.send_text(json.dumps(obj))
    except Exception as e:
        logger.error(f"[SendJSON] {e}")

async def broadcast_admin(obj: dict):
    dead = []
    # logger.info(f"Broadcasting to admins: {obj}")
    for a in list(admins):
        try:
            await a.send_text(json.dumps(obj))
        except Exception:
            dead.append(a)
    for d in dead:
        admins.discard(d)
        logger.warning("Removed disconnected admin")

def ranking_payload():
    vals = list(students_by_id.values())
    if not vals:
        return []
    speaking = [s for s in vals if s.speaking]
    arr = speaking if speaking else vals
    arr.sort(key=lambda s: s.db, reverse=True)
    return [{"studentId": s.student_id, "db": round(s.db, 1)} for s in arr]

def iter_50ms_frames(pcm: bytes, carry: bytearray):
    """
    Take arbitrary PCM16 mono bytes, prepend carry-over, and yield 50ms chunks (1600 bytes).
    Leftover remains in 'carry'.
    """
    if pcm:
        carry.extend(pcm)
    while len(carry) >= BYTES_PER_FRAME:
        chunk = carry[:BYTES_PER_FRAME]
        del carry[:BYTES_PER_FRAME]
        yield bytes(chunk)

# =========================
# AAI realtime (v3): token + websocket
# =========================
async def get_short_lived_token(expires_in_seconds: int = 300) -> str:
    if not AIAI_API_KEY:
        raise RuntimeError("ASSEMBLYAI_TOKEN is missing")

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            AIAI_TOKEN_ENDPOINT,
            headers={"Authorization": AIAI_API_KEY},  # AAI expects the raw key here
            params={"expires_in_seconds": expires_in_seconds},
        )
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"AAI token fetch failed: {e}, body={r.text}") from e

        data = r.json()
        token = data.get("token")
        if not token:
            raise RuntimeError(f"AAI token endpoint returned no 'token': {data}")
        return token

async def open_aai_ws() -> websockets.WebSocketClientProtocol:
    # 1) Fetch short-lived token
    token = await get_short_lived_token(expires_in_seconds=300)

    # 2) Connect WS with token on URL (NO Authorization header)
    ws_url = f"{AIAI_WS_BASE}?sample_rate={SAMPLE_RATE}&encoding={ENCODING}&token={token}"
    logger.info(f"[AAI] Connecting: {ws_url}")
    return await websockets.connect(ws_url, max_size=2**23)

async def pipe_aai_to_admins(aai_ws: websockets.WebSocketClientProtocol, student_id: str):
    """
    Read messages from AAI and:
      - Log all major message types
      - Broadcast 'Turn' transcripts to admins
      - Store transcripts in memory buffer
    """
    got_begin = False
    try:
        async for raw in aai_ws:
            try:
                msg = json.loads(raw)
            except Exception as e:
                logger.error(f"[AAI][{student_id}] JSON parse error: {e}")
                continue

            mtype = msg.get("type")

            if mtype == "Begin":
                got_begin = True
                logger.info(f"[AAI][{student_id}] Begin: id={msg.get('id')}")
                # Optional: request formatted turns (if supported)
                # await aai_ws.send(json.dumps({"type":"UpdateConfiguration","format_turns": True}))
                continue

            if mtype == "Turn":
                text = (msg.get("transcript") or "").strip()
                eot  = bool(msg.get("end_of_turn", False))
                fmt  = bool(msg.get("turn_is_formatted", False))
                logger.info(f"[AAI][{student_id}] Turn: '{text}' eot={eot} formatted={fmt}")

                if text:
                    item = {
                        "studentId": student_id,
                        "text": text,
                        "final": eot,
                        "ts": msg.get("audio_end_at", None)  # may be None
                    }
                    transcripts.append(item)
                    if len(transcripts) > TRANSCRIPT_BUFFER_LIMIT:
                        del transcripts[: len(transcripts) - TRANSCRIPT_BUFFER_LIMIT]

                    await broadcast_admin({
                        "type": "transcript",
                        "studentId": student_id,
                        "text": text,
                        "final": eot,
                    })
                continue

            if mtype == "Termination":
                logger.info(f"[AAI][{student_id}] Termination: audio_sec={msg.get('audio_duration_seconds')}")
                continue

            if mtype == "Error":
                logger.error(f"[AAI][{student_id}] Error: {msg}")
                continue

            logger.info(f"[AAI][{student_id}] Other: {msg}")

    except Exception as e:
        logger.error(f"[AAI][{student_id}] Read loop error: {e}")
    finally:
        if not got_begin:
            logger.warning(
                f"[AAI][{student_id}] Never received 'Begin' — "
                f"auth/token/URL wrong, or audio never reached the server."
            )

# =========================
# FastAPI app
# =========================
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.get("/")
async def root():
    return {
        "ok": True,
        "realtime": "AssemblyAI Universal-Streaming v3",
        "sample_rate": SAMPLE_RATE,
        "encoding": ENCODING,
        "frame_ms": FRAME_MS,
        "api_key_set": bool(AIAI_API_KEY),
        "students": list(students_by_id.keys()),
        "admins": len(admins),
    }

@app.get("/transcripts")
async def get_transcripts(limit: int = Query(100, ge=1, le=2000), studentId: Optional[str] = None):
    """
    Fetch recent transcripts (in-memory). Optional filter by studentId.
    """
    if studentId:
        data = [t for t in transcripts if t["studentId"] == studentId]
    else:
        data = transcripts
    return list(data[-limit:])

@app.websocket("/asr")
@app.websocket("/asr")
async def asr_ws(ws: WebSocket):
    await ws.accept()
    role: Optional[str] = None
    state: Optional[StudentState] = None
    logger.info("New WebSocket connection established")

    try:
        while True:
            msg = await ws.receive()

            # -------------------------
            # TEXT frames (JSON control/metrics)
            # -------------------------
            if "text" in msg and msg["text"]:
                try:
                    data = json.loads(msg["text"])
                except Exception:
                    continue

                t = data.get("type")

                if t == "hello":
                    role = data.get("role")
                    logger.info(f"Client role: {role}")

                    if role == "admin":
                        admins.add(ws)
                        logger.info("Admin connected")
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
                        logger.info(f"Student connected: {sid} ({label})")

                        st = StudentState(ws=ws, student_id=sid, device_label=label)
                        students_by_ws[ws] = st
                        students_by_id[sid] = st
                        state = st

                        await broadcast_admin({"type": "hello", "role": "student", "studentId": sid, "deviceLabel": label})
                        await broadcast_admin({"type": "ranking", "order": ranking_payload()})

                        try:
                            st.aai_ws = await open_aai_ws()
                            st.aai_reader_task = asyncio.create_task(
                                pipe_aai_to_admins(st.aai_ws, sid)
                            )
                        except Exception as e:
                            logger.error(f"Failed to connect to AAI for {sid}: {e}")
                            await broadcast_admin({
                                "type": "transcript",
                                "studentId": sid,
                                "text": f"[AAI open error: {e}]"
                            })
                        continue

                if role == "student" and t == "metrics" and state:
                    try:
                        state.db = float(data.get("db", -120.0))
                    except Exception:
                        state.db = -120.0
                    state.speaking = bool(data.get("speaking", False))
                    logger.info(f"Metrics from {state.student_id}: db={state.db}, speaking={state.speaking}")
                    await broadcast_admin({
                        "type": "metrics",
                        "studentId": state.student_id,
                        "db": round(state.db, 1),
                        "speaking": state.speaking
                    })
                    await broadcast_admin({"type": "ranking", "order": ranking_payload()})
                    continue

            # -------------------------
            # BINARY frames (PCM16 mono @ 16kHz)
            # -------------------------
            if "bytes" in msg and msg["bytes"] and role == "student" and state:
                pcm: bytes = msg["bytes"]
                if not state.aai_ws:
                    continue
                try:
                    sent_frames = 0
                    for f in iter_50ms_frames(pcm, state.carry):
                        # Send raw PCM bytes directly to AssemblyAI (no JSON, no base64)
                        await state.aai_ws.send(f)
                        sent_frames += 1
                    if sent_frames:
                        logger.debug(f"[AAI][{state.student_id}] sent {sent_frames} frame(s)")
                except Exception as e:
                    logger.error(f"[AAI][{state.student_id}] send error: {e}", exc_info=True)
                    await broadcast_admin({
                        "type": "transcript",
                        "studentId": state.student_id,
                        "text": f"[AAI send error: {e}]"
                    })
                continue

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected (role={role})")
    except Exception as e:
        logger.error(f"Error in /asr: {e}")
    finally:
        try:
            if role == "admin":
                admins.discard(ws)
                logger.info("Admin removed")

            elif role == "student" and state:
                # Stop upstream
                try:
                    if state.aai_reader_task:
                        state.aai_reader_task.cancel()
                    if state.aai_ws:
                        # Politely terminate AAI session
                        try:
                            await state.aai_ws.send(json.dumps({"type": "Terminate"}))
                        except Exception:
                            pass
                        await state.aai_ws.close()
                except Exception:
                    pass

                students_by_ws.pop(ws, None)
                if students_by_id.get(state.student_id) is state:
                    students_by_id.pop(state.student_id, None)

                logger.info(f"Student removed: {state.student_id}")
                await broadcast_admin({"type": "ranking", "order": ranking_payload()})
        except Exception as e:
            logger.error(f"Cleanup error: {e}")
