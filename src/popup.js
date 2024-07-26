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
    if (await get_status("redirect_to_tw")) document.getElementById("redirect-to").innerText = "目前重新導向至 台服";
    else document.getElementById("redirect-to").innerText = "目前重新導向至 國際服";

    if (await get_status("zh_tw")) document.getElementById("zh-tw").innerText = "詞綴中文化目前為 開啟";
    else document.getElementById("zh-tw").innerText = "詞綴中文化目前為 關閉";

    if (await get_status("debug")) document.getElementById("debug").innerText = "Debug Mode is ON.";
    else document.getElementById("debug").innerText = "Debug Mode is OFF.";
};

refresh_modes();

document.getElementById("redirect-to").addEventListener("click", () => switch_status("redirect_to_tw"));
document.getElementById("zh-tw").addEventListener("click", () => switch_status("zh_tw"));
document.getElementById("debug").addEventListener("click", () => switch_status("debug"));