import { LocalDataLoader, OnlineDataLoader } from "./modules/dataloader.js";
import { get_status, set_status } from "./modules/storage_utils.js";

const API_URLS_FILTER = {
    urls: ["https://poe.ninja/api/data/*/getcharacter?*", "https://poe2.ninja/api/builds/*/character?*"]
};


/**
 * init key value if needed
 * @returns {None}
 */
async function init_status() {
    for (const slot of ["redirect-to", "lang", "mods-file-mode", "debug"]) {
        const val = await get_status(slot);
        if (val === undefined || val === null) {
            if (slot === "redirect-to") await set_status(slot, "com");
            else if (slot === "lang") await set_status(slot, "en");
            else if (slot === "mods-file-mode") await set_status(slot, "build-in");
            else if (slot === "debug") await set_status(slot, "off");
        }
    }
};

/**
 * 使用 fecth 方法取得該網頁的資料
 * @param {string} target_url 目標網頁，在此應為 poe.ninja 網頁網址
 * @returns {string} @param target_url 轉換為 JSON 的結果
 */
async function fetch_url(target_url) {
    let res;

    await fetch(target_url).then(
        function (response) {
            if (response.status === 200)
                return response.json();
            else
                throw new Error("Request failed: " + response.status);
        }
    ).then(function (data) {
        // console.log(_data);
        res = data;
        console.log(res);
    }).catch(function (error) {
        console.error(error);
    });

    return res;
};

/**
 * 利用取得的角色資訊，內含本專案所需之裝備資料
 * @param {any} details 詳見 google extension webRequest api
 * @return {None}
 */
async function fetch_character_data(details) {
    if (details.tabId === -1) return;

    const api_url = details.url;
    const equipment_data = await fetch_url(api_url);

    const local_loader = new LocalDataLoader();
    const online_loader = new OnlineDataLoader();
    if (await get_status("mods-file-mode") === "online") {
        console.log("Using online data.");
        await online_loader.update_data();
    } else {
        console.log("Using local data.");
    }
    await local_loader.update_data();

    const query_data = await local_loader.get_data("local_query_data");
    const gems_query_data = await local_loader.get_data("local_gems_query_data");

    if (await get_status("mods-file-mode") === "online") {
        try {
            chrome.scripting.executeScript({
                target: { tabId: details.tabId },
                function: inject_script,
                args: [
                    await online_loader.get_data("online_stats_data"),
                    await online_loader.get_data("online_gems_data"),
                    await online_loader.get_data("online_tw_gems_data"),
                    query_data,
                    gems_query_data,
                    equipment_data
                ],
            });
        } catch (e) {
            console.warn(e);
            chrome.scripting.executeScript({
                target: { tabId: details.tabId },
                function: inject_script,
                args: [
                    await local_loader.get_data("local_stats_data"),
                    await local_loader.get_data("local_gems_data"),
                    await local_loader.get_data("local_tw_gems_data"),
                    query_data,
                    gems_query_data,
                    equipment_data
                ],
            });
        }
    } else {
        chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            function: inject_script,
            args: [
                await local_loader.get_data("local_stats_data"),
                await local_loader.get_data("local_gems_data"),
                await local_loader.get_data("local_tw_gems_data"),
                query_data,
                gems_query_data,
                equipment_data
            ],
        });
    }
}

/**
 * 要 inject 進目前 tab 的 script，功能：加入按鈕，轉換物品 mod 到 stats id
 * @param {Object} stats_data 整理過的詞墜表，提升查找效率與準確率
 * @param {Object} gems_data 整理過的寶石詞墜表，提升查找效率與準確率
 * @param {Object} tw_gems_data 整理過的台服寶石詞墜表，提升查找效率與準確率
 * @param {Object} query_data poe trade 的 query 格式，詳見 POE 官網及 query_example.json 示範
 * @param {Object} gems_query_data poe trade 的 query 格式，詳見 POE 官網及 query_example.json 示範
 * @param {Object} equipment_data 抓取到的角色裝備資料，內容來源為 poe.ninja，但格式是 POE 官方定義的
 * @return {None}
 */
