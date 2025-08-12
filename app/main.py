# app/main.py

from ui.blocks import create_ui
from services.logger_service import get_logger

logger = get_logger(__name__)

def main():
    logger.info("Starting Speech to Text application.")

    # Build the UI from blocks.py
    logger.info("Creating UI components.")
    demo = create_ui()
    logger.info("UI components created successfully.")

    # Launch Gradio app
    logger.info("Launching Gradio app on http://127.0.0.1:7860")
    demo.launch(server_name="127.0.0.1", server_port=7860)

if __name__ == "__main__":
    main()
