from json_loader import load_json, save_json


GEMS_PATH = "../data/archive/gems_data_240723.json"
GEMS_SAVE_PATH = "../data/preprocessed_gems_data.json"
TW_GEMS_PATH = "../data/tw_gems_data.json"
TW_GEMS_SAVE_PATH = "../data/tw_preprocessed_gems_data.json"


def process_gems():
    gems = load_json(GEMS_PATH)

    res = {}

    for gem in gems["result"][5]["entries"]:
        # is alter gems
        if "text" in gem:
            res[gem["text"]] = gem
        # is normal gems
        else:
            res[gem["type"]] = gem

    save_json(res, GEMS_SAVE_PATH)


def process_tw_gems():
    gems = load_json(GEMS_PATH)
    tw_gems = load_json(TW_GEMS_PATH)

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

        print(gem)
        print(tw_gem)
        print()

        # is alter gems
        if "text" in gem:
            res[gem["text"]] = tw_gem
        # is normal gems
        else:
            res[gem["type"]] = tw_gem

    save_json(res, TW_GEMS_SAVE_PATH)


if __name__ == "__main__":
    process_tw_gems()
