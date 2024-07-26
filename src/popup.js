const option_count = {
    "redirect_to_tw": 2,  // 0: www.pathofexile.com, 1: www.pathofexile.tw
    "lang": 3,  // 0: en, 1: zh-TW, 2: en & zh-TW
    "debug": 2  // 0: false, 1: true
};

async function get_status(slot) {
    var val = (await chrome.storage.local.get([slot]))[slot];

    if (!val) return 0;
    else return val;
};

async function switch_status(slot) {
    var now_val = await get_status(slot);

    chrome.storage.local.set({ [slot]: ((now_val + 1) % option_count[slot]) });

    refresh_modes();

    chrome.tabs.query({ active: true, currentWindow: true, url: "*://*.poe.ninja/builds/*" }, function (tabs) {
        if (tabs.length > 0) chrome.tabs.update(tabs[0].id, { url: tabs[0].url });
    });
};

async function refresh_modes() {
    if (await get_status("redirect_to_tw") === 0) document.getElementById("redirect-to").innerText = chrome.i18n.getMessage("redirect_to_com");
    else document.getElementById("redirect-to").innerText = chrome.i18n.getMessage("redirect_to_tw");

    if (await get_status("lang") === 0) document.getElementById("zh-tw").innerText = chrome.i18n.getMessage("mods_en");
    else if (await get_status("lang") === 1) document.getElementById("zh-tw").innerText = chrome.i18n.getMessage("mods_zh_tw");
    else document.getElementById("zh-tw").innerText = chrome.i18n.getMessage("mods_en_zh_tw");

    if (await get_status("debug") === 0) document.getElementById("debug").innerText = "Debug Mode is OFF.";
    else document.getElementById("debug").innerText = "Debug Mode is ON.";
};

// chrome.storage.local.clear();
refresh_modes();

document.getElementById("redirect-to").addEventListener("click", () => switch_status("redirect_to_tw"));
document.getElementById("zh-tw").addEventListener("click", () => switch_status("lang"));
document.getElementById("debug").addEventListener("click", () => switch_status("debug"));