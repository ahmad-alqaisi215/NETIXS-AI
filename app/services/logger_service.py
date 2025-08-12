import logging
import os
from datetime import datetime

def get_logger(name: str):
    os.makedirs("logs", exist_ok=True)
    log_file = os.path.join("logs", f"{datetime.now().strftime('%Y-%m-%d')}.log")

    logging.basicConfig(
        filename=log_file,
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    return logging.getLogger(name)
