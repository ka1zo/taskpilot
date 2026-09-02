from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import CurrentUser, SessionDep
from app.models import Category
from app.schemas import CategoryCreate, CategoryRead

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
async def list_categories(current_user: CurrentUser, session: SessionDep) -> list[Category]:
    result = await session.scalars(
        select(Category).where(Category.owner_id == current_user.id).order_by(Category.name)
    )
    return list(result)


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate, current_user: CurrentUser, session: SessionDep
) -> Category:
    category = Category(owner_id=current_user.id, **payload.model_dump())
    session.add(category)
    await session.commit()
    await session.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int, current_user: CurrentUser, session: SessionDep) -> None:
    category = await session.scalar(
        select(Category).where(Category.id == category_id, Category.owner_id == current_user.id)
    )
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    await session.delete(category)
    await session.commit()
