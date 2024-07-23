import json


def load_json(file_name: str) -> dict:
    """Load json file."""

    with open(file_name, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: dict | list, file_name: str) -> None:
    """Save data to json file."""

    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
