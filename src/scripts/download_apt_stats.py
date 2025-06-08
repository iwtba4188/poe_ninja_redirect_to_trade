import requests
from json_loader import save_json
from logger import get_logger

logger = get_logger("download_apt_stats")

default_header = {}


lang_code = ["en", "zh-tw", "ko", "ru"]

en_apt_url = "https://raw.githubusercontent.com/SnosMe/awakened-poe-trade/master/renderer/public/data/en/stats.ndjson"
zh_TW_apt_url = "https://raw.githubusercontent.com/SnosMe/awakened-poe-trade/master/renderer/public/data/cmn-Hant/stats.ndjson"
ko_apt_url = "https://raw.githubusercontent.com/SnosMe/awakened-poe-trade/master/renderer/public/data/ko/stats.ndjson"
ru_apt_url = "https://raw.githubusercontent.com/SnosMe/awakened-poe-trade/master/renderer/public/data/ru/stats.ndjson"


logger.info("Starting APT stats download...")

for idx, url in enumerate([en_apt_url, zh_TW_apt_url, ko_apt_url, ru_apt_url]):
    logger.info(f"Downloading {lang_code[idx]} stats from: {url}")
    res = requests.get(url).text
    save_path = f"../data/awakened poe trade/{lang_code[idx]}_stats.ndjson"
    save_json(res, save_path)
    logger.info(f"Saved {lang_code[idx]} stats to: {save_path}")

logger.info("APT stats download completed!")
