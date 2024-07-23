from json_loader import load_json, save_json
import logging
import re

STATS_PATH = "../static/stats_data_240719.json"
STATS_SAVE_PATH = "../static/preprocessed_stats_data_240719.json"
OPTION_MODS_PATH = "../static/option_stats.json"
DUPLICATE_MODS_PATH = "../static/duplicate_stats.json"

words_set = set()

priority_replace_dict = [
    (r"[\+\-]?#%", "NUM_PERCENT"),
    # (r"\b[\+\-]?#%\b", "NUM_PERCENT"),
    # (r"\b[\+\-]?#%\B", "NUM_PERCENT"),
    # (r"\B[\+\-]?#%\b", "NUM_PERCENT"),
    (r"[\+\-]?#", "NUM"),
    # (r"\b[\+\-]?#\b", "NUM"),
    # (r"\b[\+\-]?#\B", "NUM"),
    # (r"\B[\+\-]?#\b", "NUM"),
    # (r"\b#%\b", "NUM_PERCENT"),
    # (r"\b#%\B", "NUM_PERCENT"),
    # (r"\B#%\b", "NUM_PERCENT"),
    # (r"\B#%\B", "NUM_PERCENT"),
    # (r"\b#\b", "NUM"),
    # (r"\b#\B", "NUM"),
    # (r"\B#\b", "NUM"),
    # (r"\B#\B", "NUM"),
    (r"[\+\-]?[\d\.]+%", "NUM_PERCENT"),
    # (r"\b[\+\-]?[\d\.]+%\b", "NUM_PERCENT"),
    # (r"\b[\+\-]?[\d\.]+%\B", "NUM_PERCENT"),
    # (r"\B[\+\-]?[\d\.]+%\b", "NUM_PERCENT"),
    (r"[\+\-]?[\d\.]+", "NUM"),
    # (r"\b[\+\-]?[\d\.]+\B", "NUM"),
    # (r"\B[\+\-]?[\d\.]+\b", "NUM"),
    # (r"\B[\+\-]?[\d\.]+\B", "NUM"),
]

replace_dict_lower_b = [
    # increase, decrease
    ("increased", "INC&RED"),
    ("reduced", "INC&RED"),
    # more, less
    ("more", "MORE&LESS"),
    ("less", "MORE&LESS"),
    # gain, loss
    ("gain", "GAIN&LOSS"),
    ("loss", "GAIN&LOSS"),
    # charge, charges
    ("charges", "CHARGE"),
    ("charge", "CHARGE"),
    # flask, flasks
    ("flasks", "FLASK"),
    ("flask", "FLASK"),
    # hit, hits
    ("hits", "HIT"),
    ("hit", "HIT"),
    # second, seconds
    ("seconds", "SECOND"),
    ("second", "SECOND"),
    # add, adds
    ("adds", "ADD"),
    ("add", "ADD"),
    # modifier, modifiers
    ("modifiers", "MODIFIER"),
    ("modifier", "MODIFIER"),
    # curse, curses
    ("curses", "CURSE"),
    ("curse", "CURSE"),
    # debuff, debuffs
    ("debuffs", "DEBUFF"),
    ("debuff", "DEBUFF"),
    # word, words
    ("words", "WORD"),
    ("word", "WORD"),
    # apply, applies
    ("applies", "APPLY"),
    ("apply", "APPLY"),
    # effect, effects
    ("effects", "EFFECT"),
    ("effect", "EFFECT"),
    # its, their
    ("its", "ITS&THEIR"),
    ("their", "ITS&THEIR"),
    # sockets, socket
    ("sockets", "SOCKET"),
    ("socket", "SOCKET"),
    # metres, metre
    ("metres", "METRE"),
    ("metre", "METRE"),
    # a, an
    ("an", "NUM"),
    ("a", "NUM"),
    # arrow, arrows
    ("arrows", "ARROW"),
    ("arrow", "ARROW"),
    # projectiles, projectile
    ("projectiles", "PROJECTILE"),
    ("projectile", "PROJECTILE"),
    # enemies, enemy
    ("enemies", "ENEMY"),
    ("enemy", "ENEMY"),
    # # is a, are
    # ("is a", "ISA&ARE"),
    # ("are", "ISA&ARE"),
    # # skills, skill
    # ("skills", "SKILL"),
    # ("skill", "SKILL"),
]


