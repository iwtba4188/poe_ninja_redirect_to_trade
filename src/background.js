import { LocalDataLoader, OnlineDataLoader } from "./modules/dataloader.js";
import { get_status, set_status } from "./modules/storage_utils.js";

const API_URLS_FILTER = {
    urls: [
        "https://poe.ninja/poe1/api/builds/*/character?*",
        "https://poe.ninja/poe1/api/profile/characters/*",
        // "https://poe.ninja/poe2/api/builds/*/character?*",
        // "https://poe.ninja/poe2/api/profile/characters/*"
    ]
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
    const trade_type = (await chrome.storage.local.get(["trade-type"]))["trade-type"];
    const now_lang = (await chrome.storage.local.get(["lang"]))["lang"];
    const now_lang_for_lang_matching = now_lang.replace("en-", "");
    const global_mask_cache = new Map();

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
    const BALANCE_ICON = `<path xmlns="http://www.w3.org/2000/svg" d="M14.6302 7L13.0002 3H14.0002V2H9.00024V1H8.00024V2H3.00024V3H4.00024L2.38024 7H2.00024V8H2.15024C2.30663 8.49791 2.623 8.93028 3.05024 9.23C3.47189 9.53576 3.9794 9.7004 4.50024 9.7004C5.02108 9.7004 5.5286 9.53576 5.95024 9.23C6.3776 8.92817 6.69663 8.49696 6.86024 8H7.00024V7H6.55024L4.88024 3H8.00024V11H6.00024L5.61024 11.18L3.61024 13.69L4.00024 14.5H13.0002L13.3902 13.69L11.3902 11.18L11.0002 11H9.00024V3H12.1302L10.4602 7H10.0002V8H10.1502C10.3138 8.49544 10.6294 8.92668 11.0522 9.23236C11.4751 9.53804 11.9835 9.70258 12.5052 9.70258C13.027 9.70258 13.5354 9.53804 13.9582 9.23236C14.3811 8.92668 14.6967 8.49544 14.8602 8H15.0002V7H14.6302ZM5.22024 8.51C4.99971 8.63205 4.75229 8.69734 4.50024 8.7C4.25119 8.69869 4.00667 8.63326 3.79024 8.51C3.56955 8.38903 3.38362 8.21342 3.25024 8H5.75024C5.61799 8.21083 5.436 8.38595 5.22024 8.51ZM5.47024 7H3.47024L4.47024 4.6L5.47024 7ZM10.7602 12L12.0002 13.5H5.00024L6.24024 12H10.7602ZM12.5402 4.62L13.5402 7.02H11.5402L12.5402 4.62ZM13.2202 8.53C13.0016 8.65671 12.7529 8.72233 12.5002 8.72V8.72C12.2506 8.72355 12.0048 8.65778 11.7902 8.53C11.5692 8.40065 11.3837 8.21856 11.2502 8H13.7502C13.6263 8.2225 13.4427 8.40604 13.2202 8.53V8.53Z" fill="#424242"/>`;
    const CHECK_ICON = `<path fill-rule="evenodd" clip-rule="evenodd" d="M14.4315 3.3232L5.96151 13.3232L5.1708 13.2874L1.8208 8.5174L2.63915 7.94268L5.61697 12.1827L13.6684 2.67688L14.4315 3.3232Z" fill="#388A34"/>`;
    const CROSS_ICON = `<path fill-rule="evenodd" clip-rule="evenodd" d="M8.00028 8.70711L11.6467 12.3536L12.3538 11.6465L8.70739 8.00001L12.3538 4.35356L11.6467 3.64645L8.00028 7.2929L4.35384 3.64645L3.64673 4.35356L7.29317 8.00001L3.64673 11.6465L4.35384 12.3536L8.00028 8.70711Z" fill="#E51400"/>`;
    const BLOCK_ICON = `<path d="M8.00024 1C9.38471 1 10.7381 1.41054 11.8892 2.17971C13.0404 2.94888 13.9376 4.04213 14.4674 5.32122C14.9972 6.6003 15.1358 8.00777 14.8657 9.36563C14.5956 10.7235 13.929 11.9708 12.95 12.9497C11.971 13.9287 10.7237 14.5954 9.36587 14.8655C8.00801 15.1356 6.60054 14.997 5.32146 14.4672C4.04237 13.9373 2.94912 13.0401 2.17995 11.889C1.41078 10.7378 1.00024 9.38447 1.00024 8C1.00236 6.14413 1.74054 4.36489 3.05283 3.05259C4.36513 1.7403 6.14438 1.00212 8.00024 1ZM2.00024 8C1.99946 9.41814 2.50396 10.7902 3.42324 11.87L11.8702 3.423C10.9978 2.68282 9.93164 2.20787 8.79785 2.05426C7.66405 1.90065 6.50998 2.0748 5.47201 2.55614C4.43403 3.03748 3.55554 3.80588 2.94033 4.77056C2.32512 5.73523 1.9989 6.85585 2.00024 8ZM14.0002 8C14.001 6.58186 13.4965 5.20983 12.5772 4.13L4.13024 12.577C5.00272 13.3172 6.06885 13.7921 7.20264 13.9457C8.33643 14.0994 9.4905 13.9252 10.5285 13.4439C11.5664 12.9625 12.4449 12.1941 13.0602 11.2294C13.6754 10.2648 14.0016 9.14415 14.0002 8Z" fill="#424242"/>`;
    const EXTERNAL_LINK_ICON = `<path d="M1.50024 1.00006L6.00024 1V2L2.00024 2.00006V14.0001H14.0002V10.0001H15.0002V14.5001L14.5002 15.0001H1.50024L1.00024 14.5001V1.50006L1.50024 1.00006Z" fill="#424242"/> <path d="M15.0003 1.50006L15.0003 8.00003H14.0003L14.0003 2.70716L7.24293 9.46451L6.53583 8.7574L13.2932 2.00006L8.00028 2.00006V1.00006H14.5003L15.0003 1.50006Z" fill="#424242"/>`;

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
        if (find_mod_id(mod_string)) { // XXX: 暫時髒寫法
            if (lang_matching[mod_string]) return lang_matching[mod_string];
            else return mod_string;
        }
        return null;
    }

    dbg_log(equipment_data);

    dbg_add_msg_to_page_top("[DEBUGGING]");

    dbg_log(lang_matching);

    const mod_types = ["enchant", "implicit", "fractured", "explicit", "crafted", "mutated"];

    function clean_empty_entries(obj) {
        for (const key in obj) {
            const value = obj[key];

            if (value === undefined || Number.isNaN(value)) {
                delete obj[key];
            } else if (typeof value === "object" && value !== null) {
                clean_empty_entries(value);

                if (Object.keys(value).length === 0) {
                    delete obj[key];
                }
            }
        }
        return obj;
    }

    function clean_no_filters(obj) {
        for (const key in obj) {
            if (obj[key] !== undefined && obj[key]["filters"] === undefined) {
                delete obj[key];
            }
        }
        return obj;
    }

    function block_other_click_event_for_button(btn) {
        const stop_event = (event) => { event.stopPropagation(); };
        const events_to_block = ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"];
        events_to_block.forEach(evt => {
            btn.addEventListener(evt, stop_event, true);
        });
    }

    function gen_toggle_botton(data_key, button_type, mask_list) {
        let current_state = button_type;

        function select_icon(state) {
            switch (state) {
                case "check": return CHECK_ICON;
                case "cross": return CROSS_ICON;
                case "block": return BLOCK_ICON;
                default: return undefined;
            }
        }

        function select_hover_title(state) {
            switch (state) {
                case "check": return "Click to disable this filter in search";
                case "cross": return "Click to enable this filter in search";
                case "block": return "This filter is currently unavailable";
                default: return undefined;
            }
        }

        function select_cursor_type(state) {
            switch (state) {
                case "check":
                case "cross": return "pointer";
                case "block": return "not-allowed";
                default: return undefined;
            }
        }

        const icon_node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon_node.setAttribute("viewBox", "0 0 16 16");
        icon_node.setAttribute("fill", "currentColor");
        icon_node.setAttribute("width", "100%");
        icon_node.setAttribute("height", "100%");
        icon_node.setAttribute("style", "display: block;");
        icon_node.innerHTML = select_icon(current_state);

        const button_node = document.createElement("button");
        button_node.setAttribute("class", "button filter-btn");
        button_node.setAttribute("role", "button");
        button_node.setAttribute("style", "display: flex; justify-content: center; align-items: center; width: 18px; height: 18px; background-color: ivory; padding: 2px; border: none;");
        button_node.dataset.variant = "plain";
        button_node.dataset.size = "xsmall";
        button_node.dataset.state = current_state;
        button_node.dataset.key = data_key;
        button_node.disabled = (current_state === "block");

        button_node.appendChild(icon_node);

        const new_node = document.createElement("div");
        new_node.setAttribute("title", select_hover_title(current_state));
        new_node.setAttribute("style", `display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; margin-right: 5px; cursor: ${select_cursor_type(current_state)};`);
        new_node.appendChild(button_node);

        block_other_click_event_for_button(new_node);

        new_node.addEventListener("click", () => {
            if (current_state === "block") return;

            current_state = (current_state === "check") ? "cross" : "check";

            icon_node.innerHTML = select_icon(current_state);
            new_node.setAttribute("title", select_hover_title(current_state));
            button_node.dataset.state = current_state;

            if (mask_list) {
                mask_list.set(String(data_key), current_state);
            }
        });

        return new_node;
    }

    function gen_trade_botton(node, mask_list, item_data, is_gem, level, quality) {
        function update_mask_list(node, mask_list) {
            const toggle_btns = node.querySelectorAll("button.filter-btn");
            for (let btn of toggle_btns) {
                const key = btn.dataset.key;
                if (mask_list.has(key)) {
                    mask_list.set(key, btn.dataset.state);
                }
            }
        }

        const icon_node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const text_node = document.createTextNode("Trade");

        icon_node.setAttribute("viewBox", "0 0 16 16");
        icon_node.setAttribute("fill", "currentColor");
        icon_node.setAttribute("width", "10px");
        icon_node.setAttribute("height", "10px");
        icon_node.setAttribute("style", "display: block;");
        icon_node.innerHTML = EXTERNAL_LINK_ICON;

        const button_node = document.createElement("button");
        button_node.setAttribute("class", "button trade-btn");
        button_node.setAttribute("role", "button");
        button_node.setAttribute("style", "display: flex; justify-content: center; align-items: center; gap: 4px; height: 22px; background-color: ivory; padding: 2px 6px; border: none; cursor: pointer;");
        button_node.dataset.variant = "plain";
        button_node.dataset.size = "xsmall";

        button_node.appendChild(icon_node);
        button_node.appendChild(text_node);

        const new_node = document.createElement("div");
        new_node.setAttribute("title", "Redirect to trade website");
        new_node.setAttribute("style", "display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; margin-right: 5px;");
        new_node.appendChild(button_node);

        block_other_click_event_for_button(new_node);

        new_node.addEventListener("click", () => {
            update_mask_list(node, mask_list);
            let url = "";
            if (is_gem) {
                let gem_name = "";
                if (item_data.name) gem_name += item_data.name + " ";
                if (item_data.typeLine) gem_name += item_data.typeLine;
                gem_name = gem_name.trim();

                if (item_data.hybrid && item_data.hybrid.baseTypeName) {
                    gem_name += ` (${item_data.hybrid.baseTypeName})`;
                }

                url = `${POE_TRADE_URL}?q=${gen_gem_query(mask_list, gem_name, level, quality, redirect_to)}`;
            } else {
                url = `${POE_TRADE_URL}?q=${gen_query(mask_list, item_data, is_gem)}`;
            }
            window.open(url, '_blank').focus();
            dbg_log(url);
        });

        return new_node;
    }

    function gen_stats_by_item_data(mask_list, item_data, is_gem) {
        function is_check(key) {
            return (mask_list.get(String(key)) === "check");
        }

        if (is_gem) return undefined;

        let item_stats = [{
            type: "and",
            filters: [],
            disabled: false,
        }];

        for (const mod_type of mod_types) {
            const mod_type_index = `${mod_type}Mods`;
            const item_mods = item_data[mod_type_index];
            const item_inventoryId = item_data["inventoryId"];

            for (const idx in item_mods) {
                const mod = item_mods[idx];
                const disabled = !is_check(`${mod_type}${idx}`);

                try {
                    var res = find_mod_id(mod);
                } catch (e) {
                    dbg_warn(e);
                    dbg_add_msg_to_page_top(e);
                }

                if (!res) {
                    dbg_warn("[MOD NOT FOUND] mod_type=" + mod_type + ", mod_string='" + mod + "'");
                    dbg_add_msg_to_page_top("[MOD NOT FOUND] mod_type=" + mod_type + ", item_inventoryId=" + item_inventoryId + ", origin mod='" + mod + "'");
                    continue;
                }

                const target_index = mod_type === "mutated" ? "explicitMods" : mod_type_index;
                const mod_ids = res[target_index];
                const value = res["value"];

                if (!mod_ids) {
                    dbg_warn(item_inventoryId);
                    dbg_warn(item_mods);
                    dbg_warn("[MOD NOT FOUND] mod_type=" + mod_type + ", mod_string='" + mod + "'");
                    dbg_add_msg_to_page_top("[MOD NOT FOUND] mod_type=" + mod_type + ", item_inventoryId=" + item_inventoryId + ", origin mod='" + mod + "'");
                    continue;
                }

                if (mod_ids.length > 1) {
                    const filters = [];
                    for (const mod_id of mod_ids) {
                        if (!value) filters.push({ id: mod_id, disabled: disabled });
                        else filters.push({ id: mod_id, value: { min: value }, disabled: disabled });
                    }

                    item_stats.push({
                        type: "count",
                        filters: filters,
                        value: { min: 1 },
                    });
                } else {
                    if (value && value === 100) item_stats[0].filters.push({ id: mod_ids[0], value: { min: value }, disabled: disabled });
                    else if (value) item_stats[0].filters.push({ id: mod_ids[0], option: value, disabled: disabled });
                    else item_stats[0].filters.push({ id: mod_ids[0], disabled: disabled });
                }
                dbg_log("[SUCCESS] id=" + mod_ids[0] + ", value=" + value + ", mod_string='" + mod + "'");
            }
        }

        return item_stats;
    }

    function gen_filters_by_item_data(mask_list, item_data, is_gem) {
        function extract_value_by_type(src, type) {
            try {
                for (var ele of src) {
                    if (ele["type"] === type && ele["values"].length === 1) {
                        return ele["values"][0][0];
                    } else if (ele["type"] === type) {
                        let res = [];
                        for (var val of ele["values"]) {
                            res.push(val[0]);
                        }
                        return res;
                    }
                }
                return undefined;
            } catch (e) {
                return undefined;
            }
        }

        function calc_avg_dmg(raw_str) {
            try {
                const split_str = raw_str.split("-");
                return (parseInt(split_str[0]) + parseInt(split_str[1])) / 2;
            } catch (e) {
                return undefined;
            }
        }

        function is_check(key) {
            return (mask_list.get(String(key)) === "check");
        }

        let item_filters = {
            "armour_filters": {
                disabled: false,
                filters: {
                    "block": { min: undefined },
                    "ar": { min: undefined },
                    "ev": { min: undefined },
                    "es": { min: undefined },
                    "ward": { min: undefined },
                }
            },
            "misc_filters": {
                disabled: false,
                filters: {
                    "corrupted": { option: undefined },
                    "ilvl": { min: undefined },
                    "gem_level": { min: undefined },
                    "mirrored": { option: undefined },
                    "quality": { min: undefined },
                    "split": { option: undefined },
                    "synthesised_item": { option: undefined },
                }
            },
            "req_filters": {
                disabled: false,
                filters: {
                    "dex": { min: undefined },
                    "int": { min: undefined },
                    "lvl": { min: undefined },
                    "str": { min: undefined },
                }
            },
            "type_filters": {
                disabled: false,
                filters: {
                    "category": { option: undefined },
                    "rarity": { option: undefined },
                }
            },
            "weapon_filters": {
                disabled: false,
                filters: {
                    "aps": { min: undefined },
                    "crit": { min: undefined },
                    "edps": { min: undefined },
                    "pdps": { min: undefined },
                }
            }
        };

        if (is_gem) return clean_no_filters(clean_empty_entries(item_filters));

        let properties = item_data["properties"];
        let requirements = item_data["requirements"];

        if (is_check(15)) item_filters["armour_filters"]["filters"]["block"]["min"] = parseInt(extract_value_by_type(properties, 15));
        if (is_check(16)) item_filters["armour_filters"]["filters"]["ar"]["min"] = parseInt(extract_value_by_type(properties, 16));
        if (is_check(17)) item_filters["armour_filters"]["filters"]["ev"]["min"] = parseInt(extract_value_by_type(properties, 17));
        if (is_check(18)) item_filters["armour_filters"]["filters"]["es"]["min"] = parseInt(extract_value_by_type(properties, 18));
        if (is_check(54)) item_filters["armour_filters"]["filters"]["ward"]["min"] = parseInt(extract_value_by_type(properties, 54));

        if (is_check("item_level")) item_filters["misc_filters"]["filters"]["ilvl"]["min"] = item_data["ilvl"];
        if (is_check(5)) item_filters["misc_filters"]["filters"]["gem_level"]["min"] = parseInt(extract_value_by_type(properties, 5));
        if (is_check(6)) item_filters["misc_filters"]["filters"]["quality"]["min"] = parseInt(extract_value_by_type(properties, 6));

        if (is_check("requirements") && requirements) {
            item_filters["req_filters"]["filters"]["lvl"]["min"] = parseInt(extract_value_by_type(requirements, 62));
            item_filters["req_filters"]["filters"]["str"]["min"] = parseInt(extract_value_by_type(requirements, 63));
            item_filters["req_filters"]["filters"]["dex"]["min"] = parseInt(extract_value_by_type(requirements, 64));
            item_filters["req_filters"]["filters"]["int"]["min"] = parseInt(extract_value_by_type(requirements, 65));
        }

        if (item_data["rarity"]) {
            item_filters["type_filters"]["filters"]["rarity"]["option"] = item_data["rarity"].toLowerCase();
        }

        if (is_check(13)) item_filters["weapon_filters"]["filters"]["aps"]["min"] = parseFloat(extract_value_by_type(properties, 13));
        if (is_check(12)) item_filters["weapon_filters"]["filters"]["crit"]["min"] = parseFloat(extract_value_by_type(properties, 12));
        if (is_check(10)) {
            const ele_dmg = extract_value_by_type(properties, 10);
            if (ele_dmg !== undefined)
                item_filters["weapon_filters"]["filters"]["edps"]["min"] = (calc_avg_dmg(ele_dmg[0]) + calc_avg_dmg(ele_dmg[1]) + calc_avg_dmg(ele_dmg[2])) * parseFloat(extract_value_by_type(properties, 13));
        }
        if (is_check(9)) item_filters["weapon_filters"]["filters"]["pdps"]["min"] = calc_avg_dmg(extract_value_by_type(properties, 9)) * parseFloat(extract_value_by_type(properties, 13));

        item_filters = clean_empty_entries(item_filters);
        item_filters = clean_no_filters(item_filters);

        return item_filters;
    }

    function gen_status() {
        return { option: trade_type };
    }

    function gen_query(mask_list, item_data, is_gem) {
        let res = {
            query: {
                filters: gen_filters_by_item_data(mask_list, item_data, is_gem),
                stats: gen_stats_by_item_data(mask_list, item_data, is_gem),
                status: gen_status(),
            },
            sort: {
                price: "asc"
            }
        };

        res = clean_empty_entries(res);
        return JSON.stringify(res);
    }

    function gen_gem_query(mask_list, name, level, quality, server_type) {
        function is_check(key) {
            return (mask_list.get(String(key)) === "check");
        }

        let filters = {
            query: {
                status: gen_status(),
                type: {
                    option: undefined,
                    discriminator: "alt_x"
                },
                stats: [],
                filters: {
                    misc_filters: {
                        filters: {}
                    }
                }
            },
            sort: { price: "asc" }
        };

        if (is_check(5) && level !== undefined) {
            filters.query.filters.misc_filters.filters.gem_level = { min: level };
        }
        if (is_check(6) && quality !== undefined) {
            filters.query.filters.misc_filters.filters.quality = { min: quality };
        }

        const gems_info = server_type === "com" ? gems_data[name] : tw_gems_data[name];

        if (gems_info) {
            if (gems_info["disc"]) {
                filters.query.type.option = gems_info["type"];
                filters.query.type.discriminator = gems_info["disc"];
            } else {
                filters.query.type = gems_info["type"];
                delete filters.query.type.discriminator;
            }
        } else {
            filters.query.type = name;
        }

        filters = clean_empty_entries(filters);
        filters = clean_no_filters(filters);

        return JSON.stringify(filters);
    }

    function get_all_deepest_div(node) {
        if (!node) return [];
        const all_divs = node.querySelectorAll("div");
        const deepest_divs = Array.from(all_divs).filter(div => !div.querySelector("div"));
        return deepest_divs;
    }

    function translate_node(node) {
        const divs = get_all_deepest_div(node);

        if (now_lang === "en") return;
        for (const ele of divs) {
            const lang_mod_string = translate_mod(ele.innerText);

            if (!lang_mod_string) continue;

            if (["zh-tw", "ko", "ru"].includes(now_lang)) {
                ele.innerText = lang_mod_string;
            }
            else if (["en-zh-tw", "en-ko", "en-ru"].includes(now_lang) && ele.innerText !== lang_mod_string) {
                ele.innerText += "\n" + lang_mod_string;
            }
        }
    }

    function process_tippy(tippy_node) {
        function get_item_name(node) {
            try {
                let name = node.querySelector("h1").innerText;
                return name.replace(/\n/g, " ");
            } catch (error) {
                return undefined;
            }
        }

        function get_item_level(node) {
            const regex = /Level:\s*(\d+)/;
            const match = node.innerText.match(regex);
            if (match) {
                return Number(match[1]);
            }
            return undefined;
        }

        function get_item_quality(node) {
            const regex = /Quality:\s*\+(\d+)/;
            const match = node.innerText.match(regex);
            if (match) {
                return Number(match[1]);
            }
            return undefined;
        }

        function gen_mask_list(item_data, is_gem) {
            let placeholder_idx = 1000;
            let res = new Map();

            if (is_gem) {
                if (item_data["properties"]) {
                    for (var ele of item_data["properties"]) {
                        switch (ele["type"]) {
                            case 5:
                            case 6:
                                res.set(String(ele["type"]), "check");
                                break;
                            case undefined:
                                res.set(placeholder_idx, "block");
                                placeholder_idx++;
                                break;
                            default:
                                dbg_warn(ele);
                                res.set("unknown", "block");
                                break;
                        }
                    }
                }
                return res;
            }

            for (var ele of item_data["properties"]) {
                switch (ele["type"]) {
                    case 6:
                    case 9:
                    case 10:
                    case 12:
                    case 13:
                    case 15:
                    case 16:
                    case 17:
                    case 18:
                    case 54:
                        res.set(String(ele["type"]), "cross");
                        break;
                    case 14:
                        res.set(String(ele["type"]), "block");
                        break;
                    case undefined:
                        res.set(placeholder_idx, "block");
                        placeholder_idx++;
                        break;
                    default:
                        dbg_warn(ele);
                        res.set("unknown", "block");
                        break;
                }
            }

            res.set("item_level", "cross");

            if (item_data["influences"] !== undefined) {
                res.set("influences", "block");
            }

            if (item_data["requirements"] && item_data["requirements"].length > 0 && item_data["requirements"][0]["type"] !== 57) {
                res.set("requirements", "cross");
            } else if (item_data["requirements"] && item_data["requirements"].length > 0) {
                res.set("requirements", "block");
            }

            for (const mod_type of mod_types) {
                if (item_data[`${mod_type}Mods`]) {
                    for (let i = 0; i < item_data[`${mod_type}Mods`].length; i++) {
                        res.set(`${mod_type}${i}`, "check");
                    }
                }
            }

            return res;
        }

        function get_item_data_by_node(node, name, node_level) {
            function get_possible_names(iData) {
                let base = "";
                if (iData["name"]) base += iData["name"] + " ";
                if (iData["typeLine"]) base += iData["typeLine"];
                base = base.trim();

                let names = [base];

                if (iData["hybrid"] && iData["hybrid"]["baseTypeName"]) {
                    names.push(`${base} (${iData["hybrid"]["baseTypeName"]})`);
                }
                return names;
            }

            let candidates = [];

            try {
                for (var item of equipment_data["items"] || []) {
                    if (get_possible_names(item["itemData"]).includes(name)) candidates.push({ data: item["itemData"], is_gem: false });
                }
                for (var item of equipment_data["jewels"] || []) {
                    if (get_possible_names(item["itemData"]).includes(name)) candidates.push({ data: item["itemData"], is_gem: false });
                }
                for (var item of equipment_data["flasks"] || []) {
                    if (get_possible_names(item["itemData"]).includes(name)) candidates.push({ data: item["itemData"], is_gem: false });
                }
                for (var skill_group of equipment_data["skills"] || []) {
                    for (var item of skill_group["allGems"] || []) {
                        if (!item["itemData"]) continue;
                        if (get_possible_names(item["itemData"]).includes(name)) candidates.push({ data: item["itemData"], is_gem: true });
                    }
                }
            } catch (e) {
                return undefined;
            }

            if (candidates.length === 0) return undefined;
            if (candidates.length === 1) return candidates[0];

            let best_match = candidates[0];
            let max_score = -1;
            const node_text = node.innerText.toLowerCase().replace(/\n/g, " ");

            for (let cand of candidates) {
                let score = 0;
                let data = cand.data;

                if (cand.is_gem) {
                    let gem_lvl;
                    if (data.properties) {
                        for (let p of data.properties) {
                            if (p.type === 5 && p.values && p.values[0]) gem_lvl = parseInt(p.values[0][0]);
                        }
                    }
                    if (gem_lvl === node_level) score += 10;
                } else {
                    if (data.ilvl === node_level) score += 10;
                }

                const check_mods = (mod_array) => {
                    if (!mod_array) return;
                    for (let m of mod_array) {
                        // 移除數值僅比對詞彙本身
                        let clean_m = m.replace(/[0-9+\-.%]/g, "").trim().toLowerCase();
                        if (node_text.includes(clean_m)) score += 5;
                    }
                };

                check_mods(data.fracturedMods);
                check_mods(data.explicitMods);
                check_mods(data.implicitMods);

                if (score > max_score) {
                    max_score = score;
                    best_match = cand;
                }
            }

            return best_match;
        }

        translate_node(tippy_node);

        const item_name = get_item_name(tippy_node);
        if (item_name === undefined) return;

        const level = get_item_level(tippy_node);
        const quality = get_item_quality(tippy_node);

        const item_info = get_item_data_by_node(tippy_node, item_name, level);
        if (item_info === undefined) return;

        const item_data = item_info.data;
        const is_gem = item_info.is_gem;

        // 使用官方資料庫的唯一 id，若無則降級為組合屬性
        const cache_key = item_data.id ? item_data.id : (item_name + "_" + (item_data.ilvl || "") + "_" + JSON.stringify(item_data.explicitMods || []));

        let mask_list;
        if (global_mask_cache.has(cache_key)) {
            mask_list = global_mask_cache.get(cache_key);
        } else {
            mask_list = gen_mask_list(item_data, is_gem);
            global_mask_cache.set(cache_key, mask_list);
        }

        const article_div = tippy_node.querySelector("article > div");
        if (!article_div) return;
        const mask_target = get_all_deepest_div(article_div);

        const button_keys = Array.from(mask_list.keys());
        const button_values = Array.from(mask_list.values());
        for (var i = 0; i < mask_list.size; i++) {
            if (mask_target[i]) {
                const toggle_btn = gen_toggle_botton(button_keys[i], button_values[i], mask_list);
                mask_target[i].prepend(toggle_btn);
            }
        }

        var trade_button = gen_trade_botton(tippy_node, mask_list, item_data, is_gem, level, quality);

        const last_div = tippy_node.querySelector("article > div:last-child");
        if (last_div) last_div.prepend(trade_button);
    }

    const tippy_observer = new MutationObserver(mutationRecords => {
        for (const mutationRecord of mutationRecords) {
            for (const addedNode of mutationRecord["addedNodes"]) {
                process_tippy(addedNode);
            }
        }
    });

    tippy_observer.observe(document.body, {
        childList: true
    });

    const portal = document.querySelector("div[data-floating-ui-portal]");
    if (portal) {
        tippy_observer.observe(portal, {
            childList: true
        });
    }
};

// 初始化所需設定
chrome.runtime.onInstalled.addListener(init_status);

// 當頁面建立或重新整理時，擷取送出的封包以取得能拿到角色資料的 api 網址
chrome.tabs.onUpdated.addListener(chrome.webRequest.onBeforeRequest.addListener(fetch_character_data, API_URLS_FILTER));