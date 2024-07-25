from json_loader import save_json
import json
import re


not_in_zh_tw = [
    "#% of Chaos Damage Leeched by Enemy as Life",
    "#% of Physical Damage Leeched by Enemy as Life",
    "Cannot Fish while standing in Water",
    "Effect is removed when Hit by a Player",
    "Lose #% of Energy Shield per second",
    "Lose #% of Life per second",
    "Socketed Gems are Supported by Level # Awakened Added Chaos Damage",
    "Socketed Gems are Supported by Level # Awakened Added Lightning Damage",
    "Socketed Gems are Supported by Level # Awakened Blasphemy",
    "Socketed Gems are Supported by Level # Awakened Chain",
    "Socketed Gems are Supported by Level # Awakened Deadly Ailments",
    "Socketed Gems are Supported by Level # Awakened Enhance",
    "Socketed Gems are Supported by Level # Awakened Fire Penetration",
    "Socketed Gems are Supported by Level # Awakened Fork",
    "Socketed Gems are Supported by Level # Awakened Generosity",
    "Socketed Gems are Supported by Level # Awakened Spell Cascade",
    "Socketed Gems are Supported by Level # Awakened Void Manipulation",
    "Socketed Gems are Supported by Level # Item Quantity",
]


def calculate_apt_stats() -> None:
    with open("../data/awakened poe trade/en_stats.ndjson", "r", encoding="utf-8") as f:
        en_original_data = f.read()
    with open(
        "../data/awakened poe trade/zh-tw_stats.ndjson", "r", encoding="utf-8"
    ) as f:
        tw_original_data = f.read()

    en_original_data_list = en_original_data.split("\n")[:-1]
    tw_original_data_list = tw_original_data.split("\n")[:-1]

    en_table = {}
    for i in en_original_data_list:
        en_load = json.loads(i)
        en_table[en_load["ref"]] = en_load

    tw_table = {}
    for i in tw_original_data_list:
        tw_load = json.loads(i)
        tw_table[tw_load["ref"]] = tw_load

    processed_stats = 0
    not_processed_stats = 0
    processed_matchers = [0, 0]  # [en, tw]
    not_processed_matchers = [0, 0]  # [en, tw]

    for i in range(len(en_original_data_list)):
        en_load = json.loads(en_original_data_list[i])
        if en_load["ref"] in tw_table:
            if len(en_load["matchers"]) != len(tw_table[en_load["ref"]]["matchers"]):
                # print(f'en[{len(en_load["matchers"])}]: {en_load["matchers"]}')
                # print(
                #     f'tw[{len(tw_table[en_load["ref"]]["matchers"])}]: {tw_table[en_load["ref"]]["matchers"]}'
                # )
                # print()
                not_processed_matchers[0] += len(en_load["matchers"])
                not_processed_matchers[1] += len(tw_table[en_load["ref"]]["matchers"])
                not_processed_stats += 1
            else:
                processed_matchers[0] += len(en_load["matchers"])
                processed_matchers[1] += len(tw_table[en_load["ref"]]["matchers"])
                processed_stats += 1

                # idx = 0
                # while idx < len(en_load["matchers"]):
                #     if en_load["matchers"][idx]["string"].count("#") != tw_table[
                #         en_load["ref"]
                #     ]["matchers"][idx]["string"].count("#"):
                #         print(f'en: {en_load["matchers"][idx]["string"]}')
                #         print(
                #             f'tw: {tw_table[en_load["ref"]]["matchers"][idx]["string"]}'
                #         )
                #         print()

                #     idx += 1

    print(f"共處理了 {processed_stats} 個詞墜類型, {not_processed_stats} 未處理")
    print(
        f"英文詞墜共處理了 {processed_matchers[0]} 個配對, {not_processed_matchers[0]} 未處理"
    )
    print(
        f"中文詞墜共處理了 {processed_matchers[1]} 個配對, {not_processed_matchers[1]} 未處理"
    )
    return


