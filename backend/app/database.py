from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

# SQLite 相对路径以 backend/ 为基准，保证从任意目录启动都能找到同一个库
_database_url = settings.database_url
if _database_url.startswith("sqlite:///"):
    raw_path = _database_url[len("sqlite:///"):]
    if not raw_path.startswith(":memory:"):
        db_path = Path(raw_path)
        if not db_path.is_absolute():
            db_path = Path(__file__).resolve().parent.parent / db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        _database_url = f"sqlite:///{db_path.as_posix()}"

engine = create_engine(
    _database_url,
    connect_args={"check_same_thread": False} if _database_url.startswith("sqlite") else {},
)


@event.listens_for(engine, "connect")
def _sqlite_pragma(dbapi_conn, _connection_record):
    if not _database_url.startswith("sqlite"):
        return
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
