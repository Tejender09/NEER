import json
import os
from typing import List, Dict, Any

DB_DIR = os.path.join(os.path.dirname(__file__), "db")

# Ensure DB directory exists
os.makedirs(DB_DIR, exist_ok=True)

def get_table_path(table_name: str) -> str:
    return os.path.join(DB_DIR, f"{table_name}.json")

def read_table(table_name: str) -> List[Dict[str, Any]]:
    path = get_table_path(table_name)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return []

def write_table(table_name: str, data: List[Dict[str, Any]]):
    path = get_table_path(table_name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def insert(table_name: str, record: Dict[str, Any]) -> Dict[str, Any]:
    data = read_table(table_name)
    data.append(record)
    write_table(table_name, data)
    return record

def select_all(table_name: str) -> List[Dict[str, Any]]:
    return read_table(table_name)

def select_by(table_name: str, key: str, value: Any) -> List[Dict[str, Any]]:
    data = read_table(table_name)
    return [d for d in data if d.get(key) == value]

def get_by_id(table_name: str, id_value: str) -> Dict[str, Any] | None:
    results = select_by(table_name, "id", id_value)
    return results[0] if results else None

def update_by_id(table_name: str, id_value: str, updates: Dict[str, Any]) -> Dict[str, Any] | None:
    data = read_table(table_name)
    for i, record in enumerate(data):
        if record.get("id") == id_value:
            data[i].update(updates)
            write_table(table_name, data)
            return data[i]
    return None

def upsert_by(table_name: str, key: str, value: Any, record: Dict[str, Any]) -> Dict[str, Any]:
    """Insert if key=value doesn't exist, otherwise update."""
    data = read_table(table_name)
    for i, existing in enumerate(data):
        if existing.get(key) == value:
            data[i].update(record)
            write_table(table_name, data)
            return data[i]
    # Not found, insert
    data.append(record)
    write_table(table_name, data)
    return record