def tw_make_string_matching_table() -> dict:
    with open(
        "../data/awakened poe trade/zh-tw_stats.ndjson", "r", encoding="utf-8"
    ) as f:
        tw_original_data = f.read()

    tw_original_data_list = tw_original_data.split("\n")[:-1]

    tw_table = {}
    for i in tw_original_data_list:
        tw_load = json.loads(i)
        for matcher in tw_load["matchers"]:
            if (
                tw_load.get("ref"),
                matcher.get("value"),
                matcher.get("negate"),
                matcher["string"].count("#"),
            ) not in tw_table:
                res_str = matcher["string"]

                res_str = res_str.replace("#%", "$<percent>")
                for idx in range(0, 5):
                    res_str = res_str.replace("#", f"$<num{idx}>", 1)

                tw_table[
                    (
                        tw_load.get("ref"),
                        matcher.get("value"),
                        matcher.get("negate"),
                        matcher["string"].count("#"),
                    )
                ] = res_str

    return tw_table


def en_make_matcher_structure() -> dict:
    with open("../data/awakened poe trade/en_stats.ndjson", "r", encoding="utf-8") as f:
        en_original_data = f.read()

    en_original_data_list = en_original_data.split("\n")[:-1]

    tw_table = tw_make_string_matching_table()

    count = 0
    en_table = {}

    matcher_count = 0
    for i in en_original_data_list:
        en_load = json.loads(i)

        for matcher in en_load["matchers"]:
            matcher_count += 1
            en_table[matcher["string"]] = {
                "value": matcher.get("value"),
                "zh-tw": tw_table.get(
                    (
                        en_load.get("ref"),
                        matcher.get("value"),
                        matcher.get("negate"),
                        matcher["string"].count("#"),
                    )
                ),
                "explicitMods": en_load["trade"]["ids"].get("explicit"),
                "implicitMods": en_load["trade"]["ids"].get("implicit"),
                "fracturedMods": en_load["trade"]["ids"].get("fractured"),
                "enchantMods": en_load["trade"]["ids"].get("enchant"),
                "craftedMods": en_load["trade"]["ids"].get("crafted"),
                "pseudoMods": en_load["trade"]["ids"].get("pseudo"),
            }
            if en_table[matcher["string"]]["zh-tw"] != None:
                count += 1
                # if matcher["string"].count("#") != en_table[matcher["string"]][
                #     "zh-tw"
                # ].count("#"):re
                #     print(f'en: {matcher["string"]}')
                #     print(f'tw: {en_table[matcher["string"]]["zh-tw"]}')
                #     print()

                if matcher["string"].count("#%") >= 3:
                    pass

    # save_json(en_table, "../data/awakened poe trade/en_stats.json")

    return en_table


def sort_matcher_structure():
    en_table = {}

    en_matcher_structure = en_make_matcher_structure()
    for key, value in en_matcher_structure.items():
        kl = key.split(" ")
        if len(kl) >= 2:
            k = re.sub(r"(([\+-]?[\d\.]+%?)|(#%)|(#))", "", kl[-2]) + kl[-1]
        else:
            k = kl[-1]
        k = k.lower()

        key = key.replace("#%", "(?<percent>[\+-]?[\d\.]+%)")
        for idx in range(0, 5):
            key = key.replace("#", f"(?<num{idx}>[\+-]?[\d\.]+)", 1)

        key = f"^{key}$"

        if k not in en_table:
            en_table[k] = [{"matcher": key, "res": value}]
        else:
            en_table[k].append({"matcher": key, "res": value})

    en_table["toyou"].append(
        {
            "matcher": "^Projectiles Return to you$",
            "res": {
                "value": None,
                "zh-tw": "攻擊投射物返回你",
                "explicitMods": ["explicit.stat_1658124062"],
                "implicitMods": None,
                "fracturedMods": None,
                "enchantMods": None,
                "craftedMods": ["crafted.stat_1658124062"],
                "pseudoMods": None,
            },
        },
    )

    max_key = ""
    max_len_value = 0
    for key, value in en_table.items():
        en_table[key] = sorted(value, key=lambda x: x["matcher"])
        print(f"key {key} 有 {len(value)} 項")

        if max_len_value < len(value):
            max_key = key
            max_len_value = len(value)
    print(f"{max_key} 數量最多，有 {max_len_value} 項")

    save_json(en_table, "../data/awakened poe trade/en_stats.json")


if __name__ == "__main__":
    pass
    # calculate_apt_stats()
    # en_make_matcher_structure()
    # tw_make_matching_dict()
    sort_matcher_structure()
