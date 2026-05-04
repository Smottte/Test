import os
from datetime import date, timedelta
from .database import SessionLocal
from .models import PantryItem

SAMPLE_ITEMS = [
    ("rice", "grain", 3, "cups", 7),
    ("black beans", "canned", 2, "cans", 10),
]

def seed_data():
    if os.getenv("SEED_DEMO_DATA", "false").lower() != "true":
        return
    db = SessionLocal()
    try:
        if db.query(PantryItem).count() > 0:
            return
        for name, category, qty, unit, days in SAMPLE_ITEMS:
            db.add(PantryItem(name=name, category=category, quantity=qty, unit=unit, expiration_date=date.today()+timedelta(days=days), notes="seeded"))
        db.commit()
    finally:
        db.close()
