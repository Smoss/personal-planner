"""Initial migration - create todos table with pgvector

Revision ID: 0001
Revises:
Create Date: 2026-02-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Create todos table
    op.create_table(
        "todos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("completed", sa.Boolean(), default=False, nullable=False),
        sa.Column("embedding", sa.Text(), nullable=True),  # Will be VECTOR(768)
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    # Add vector column with proper dimensions
    op.execute("ALTER TABLE todos ALTER COLUMN embedding TYPE vector(768) USING embedding::vector(768)")

    # Create HNSW index for fast similarity search
    op.execute("CREATE INDEX idx_todos_embedding ON todos USING hnsw (embedding vector_cosine_ops)")


def downgrade() -> None:
    op.drop_index("idx_todos_embedding", table_name="todos")
    op.drop_table("todos")
    op.execute("DROP EXTENSION IF EXISTS vector")
