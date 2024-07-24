const FILTER = {
    urls: ["https://poe.ninja/api/data/*/getcharacter?*"]
};
// const STATS_DATA_PATH = "./stats_data_231008.json";
const STATS_DATA_PATH = "./static/preprocessed_stats_data_240719.json";
const GEMS_DATA_PATH = "./static/preprocessed_gems_data_240723.json";
const DUPLICATE_STATS_PATH = "./static/duplicate_stats.json";
const PLURAL_PATH = "./static/plural.json";
const QUERY_PATH = "./static/query.json";
const GEMS_QUERY_PATH = "./static/query_gems.json";

var equipment_data = {};
var trigger_tab_id = 0;
var stats_data;
fetch(STATS_DATA_PATH).then((response) => response.json()).then((json) => stats_data = json);
var gems_data;
fetch(GEMS_DATA_PATH).then((response) => response.json()).then((json) => gems_data = json);
var duplicate_stats_data;
fetch(DUPLICATE_STATS_PATH).then((response) => response.json()).then((json) => duplicate_stats_data = json);
var plural;
fetch(PLURAL_PATH).then((response) => response.json()).then((json) => plural = json);
var query_data;
fetch(QUERY_PATH).then((response) => response.json()).then((json) => query_data = json);
var gems_query_data;
fetch(GEMS_QUERY_PATH).then((response) => response.json()).then((json) => gems_query_data = json);

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
        args: [stats_data, gems_data, query_data, gems_query_data, equipment_data, duplicate_stats_data, plural],
    });
}

/**
 * 要 inject 進目前 tab 的 script，功能：加入按鈕，轉換物品 mod 到 stats id
 * @method inject_script
 * @param {Object} stats_data 整理過的詞墜表，提升查找效率與準確率
 * @param {Object} gems_data 整理過的寶石詞墜表，提升查找效率與準確率
 * @param {Object} query_data poe trade 的 query 格式，詳見 POE 官網及 query_example.json 示範
 * @param {Object} gems_query_data poe trade 的 query 格式，詳見 POE 官網及 query_example.json 示範
 * @param {Object} equipment_data 抓取到的角色裝備資料，內容來源為 poe.ninja，但格式是 POE 官方定義的
 * @param {Object} duplicate_stats_data 重複的詞墜表，僅處理 explicitMods
 * @param {Object} plural 複數型態的詞墜
 * @return {None}
 */
