import sqlite3
import aiosqlite
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from config import settings

class Database:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or settings.DATABASE_PATH
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
    
    async def initialize(self):
        """Initialize database and create tables"""
        async with aiosqlite.connect(self.db_path) as db:
            # Read and execute schema
            schema_path = Path(__file__).parent / "schema.sql"
            with open(schema_path, 'r') as f:
                schema = f.read()
            
            await db.executescript(schema)
            await db.commit()

        # Migration: add Google OAuth column if missing
        await self._migrate_add_oauth_column()

    async def _migrate_add_oauth_column(self):
        """Add encrypted_refresh_token to users if not present"""
        async with self.get_connection() as conn:
            cursor = await conn.execute(
                "PRAGMA table_info(users)"
            )
            rows = await cursor.fetchall()
            columns = [row[1] for row in rows]
            if "encrypted_refresh_token" not in columns:
                await conn.execute(
                    "ALTER TABLE users ADD COLUMN encrypted_refresh_token TEXT"
                )
                await conn.commit()
    
    @asynccontextmanager
    async def get_connection(self):
        """Get database connection context manager"""
        conn = await aiosqlite.connect(self.db_path)
        conn.row_factory = aiosqlite.Row
        try:
            yield conn
        finally:
            await conn.close()
    
    async def execute(self, query: str, params: tuple = ()) -> int:
        """Execute a query and return last row id"""
        async with self.get_connection() as conn:
            cursor = await conn.execute(query, params)
            await conn.commit()
            return cursor.lastrowid
    
    async def fetch_one(self, query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        """Fetch one row"""
        async with self.get_connection() as conn:
            cursor = await conn.execute(query, params)
            row = await cursor.fetchone()
            return dict(row) if row else None
    
    async def fetch_all(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Fetch all rows"""
        async with self.get_connection() as conn:
            cursor = await conn.execute(query, params)
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    
    async def execute_many(self, query: str, params_list: List[tuple]) -> None:
        """Execute many queries"""
        async with self.get_connection() as conn:
            await conn.executemany(query, params_list)
            await conn.commit()

# Global database instance
db = Database()
