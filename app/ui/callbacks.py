# app/ui/callbacks.py

from services.stt_service import transcribe_file
from services.logger_service import get_logger

logger = get_logger(__name__)

def transcribe_audio(audio_file_path: str) -> str:
    """
    Callback for the UI button.
    Takes the audio file path from Gradio and returns a transcript string.
    """
    if not audio_file_path:
        logger.warning("No audio file provided by the user.")
        return "No audio file provided."
    
    logger.info(f"Received audio file from UI: {audio_file_path}")
    transcript = transcribe_file(audio_file_path)
    logger.info(f"Transcript generated (first 50 chars): {transcript[:50]}...")
    return transcript
