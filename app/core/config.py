# app/core/config.py

# Model ID
DEFAULT_MODEL_SIZE = "small"
MODEL_MAP = {
    "tiny":  "openai/whisper-tiny",
    "base":  "openai/whisper-base",
    "small": "openai/whisper-small",
    "medium":"openai/whisper-medium",
    "large": "openai/whisper-large-v3"
}


LANGUAGE = None # Auto-detect

DEVICE = "cpu"