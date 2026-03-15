from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas, database, security

router = APIRouter()

# Dependency to get the database session
get_db = lambda: database.SessionLocal()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

@router.post("/auth/register", response_model=schemas.User)
async def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Functionality to create a new user
    db_user = models.User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = security.authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    access_token = security.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/auth/users/me", response_model=schemas.User)
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user = security.get_current_user(token, db)
    return user
