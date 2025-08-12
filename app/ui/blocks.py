# app/ui/blocks.py

import gradio as gr
from ui.callbacks import transcribe_audio
from services.logger_service import get_logger

logger = get_logger(__name__)

def create_ui():
    logger.info("Creating Speech to Text UI.")

    with gr.Blocks() as demo:
        gr.Markdown("# 🎤 Speech to Text Demo\nRecord or upload an audio file to see the transcript.")
        logger.info("UI layout initialized.")

        with gr.Row():
            audio_input = gr.Audio(
                sources=["microphone", "upload"],
                type="filepath",
                label="Audio Input"
            )
            logger.info("Audio input component added (mic + upload).")

        transcript_output = gr.Textbox(
            label="Transcript",
            placeholder="Your transcription will appear here..."
        )
        logger.info("Transcript output textbox added.")

        transcribe_button = gr.Button("Transcribe")
        logger.info("Transcribe button added.")

        # Link button click to the transcription callback
        transcribe_button.click(
            fn=transcribe_audio,
            inputs=audio_input,
            outputs=transcript_output
        )
        logger.info("Transcribe button linked to callback.")

    logger.info("Speech to Text UI creation complete.")
    return demo
