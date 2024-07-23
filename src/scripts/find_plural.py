from json_loader import load_json, save_json
import re

words_set = load_json("../static/words_set.json")
words_set = [i.lower() for i in words_set]
words_set = set(words_set)
words_set = sorted(list(words_set))

plural = {}

for word in words_set:
    if word in ["your", "it", "a"]:
        continue

    if re.match(r".*(sh|ch|s|z|x)$", word):
        if word + "es" in words_set:
            print(f"{word} -> {word}es")
            plural[word] = word + "es"
            plural[word + "es"] = word
    elif re.match(r".*[^aeiou]y$", word):
        if word[:-1] + "ies" in words_set:
            print(f"{word} -> {word[:-1]}ies")
            plural[word] = word[:-1] + "ies"
            plural[word[:-1] + "ies"] = word
    elif re.match(r".*o$", word):
        if word + "es" in words_set:
            print(f"{word} -> {word}es")
            plural[word] = word + "es"
            plural[word + "es"] = word
        elif word + "s" in words_set:
            print(f"{word} -> {word}s")
            plural[word] = word + "s"
            plural[word + "s"] = word
    elif re.match(r".*f$", word):
        if word[:-1] + "ves" in words_set:
            print(f"{word} -> {word[:-1]}ves")
            plural[word] = word[:-1] + "ves"
            plural[word[:-1] + "ves"] = word
    else:
        if word + "s" in words_set:
            print(f"{word} -> {word}s")
            plural[word] = word + "s"
            plural[word + "s"] = word

save_json(plural, "../static/plural.json")
