async function switch_debug_mode() {
    var is_debug = (await chrome.storage.local.get(["debug"]))["debug"];
    console.log(is_debug);

    if (is_debug) chrome.storage.local.set({ "debug": false });
    else chrome.storage.local.set({ "debug": true });

    refresh_mode();
};

async function switch_zh_tw_mode() {
    var is_zh_tw = (await chrome.storage.local.get(["zh_tw"]))["zh_tw"];
    console.log(is_zh_tw);

    if (is_zh_tw) chrome.storage.local.set({ "zh_tw": false });
    else chrome.storage.local.set({ "zh_tw": true });

    refresh_mode();
};

async function refresh_mode() {
    var is_debug = (await chrome.storage.local.get(["debug"]))["debug"];
    console.log(is_debug);

    if (is_debug) document.getElementById("debug").innerText = "Debug Mode is ON.";
    else document.getElementById("debug").innerText = "Debug Mode is OFF.";

    var is_zh_tw = (await chrome.storage.local.get(["zh_tw"]))["zh_tw"];
    console.log(is_zh_tw);

    if (is_zh_tw) document.getElementById("zh-tw").innerText = "詞墜中文化目前為 開啟";
    else document.getElementById("zh-tw").innerText = "詞墜中文化目前為 關閉";
};

refresh_mode();
document.getElementById("debug").addEventListener("click", switch_debug_mode);
document.getElementById("zh-tw").addEventListener("click", switch_zh_tw_mode);