async function inject_script(stats_data, gems_data, tw_gems_data, query_data, gems_query_data, equipment_data) {
    function dbg_log(msg) { if (is_debugging) console.log(msg); }
    function dbg_warn(msg) { if (is_debugging) console.warn(msg); }

    const is_debugging = (await chrome.storage.local.get(["debug"]))["debug"] === "on";
    const redirect_to = (await chrome.storage.local.get(["redirect-to"]))["redirect-to"];
    const now_lang = (await chrome.storage.local.get(["lang"]))["lang"];
    const now_lang_for_lang_matching = now_lang.replace("en-", "");

    dbg_log("[Status] 'PoE Ninja Redirect to Trade' start!")
    dbg_log("[Status] stats_data = ");
    dbg_log(stats_data);
    dbg_log("[Status] gems_data = ");
    dbg_log(gems_data);
    dbg_log("[Status] tw_gems_data = ");
    dbg_log(tw_gems_data);
    dbg_log("[Status] query_data = ");
    dbg_log(query_data);
    dbg_log("[Status] gems_query_data = ");
    dbg_log(gems_query_data);

    const POE_TRADE_URL = `https://www.pathofexile.${redirect_to}/trade/search`;
    const BALANCE_ICON = `<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
    <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
    <g id="SVGRepo_iconCarrier">
        <path fill-rule="evenodd" clip-rule="evenodd"
            d="M16 3.93a.75.75 0 0 1 1.177-.617l4.432 3.069a.75.75 0 0 1 0 1.233l-4.432 3.069A.75.75 0 0 1 16 10.067V8H4a1 1 0 0 1 0-2h12V3.93zm-9.177 9.383A.75.75 0 0 1 8 13.93V16h12a1 1 0 1 1 0 2H8v2.067a.75.75 0 0 1-1.177.617l-4.432-3.069a.75.75 0 0 1 0-1.233l4.432-3.069z"
            fill="#ffffff"></path>
    </g>`;

    let lang_matching = {};

    /**
     * 從 STATS_DATA_PATH 尋找 mod_string 對應的 stats id。
     * @param {string} mod_string 要查詢的詞墜（預先處理過），格式是預先處理過的詞墜，用來直接比對查詢 stats id
     * @return {object} 查詢到的 stats res。如果沒有查詢到的話，則為 null
     */
    function find_mod_id(mod_string) {
        let last_two_char = mod_string.trim().split(" ");
        // replace regex 和 ./scripts/transform_apt_stats.py sort_matcher_structure() 的 k.sub() 一致
        if (last_two_char.length >= 2) last_two_char = last_two_char[last_two_char.length - 2].replace(/(([\+-]?[\d\.]+%?)|(#%)|(#))/, "") + last_two_char[last_two_char.length - 1].replace(/(([\+-]?[\d\.]+%?)|(#%)|(#))/, "");
        else last_two_char = last_two_char[last_two_char.length - 1].replace(/(([\+-]?[\d\.]+%?)|(#%)|(#))/, "");

        const matchers = stats_data[last_two_char.toLowerCase()];

        if (!matchers) return null;

        for (const matcher of matchers) {
            const match_string = matcher["matcher"];
            const match_regex = RegExp(match_string, "g");

            if (match_regex.test(mod_string)) {
                if (!matcher["res"][now_lang_for_lang_matching]) {
                    return matcher["res"];
                }

                const lang_mod_string = mod_string.replace(match_regex, RegExp(matcher["res"][now_lang_for_lang_matching])).replaceAll("/", "").replaceAll("\\n", "\n");

                // 珠寶換行的詞綴在 tippy 中是用空格分開，ex: "Added Small Passive Skills grant: 12% increased Trap Damage Added Small Passive Skills grant: 12% increased Mine Damage"
                if (mod_string.indexOf("\n") !== -1) lang_matching[mod_string.replace("\n", " ")] = lang_mod_string;
                lang_matching[mod_string] = lang_mod_string;

                return matcher["res"];
            }
        }

        return null;
    };

    /**
     * 生成該物品在 poe trade 的 query json string
     * @param {string} item_type Literal["items", "flasks", "jewels"]
     * @param {int} item_index 要從 equipment_data[item_type] 中的哪一個 idx 抓該物品的資料
     * @returns {string} 生成的 query json string
     */
    function gen_item_target_query_str(item_type, item_index) {
        const target_query = JSON.parse(JSON.stringify(query_data));
        const equipment = equipment_data[item_type][item_index];
        const mod_type_names = ["enchantMods", "implicitMods", "fracturedMods", "explicitMods", "craftedMods"];

        for (const type_name of mod_type_names) {
            const item_mods = equipment.itemData[type_name];
            const item_inventoryId = equipment.itemData["inventoryId"];
            // const item_typeLine = equipment.itemData["typeLine"];

            if (item_mods.length === 0) continue;

            for (const mod of item_mods) {
                try {
                    var res = find_mod_id(mod);
                } catch (e) {
                    dbg_warn(e);
                    dbg_add_msg_to_page_top(e);
                }

                if (!res) {
                    dbg_warn("[MOD NOT FOUND] mod_type=" + type_name + ", mod_string='" + mod + "'");
                    dbg_add_msg_to_page_top("[MOD NOT FOUND] mod_type=" + type_name + ", item_inventoryId=" + item_inventoryId + ", origin mod='" + mod + "'");
                    continue;
                }
                const mod_ids = res[type_name];
                const value = res["value"];

                if (!mod_ids) {
                    dbg_warn(item_inventoryId);
                    dbg_warn(item_mods);
                    dbg_warn("[MOD NOT FOUND] mod_type=" + type_name + ", mod_string='" + mod + "'");

                    dbg_add_msg_to_page_top("[MOD NOT FOUND] mod_type=" + type_name + ", item_inventoryId=" + item_inventoryId + ", origin mod='" + mod + "'");
                    continue;
                }

                // duplicate mods
                if (mod_ids.length > 1) {
                    const filters = [];
                    for (const mod_id of mod_ids) {
                        if (!value) filters.push({ "id": mod_id });
                        else filters.push({ "id": mod_id, "value": { "min": value } });
                    }

                    target_query.query.stats.push({
                        "type": "count",
                        "filters": filters,
                        "value": {
                            "min": 1
                        }
                    });
                    // console.info("\n[DUPLICATE] id=" + mod_ids + ", option=" + mod_option + ", mod_string='" + fixed_mod + "', duplicate_list:" + JSON.stringify(duplicate_stats_data[fixed_mod]));
                }
                // no duplicate mods
                else {
                    if (value && value === 100) target_query.query.stats[0].filters.push({ "id": mod_ids[0], "value": { "min": value } });
                    else if (value) target_query.query.stats[0].filters.push({ "id": mod_ids[0], "option": value });
                    else target_query.query.stats[0].filters.push({ "id": mod_ids[0] });
                }
                dbg_log("[SUCCESS] id=" + mod_ids[0] + ", value=" + value + ", mod_string='" + mod + "'");
            }
        }

        return JSON.stringify(target_query);
    };

    /**
     * 生成該寶石在 poe trade 的 query json string
     * @param {string} name 寶石名稱
     * @param {int} level 該寶石的等級
     * @param {int} quality 該寶石的品質
     * @param {string} server_type com: www.pathofexile.com, tw: www.pathofexile.tw
     * @returns {string} 生成的 query json string
     */
    function gen_skills_target_query_str(name, level, quality, server_type) {
        const target_query = JSON.parse(JSON.stringify(gems_query_data));
        const gems_info = server_type === "com" ? gems_data[name] : tw_gems_data[name];

        if (!gems_info) return;

        // alter version gems
        if (gems_info["disc"]) {
            target_query.query.type.option = gems_info["type"];
            target_query.query.type.discriminator = gems_info["disc"];
        }
        // normal gems
        else {
            target_query.query.type = gems_info["type"];
        }

        target_query.query.filters.misc_filters.filters.gem_level.min = level;
        target_query.query.filters.misc_filters.filters.quality.min = quality;

        return JSON.stringify(target_query);
    }

    /**
     * 生成重導向按鈕
     * @param {string} target_query 按下按鈕後會前往的網址
     * @param {string} btn_position Literal["top", "bottom"] 按鈕放在上方或下方
     * @returns {HTMLButtonElement} 重導向至 target_url 的按鈕
     */
    function gen_btn_trade_element(target_query, btn_position) {
        const new_node = document.createElement("button");
        const text_node = document.createTextNode("Trade");
        const balance_icon_node = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        balance_icon_node.setAttribute("viewBox", "0 0 24 24");
        balance_icon_node.setAttribute("fill", "currentColor");
        balance_icon_node.setAttribute("width", "1em");
        balance_icon_node.setAttribute("height", "1em");
        balance_icon_node.innerHTML = BALANCE_ICON;

        new_node.setAttribute("class", "button absolute opacity-0 group-hover:opacity-100");
        new_node.setAttribute("title", "Redirect to trade website");
        new_node.setAttribute("role", "button");
        new_node.setAttribute("data-variant", "plain");
        new_node.setAttribute("data-size", "xsmall");
        new_node.setAttribute("onclick", `window.open('${POE_TRADE_URL}?q=${target_query}', '_blank');`);

        if (btn_position === "top") new_node.setAttribute("style", "position: absolute; top: 0px; right: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");
        else if (btn_position === "bottom") new_node.setAttribute("style", "position: absolute; bottom: -15px; left: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");
        else if (btn_position === "skills") new_node.setAttribute("style", "opacity: 1; position: relative; background-color: hsla(var(--emerald-800),var(--opacity-100));");
        // new_node.setAttribute("style", "opacity: 0; position: absolute; bottom: -15px; right: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");

        new_node.appendChild(balance_icon_node);
        new_node.appendChild(text_node);

        return new_node;
    };

    /**
     * 生成排版用的 span
     * @returns {HTMLSpanElement}
     */
    function gen_btn_span_element() {
        const new_node = document.createElement("span");
        new_node.setAttribute("style", "padding: 3px;");

        return new_node;
    }

    /**
     * 將 物品,藥劑,珠寶 的重導向按鈕加入頁面
     * @returns {None}
     */
    async function add_btn_items() {
        // var items = document.body.getElementsByClassName("_item-hover_8bh10_26");
        const buttons = document.body.querySelectorAll("div.content.p-6:nth-child(2) button[title~=Copy]");
        console.log(buttons);

        let offset = 0;

        // items buttons
        for (let i = 0; i < equipment_data["items"].length; i++) {
            let slot_num = equipment_data["items"][i]["itemSlot"];

            var target_query = gen_item_target_query_str("items", i);
            if ([1, 2, 3, 5, 6, 7, 10].includes(slot_num)) var new_node = gen_btn_trade_element(target_query, "top");
            else var new_node = gen_btn_trade_element(target_query, "bottom");

            buttons[i].insertAdjacentElement("afterend", new_node);
        }

        offset += equipment_data["items"].length;

        // flasks buttons
        for (let i = 0; i < equipment_data["flasks"].length; i++) {
            var target_query = gen_item_target_query_str("flasks", i);
            var new_node = gen_btn_trade_element(target_query, "bottom");

            buttons[offset + equipment_data["flasks"][i]["itemData"]["x"]].insertAdjacentElement("afterend", new_node);
        }

        offset += equipment_data["flasks"].length;

        // jewels buttons
        let jewels_names = [];
        let jewels_nodes = document.body.querySelectorAll("div.content.p-6:nth-child(2) > div:nth-child(2) > div > div > div > div > div > div:nth-child(2)");
        for (let node of jewels_nodes) {
            const jewel_name = node.innerText.trim();
            jewels_names.push(jewel_name);
        }
        dbg_log(jewels_names);

        for (let i = 0; i < equipment_data["jewels"].length; i++) {
            const jewel_name = equipment_data["jewels"][i]["itemData"]["name"] + " " + equipment_data["jewels"][i]["itemData"]["baseType"];

            var target_query = gen_item_target_query_str("jewels", i);
            var new_node = gen_btn_trade_element(target_query, "bottom");

            buttons[offset + jewels_names.indexOf(jewel_name)].insertAdjacentElement("afterend", new_node);

            jewels_names[jewels_names.indexOf(jewel_name)] = ""; 
        }
    };

    /**
     * 將 技能寶石 的重導向按鈕加入頁面
     * @returns {None}
     */
    async function add_btn_skills() {
        const btns = document.body.querySelectorAll("article._item-border_17v42_1 div[style='flex: 1 1 auto;']");

        let btns_count = 0;
        for (const skill_section of equipment_data["skills"]) {
            for (const gem of skill_section["allGems"]) {
                const target_query = gen_skills_target_query_str(gem.name, gem.level, gem.quality, redirect_to);
                const btn = gen_btn_trade_element(target_query, "skills");
                const btn_span = gen_btn_span_element();
        
                btns[btns_count].prepend(btn_span);
                btns[btns_count].prepend(btn);
                btns_count += 1;
            }
        }
    };

    /**
     * 將 msg 直接 push_front 到頁面最上方
     * @param {string} msg 要加在頁面最上方的 msg
     * @returns {None}
     */
    function dbg_add_msg_to_page_top(msg) {
        if (!is_debugging) return;

        const new_node = document.createElement("p");
        new_node.setAttribute("style", "width: max-content; max-width: none;");
        new_node.innerHTML = msg;

        document.querySelectorAll("header#header")[0].prepend(new_node);
    };

    /**
     * 英文詞墜翻成中文詞墜
     * @param {string} mod_string 要翻譯的英文詞墜
     * @returns {string} 翻譯成中文的詞墜
     */
    function translate_mod(mod_string) {
        dbg_log(`[Tippy Item] mod_string = "${mod_string}", lang_matching[mod_string] = "${lang_matching[mod_string]}"`);
        if (lang_matching[mod_string]) return lang_matching[mod_string];
        else return mod_string;
    }

    dbg_log(equipment_data);

    dbg_add_msg_to_page_top("[DEBUGGING]");

    // 將所有物品的重導向按鈕加入頁面
    try {
        await add_btn_items();
        await add_btn_skills();
    } catch (e) {
        dbg_warn(e);
    }

    dbg_log(lang_matching);

    // [Tippy Observers]
    const tippy_mods_record_callbacks = new Map();
    const tippy_mods_record = new Proxy({}, {
        set(target, key, value, receiver) {
            dbg_log(`[TIPPY MODS RECORD] key = ${key}, value = ${value}`);
            target[key] = value;

            // 如果有人在等這個 key，就觸發 callback
            if (tippy_mods_record_callbacks.has(key)) {
                const callbacks = tippy_mods_record_callbacks.get(key);
                callbacks();
                tippy_mods_record_callbacks.delete(key);
            }
        }
    });
    const translated_tippy_id = new Set();

    function translate_node(node) {
        const tippy_id = node.id;
        if (translated_tippy_id.has(tippy_id)) return;

        const section = node.querySelectorAll("div._item-body_1tb3h_1 section");
        if (section.length < 5) return;  // 此 Node 不是裝備的 tippy

        const enchant = section[2]?.querySelectorAll("div div")[0];
        const enchant_all = enchant?.querySelectorAll("div") || [];
        const implicit = section[3]?.querySelectorAll("div#implicit")[0];
        const implicit_all = section[3]?.querySelectorAll("div > div") || [];
        const explicit = section[4]?.querySelectorAll("div#explicit")[0];
        const explicit_all = section[4]?.querySelectorAll("div > div") || [];

        let mod_text = "";
        for (const mod_type of [enchant, implicit, explicit]) {
            if (mod_type !== undefined) mod_text += mod_type["textContent"];
        }
        tippy_mods_record[tippy_id] = mod_text;

        let translated = false;
        if (now_lang === "en") return;
        for (const ele of [...enchant_all, ...implicit_all, ...explicit_all]) {
            translated = true;

            const lang_mod_string = translate_mod(ele.innerText);

            if (["zh-tw", "ko", "ru"].includes(now_lang)) {
                ele.innerText = lang_mod_string;
            }
            else if (["en-zh-tw", "en-ko", "en-ru"].includes(now_lang) && ele.innerText !== lang_mod_string) {
                ele.innerText += "\n" + lang_mod_string;
            }
        }

        if (translated)
            translated_tippy_id.add(tippy_id);
    }

    function waiting_tippy_data(node) {
        dbg_log(node.innerHTML);
        if (node.innerText !== "") {
            dbg_log("tippy data already received, translate now");
            translate_node(node);
            return;
        }

        const content_observer = new MutationObserver((mutationRecords, observer) => {
            // XXX: 現在還是會觀察到兩次這個 node 的變化，不太確定是什麼原因
            // dbg_log(node.innerHTML);
            dbg_log("triggered tippy content observer");
            observer.disconnect();
            queueMicrotask(() => { translate_node(node); });  // 放到下一次的微任務中，確保 observer 已經斷開連線
        });

        content_observer.observe(node, {
            childList: true,
            subtree: true,
        });
    }

    const observer = new MutationObserver(mutationRecords => {
        for (const mutationRecord of mutationRecords) {
            for (const addedNode of mutationRecord["addedNodes"]) {
                waiting_tippy_data(addedNode);
            }
        }
    });
    observer.observe(document.body, {
        childList: true
    });

};

// 初始化所需設定
chrome.runtime.onInstalled.addListener(init_status);

// 當頁面建立或重新整理時，擷取送出的封包以取得能拿到角色資料的 api 網址
chrome.tabs.onUpdated.addListener(chrome.webRequest.onBeforeRequest.addListener(fetch_character_data, API_URLS_FILTER));