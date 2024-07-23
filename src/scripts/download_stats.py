import requests
import json
import datetime

defualt_headers = {
    # ":authority:": "www.pathofexile.com",
    # ":method:": "GET",
    # ":path:": "/api/trade/data/items",
    # ":scheme:": "https",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "zh-TW,zh;q=0.9",
    "Cache-Control": "max-age=0",
    # "If-Modified-Since": "Tue, 23 Jul 2024 09:34:32 GMT",
    "Priority": "u=0, i",
    "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Microsoft Edge";v="126"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
}


def load_json(file_name: str) -> dict:
    """Load json file."""

    with open(file_name, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: dict | list, file_name: str) -> None:
    """Save data to json file."""

    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def download_stats() -> None:
    """Download stats data from pathofexile.com."""

    res = requests.get(
        "https://www.pathofexile.com/api/trade/data/stats", headers=defualt_headers
    )
    stats = json.loads(res.text)
    save_json(
        stats,
        f"../static/stats_data_{datetime.datetime.now().strftime('%y%m%d')}.json",
    )


def download_gems() -> None:
    """Download gems data from pathofexile.com."""

    res = requests.get(
        "https://www.pathofexile.com/api/trade/data/items", headers=defualt_headers
    )
    gems = json.loads(res.text)
    save_json(
        gems, f"../static/gems_data_{datetime.datetime.now().strftime('%y%m%d')}.json"
    )


if __name__ == "__main__":
    download_stats()
    download_gems()
