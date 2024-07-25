const FILTER = {
    urls: ["https://poe.ninja/api/data/*/getcharacter?*"]
};
const STATS_DATA_PATH = "./data/awakened poe trade/en_stats.json";
const GEMS_DATA_PATH = "./data/preprocessed_gems_data_240723.json";
const QUERY_PATH = "./data/query.json";
const GEMS_QUERY_PATH = "./data/query_gems.json";

var equipment_data = {};
var trigger_tab_id = 0;
var stats_data;
fetch(STATS_DATA_PATH).then((response) => response.json()).then((json) => stats_data = json);
var gems_data;
fetch(GEMS_DATA_PATH).then((response) => response.json()).then((json) => gems_data = json);
var query_data;
fetch(QUERY_PATH).then((response) => response.json()).then((json) => query_data = json);
var gems_query_data;
fetch(GEMS_QUERY_PATH).then((response) => response.json()).then((json) => gems_query_data = json);

/**
 * 使用 fecth 方法取得該網頁的資料
 * @param {string} target_url 目標網頁，在此應為 poe.ninja 網頁網址
 * @returns {string} @param target_url 轉換為 JSON 的結果
 */
async function fetch_url(target_url) {

    var res;

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

    // 去除監聽器避免抓取此函式發出的 request 導致無限循環
    chrome.webRequest.onCompleted.removeListener(fetch_character_data);

    var api_url = details.url;

    equipment_data = await fetch_url(api_url);

    chrome.scripting.executeScript({
        target: { tabId: trigger_tab_id },
        function: inject_script,
        args: [stats_data, gems_data, query_data, gems_query_data, equipment_data],
    });
}

/**
 * 要 inject 進目前 tab 的 script，功能：加入按鈕，轉換物品 mod 到 stats id
 * @param {Object} stats_data 整理過的詞墜表，提升查找效率與準確率
 * @param {Object} gems_data 整理過的寶石詞墜表，提升查找效率與準確率
 * @param {Object} query_data poe trade 的 query 格式，詳見 POE 官網及 query_example.json 示範
 * @param {Object} gems_query_data poe trade 的 query 格式，詳見 POE 官網及 query_example.json 示範
 * @param {Object} equipment_data 抓取到的角色裝備資料，內容來源為 poe.ninja，但格式是 POE 官方定義的
 * @return {None}
 */
