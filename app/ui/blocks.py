import gradio as gr
from ui.callbacks import transcribe_audio

def create_ui():
    with gr.Blocks() as demo:
        gr.Markdown("# 🎤 Speech to Text Demo\nRecord or upload an audio file to see the transcript.")

        with gr.Row():
            audio_input = gr.Audio(
                sources=["microphone", "upload"],
                type="filepath",
                label="Audio Input"
            )

        transcript_output = gr.Textbox(
            label="Transcript",
            placeholder="Your transcription will appear here..."
        )

        transcribe_button = gr.Button("Transcribe")

        # Link button click to the transcription callback
        transcribe_button.click(
            fn=transcribe_audio,
            inputs=audio_input,
            outputs=transcript_output
        )

    return demo
