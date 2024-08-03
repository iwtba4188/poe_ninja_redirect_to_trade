import json


def load_json(file_name: str) -> dict:
    """Load json file."""

    with open(file_name, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: dict | list | str, file_name: str, minify: bool = False) -> None:
    """Save data to json file."""

    with open(file_name, "w", encoding="utf-8") as f:
        if minify:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(data, f, ensure_ascii=False, indent=4)
