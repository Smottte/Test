import os
from .database import SessionLocal
from .models import PantryItem


def seed_data():
    enabled = os.getenv("SEED_DEMO_DATA", "false").lower() == "true"
    print(f"[seed] demo_mode_enabled={enabled}")
    if not enabled:
        return
    db = SessionLocal()
    try:
        # Intentionally no hardcoded ingredient rows by default in this build.
        if db.query(PantryItem).count() == 0:
            print("[seed] demo mode enabled but no default rows configured")
    finally:
        db.close()
