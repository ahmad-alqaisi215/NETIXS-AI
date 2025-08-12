# app/ui/callbacks.py

from services.stt_service import transcribe_file
from services.logger_service import get_logger

logger = get_logger(__name__)

def transcribe_audio(audio_file_path: str, model_size: str, language_choice: str) -> str:
    """
    audio_file_path: file path from Gradio
    model_size: e.g., 'tiny'|'base'|'small'|'medium' (or full HF id)
    language_choice: 'auto'|'en'|'ar'
    """
    if not audio_file_path:
        logger.warning("No audio file provided by the user.")
        return "No audio file provided."

    lang = None if (not language_choice or language_choice == "auto") else language_choice
    logger.info(f"UI request: file={audio_file_path}, model={model_size}, lang={lang or 'auto'}")
    transcript = transcribe_file(audio_file_path, model_size=model_size, language=lang)
    logger.info(f"Transcript (first 60): {transcript[:60]}...")
    return transcript
