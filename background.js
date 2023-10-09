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

    function cal_difference(int1, int2) {
        if (int1 > int2) return int1 - int2;
        else if (int2 > int1) return int2 - int1;
    };

    function find_mod_id(stat_string, stat_index) {
        var entries = stats_data["result"][stat_index]["entries"];
        stat_string = stat_string.replace(/[\+]+/, "\\+");
        stat_string = stat_string.replace(/^[-]+/, "");
        stat_string = stat_string.replace(/[\d.]+/g, ".+?");

        var res_id = "";
        var res_text = "";
        Object.values(entries).some(function (key) {
            if (RegExp(stat_string).test(key["text"])) {
                if (Math.abs(key.text.length - stat_string.length) < Math.abs(res_text.length - stat_string.length)) {
                    [res_id, res_text] = [key.id, key.text];
                }
            }
        });

        if (res_id.length === 0) console.log(stat_index + ": " + stat_string);
        // console.log(res);
        return res_id;
    };

    function fix_enchant(mod, item_type) {
        var filter = { "id": -1 };
        // fix "Allocates #"
        if (/Allocates/.test(mod)) {
            // console.log(mod.match(/Allocates (.+)/)[1]);
            var passives_list = stats_data["result"][4]["entries"][4]["option"]["options"];

            var passive_name = mod.match(/Allocates (.+)/)[1];
            var passive_id = -1;
            Object.values(passives_list).some(function (passives) {
                if (passives.text === passive_name) passive_id = passives.id;
            });

            filter["value"] = { "option": passive_id };
            mod = "Allocates #";
        }
        // fix "Added Small Passive Skills grant: #"
        if (/Added Small Passive Skills grant: /.test(mod)) {
            var passives_list = stats_data["result"][4]["entries"][0]["option"]["options"];

            var passive_name = mod.match(/Added Small Passive Skills grant: (.+)/)[1];
            var passive_id = -1;
            Object.values(passives_list).some(function (passives) {
                if (passives.text === passive_name) passive_id = passives.id;
            });

            filter["value"] = { "option": passive_id };
            mod = "Added Small Passive Skills grant: #";
        }
        // fix "Enemies Blinded by you have #% reduced Critical Strike Chance"
        mod = mod.replace(/(Enemies Blinded by you have .+% reduced Critical Strike Chance)/, "Enemies Blinded by you have #% increased Critical Strike Chance");

        return [mod, filter];
    };
    function fix_implicit(mod, item_type) {
        var filter = { "id": -1 };
        return [mod, filter];
    };
    function fix_fractured(mod, item_type) {
        var filter = { "id": -1 };
        return [mod, filter];
    };
    function fix_explicit(mod, item_type) {
        var filter = { "id": -1 };

        if (item_type === "items") {
            // fix "#% Chance to Block Attack Damage"
            mod = mod.replace(/(^[^+]\d+% Chance to Block Attack Damage)/, "#% Chance to Block Attack Damage");
            // fix "#% Chance to Block Spell Damage"
            mod = mod.replace(/(^[^+]\d+% Chance to Block Spell Damage)/, "#% Chance to Block Spell Damage");
            // fix "Items and Gems have #% reduced Attribute Requirements"
            mod = mod.replace(/(reduced Attribute Requirements)/, "increased Attribute Requirements");
            // fix "#% reduced Global Physical Damage"
            mod = mod.replace(/(reduced Global Physical Damage)/, "increased Global Physical Damage");
            // fix "Shocks you inflict spread to other Enemies within 1.5 metres"
            mod = mod.replace(/(within 1.5 metres)/, "within 1.5 metre");
            // fix "Leftmost # Magic Utility Flasks constantly apply their Flask Effects to you"
            // mod = mod.replace(/(Magic Utility Flasks constantly apply their Flask Effects to you)/, "Magic Utility Flask constantly applies its Flask Effect to you");
            mod = mod.replace(/(Flasks|Flask)/, "\(Flasks|Flask\)");
            mod = mod.replace(/(applies|apply)/, "\(applies|apply\)");
            mod = mod.replace(/(Effects|Effect)/, "\(Effects|Effect\)");
            mod = mod.replace(/(its|their)/, "\(its|their\)");
            // fix "#% increased Evasion and Energy Shield"
            mod = mod.replace(/(Evasion and Energy Shield)/, "Evasion and Energy Shield \\(Local\\)");
            // fix "#% Chance to Block Attack Damage while wielding a Staff"
            mod = mod.replace(/(% Chance to Block Attack Damage while wielding a Staff)/, "% Chance to Block Attack Damage while wielding a Staff \\(Staves\\)");
            // fix "#% increased Evasion Rating"
            mod = mod.replace(/(increased Evasion Rating$)/, "increased Evasion Rating \\(Local\\)");
            // fix "#% increased Armour"
            mod = mod.replace(/(increased Armour$)/, "increased Armour \\(Local\\)");
            // fix "Non-Channelling Skills have -# to Total Mana Cost"
            mod = mod.replace(/(Non-Channelling Skills have .+ to Total Mana Cost)/, "Non-Channelling Skills have \+# to Total Mana Cost");
        } else if (item_type === "flasks") {
            mod = mod.replace(/(Charges|Charge)/, "\(Charges|Charge\)");
            // fix "#% reduced Charges per use"
            mod = mod.replace(/(reduced \(Charges\|Charge\) per use)/, "increased \(Charges|Charge\) per use");
            // fix "#% reduced Amount Recovered"
            mod = mod.replace(/(reduced Amount Recovered)/, "increased Amount Recovered");
            // fix "#% reduced Effect of Shock on you during Effect"
            mod = mod.replace(/(reduced Effect of Shock on you during Effect)/, "increased Effect of Shock on you during Effect");
            // fix "+#% reduced Duration"
            mod = mod.replace(/(reduced Duration)/, "increased Duration");
            // fix "Consumes Frenzy Charges on use"
            mod = mod.replace(/(Consumes Frenzy Charges on use)/, "Consumes 1 Frenzy Charge on use");
            // fix "less Duration"
            mod = mod.replace(/(less Duration)/, "more Duration");
            // fix "#% reduced Charges per use"
            mod = mod.replace(/(reduced Charges per use)/, "increased Charges per use");
        } else if (item_type === "jewels") {
            // fix "Passives in Radius of # can be Allocated\nwithout being connected to your tree"
            if (/Passives in Radius of .+ can be Allocated\nwithout being connected to your tree/.test(mod)) {
                var passives_list = stats_data["result"][1]["entries"][1787]["option"]["options"];

                var passive_name = mod.match(/Passives in Radius of (.+) can be Allocated/)[1];
                console.log(passive_name);
                var passive_id = -1;
                Object.values(passives_list).some(function (passives) {
                    if (passives.text === passive_name) passive_id = passives.id;
                });

                filter["value"] = { "option": passive_id };
                mod = "Passives in Radius of # can be Allocated\nwithout being connected to your tree";
            }
        }

        // fix "Grants Summon Harbinger"
        if (/Grants Summon.+?Harbinger/.test(mod)) {
            var passives_list = stats_data["result"][1]["entries"][1125]["option"]["options"];

            var passive_name = mod.match(/Grants Summon (.+) Skill/)[1];
            console.log(passive_name);
            var passive_id = -1;
            Object.values(passives_list).some(function (passives) {
                if (passives.text === passive_name) passive_id = passives.id;
            });

            filter["value"] = { "option": passive_id };
            mod = "Grants Summon Harbinger";
        }

        return [mod, filter];
    };
    function fix_crafted(mod, item_type) {
        var filter = { "id": -1 };

        // fix "#% reduced Mana Cost of Skills during Effect"
        mod = mod.replace(/(reduced Mana Cost of Skills during Effect)/, "increased Mana Cost of Skills during Effect");
        // fix "Non-Channelling Skills have -# to Total Mana Cost"
        mod = mod.replace(/(Non-Channelling Skills have .+ to Total Mana Cost)/, "Non-Channelling Skills have \+# to Total Mana Cost");

        return [mod, filter];
    };

    // type: items, flasks, jewels
    async function generate_target_url(item_index, item_type) {
        var this_query = JSON.parse(JSON.stringify(query_data));
        var item_data = equipment_data[item_type][item_index]["itemData"];

        // enchant mods not empty
        // enchant stat index = 4
        if (item_data["enchantMods"].length !== 0) {
            for (const mod of item_data["enchantMods"]) {
                var [fixed_mod, filter] = fix_enchant(mod, item_type);
                var mod_id = find_mod_id(fixed_mod, 4);

                if (mod_id.length !== 0) {
                    filter["id"] = mod_id;
                    this_query["query"]["stats"][0]["filters"].push(filter);
                }
            }
        }

        // implicit mods not empty
        // implicit stat index = 2
        if (item_data["implicitMods"].length !== 0) {
            for (const mod of item_data["implicitMods"]) {
                var [fixed_mod, filter] = fix_implicit(mod, item_type);
                var mod_id = find_mod_id(fixed_mod, 2);

                if (mod_id.length !== 0) {
                    filter["id"] = mod_id;
                    this_query["query"]["stats"][0]["filters"].push(filter);
                }
            }
        }

        // fractured mods not empty
        // fractured stat index = 3
        if (item_data["fracturedMods"].length !== 0) {
            for (const mod of item_data["fracturedMods"]) {
                var [fixed_mod, filter] = fix_fractured(mod, item_type);
                var mod_id = find_mod_id(fixed_mod, 3);

                if (mod_id.length !== 0) {
                    filter["id"] = mod_id;
                    this_query["query"]["stats"][0]["filters"].push(filter);
                }
            }
        }

        // explicit mods not empty
        // explicit stat index = 1
        if (item_data["explicitMods"].length !== 0) {
            for (const mod of item_data["explicitMods"]) {
                var [fixed_mod, filter] = fix_explicit(mod, item_type);
                var mod_id = find_mod_id(fixed_mod, 1);

                if (mod_id.length !== 0) {
                    filter["id"] = mod_id;
                    this_query["query"]["stats"][0]["filters"].push(filter);
                }
            }
        }

        // crafted mods not empty
        // crafted stat index = 6
        if (item_data["craftedMods"].length !== 0) {
            for (const mod of item_data["craftedMods"]) {
                var [fixed_mod, filter] = fix_crafted(mod, item_type);
                var mod_id = find_mod_id(fixed_mod, 6);

                if (mod_id.length !== 0) {
                    filter["id"] = mod_id;
                    this_query["query"]["stats"][0]["filters"].push(filter);
                }
            }
        }

        // console.log(JSON.stringify(this_query));

        return JSON.stringify(this_query);
    };

    // 將按鈕insert進頁面
    async function add_button_to_page() {
        // var items = document.body.getElementsByClassName("_item-hover_8bh10_26");
        var items = document.body.querySelectorAll("div.content.p-6:nth-child(2) button");
        console.log(items);

        // items
        for (var i = 0; i < items.length; i += 1) {
            var slot_num = 0;
            if (i < equipment_data["items"].length) { //items
                slot_num = equipment_data["items"][i]["itemSlot"];
            } else if (i < equipment_data["items"].length) { // flasks or jewels
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
            else if (i < equipment_data["items"].length + equipment_data["flasks"].length) /* flasks */ var target_url = await generate_target_url(i - equipment_data["items"].length, "flasks");
            else /* jewels */ var target_url = await generate_target_url(i - equipment_data["items"].length - equipment_data["flasks"].length, "jewels");
            new_node.setAttribute("onclick", `window.open('${POE_TRADE_URL}?q=${target_url}', '_blank');`);

            if ([1, 2, 3, 5, 6, 7, 10].includes(slot_num)) /* top */ new_node.setAttribute("style", "opacity: 0; position: absolute; top: 0px; right: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");
            else /* bottom */ new_node.setAttribute("style", "opacity: 0; position: absolute; bottom: -15px; left: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");
            // new_node.setAttribute("style", "opacity: 0; position: absolute; bottom: -15px; right: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");

            new_node.appendChild(balance_icon_node);
            new_node.appendChild(text_node);

            items[i].insertAdjacentElement("afterend", new_node);
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