def transform_mod(mod: str) -> str:
    mod = mod.lower()

    for replace in priority_replace_dict:
        regex_str = replace[0]
        mod = re.sub(regex_str, replace[1], mod)

    for replace in replace_dict_lower_b:
        regex_str = r"\b" + replace[0] + r"\b"
        mod = re.sub(regex_str, replace[1], mod)

    return mod


def transform_stats(stats: dict) -> dict:
    """Process stats data. Replace some parts of the data with uniform token."""

    stats_alias = stats["result"]
    for mod_types in stats_alias:
        for mod in mod_types["entries"]:

            logging.debug(f"Original text: {mod['text']}")
            ## extract words
            for i in mod["text"].split():
                words_set.add(i)

            # print(words_set)
            ##
            mod["text"] = transform_mod(mod["text"])


def transform_structure(stats: dict) -> tuple[dict, list]:
    """Transform stats structure data."""

    res = {}
    options_regex = []

    stats_alias = stats["result"]
    for mod_type in stats_alias:
        # e.g. "explicitMods"
        mod_type_name = mod_type["id"] + "Mods"

        tmp = {}
        for mod in mod_type["entries"]:

            # print out timeless jewel mods in javascript object format
            if "pseudo_timeless_jewel" in mod["id"]:
                print(
                    r"{ regex: /"
                    + mod["text"]
                    + r'\n.+/, replace: "'
                    + mod["text"]
                    + r'" },'
                )

            # if mod has "option"
            if "option" in mod:
                options_regex.append(mod["text"].replace("NUM", r"(.+)"))

                tmp[mod["text"]] = {"id": mod["id"]}
                tmp[mod["text"]]["options"] = {}
                for option in mod["option"]["options"]:
                    # pre-process option text
                    option["text"] = transform_mod(option["text"])

                    tmp[mod["text"]]["options"][option["text"]] = option["id"]
            else:
                tmp[mod["text"]] = mod["id"]
                if re.match(r"^NUM_PERCENT chance to ", mod["text"]):
                    new_mod = re.sub(r"^NUM_PERCENT chance to ", "", mod["text"])
                    if new_mod not in tmp:
                        tmp[new_mod] = mod["id"]
                    else:
                        print(f"Duplicate mod: {new_mod}")

        res[mod_type_name] = tmp

    return res, options_regex


def gen_duplicate_mods(stats: dict) -> dict:
    """Generate duplicate mods data."""

    res = {}

    stats_alias = stats["result"]

    tmp = dict()
    # idx 1: "explicit"
    for mod in stats_alias[1]["entries"]:
        mod_text = mod["text"].lower()
        if mod_text in tmp and mod_text not in res:
            res[mod_text] = [tmp[mod_text], mod["id"]]
            print(res[mod_text])
        elif mod_text in tmp:
            res[mod_text].append(mod["id"])

        tmp[mod_text] = mod["id"]

    return res


def gen_structured_stats():
    # logging.basicConfig(level=logging.DEBUG)

    stats = load_json(STATS_PATH)

    transform_stats(stats)
    stats, options_regex = transform_structure(stats)
    save_json(stats, STATS_SAVE_PATH)

    save_json(sorted(list(words_set)), "words_set.json")

    save_json(options_regex, OPTION_MODS_PATH)


def gen_duplicate_stats():
    origin = load_json(STATS_PATH)
    # transform_stats(origin)
    duplicate_mods = gen_duplicate_mods(origin)
    processed_duplicate_mods = {"all_mods": []}

    for key, value in duplicate_mods.items():
        new_key = transform_mod(key)
        processed_duplicate_mods[new_key] = [{"id": ele} for ele in value]
        processed_duplicate_mods["all_mods"].extend(value)

    save_json(processed_duplicate_mods, DUPLICATE_MODS_PATH)


if __name__ == "__main__":
    gen_structured_stats()
    gen_duplicate_stats()
