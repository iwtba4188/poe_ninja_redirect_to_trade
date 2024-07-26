import requests
import json
from json_loader import load_json, save_json
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


def download_stats(domain) -> None:
    """Download stats data from pathofexile.com."""

    res = requests.get(
        f"https://www.pathofexile.{domain}/api/trade/data/stats",
        headers=defualt_headers,
    )
    stats = json.loads(res.text)
    save_json(
        stats,
        f"../data/{domain}_stats_data.json",
    )


def download_gems(domain) -> None:
    """Download gems data from pathofexile.com."""

    res = requests.get(
        f"https://www.pathofexile.{domain}/api/trade/data/items",
        headers=defualt_headers,
    )
    gems = json.loads(res.text)
    save_json(
        gems,
        f"../data/{domain}_gems_data.json",
    )


def download_cof_data() -> None:
    res = requests.get("https://www.craftofexile.com/json/data/main/poec_data.json")
    save_json(
        res.text,
        f"../data/cof_data_{datetime.datetime.now().strftime('%y%m%d')}.json",
    )


if __name__ == "__main__":
    # download_stats()
    download_gems("tw")
    # download_cof_data()
    pass
