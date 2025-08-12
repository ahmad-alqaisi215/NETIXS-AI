# app/services/stt_service.py

import os
from transformers import pipeline
import core.config as config
from services.logger_service import get_logger

logger = get_logger(__name__)

logger.info(f"Loading ASR model: {config.MODEL_NAME} on {config.DEVICE}")
asr_pipeline = pipeline(
    task="automatic-speech-recognition",
    model=config.MODEL_NAME,
    device=0 if config.DEVICE == "cuda" else -1
)

logger.info("ASR model loaded.")

def transcribe_file(file_path: str) -> str:
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return "Audio file not found."

    try:
        logger.info(f"Transcribing: {file_path}")
        generate_kwargs = {}
        if config.LANGUAGE:
            generate_kwargs["language"] = config.LANGUAGE
            logger.info(f"Forced language: {config.LANGUAGE}")

        result = asr_pipeline(file_path, generate_kwargs=generate_kwargs)
        text = result.get("text", "").strip()

        logger.info(f"Transcription result: {text[:50]}...")
        return text if text else "No speech detected in the audio."

    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        return f"Error during transcription: {e}"