async function inject_script(stats_data, gems_data, query_data, gems_query_data, equipment_data, duplicate_stats_data, plural) {

    var is_debugging = await chrome.storage.local.get(["debug"]);
    is_debugging = is_debugging["debug"];
    const POE_TRADE_URL = "https://www.pathofexile.com/trade/search";
    const BALANCE_ICON = `<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
    <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
    <g id="SVGRepo_iconCarrier">
        <path fill-rule="evenodd" clip-rule="evenodd"
            d="M16 3.93a.75.75 0 0 1 1.177-.617l4.432 3.069a.75.75 0 0 1 0 1.233l-4.432 3.069A.75.75 0 0 1 16 10.067V8H4a1 1 0 0 1 0-2h12V3.93zm-9.177 9.383A.75.75 0 0 1 8 13.93V16h12a1 1 0 1 1 0 2H8v2.067a.75.75 0 0 1-1.177.617l-4.432-3.069a.75.75 0 0 1 0-1.233l4.432-3.069z"
            fill="#ffffff"></path>
    </g>`;
    const mod_type_map = {
        4: "enchantMods",
        2: "implicitMods",
        3: "fracturedMods",
        1: "explicitMods",
        6: "craftedMods"
    };

    /**
     * 預先處理詞墜，替換掉指定部分。
     * @method preprocess_mod
     * @param {string} mod_string 
     * @returns {string} 替換完成的 mod_string
     */
    function preprocess_mod(mod_string) {
        mod_string = mod_string.toLowerCase()
        // +-
        mod_string = mod_string.replace(/[\+\-][\d\.]+%/g, "NUM_PERCENT");
        mod_string = mod_string.replace(/[\+\-][\d\.]+/g, "NUM");
        // #, #%
        mod_string = mod_string.replace(/[\d\.]+%/g, "NUM_PERCENT");
        mod_string = mod_string.replace(/[\d\.]+/g, "NUM");

        // increase, decrease
        mod_string = mod_string.replace(/\bincreased\b/g, "INC&RED");
        mod_string = mod_string.replace(/\breduced\b/g, "INC&RED");
        // more, less
        mod_string = mod_string.replace(/\bmore\b/g, "MORE&LESS");
        mod_string = mod_string.replace(/\bless\b/g, "MORE&LESS");
        // gain, loss
        mod_string = mod_string.replace(/\bgain\b/g, "GAIN&LOSS");
        mod_string = mod_string.replace(/\bloss\b/g, "GAIN&LOSS");
        // charge, charges
        mod_string = mod_string.replace(/\bcharges\b/g, "CHARGE");
        mod_string = mod_string.replace(/\bcharge\b/g, "CHARGE");
        // flask, flasks
        mod_string = mod_string.replace(/\bflasks\b/g, "FLASK");
        mod_string = mod_string.replace(/\bflask\b/g, "FLASK");
        // hit, hits
        mod_string = mod_string.replace(/\bhits\b/g, "HIT");
        mod_string = mod_string.replace(/\bhit\b/g, "HIT");
        // second, seconds
        mod_string = mod_string.replace(/\bseconds\b/g, "SECOND");
        mod_string = mod_string.replace(/\bsecond\b/g, "SECOND");
        // adds, add
        mod_string = mod_string.replace(/\badds\b/g, "ADD");
        mod_string = mod_string.replace(/\badd\b/g, "ADD");
        // modifier, modifiers
        mod_string = mod_string.replace(/\bmodifiers\b/g, "MODIFIER");
        mod_string = mod_string.replace(/\bmodifier\b/g, "MODIFIER");
        // curse, curses
        mod_string = mod_string.replace(/\bcurses\b/g, "CURSE");
        mod_string = mod_string.replace(/\bcurse\b/g, "CURSE");
        // debuff, debuffs
        mod_string = mod_string.replace(/\bdebuffs\b/g, "DEBUFF");
        mod_string = mod_string.replace(/\bdebuff\b/g, "DEBUFF");
        // word, words
        mod_string = mod_string.replace(/\bwords\b/g, "WORD");
        mod_string = mod_string.replace(/\bword\b/g, "WORD");
        // apply, applies
        mod_string = mod_string.replace(/\bapplies\b/g, "APPLY");
        mod_string = mod_string.replace(/\bapply\b/g, "APPLY");
        // effect, effects
        mod_string = mod_string.replace(/\beffects\b/g, "EFFECT");
        mod_string = mod_string.replace(/\beffect\b/g, "EFFECT");
        // its, their
        mod_string = mod_string.replace(/\bits\b/g, "ITS&THEIR");
        mod_string = mod_string.replace(/\btheir\b/g, "ITS&THEIR");
        // sockets, socket
        mod_string = mod_string.replace(/\bsockets\b/g, "SOCKET");
        mod_string = mod_string.replace(/\bsocket\b/g, "SOCKET");
        // sockets, socket
        mod_string = mod_string.replace(/\bmetres\b/g, "METRE");
        mod_string = mod_string.replace(/\bmetre\b/g, "METRE");
        // a, an
        mod_string = mod_string.replace(/\ban\b/g, "NUM");
        mod_string = mod_string.replace(/\ba\b/g, "NUM");
        // arrows, arrow
        mod_string = mod_string.replace(/\barrows\b/g, "ARROW");
        mod_string = mod_string.replace(/\barrow\b/g, "ARROW");
        // projectiles, projectile
        mod_string = mod_string.replace(/\bprojectiles\b/g, "PROJECTILE");
        mod_string = mod_string.replace(/\bprojectile\b/g, "PROJECTILE");
        // NUM_PERCENT chance to trigger socketed
        mod_string = mod_string.replace(/^trigger socketed CURSE\b/g, "NUM_PERCENT chance to trigger socketed CURSE");
        mod_string = mod_string.replace(/^trigger socketed spells\b/g, "NUM_PERCENT chance to trigger socketed spells");
        // enemies, enemy
        mod_string = mod_string.replace(/\benemies\b/g, "ENEMY");
        mod_string = mod_string.replace(/\benemy\b/g, "ENEMY");
        // // is, are
        // mod_string = mod_string.replace(/\bis a\b/g, "ISA&ARE");
        // mod_string = mod_string.replace(/\bare\b/g, "ISA&ARE");
        // // skills, skill
        // mod_string = mod_string.replace(/\bskills\b/g, "SKILL");
        // mod_string = mod_string.replace(/\bskill\b/g, "SKILL");
        // // 
        // mod_string = mod_string.replace(/\b\b/g, "");
        // mod_string = mod_string.replace(/\b\b/g, "");

        return mod_string;
    };

    /**
     * 處理像是塗油之類的選項。
     * @method process_options
     * @param {string} mod_string 詞墜
     * @param {string} mod_type_name 詞墜類型，如 explicit 或 implicit 等，用來定位 stats_data 中對應詞墜類別的資料
     * @returns {string, string} [查找到對應的 mod_id, 查找到對應的 option_id]
     */
    function process_options(mod_string, mod_type_name) {
        var mod_id = undefined;
        var option_id = undefined;

        // 希望之弦（Thread of Hope）
        if (/only affects passives in (.+) ring/.test(mod_string)) {
            mod_id = stats_data[mod_type_name]["only affects passives in NUM ring"]["id"];
            const passiveName = mod_string.match(/only affects passives in (.+) ring/)[1];
            option_id = stats_data[mod_type_name]["only affects passives in NUM ring"]["options"][passiveName];
        }
        // Forbidden Flesh，實際上的詞墜多了 "the"
        else if (/allocates (.+) if you have the matching MODIFIER on forbidden flesh/.test(mod_string)) {
            mod_id = stats_data[mod_type_name]["allocates NUM if you have matching MODIFIER on forbidden flesh"]["id"];
            const passiveName = mod_string.match(/allocates (.+) if you have the matching MODIFIER on forbidden flesh/)[1];
            option_id = stats_data[mod_type_name]["allocates NUM if you have matching MODIFIER on forbidden flesh"]["options"][passiveName];
        }
        // Forbidden Flame，實際上的詞墜多了 "the"
        else if (/allocates (.+) if you have the matching MODIFIER on forbidden flame/.test(mod_string)) {
            mod_id = stats_data[mod_type_name]["allocates NUM if you have matching MODIFIER on forbidden flame"]["id"];
            const passiveName = mod_string.match(/allocates (.+) if you have the matching MODIFIER on forbidden flame/)[1];
            option_id = stats_data[mod_type_name]["allocates NUM if you have matching MODIFIER on forbidden flame"]["options"][passiveName];
        }
        // 塗油
        else if (/allocates (.+)/.test(mod_string)) {
            mod_id = stats_data[mod_type_name]["allocates NUM"]["id"];
            const passiveName = mod_string.match(/allocates (.+)/)[1];
            option_id = stats_data[mod_type_name]["allocates NUM"]["options"][passiveName];
        }
        // 星團
        else if (/added small passive skills grant: (.+)/.test(mod_string)) {
            mod_id = stats_data[mod_type_name]["added small passive skills grant: NUM"]["id"];

            const passiveNameArr = mod_string.match(/added small passive skills grant: (.+)/g);
            // console.log(passiveNameArr)
            if (passiveNameArr.length < 2) var passiveName = passiveNameArr[0].match(/added small passive skills grant: (.+)/)[1];
            else var passiveName = passiveNameArr[0].match(/added small passive skills grant: (.+)/)[1] + "\n" + passiveNameArr[1].match(/added small passive skills grant: (.+)/)[1];

            option_id = stats_data[mod_type_name]["added small passive skills grant: NUM"]["options"][passiveName];
        }
        // summon harbinger
        else if (/grants summon (.+?) harbinger/.test(mod_string)) {
            mod_id = stats_data[mod_type_name]["grants summon harbinger skill"]["id"];
            const passiveName = mod_string.match(/grants summon (.+?) harbinger/)[1];
            option_id = stats_data[mod_type_name]["grants summon harbinger skill"]["options"][passiveName];
        }
        // summon bestial
        else if (/grants level NUM summon bestial (.+?) skill/.test(mod_string)) {
            mod_id = stats_data[mod_type_name]["grants level NUM summon bestial NUM skill"]["id"];
            const passiveName = mod_string.match(/grants level NUM summon bestial (.+?) skill/)[1];
            option_id = stats_data[mod_type_name]["grants level NUM summon bestial NUM skill"]["options"][passiveName];
        }
        // summon conflux
        else if (/you have (.+?) conflux for NUM SECOND every NUM SECOND/.test(mod_string)) {
            mod_id = stats_data[mod_type_name]["you have NUM conflux for NUM SECOND every NUM SECOND"]["id"];
            const passiveName = mod_string.match(/you have (.+?) conflux for NUM SECOND every NUM SECOND/)[1];
            option_id = stats_data[mod_type_name]["you have NUM conflux for NUM SECOND every NUM SECOND"]["options"][passiveName];
        }
        // 逃脫不能（Impossible Escape）
        else if (/passives in radius of (.+?) can be allocated\nwithout being connected to your tree/.test(mod_string)) {
            mod_id = stats_data[mod_type_name]["passives in radius of NUM can be allocated\nwithout being connected to your tree"]["id"];
            const passiveName = mod_string.match(/passives in radius of (.+?) can be allocated\nwithout being connected to your tree/)[1];
            option_id = stats_data[mod_type_name]["passives in radius of NUM can be allocated\nwithout being connected to your tree"]["options"][passiveName];
        }


        return [mod_id, option_id];
    };

    /**
     * 從 STATS_DATA_PATH 尋找 mod_string 對應的 stats id。
     * enchantMods, implicitMods, fracturedMods, explicitMods, craftedMods
     * 4, 2, 3, 1, 6
     * @method find_mod_id
     * @param {string} mod_string 要查詢的詞墜（預先處理過），格式是預先處理過的詞墜，用來直接比對查詢 stats id
     * @param {number} mod_type_name 詞墜種類對應 stats 資料的 index
     * @return {string, string} [查詢到的 stats id，如 enchant.stat_2954116742。如果沒有查詢到的話，則為 undefined。, mod option if possible]
     */
    function find_mod_id(mod_string, mod_type_name) {
        var mod_id = undefined;
        var mod_option = undefined;
        // console.log(mod_string);

        if (mod_string in stats_data[mod_type_name]) {
            mod_id = stats_data[mod_type_name][mod_string];
        } else {
            [mod_id, mod_option] = process_options(mod_string, mod_type_name);
        }

        return [mod_id, mod_option];
    };

    /**
     * 修正單條詞墜，替換掉特定部分使其能夠和 stats_data 對應到
     * @method fix_mod
     * @param {string} mod 要修正的詞墜
     * @param {string} item_inventoryId 物品識別類別
     * @param {string} item_typeLine 物品基底
     * @returns {string} 修正完成的詞墜
     */
    function fix_mod(mod, item_inventoryId, item_typeLine) {
        // filter["value"] = { "option": passive_id };
        const weaponMods = [
            // attack speed
            { regex: /^(NUM_PERCENT INC&RED attack speed)$/, replace: "NUM_PERCENT INC&RED attack speed (local)" },
            // damages
            { regex: /^(ADD NUM to NUM lightning damage)$/, replace: "ADD NUM to NUM lightning damage (local)" },
            { regex: /^(ADD NUM to NUM cold damage)$/, replace: "ADD NUM to NUM cold damage (local)" },
            { regex: /^(ADD NUM to NUM fire damage)$/, replace: "ADD NUM to NUM fire damage (local)" },
            { regex: /^(ADD NUM to NUM chaos damage)$/, replace: "ADD NUM to NUM chaos damage (local)" },
            { regex: /^(ADD NUM to NUM physical damage)$/, replace: "ADD NUM to NUM physical damage (local)" },
            // accuracy rating
            { regex: /^(NUM to accuracy rating)$/, replace: "NUM to accuracy rating (local)" },
            // #% of Physical Attack Damage Leeched as Life
            { regex: /^(NUM_PERCENT of physical attack damage leeched as life)$/, replace: "NUM_PERCENT of physical attack damage leeched as life (local)" },
            // #% of Physical Attack Damage Leeched as Mana
            { regex: /^(NUM_PERCENT of physical attack damage leeched as mana)$/, replace: "NUM_PERCENT of physical attack damage leeched as mana (local)" },
            // #% chance to Poison on Hit
            { regex: /^(NUM_PERCENT chance to poison on hit)$/, replace: "NUM_PERCENT chance to poison on hit (local)" },
            // weapon fortify
            { regex: /^(melee HIT have NUM_PERCENT chance to fortify)$/, replace: "melee HIT fortify" },
            // trigger skill
            { regex: /trigger a socketed bow skill when you attack with a bow, with a NUM SECOND cooldown/, replace: "NUM_PERCENT chance to trigger a socketed bow skill when you attack with a bow, with a NUM SECOND cooldown" },
            { regex: /trigger a socketed bow skill when you cast a spell while wielding a bow, with a NUM SECOND cooldown/, replace: "NUM_PERCENT chance to trigger a socketed bow skill when you cast a spell while wielding a bow, with a NUM SECOND cooldown" },
            // fire additional arrows
            // { regex: /bow attacks fire an additional arrow/, replace: "bow attacks fire NUM additional arrows" },
            // // #% chance to Trigger a Socketed Spell on Using a Skill, with a 8 second Cooldown\nSpells Triggered this way have 150% more Cost
            { regex: /trigger NUM socketed spell when you use NUM skill, with NUM NUM SECOND cooldown\nspells triggered this way have NUM_PERCENT MORE&LESS cost/, replace: "NUM_PERCENT chance to trigger NUM socketed spell on using NUM skill, with NUM NUM SECOND cooldown\nspells triggered this way have NUM_PERCENT MORE&LESS cost" },
            // { regex: /^trigger (.+) socketed/, replace: "NUM_PERCENT chance to " }
            { regex: /no physical damage/, replace: "NUM_PERCENT INC&RED physical damage" },
        ];
        const localMods = [
            // energy shield
            { regex: /^(NUM_PERCENT INC&RED energy shield)$/, replace: "NUM_PERCENT INC&RED energy shield (local)" },
            { regex: /^(NUM to maximum energy shield)$/, replace: "NUM to maximum energy shield (local)" },
            // evasion rating
            { regex: /^(NUM_PERCENT INC&RED evasion rating)$/, replace: "NUM_PERCENT INC&RED evasion rating (local)" },
            { regex: /^(NUM to evasion rating)$/, replace: "NUM to evasion rating (local)" },
            // armour 
            { regex: /^(NUM_PERCENT INC&RED armour)$/, replace: "NUM_PERCENT INC&RED armour (local)" },
            { regex: /^(NUM to armour)$/, replace: "NUM to armour (local)" },
            // armour and energy shield
            { regex: /^(NUM_PERCENT INC&RED armour and energy shield)$/, replace: "NUM_PERCENT INC&RED armour and energy shield (local)" },
            // armour and evasion
            { regex: /^(NUM_PERCENT INC&RED armour and evasion)$/, replace: "NUM_PERCENT INC&RED armour and evasion (local)" },
            // evasion and energy shield
            { regex: /^(NUM_PERCENT INC&RED evasion and energy shield)$/, replace: "NUM_PERCENT INC&RED evasion and energy shield (local)" },
            // #% increased Armour, Evasion and Energy Shield
            { regex: /^(NUM_PERCENT INC&RED armour, evasion and energy shield)$/, replace: "NUM_PERCENT INC&RED armour, evasion and energy shield (local)" },
            // Flasks gain a Charge every 3 seconds
            { regex: /FLASK GAIN&LOSS a CHARGE every NUM SECOND/, replace: "FLASK GAIN&LOSS NUM CHARGE every NUM SECOND" },
            // #% chance to block (shields)
            { regex: /^NUM_PERCENT chance to block$/, replace: "NUM_PERCENT chance to block (shields)" },
            // Your Hits treat Cold Resistance as 10% higher than actual value
            { regex: /your HIT treat cold resistance as NUM_PERCENT higher than actual value/, replace: "damage penetrates NUM_PERCENT cold resistance" },
            // Eat a Soul when you Hit a Rare or Unique Enemy, no more than once every second
            { regex: /eat NUM soul when you HIT NUM rare or unique enemy, no MORE&LESS than once every NUM SECOND/, replace: "eat NUM soul when you HIT NUM rare or unique enemy, no MORE&LESS than once every SECOND" },
        ];
        const flaskMods = [
            { regex: /^(consumes frenzy charges on use)$/, replace: "consumes NUM frenzy CHARGE on use" },
            // { regex: /skills fire NUM additional PROJECTILE during EFFECT$/, replace: "skills fire NUM additional PROJECTILE during EFFECT" },
        ];
        const passiveJewelMods = [
            { regex: /commissioned NUM coins to commemorate victario\n.+/, replace: "commissioned NUM coins to commemorate victario" },
            { regex: /commissioned NUM coins to commemorate cadiro\n.+/, replace: "commissioned NUM coins to commemorate cadiro" },
            { regex: /commanded leadership over NUM warriors under kaom\n.+/, replace: "commanded leadership over NUM warriors under kaom" },
            { regex: /bathed in the blood of NUM sacrificed in the name of doryani\n.+/, replace: "bathed in the blood of NUM sacrificed in the name of doryani" },
            { regex: /commanded leadership over NUM warriors under rakiata\n.+/, replace: "commanded leadership over NUM warriors under rakiata" },
            { regex: /bathed in the blood of NUM sacrificed in the name of ahuana\n.+/, replace: "bathed in the blood of NUM sacrificed in the name of ahuana" },
            { regex: /bathed in the blood of NUM sacrificed in the name of xibaqua\n.+/, replace: "bathed in the blood of NUM sacrificed in the name of xibaqua" },
            { regex: /commanded leadership over NUM warriors under akoya\n.+/, replace: "commanded leadership over NUM warriors under akoya" },
            { regex: /carved to glorify NUM new faithful converted by high templar avarius\n.+/, replace: "carved to glorify NUM new faithful converted by high templar avarius" },
            { regex: /commissioned NUM coins to commemorate caspiro\n.+/, replace: "commissioned NUM coins to commemorate caspiro" },
            { regex: /carved to glorify NUM new faithful converted by high templar maxarius\n.+/, replace: "carved to glorify NUM new faithful converted by high templar maxarius" },
            { regex: /denoted service of NUM dekhara in the akhara of nasima\n.+/, replace: "denoted service of NUM dekhara in the akhara of nasima" },
            { regex: /denoted service of NUM dekhara in the akhara of asenath\n.+/, replace: "denoted service of NUM dekhara in the akhara of asenath" },
            { regex: /carved to glorify NUM new faithful converted by high templar dominus\n.+/, replace: "carved to glorify NUM new faithful converted by high templar dominus" },
            { regex: /denoted service of NUM dekhara in the akhara of balbala\n.+/, replace: "denoted service of NUM dekhara in the akhara of balbala" },
            { regex: /commissioned NUM coins to commemorate chitus\n.+/, replace: "commissioned NUM coins to commemorate chitus" },
            { regex: /commanded leadership over NUM warriors under kiloava\n.+/, replace: "commanded leadership over NUM warriors under kiloava" },
            { regex: /bathed in the blood of NUM sacrificed in the name of zerphi\n.+/, replace: "bathed in the blood of NUM sacrificed in the name of zerphi" },
            { regex: /carved to glorify NUM new faithful converted by high templar venarius\n.+/, replace: "carved to glorify NUM new faithful converted by high templar venarius" },
            { regex: /denoted service of NUM dekhara in the akhara of deshret\n.+/, replace: "denoted service of NUM dekhara in the akhara of deshret" },
            { regex: /NUM added passive skill is NUM jewel SOCKET/, replace: "NUM added passive skills are jewel SOCKET" },
        ];
        const ringMods = [
            { regex: /PROJECTILE return to you/, replace: "PROJECTILE have NUM_PERCENT chance to return to you" },
        ];
        const amuletMods = [
            { regex: /critical strikes inflict malignant madness if the eater of worlds is dominant/, replace: "critical strikes have NUM_PERCENT chance to inflict malignant madness if the eater of worlds is dominant", }
        ];

        // console.log(item_inventoryId);
        if (["Weapon"].includes(item_inventoryId)) var mods = weaponMods;
        else if (["Offhand"].includes(item_inventoryId) && !item_typeLine.includes("Shield")) var mods = weaponMods;
        else if (["Offhand", "Helm", "BodyArmour", "Gloves", "Boots"].includes(item_inventoryId)) var mods = localMods;
        else if (["Flask"].includes(item_inventoryId)) var mods = flaskMods;
        else if (["PassiveJewels"].includes(item_inventoryId)) var mods = passiveJewelMods;
        else if (["Ring", "Ring2"].includes(item_inventoryId)) var mods = ringMods;
        else var mods = amuletMods;

        for (const { regex, replace } of mods) {
            mod = mod.replace(regex, replace);
        }

        return mod;
    };

    /**
     * 生成 poe trade 的查詢網址
     * @method generate_target_query
     * @param {string} item_type ["items", "flasks", "jewels"]
     * @param {int} item_index 要從哪一個 idx 抓該物品的資料
     * @returns {string} 生成的查詢網址
     */
    function gen_target_query(item_type, item_index) {
        const this_query = JSON.parse(JSON.stringify(query_data));
        const equipment = equipment_data[item_type][item_index];
        const mods = [4, 2, 3, 1, 6];

        for (const index of mods) {
            const mod_type_name = mod_type_map[index];
            const item_mods = equipment.itemData[mod_type_name];
            const item_inventoryId = equipment.itemData["inventoryId"];
            const item_typeLine = equipment.itemData["typeLine"];

            if (item_mods.length === 0) continue;
            // console.log(item_mods);    // DEBUG ONLY

            for (const mod of item_mods) {
                const preprocessed_mod = preprocess_mod(mod);
                const fixed_mod = fix_mod(preprocessed_mod, item_inventoryId, item_typeLine);
                var [mod_id, mod_option] = find_mod_id(fixed_mod, mod_type_name);

                // if (mod_id === undefined) {
                //     var words_of_fixed_mod = fixed_mod.split(" ");

                //     console.log(words_of_fixed_mod);
                //     // console.log(plural);
                //     for (var word of words_of_fixed_mod) {
                //         if (plural[word] !== null) {
                //             word = plural[word];
                //             var new_mod = words_of_fixed_mod.join(" ");
                //             console.log(new_mod);
                //             [mod_id, mod_option] = find_mod_id(new_mod, mod_type_name);

                //             if (!mod_id) break;
                //             else if (plural[word]) word = plural[word];
                //         }
                //     }

                //     if (mod_id !== undefined) {
                //         console.log("[可喜可賀] 成功修復了一項詞墜：");
                //         console.info("[SUCCESS] id=" + mod_id + ", option=" + mod_option + ", mod_string='" + new_mod + "'");
                //     } else {
                //         console.log("[可惜沒如果] 未修復詞墜：");
                //         console.warn("[MOD NOT FOUND] mod_type=" + mod_type_name + ", mod_string='" + new_mod + "'");
                //     }
                // }

                if (mod_id !== undefined) {
                    if (duplicate_stats_data["all_mods"].includes(mod_id)) {
                        this_query.query.stats.push({
                            "type": "count",
                            "filters": duplicate_stats_data[fixed_mod],
                            "value": {
                                "min": 1
                            }
                        });
                        console.info("\n[DUPLICATE] id=" + mod_id + ", option=" + mod_option + ", mod_string='" + fixed_mod + "', duplicate_list:" + JSON.stringify(duplicate_stats_data[fixed_mod]));
                    }
                    // not duplicate mods
                    else {
                        if (mod_option === undefined) this_query.query.stats[0].filters.push({ "id": mod_id });
                        else this_query.query.stats[0].filters.push({ "id": mod_id, "option": mod_option });
                    }
                    console.info("[SUCCESS] id=" + mod_id + ", option=" + mod_option + ", mod_string='" + fixed_mod + "'");
                } else {
                    // DEBUG 資訊，當未查詢到該詞墜的話，印出該詞墜種類及詞墜本身
                    console.warn(item_inventoryId);
                    console.warn(item_mods);
                    console.warn("[MOD NOT FOUND] mod_type=" + mod_type_name + ", mod_string='" + fixed_mod + "'");

                    if (is_debugging) add_debug_msg("[MOD NOT FOUND] mod_type=" + mod_type_name + ", item_inventoryId=" + item_inventoryId + ", mod_string='" + fixed_mod + "', origin mod='" + mod + "'");
                }
            }
        }

        return JSON.stringify(this_query);
    };

    function gen_skills_target_query(name, level, quality) {
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
     * 生成新的重導向按鈕
     * @method gen_btn_element
     * @param {string} target_query 按下按鈕後會前往的網址
     * @param {string} btn_position {"top", "buttom"} 按鈕放在上方或下方
     * @returns {HTMLButtonElement} 重導向至 target_url 的按鈕
     */
    function gen_trade_btn_element(target_query, btn_position) {
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

        if (btn_position === "top") /* top */ new_node.setAttribute("style", "opacity: 0; position: absolute; top: 0px; right: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");
        else if (btn_position === "buttom") /* bottom */ new_node.setAttribute("style", "opacity: 0; position: absolute; bottom: -15px; left: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");
        else if (btn_position === "skills") /* for skills */ new_node.setAttribute("style", "position: relative; background-color: hsla(var(--emerald-800),var(--opacity-100));");
        // new_node.setAttribute("style", "opacity: 0; position: absolute; bottom: -15px; right: var(--s1); background-color: hsla(var(--emerald-800),var(--opacity-100)); transform: translateY(-66%); border-radius: var(--rounded-sm); z-index: 100;");

        new_node.appendChild(balance_icon_node);
        new_node.appendChild(text_node);

        return new_node;
    };

    function gen_btn_span_element() {
        const new_node = document.createElement("span");
        new_node.setAttribute("style", "padding: 3px;");

        return new_node;
    }

    /**
     * 將按鈕insert進頁面
     * @method add_item_btn_to_page
     * @returns None
     */
    async function add_item_btn_to_page() {
        // var items = document.body.getElementsByClassName("_item-hover_8bh10_26");
        var buttons = document.body.querySelectorAll("div.content.p-6:nth-child(2) button[title~=Copy]");
        console.log(buttons);

        // buttons
        for (var i = 0; i < equipment_data["items"].length; i++) {
            var slot_num = 0;
            if (i < equipment_data["items"].length) { //items
                slot_num = equipment_data["items"][i]["itemSlot"];
            }

            if (i < equipment_data["items"].length) /* items */ var target_query = await gen_target_query("items", i);
            else continue;

            if ([1, 2, 3, 5, 6, 7, 10].includes(slot_num)) /* top */ var new_node = gen_trade_btn_element(target_query, "top");
            else /* buttom */ var new_node = gen_trade_btn_element(target_query, "buttom");

            buttons[i].insertAdjacentElement("afterend", new_node);
        }

    };

    async function add_flask_jewel_btn_to_page(target_btn, equipment_type, equipment_mod) {
        // var target_url = await generate_target_url(equipment_type, equipment_data_idx);
        var target_query = mods_target_query_mapping[equipment_type][equipment_mod];

        var new_node = gen_trade_btn_element(target_query, "buttom");

        if (equipment_type === "flasks") target_btn.appendChild(new_node);
        else target_btn.querySelector("div").appendChild(new_node);
    };

    async function add_skill_btn_to_page() {
        var btns = document.body.querySelectorAll("article._item-border_17v42_1 div[style='flex: 1 1 auto;']");

        for (var i = 0; i < btns.length; i++) {
            var target_query = mods_target_query_mapping["skills"][i];
            var btn = gen_trade_btn_element(target_query, "skills");
            var btn_span = gen_btn_span_element();

            btns[i].prepend(btn_span);
            btns[i].prepend(btn);
        }
    };

    function combine_item_mods(item_type, item_index) {
        var mod = "";
        mod += equipment_data[item_type][item_index]["itemData"]["enchantMods"].join("");
        mod += equipment_data[item_type][item_index]["itemData"]["implicitMods"].join("");
        mod += equipment_data[item_type][item_index]["itemData"]["explicitMods"].join("");

        return mod;
    };

    function gen_all_target_query_mapping() {
        var mapping = { "items": {}, "flasks": {}, "jewels": {}, "skills": [] };
        var item_types = ["items", "flasks", "jewels"];

        // gen item types
        for (var type of item_types) {
            for (var i = 0; i < equipment_data[type].length; i++) {
                var mod = combine_item_mods(type, i);
                var target_query = gen_target_query(type, i);
                mapping[type][mod] = target_query;
            }
        }

        // gen skills type
        for (var skill_section of equipment_data["skills"]) {
            for (var gem of skill_section["allGems"]) {
                var target_query = gen_skills_target_query(gem.name, gem.level, gem.quality);
                mapping["skills"].push(target_query);
            }
        }

        return mapping;
    };

    function add_debug_msg(msg) {
        var new_node = document.createElement("p");
        new_node.setAttribute("style", "width: max-content; max-width: none;");
        new_node.innerHTML = msg;

        document.querySelectorAll("header#header")[0].prepend(new_node);
    };

    if (is_debugging) add_debug_msg("[DEBUGGING]");

    var mods_target_query_mapping = gen_all_target_query_mapping();
    console.log(mods_target_query_mapping);

    var tippy_mods_record = {};
    let observer = new MutationObserver(mutationRecords => {
        // console.log(mutationRecords);
        for (var mutationRecord of mutationRecords) {
            var addedNode = mutationRecord["addedNodes"][0];
            // 如果未新增 Node
            if (addedNode === undefined) continue;
            // console.log(addedNode);

            var tippy_id = addedNode.id;
            // 如果此 Node 已經紀錄過
            if (tippy_mods_record[tippy_id] !== undefined) continue;

            var section = addedNode.querySelectorAll("div._item-body_1tb3h_1 section")
            // 此 Node 不是裝備的 tippy
            if (section === undefined || section.length < 5) continue;
            var enchant = section[2].querySelectorAll("div div")[0];
            var implicit = section[3].querySelectorAll("div#implicit")[0];
            var explicit = section[4].querySelectorAll("div#explicit")[0];
            // console.log(enchant);
            // console.log(implicit);
            // console.log(explicit);

            // 此 Node 不是裝備的 tippy
            if (enchant === undefined && implicit === undefined && explicit === undefined) {
                tippy_mods_record[tippy_id] = undefined;
                continue;
            }

            var mod_text = "";
            for (var mod_type of [enchant, implicit, explicit]) {
                if (mod_type !== undefined) mod_text += mod_type["textContent"];
            }
            // if (enchant !== undefined) mod_text += enchant["textContent"];
            // if (implicit !== undefined) mod_text += implicit["textContent"];
            // if (explicit !== undefined) mod_text += explicit["textContent"];

            tippy_mods_record[tippy_id] = mod_text;
            // console.log("[ROCORD] " + tippy_id);
            // console.log("mod_text=" + mod_text);
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
            console.warn("[TIPPY DATA NOT RECEIVED] tippy_id=" + tippy_id);
        } else if (flasks_finished.includes(tippy_id)) {
            console.log("[ALREADY ADDED] flasks with tippy_id=" + tippy_id);
        } else {
            // console.log("[ADDING FLASK] " + mod + ", flask_idx=" + flask_idx);
            add_flask_jewel_btn_to_page(target, "flasks", mod);

            flasks_finished.push(tippy_id);
            if (flasks_finished.length == equipment_data["flasks"].length) {
                flasks_observer.disconnect();
                console.log("[OBSERVER CLOSED] flasks");
            }

            if (flasks_finished.length == equipment_data["flasks"].length && jewels_finished.length == equipment_data["jewels"].length) {
                observer.disconnect();
                console.log("[OBSERVER CLOSED] all");
            }
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
            console.warn("[TIPPY DATA NOT RECEIVED] tippy_id=" + tippy_id);
        } else if (jewels_finished.includes(tippy_id)) {
            console.log("[ALREADY ADDED] jewels with tippy_id=" + tippy_id);
        } else {
            // console.log("[ADDING JEWEL] " + mod + ", jewel_idx=" + jewel_idx);
            add_flask_jewel_btn_to_page(target, "jewels", mod);

            jewels_finished.push(tippy_id);
            if (jewels_finished.length == equipment_data["jewels"].length) {
                jewels_observer.disconnect();
                console.log("[OBSERVER CLOSED] jewels");
            }

            if (flasks_finished.length == equipment_data["flasks"].length && jewels_finished.length == equipment_data["jewels"].length) {
                observer.disconnect();
                console.log("[OBSERVER CLOSED] all");
            }
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

    add_item_btn_to_page();
    add_skill_btn_to_page();
};

// 當頁面建立或重新整理時，擷取送出的封包以取得能拿到角色資料的 api 網址
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === "complete") {
        console.log(tabId + " is updated!");
        trigger_tab_id = tabId;
        chrome.webRequest.onCompleted.addListener(fetch_character_data, FILTER);
    }
});
