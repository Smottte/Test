from sqlalchemy import Column, Integer, String, Date, Text, DateTime, func
from .database import Base


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    category = Column(String(80), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit = Column(String(20), nullable=False)
    expiration_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MealIdea(Base):
    __tablename__ = "meal_ideas"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    ingredients_used = Column(Text, nullable=False)
    missing_ingredients = Column(Text, nullable=False)
    meal_type = Column(String(20), nullable=False, default="dinner")
    image_hint = Column(String(80), nullable=True)
    plan_day = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    meal_idea_id = Column(Integer, nullable=False)
    pantry_item_name = Column(String(120), nullable=False)
    quantity_used = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
