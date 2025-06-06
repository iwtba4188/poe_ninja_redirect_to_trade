from json_loader import load_json, save_json
from logger import get_logger

logger = get_logger("process_gems")

GEMS_PATH = "../data/archive/com_gems_data.json"
GEMS_SAVE_PATH = "../data/com_preprocessed_gems_data.json"
TW_GEMS_PATH = "../data/tw_gems_data.json"
TW_GEMS_SAVE_PATH = "../data/tw_preprocessed_gems_data.json"


def process_gems():
    logger.info("Starting gems processing...")
    gems = load_json(GEMS_PATH)
    logger.info(f"Loaded gems data with {len(gems['result'][5]['entries'])} entries")

    res = {}

    for gem in gems["result"][5]["entries"]:
        # is alter gems
        if "text" in gem:
            res[gem["text"]] = gem
        # is normal gems
        else:
            res[gem["type"]] = gem

    logger.info(f"Processed {len(res)} gems")
    save_json(res, GEMS_SAVE_PATH)
    logger.info(f"Saved processed gems data to {GEMS_SAVE_PATH}")


def process_tw_gems():
    logger.info("Starting TW gems processing...")
    gems = load_json(GEMS_PATH)
    tw_gems = load_json(TW_GEMS_PATH)
    logger.info(f"Loaded gems data with {len(gems['result'][5]['entries'])} entries")
    logger.info(
        f"Loaded TW gems data with {len(tw_gems['result'][5]['entries'])} entries"
    )

    res = {}

    # TW_GEMS_PATH Line 13989: 手動新增
    # {
    #     "type": "瓦爾．裂地之擊",
    #     "text": "瓦爾．裂地之擊 (裂地之擊．地震)",
    #     "disc": "alt_x"
    # },

    for i in range(len(gems["result"][5]["entries"])):
        gem = gems["result"][5]["entries"][i]
        tw_gem = tw_gems["result"][5]["entries"][i]

        logger.debug(
            f"Processing gem {i + 1}/{len(gems['result'][5]['entries'])}: {gem.get('type', gem.get('text', 'Unknown'))}"
        )

        # is alter gems
        if "text" in gem:
            res[gem["text"]] = tw_gem
        # is normal gems
        else:
            res[gem["type"]] = tw_gem

    logger.info(f"Processed {len(res)} TW gems")
    save_json(res, TW_GEMS_SAVE_PATH)
    logger.info(f"Saved processed TW gems data to {TW_GEMS_SAVE_PATH}")


if __name__ == "__main__":
    process_tw_gems()
