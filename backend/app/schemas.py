from datetime import date
from typing import Optional
from pydantic import BaseModel


class PantryItemCreate(BaseModel):
    name: str
    category: str
    quantity: int
    unit: str
    expiration_date: date
    notes: Optional[str] = None


class PantryItemOut(PantryItemCreate):
    id: int

    class Config:
        from_attributes = True


class MealIdeaOut(BaseModel):
    id: int
    title: str
    description: str
    ingredients_used: str
    missing_ingredients: str
    meal_type: str
    image_hint: Optional[str] = None
    plan_day: Optional[str] = None

    class Config:
        from_attributes = True


class GenerateRequest(BaseModel):
    weekly: bool = False
    meal_type: Optional[str] = None
    prompt: Optional[str] = None


class InventoryImageIn(BaseModel):
    image_base64: str
    context: str = "fridge"


class MarkCookedRequest(BaseModel):
    meal_idea_id: int
