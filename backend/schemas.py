from pydantic import BaseModel

# Request models
class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str

class UpdateUserRequest(BaseModel):
    email: str

# Response models
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: str
    updated_at: str

class UserListResponse(BaseModel):
    users: list[UserResponse]
