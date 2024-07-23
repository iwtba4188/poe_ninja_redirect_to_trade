from json_loader import load_json, save_json


GEMS_PATH = "../static/gems_data_240723.json"
GEMS_SAVE_PATH = "../static/preprocessed_gems_data_240723.json"


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


if __name__ == "__main__":
    process_gems()
