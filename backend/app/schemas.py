from datetime import date
from typing import Optional, List
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
    plan_day: Optional[str] = None
    class Config:
        from_attributes = True

class GenerateRequest(BaseModel):
    weekly: bool = False
