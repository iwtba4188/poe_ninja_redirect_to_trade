const FILTER = {
    urls: ["https://poe.ninja/api/data/*/getcharacter?*"]
};
const STATS_DATA_PATH = "./stats_data_231008.json";
const QUERY_PATH = "./query.json";

var equipment_data = {};
var trigger_tab_id = 0;
var stats_data;
fetch(STATS_DATA_PATH).then((response) => response.json()).then((json) => stats_data = json);
var query_data;
fetch(QUERY_PATH).then((response) => response.json()).then((json) => query_data = json);

async function fetch_url(target_url) {
    var res;

    await fetch(target_url).then(
        function (response) {
            if (response.status === 200) {
                return response.json();
            } else {
                throw new Error("Request failed: " + response.status);
            }
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

// 利用取得的url資訊取得所需response body。
async function fetch_character_data(details) {
    // 去除監聽器避免抓取此函式發出的request。
    chrome.webRequest.onCompleted.removeListener(fetch_character_data);

    var api_url = details.url;

    equipment_data = await fetch_url(api_url);

    chrome.scripting.executeScript({
        target: { tabId: trigger_tab_id },
        function: inject_script,
        args: [stats_data, query_data, equipment_data],
    });
}

async function inject_script(stats_data, query_data, equipment_data) {
    const POE_TRADE_URL = "https://www.pathofexile.com/trade/search";
    const BALANCE_ICON = `<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
    <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
    <g id="SVGRepo_iconCarrier">
        <path fill-rule="evenodd" clip-rule="evenodd"
            d="M16 3.93a.75.75 0 0 1 1.177-.617l4.432 3.069a.75.75 0 0 1 0 1.233l-4.432 3.069A.75.75 0 0 1 16 10.067V8H4a1 1 0 0 1 0-2h12V3.93zm-9.177 9.383A.75.75 0 0 1 8 13.93V16h12a1 1 0 1 1 0 2H8v2.067a.75.75 0 0 1-1.177.617l-4.432-3.069a.75.75 0 0 1 0-1.233l4.432-3.069z"
            fill="#ffffff"></path>
    </g>`;

    // console.log(stats_data);
    // console.log(query_data);
    // console.log(equipment_data);

    function find_stat_id(stat_string, stat_index) {
        var entries = stats_data["result"][stat_index]["entries"];
        stat_string = stat_string.replace(/[\+]+/, "\\+");
        stat_string = stat_string.replace(/[-]+/, "-");
        stat_string = stat_string.replace(/[\d#.]+/g, ".?");

        var res = [];
        Object.values(entries).some(function (key) {
            if (RegExp(stat_string).test(key["text"])) {
                res.push(key.id);
            }
        });

        if (res.length === 0) console.log(stat_index + stat_string);
        // console.log(res);
        return res;
    };

    function fix_enchant(mod) {
        // fix "Allocates #"
        if (/Allocates/.test(mod)) {
            console.log(mod.match(/Allocates (.+)/)[1]);
            // filter["value"] = { "option": mod.match(/Allocates (.+)/) };
            // mod = mod.replace(/Allocates .+?/, "Allocates #");
        }

        return mod;
    };
    function fix_implicit(mod) {
        return mod;
    };
    function fix_fractured(mod) {
        return mod;
    };
    function fix_explicit(mod) {
        // fix "#% reduced Amount Recovered"
        mod = mod.replace(/(reduced Amount Recovered)/, "increased Amount Recovered");
        // fix "Items and Gems have #% reduced Attribute Requirements"
        mod = mod.replace(/(reduced Attribute Requirements)/, "increased Attribute Requirements");
        // fix "Shocks you inflict spread to other Enemies within 1.5 metres"
        mod = mod.replace(/(within 1.5 metres)/, "within 1.5 metre");
        // fix "#% increased Evasion and Energy Shield"
        mod = mod.replace(/(Evasion and Energy Shield)/, "Evasion and Energy Shield \\(Local\\)");

        return mod;
    };
    function fix_crafted(mod) {
        return mod;
    };

    // type: items, flasks, jewels
    async function generate_target_url(item_index, item_type) {
        var this_query = JSON.parse(JSON.stringify(query_data));
        var item_data = equipment_data[item_type][item_index]["itemData"];

        // enchant mods not empty
        // enchant stat index = 4
        if (item_data["enchantMods"].length !== 0) {
            for (const mod of item_data["enchantMods"]) {
                var filter = {};
                var mod_id = find_stat_id(fix_enchant(mod), 4);

                if (mod_id.length !== 0) {
                    filter["id"] = mod_id[0];
                    this_query["query"]["stats"][0]["filters"].push(filter);
                }
            }
        }

        // implicit mods not empty
        // implicit stat index = 2
        if (item_data["implicitMods"].length !== 0) {
            for (const mod of item_data["implicitMods"]) {
                var filter = {};
                var mod_id = find_stat_id(fix_implicit(mod), 2);

                if (mod_id.length !== 0) {
                    filter["id"] = mod_id[0];
                    this_query["query"]["stats"][0]["filters"].push(filter);
                }
            }
        }

        // fractured mods not empty
        // fractured stat index = 3
        if (item_data["fracturedMods"].length !== 0) {
            for (const mod of item_data["fracturedMods"]) {
                var filter = {};
                var mod_id = find_stat_id(fix_fractured(mod), 3);

                if (mod_id.length !== 0) {
                    filter["id"] = mod_id[0];
                    this_query["query"]["stats"][0]["filters"].push(filter);
                }
            }
        }

        // explicit mods not empty
        // explicit stat index = 1
        if (item_data["explicitMods"].length !== 0) {
            for (const mod of item_data["explicitMods"]) {
                var filter = {};
                var mod_id = find_stat_id(fix_explicit(mod), 1);

                if (mod_id.length !== 0) {
                    filter["id"] = mod_id[0];
                    this_query["query"]["stats"][0]["filters"].push(filter);
                }
            }
        }

        // crafted mods not empty
        // crafted stat index = 6
        if (item_data["craftedMods"].length !== 0) {
            for (const mod of item_data["craftedMods"]) {
                var filter = {};
                var mod_id = find_stat_id(fix_crafted(mod), 6);

                if (mod_id.length !== 0) {
                    filter["id"] = mod_id[0];
                    this_query["query"]["stats"][0]["filters"].push(filter);
                }
            }
        }

        // console.log(JSON.stringify(this_query));

        return JSON.stringify(this_query);
    };

    // 將按鈕insert進頁面
    async function add_button_to_page() {
        var items = document.body.getElementsByClassName("_item-hover_8bh10_26");

        // items
        for (var i = 0; i < items.length; i += 1) {
            var slot_num = 0;
            if (i < equipment_data["items"].length) { //items
                slot_num = equipment_data["items"][i]["itemSlot"];
            } else { // flasks
                slot_num = 13;
            }

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
            if (i < equipment_data["items"].length) /* items */ var target_url = await generate_target_url(i, "items");
            else /* flasks */ var target_url = await generate_target_url(i - equipment_data["items"].length, "flasks");
            new_node.setAttribute("onclick", `window.open('${POE_TRADE_URL}?q=${target_url}', '_blank');`);

            if ([1, 2, 3, 5, 6, 7, 10].includes(slot_num)) /* top */ new_node.setAttribute("style", "opacity: 0; position: absolute; top: 0px; right: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");
            else /* bottom */ new_node.setAttribute("style", "opacity: 0; position: absolute; bottom: -15px; left: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");
            // new_node.setAttribute("style", "opacity: 0; position: absolute; bottom: -15px; right: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");

            new_node.appendChild(balance_icon_node);
            new_node.appendChild(text_node);

            items[i].appendChild(new_node);
            // console.log(items[i].appendChild(new_node));
        }

    };

    add_button_to_page();
};

// 當頁面建立或重新整理時，擷取指定封包資訊以利用url資訊取得所需response body。
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === "complete") {
        console.log(tabId + " is updated!");
        trigger_tab_id = tabId;
        chrome.webRequest.onCompleted.addListener(fetch_character_data, FILTER);
    }
});
