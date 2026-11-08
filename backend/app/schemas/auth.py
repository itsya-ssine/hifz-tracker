from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["en", "ar"]
Role = Literal["STUDENT", "ADMIN"]


class LoginRequest(BaseModel):
    login: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class UserOut(BaseModel):
    id: int
    login: str
    full_name: str
    email: str | None
    role: Role
    preferred_lang: Language
    is_active: bool
    must_change_password: bool


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    preferred_lang: Language | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)
