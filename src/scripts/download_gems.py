import datetime
import json

import requests
from json_loader import save_json
from logger import get_logger

logger = get_logger("download_gems")

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

    logger.info(f"Downloading stats data from pathofexile.{domain}")
    res = requests.get(
        f"https://www.pathofexile.{domain}/api/trade/data/stats",
        headers=defualt_headers,
    )
    stats = json.loads(res.text)
    save_path = f"../data/{domain}_stats_data.json"
    save_json(stats, save_path)
    logger.info(f"Saved stats data to: {save_path}")


def download_gems(domain) -> None:
    """Download gems data from pathofexile.com."""

    logger.info(f"Downloading gems data from pathofexile.{domain}")
    res = requests.get(
        f"https://www.pathofexile.{domain}/api/trade/data/items",
        headers=defualt_headers,
    )
    gems = json.loads(res.text)
    save_path = f"../data/{domain}_gems_data.json"
    save_json(gems, save_path)
    logger.info(f"Saved gems data to: {save_path}")


def download_cof_data() -> None:
    logger.info("Downloading CoF data from craftofexile.com")
    res = requests.get("https://www.craftofexile.com/json/data/main/poec_data.json")
    save_path = f"../data/cof_data_{datetime.datetime.now().strftime('%y%m%d')}.json"
    save_json(res.text, save_path)
    logger.info(f"Saved CoF data to: {save_path}")


if __name__ == "__main__":
    logger.info("Starting gems and stats download process...")
    # download_stats()
    download_gems("tw")
    download_gems("com")
    # download_cof_data()
    logger.info("Download process completed!")
    pass
