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

/**
 * 使用 fecth 方法取得該網頁的資料
 * @method fetch_url
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
 * @method fetch_character_data
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
        args: [stats_data, query_data, equipment_data],
    });
}

/**
 * 要 inject 進目前 tab 的 script，功能：加入按鈕，轉換物品 mod 到 stats id
 * @method inject_script
 * @param {Object} stats_data 所有詞墜表，格式詳見 POE 官網
 * @param {Object} query_data poe trade 的 query 格式，詳見 POE 官網及 query_example.json 示範
 * @param {Object} equipment_data 抓取到的角色裝備資料，內容來源為 poe.ninja，但格式是 POE 官方定義的
 * @return {None}
 */
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

    /**
     * 從 STATS_DATA_PATH 尋找 mod_string 對應的 stats id
     * @method find_mod_id
     * @param {string} mod_string 要查詢的詞墜（預先處理過），格式實際上是 RegExp，用來直接使用正則表達式查詢 stats id
     * @param {number} mod_type_index 詞墜種類對應 stats 資料的 index。TODO: 把 index 看能不能 ENUM 起來
     * @return {string} 查詢到的 stats id，如 enchant.stat_2954116742。如果沒有查詢到的話，則為空字串。
     */
    function find_mod_id(mod_string, mod_type_index) {

        var stats_entries = stats_data["result"][mod_type_index]["entries"];
        mod_string = mod_string.replace(/[\+]+/, "\\+");
        mod_string = mod_string.replace(/^[-]+/, "");
        mod_string = mod_string.replace(/[\d.]+/g, ".+?");

        var res_id = "";
        var res_text = "";
        Object.values(stats_entries).some(function (key) {
            // stats_entries 中每一項的 text 如果符合想查找的詞墜，也就是 @mod_string 是該項 text 的子字串
            if (RegExp(mod_string).test(key.text)) {
                // 如果找到長度更接近 @mod_string 的話，更新結果
                if (Math.abs(key.text.length - mod_string.length) < Math.abs(res_text.length - mod_string.length)) {
                    [res_id, res_text] = [key.id, key.text];
                }
            }
        });

        // DEBUG 資訊，當未查詢到該詞墜的話，印出該詞墜種類及詞墜本身
        if (res_id.length === 0) console.log(mod_type_index + ": " + mod_string);
        // console.log(res);
        return res_id;
    };

    /**
     * 修正 enchant 類別的詞墜
     */
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
        const filter = { id: -1 };
        const localMods = [
            { regex: /(Evasion and Energy Shield)$/, replace: "Evasion and Energy Shield (Local)" },
            { regex: /(increased Evasion Rating$)/, replace: "increased Evasion Rating (Local)" },
            { regex: /(increased Armour$)/, replace: "increased Armour (Local)" },
        ];
        const globalMods = [
            { regex: /(^[^+]\d+% Chance to Block Attack Damage)/, replace: "#% Chance to Block Attack Damage" },
            { regex: /(^[^+]\d+% Chance to Block Spell Damage)/, replace: "#% Chance to Block Spell Damage" },
            { regex: /(reduced Global Physical Damage)/, replace: "increased Global Physical Damage" },
            { regex: /(Non-Channelling Skills have .+ to Total Mana Cost)/, replace: "Non-Channelling Skills have +# to Total Mana Cost" },
        ];
        const flaskMods = [
            { regex: /(Charges|Charge)/, replace: "(Charges|Charge)" },
            { regex: /(reduced \(Charges\|Charge\) per use)/, replace: "increased (Charges|Charge) per use" },
            { regex: /(reduced Amount Recovered)/, replace: "increased Amount Recovered" },
            { regex: /(reduced Effect of Shock on you during Effect)/, replace: "increased Effect of Shock on you during Effect" },
            { regex: /(reduced Duration)/, replace: "increased Duration" },
            { regex: /(Consumes Frenzy Charges on use)/, replace: "Consumes 1 Frenzy Charge on use" },
            { regex: /(less Duration)/, replace: "more Duration" },
            { regex: /(reduced Charges per use)/, replace: "increased Charges per use" },
        ];

        const mods = item_type === "items" ? [...localMods, ...globalMods] : item_type === "flasks" ? flaskMods : [];

        for (const { regex, replace } of mods) {
            mod = mod.replace(regex, replace);
        }

        if (/Passives in Radius of .+ can be Allocated\nwithout being connected to your tree/.test(mod)) {
            const passivesList = stats_data.result[1].entries[1787].option.options;
            const passiveName = mod.match(/Passives in Radius of (.+) can be Allocated/)[1];
            const passiveId = Object.values(passivesList).find((passives) => passives.text === passiveName)?.id ?? -1;
            filter.value = { option: passiveId };
            mod = "Passives in Radius of # can be Allocated\nwithout being connected to your tree";
        }

        if (/Grants Summon.+?Harbinger/.test(mod)) {
            const passivesList = stats_data.result[1].entries[1125].option.options;
            const passiveName = mod.match(/Grants Summon (.+) Skill/)[1];
            const passiveId = Object.values(passivesList).find((passives) => passives.text === passiveName)?.id ?? -1;
            filter.value = { option: passiveId };
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
        const this_query = JSON.parse(JSON.stringify(query_data));
        const equipment = equipment_data[item_type][item_index];
        const mods = [
            { key: "enchantMods", index: 4, fix: fix_enchant },
            { key: "implicitMods", index: 2, fix: fix_implicit },
            { key: "fracturedMods", index: 3, fix: fix_fractured },
            { key: "explicitMods", index: 1, fix: fix_explicit },
            { key: "craftedMods", index: 6, fix: fix_crafted },
        ];

        for (const { key, index, fix } of mods) {
            const item_mods = equipment.itemData[key];
            if (item_mods.length === 0) continue;

            for (const mod of item_mods) {
                const [fixed_mod, filter] = fix(mod, item_type);
                const mod_id = find_mod_id(fixed_mod, index);

                if (mod_id.length !== 0) {
                    filter.id = mod_id;
                    this_query.query.stats[0].filters.push(filter);
                }
            }
        }

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

// 當頁面建立或重新整理時，擷取送出的封包以取得能拿到角色資料的api網址
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === "complete") {
        console.log(tabId + " is updated!");
        trigger_tab_id = tabId;
        chrome.webRequest.onCompleted.addListener(fetch_character_data, FILTER);
    }
});
