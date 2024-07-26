async function get_status(slot) {
    return (await chrome.storage.local.get([slot]))[slot];
};

async function switch_status(slot) {
    if (await get_status(slot)) chrome.storage.local.set({ [slot]: false });
    else chrome.storage.local.set({ [slot]: true });

    refresh_modes();

    chrome.tabs.query({ active: true, currentWindow: true, url: "*://*.poe.ninja/builds/*" }, function (tabs) {
        if (tabs.length > 0) chrome.tabs.update(tabs[0].id, { url: tabs[0].url });
    });
};

async function refresh_modes() {
    if (await get_status("redirect_to_tw")) document.getElementById("redirect-to").innerText = chrome.i18n.getMessage("redirect_to_tw");
    else document.getElementById("redirect-to").innerText = chrome.i18n.getMessage("redirect_to_com");

    if (await get_status("zh_tw")) document.getElementById("zh-tw").innerText = chrome.i18n.getMessage("mods_zh_tw");
    else document.getElementById("zh-tw").innerText = chrome.i18n.getMessage("mods_en");

    if (await get_status("debug")) document.getElementById("debug").innerText = "Debug Mode is ON.";
    else document.getElementById("debug").innerText = "Debug Mode is OFF.";
};

refresh_modes();

document.getElementById("redirect-to").addEventListener("click", () => switch_status("redirect_to_tw"));
document.getElementById("zh-tw").addEventListener("click", () => switch_status("zh_tw"));
document.getElementById("debug").addEventListener("click", () => switch_status("debug"));