# app/services/stt_service.py

import os
from transformers import pipeline
import core.config as config
from services.logger_service import get_logger

logger = get_logger(__name__)

# Cache of initialized pipelines keyed by (model_name, device)
_PIPELINES = {}

def _resolve_model_name(size_or_name: str | None) -> str:
    if not size_or_name:
        return config.MODEL_MAP[config.DEFAULT_MODEL_SIZE]
    return config.MODEL_MAP.get(size_or_name, size_or_name)  # allow full HF ids too

def _device_index() -> int:
    return 0 if config.DEVICE == "cuda" else -1

def _get_pipeline(model_id: str):
    key = (model_id, config.DEVICE)
    if key not in _PIPELINES:
        logger.info(f"Loading ASR pipeline: {model_id} on {config.DEVICE}")
        _PIPELINES[key] = pipeline(
            task="automatic-speech-recognition",
            model=model_id,
            device=_device_index(),
        )
        logger.info("ASR pipeline loaded.")
    return _PIPELINES[key]

def transcribe_file(file_path: str, model_size: str | None = None, language: str | None = None) -> str:
    """
    Transcribe an audio file using HF Whisper.
    model_size: "tiny" | "base" | "small" | "medium" | full HF model id
    language: "en" | "ar" | None (auto-detect)
    """
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return "Audio file not found."

    try:
        model_id = _resolve_model_name(model_size)
        asr = _get_pipeline(model_id)

        logger.info(f"Transcribing {file_path} with model={model_id}, lang={language or 'auto'}")
        generate_kwargs = {"task": "transcribe"}  # don’t force translate
        if language and language.lower() != "auto":
            generate_kwargs["language"] = language

        # Chunking helps with longer files
        result = asr(
            file_path,
            chunk_length_s=30,
            stride_length_s=5,
            generate_kwargs=generate_kwargs,
        )
        text = (result.get("text") or "").strip()
        logger.info(f"Transcription done ({len(text)} chars)")
        return text if text else "No speech detected in the audio."
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        return f"Error during transcription: {e}"
