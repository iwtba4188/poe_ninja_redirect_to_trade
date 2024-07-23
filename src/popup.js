async function switch_debug_mode() {
    var is_debug = await chrome.storage.local.get(["debug"]);
    is_debug = is_debug["debug"];
    console.log(is_debug);

    if (is_debug) {
        chrome.storage.local.set({ "debug": false });
        document.getElementById("debug").innerText = "Debug Mode is OFF.";
    }
    else {
        chrome.storage.local.set({ "debug": true });
        document.getElementById("debug").innerText = "Debug Mode is ON.";
    }
};

async function refresh_mode() {
    var is_debug = await chrome.storage.local.get(["debug"]);
    is_debug = is_debug["debug"];
    console.log(is_debug);

    if (is_debug) {
        document.getElementById("debug").innerText = "Debug Mode is ON.";
    }
    else {
        document.getElementById("debug").innerText = "Debug Mode is OFF.";
    }
};

refresh_mode();
document.getElementById("debug").addEventListener("click", switch_debug_mode);