async function inject_script(stats_data, gems_data, query_data, gems_query_data, equipment_data) {

    var is_debugging = (await chrome.storage.local.get(["debug"]))["debug"];
    const POE_TRADE_URL = "https://www.pathofexile.com/trade/search";
    const BALANCE_ICON = `<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
    <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
    <g id="SVGRepo_iconCarrier">
        <path fill-rule="evenodd" clip-rule="evenodd"
            d="M16 3.93a.75.75 0 0 1 1.177-.617l4.432 3.069a.75.75 0 0 1 0 1.233l-4.432 3.069A.75.75 0 0 1 16 10.067V8H4a1 1 0 0 1 0-2h12V3.93zm-9.177 9.383A.75.75 0 0 1 8 13.93V16h12a1 1 0 1 1 0 2H8v2.067a.75.75 0 0 1-1.177.617l-4.432-3.069a.75.75 0 0 1 0-1.233l4.432-3.069z"
            fill="#ffffff"></path>
    </g>`;

    var zh_tw_matching = {};

    function dbg_log(msg) { if (is_debugging) console.log(msg); };
    function dbg_warn(msg) { if (is_debugging) console.warn(msg); }

    /**
     * 從 STATS_DATA_PATH 尋找 mod_string 對應的 stats id。
     * @param {string} mod_string 要查詢的詞墜（預先處理過），格式是預先處理過的詞墜，用來直接比對查詢 stats id
     * @return {object} 查詢到的 stats res。如果沒有查詢到的話，則為 null
     */
    function find_mod_id(mod_string) {
        var last_two_char = mod_string.split(" ");
        // replace regex 和 ./scripts/transform_apt_stats.py sort_matcher_structure() 的 k.sub() 一致
        if (last_two_char.length >= 2) last_two_char = last_two_char[last_two_char.length - 2].replace(/(([\+-]?[\d\.]+%?)|(#%)|(#))/, "") + last_two_char[last_two_char.length - 1].replace(/(([\+-]?[\d\.]+%?)|(#%)|(#))/, "");
        else last_two_char = last_two_char[last_two_char.length - 1].replace(/(([\+-]?[\d\.]+%?)|(#%)|(#))/, "");

        var matchers = stats_data[last_two_char.toLowerCase()];

        for (var matcher of matchers) {
            var match_string = matcher["matcher"];
            var match_regex = RegExp(match_string, "g");

            if (match_regex.test(mod_string)) {
                if (matcher["res"]["zh-tw"]) {
                    zh_tw_matching[mod_string] = mod_string.replace(match_regex, RegExp(matcher["res"]["zh-tw"])).replaceAll("/", "").replaceAll("\\n", "\n");
                }
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
                var res = find_mod_id(mod);

                if (!res) {
                    dbg_warn("[MOD NOT FOUND] mod_type=" + type_name + ", mod_string='" + mod + "'");
                    dbg_add_msg_to_page_top("[MOD NOT FOUND] mod_type=" + type_name + ", item_inventoryId=" + item_inventoryId + ", origin mod='" + mod + "'");
                    continue;
                }
                var mod_ids = res[type_name];
                var value = res["value"];

                if (!mod_ids) {
                    dbg_warn(item_inventoryId);
                    dbg_warn(item_mods);
                    dbg_warn("[MOD NOT FOUND] mod_type=" + type_name + ", mod_string='" + mod + "'");

                    dbg_add_msg_to_page_top("[MOD NOT FOUND] mod_type=" + type_name + ", item_inventoryId=" + item_inventoryId + ", origin mod='" + mod + "'");
                    continue;
                }

                // duplicate mods
                if (mod_ids.length > 1) {
                    var filters = [];
                    for (var mod_id of mod_ids) {
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
                    if (value) {
                        if (value === 100) target_query.query.stats[0].filters.push({ "id": mod_ids[0], "value": { "min": value } });
                        else target_query.query.stats[0].filters.push({ "id": mod_ids[0], "option": value });
                    }
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
     * @returns {string} 生成的 query json string
     */
    function gen_skills_target_query_str(name, level, quality) {
        const this_query = JSON.parse(JSON.stringify(gems_query_data));
        var gems_info = gems_data[name];

        if (!gems_info) return;

        // alter version gems
        if (gems_info["disc"]) {
            this_query.query.type.option = gems_info["type"];
            this_query.query.type.discriminator = gems_info["disc"];
        }
        // normal gems
        else {
            this_query.query.type = gems_info["type"];
        }

        this_query.query.filters.misc_filters.filters.gem_level.min = level;
        this_query.query.filters.misc_filters.filters.quality.min = quality;

        return JSON.stringify(this_query);
    }

    /**
     * 生成重導向按鈕
     * @param {string} target_query 按下按鈕後會前往的網址
     * @param {string} btn_position Literal["top", "buttom"] 按鈕放在上方或下方
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

        new_node.setAttribute("class", "button");
        new_node.setAttribute("title", "Redirect to trade website");
        new_node.setAttribute("role", "button");
        new_node.setAttribute("data-variant", "plain");
        new_node.setAttribute("data-size", "xsmall");
        new_node.setAttribute("onclick", `window.open('${POE_TRADE_URL}?q=${target_query}', '_blank');`);

        if (btn_position === "top") new_node.setAttribute("style", "opacity: 0; position: absolute; top: 0px; right: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");
        else if (btn_position === "buttom") new_node.setAttribute("style", "opacity: 0; position: absolute; bottom: -15px; left: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");
        else if (btn_position === "skills") new_node.setAttribute("style", "position: relative; background-color: hsla(var(--emerald-800),var(--opacity-100));");
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
     * 將 物品 的重導向按鈕加入頁面
     * @returns {None}
     */
    async function add_btn_items() {
        // var items = document.body.getElementsByClassName("_item-hover_8bh10_26");
        var buttons = document.body.querySelectorAll("div.content.p-6:nth-child(2) button[title~=Copy]");
        console.log(buttons);

        // buttons
        for (var i = 0; i < equipment_data["items"].length; i++) {
            var slot_num = 0;
            if (i < equipment_data["items"].length) { //items
                slot_num = equipment_data["items"][i]["itemSlot"];
            }

            if (i < equipment_data["items"].length) var target_query = await gen_item_target_query_str("items", i);
            else continue;

            if ([1, 2, 3, 5, 6, 7, 10].includes(slot_num)) var new_node = gen_btn_trade_element(target_query, "top");
            else var new_node = gen_btn_trade_element(target_query, "buttom");

            buttons[i].insertAdjacentElement("afterend", new_node);
        }

    };

    /**
     * 將 藥劑、珠寶 的重導向按鈕加入頁面
     * @param {HTMLButtonElement} target_btn copy pob button，重導向按鈕會加在它後面
     * @param {string} equipment_type 裝備類型： Literal["flasks", "jewels"]
     * @param {string} equipment_mod 物品詞墜
     * @returns {None}
     */
    async function add_btn_flasks_jewels(target_btn, equipment_type, equipment_mod) {
        var target_query = mods_mapping_target_query[equipment_type][equipment_mod];

        var new_node = gen_btn_trade_element(target_query, "buttom");

        if (equipment_type === "flasks") target_btn.appendChild(new_node);
        else target_btn.querySelector("div").appendChild(new_node);
    };

    /**
     * 將 技能寶石 的重導向按鈕加入頁面
     * @returns {None}
     */
    async function add_btn_skills() {
        var btns = document.body.querySelectorAll("article._item-border_17v42_1 div[style='flex: 1 1 auto;']");

        for (var i = 0; i < btns.length; i++) {
            var target_query = mods_mapping_target_query["skills"][i];
            var btn = gen_btn_trade_element(target_query, "skills");
            var btn_span = gen_btn_span_element();

            btns[i].prepend(btn_span);
            btns[i].prepend(btn);
        }
    };

    /**
     * 將物品的 enchant, implicit and explicit mods 直接串在一起，用來當作 mods_mapping_target_query 的 key
     * @param {string} item_type Literal["items", "flasks", "jewels"]
     * @param {int} item_index 物品在該類別的 idx
     * @returns {string} 串聯後的詞墜
     */
    function combine_item_mods(item_type, item_index) {
        var mod = "";
        mod += equipment_data[item_type][item_index]["itemData"]["enchantMods"].join("");
        mod += equipment_data[item_type][item_index]["itemData"]["implicitMods"].join("");
        mod += equipment_data[item_type][item_index]["itemData"]["explicitMods"].join("");

        return mod;
    };

    /**
     * 建立所有物品 mods 和 query string 的 mapping
     * @returns {object} 所有物品的 mods mapping query string
     */
    function gen_all_target_query_mapping() {
        var mapping = { "items": {}, "flasks": {}, "jewels": {}, "skills": [] };
        var item_types = ["items", "flasks", "jewels"];

        // gen item types
        for (var type of item_types) {
            for (var i = 0; i < equipment_data[type].length; i++) {
                var mod = combine_item_mods(type, i);
                var target_query = gen_item_target_query_str(type, i);
                mapping[type][mod] = target_query;
            }
        }

        // gen skills type
        for (var skill_section of equipment_data["skills"]) {
            for (var gem of skill_section["allGems"]) {
                var target_query = gen_skills_target_query_str(gem.name, gem.level, gem.quality);
                mapping["skills"].push(target_query);
            }
        }

        return mapping;
    };

    /**
     * 將 msg 直接 push_front 到頁面最上方
     * @param {string} msg 要加在頁面最上方的 msg
     * @returns {None}
     */
    function dbg_add_msg_to_page_top(msg) {
        if (!is_debugging) return;

        var new_node = document.createElement("p");
        new_node.setAttribute("style", "width: max-content; max-width: none;");
        new_node.innerHTML = msg;

        document.querySelectorAll("header#header")[0].prepend(new_node);
    };

    /**
     * 英文詞墜翻成中文詞墜
     * @param {string} mod_string 要翻譯的英文詞墜
     * @returns {string} 翻譯成中文的詞墜
     */
    function mod_to_zh_tw(mod_string) {
        if (zh_tw_matching[mod_string]) return zh_tw_matching[mod_string];
        else return mod_string;
    }

    dbg_log(equipment_data);

    dbg_add_msg_to_page_top("[DEBUGGING]");

    var mods_mapping_target_query = gen_all_target_query_mapping();
    dbg_log("=============================");
    dbg_log(mods_mapping_target_query);
    dbg_log("=============================");

    var tippy_mods_record = {};
    let observer = new MutationObserver(async mutationRecords => {
        for (var mutationRecord of mutationRecords) {
            var addedNode = mutationRecord["addedNodes"][0];
            // 未新增 Node
            if (addedNode === undefined) continue;

            var tippy_id = addedNode.id;
            // 此 Node 已經紀錄過
            if (tippy_mods_record[tippy_id] !== undefined) continue;

            var section = addedNode.querySelectorAll("div._item-body_1tb3h_1 section");
            // 此 Node 不是裝備的 tippy
            if (section === undefined || section.length < 5) continue;

            var enchant = section[2].querySelectorAll("div div")[0];
            var implicit = section[3].querySelectorAll("div#implicit")[0];
            var implicit_all = section[3].querySelectorAll("div > div");
            var explicit = section[4].querySelectorAll("div#explicit")[0];
            var explicit_all = section[4].querySelectorAll("div > div");

            // 此 Node 不是裝備的 tippy
            if (enchant === undefined && implicit === undefined && explicit === undefined) {
                tippy_mods_record[tippy_id] = undefined;
                continue;
            }

            var mod_text = "";
            for (var mod_type of [enchant, implicit, explicit]) {
                if (mod_type !== undefined) mod_text += mod_type["textContent"];
            }
            tippy_mods_record[tippy_id] = mod_text;

            // 中文化區塊 start
            var is_zh_tw = (await chrome.storage.local.get("zh_tw"))["zh_tw"];
            if (is_zh_tw && enchant) {
                var all_mod_elements = enchant.querySelectorAll("div");
                for (var ele of all_mod_elements) { ele.innerText = mod_to_zh_tw(ele.innerText); }
            }
            if (is_zh_tw && implicit) {
                for (var ele of implicit_all) { ele.innerText = mod_to_zh_tw(ele.innerText); }
            }
            if (is_zh_tw && explicit) {
                for (var ele of explicit_all) { ele.innerText = mod_to_zh_tw(ele.innerText); }
            }
            // 中文化區塊 end
        }
    });
    observer.observe(document.body, {
        childList: true
    });

    var flasks_finished = [];
    let flasks_observer = new MutationObserver(mutationRecords => {
        var target = mutationRecords[0]["target"];
        var tippy_id = mutationRecords[0]["oldValue"];

        if (!tippy_id) return;
        var mod = tippy_mods_record[tippy_id];
        if (!mod) {
            dbg_warn("[TIPPY DATA NOT RECEIVED] tippy_id=" + tippy_id);
        } else if (flasks_finished.includes(tippy_id)) {
            dbg_log("[ALREADY ADDED] flasks with tippy_id=" + tippy_id);
        } else {
            add_btn_flasks_jewels(target, "flasks", mod);

            flasks_finished.push(tippy_id);
            if (flasks_finished.length == equipment_data["flasks"].length) {
                flasks_observer.disconnect();
                console.log("[OBSERVER CLOSED] flasks");
            }

            // 配合詞墜中文化先移除
            // if (flasks_finished.length == equipment_data["flasks"].length && jewels_finished.length == equipment_data["jewels"].length) {
            //     observer.disconnect();
            //     console.log("[OBSERVER CLOSED] all");
            // }
        }
    });
    var flasks_nodes = document.body.querySelectorAll("div._equipment_8bh10_1 div div._item-hover_8bh10_26");
    // observe each flasks slot
    for (var flasks_node of flasks_nodes) {
        flasks_observer.observe(flasks_node, {
            attributes: true,
            attributeOldValue: true
        });
    }

    var jewels_finished = [];
    let jewels_observer = new MutationObserver(mutationRecords => {
        var target = mutationRecords[0]["target"];
        var tippy_id = mutationRecords[0]["oldValue"];

        if (!tippy_id) return;
        var mod = tippy_mods_record[tippy_id];
        if (!mod) {
            dbg_warn("[TIPPY DATA NOT RECEIVED] tippy_id=" + tippy_id);
        } else if (jewels_finished.includes(tippy_id)) {
            dbg_log("[ALREADY ADDED] jewels with tippy_id=" + tippy_id);
        } else {
            add_btn_flasks_jewels(target, "jewels", mod);

            jewels_finished.push(tippy_id);
            if (jewels_finished.length == equipment_data["jewels"].length) {
                jewels_observer.disconnect();
                console.log("[OBSERVER CLOSED] jewels");
            }

            // 配合詞墜中文化先移除
            // if (flasks_finished.length == equipment_data["flasks"].length && jewels_finished.length == equipment_data["jewels"].length) {
            //     observer.disconnect();
            //     console.log("[OBSERVER CLOSED] all");
            // }
        }
    });
    var jewels_nodes = document.body.querySelectorAll("div._layout-cluster_hedo7_1 div.layout-stack div._layout-cluster_hedo7_1 > div");
    // observe each jewels slot
    for (var jewels_node of jewels_nodes) {
        jewels_observer.observe(jewels_node, {
            attributes: true,
            attributeOldValue: true
        });
    }

    add_btn_items();
    add_btn_skills();
};

// 當頁面建立或重新整理時，擷取送出的封包以取得能拿到角色資料的 api 網址
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === "complete") {
        console.log(tabId + " is updated!");
        trigger_tab_id = tabId;
        chrome.webRequest.onCompleted.addListener(fetch_character_data, FILTER);
    }
});
