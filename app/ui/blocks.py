# app/ui/blocks.py

import gradio as gr
from ui.callbacks import transcribe_audio
from services.logger_service import get_logger

logger = get_logger(__name__)

def create_ui():
    logger.info("Creating Speech to Text UI.")

    with gr.Blocks(title="STT Demo") as demo:
        gr.Markdown("# 🎤 Speech to Text Demo\nRecord or upload an audio file to see the transcript.")
        logger.info("UI layout initialized.")

        with gr.Row():
            audio_input = gr.Audio(
                sources=["microphone", "upload"],
                type="filepath",
                label="Audio Input"
            )
            with gr.Column():
                model_dd = gr.Dropdown(
                    choices=["tiny", "base", "small", "medium", "large"],
                    value="small",
                    label="Model size"
                )
                lang_dd = gr.Dropdown(
                    choices=["auto", "en", "ar"],
                    value="auto",
                    label="Language"
                )

        transcript_output = gr.Textbox(
            label="Transcript",
            placeholder="Your transcription will appear here..."
        )

        transcribe_button = gr.Button("Transcribe")

        # Wire callback: pass audio + model + language
        transcribe_button.click(
            fn=transcribe_audio,
            inputs=[audio_input, model_dd, lang_dd],
            outputs=transcript_output
        )

    logger.info("Speech to Text UI creation complete.")
    return demo
