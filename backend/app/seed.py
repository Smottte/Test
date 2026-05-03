from datetime import date, timedelta
from .database import SessionLocal
from .models import PantryItem

SAMPLE_ITEMS = [
    ("rice", "grain", 3, "cups", 7),
    ("black beans", "canned", 2, "cans", 10),
    ("chicken breast", "protein", 4, "pieces", 3),
    ("broccoli", "produce", 2, "heads", 2),
    ("onion", "produce", 4, "count", 12),
    ("garlic", "produce", 1, "bulb", 20),
    ("pasta", "grain", 1, "box", 30),
    ("tomato sauce", "canned", 2, "jars", 15),
]

def seed_data():
    db = SessionLocal()
    try:
        if db.query(PantryItem).count() > 0:
            return
        for name, category, qty, unit, days in SAMPLE_ITEMS:
            db.add(PantryItem(
                name=name,
                category=category,
                quantity=qty,
                unit=unit,
                expiration_date=date.today() + timedelta(days=days),
                notes="seeded"
            ))
        db.commit()
    finally:
        db.close()
