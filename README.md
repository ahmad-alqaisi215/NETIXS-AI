# Speech-to-Text Demo (Gradio + Hugging Face Whisper)

A simple, modular **speech-to-text** application built with:
- **Gradio** for the UI
- **Hugging Face Transformers (Whisper)** for transcription
- **Python logging** for request tracking

Supports microphone recording and file uploads. Arabic and English are supported (depends on the Whisper model).

---

## Project Structure
```
app/
├── core/
│   └── config.py              # Config variables (model, device, language)
├── services/
│   ├── logger_service.py      # Logging helper
│   └── stt_service.py         # Transcription logic (Transformers Whisper)
├── ui/
│   ├── blocks.py              # UI layout (Gradio Blocks)
│   ├── callbacks.py           # UI → service bridge
│   └── __init__.py
├── main.py                    # App entrypoint
├── requirements.txt           # Python dependencies
logs/                          # Auto-generated logs (created at runtime)
```

---

## Installation

1) Clone and enter the project:
```bash
git clone https://github.com/ahmad-alqaisi215/NETIXS-AI && cd NETIXS-AI
```

2) Install dependencies:
```bash
pip install -r app/requirements.txt
```

CPU-only PyTorch (if needed):
```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

---

## Usage
Run the app:
```bash
python app/main.py
```

Open in your browser:
```
http://127.0.0.1:7860
```

- Click the **mic** or **upload** a file.
- Press **Transcribe** to get text.

> Tip: If the mic doesn’t work, ensure browser mic permissions are allowed for `127.0.0.1:7860`.

---

## Configuration
Edit **`app/core/config.py`**:
```python
MODEL_NAME = "openai/whisper-small"   # e.g., tiny/base/small/medium/large variants
LANGUAGE = None                       # "en", "ar", or None to auto-detect
DEVICE = "cpu"                        # "cpu" or "cuda"
```

---

## Logging
- Logs are written to `logs/YYYY-MM-DD.log`.
- Console logging is also enabled.
- You’ll see entries for model loading, requests, results, and errors.

---

## Dependencies
- gradio
- transformers
- torch
- torchaudio
- accelerate

---