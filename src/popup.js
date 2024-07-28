async function get_status(slot) {
    var val = (await chrome.storage.local.get([slot]))[slot];

    if (!val && slot === "redirect-to") {
        chrome.storage.local.set({ [slot]: "com" });
        return "com";
    } else if (!val && slot === "lang") {
        chrome.storage.local.set({ [slot]: "en" });
        return "en";
    } else if (!val && slot === "debug") {
        chrome.storage.local.set({ [slot]: "off" });
        return "off";
    }

    return val;
};

async function set_status(slot, value) {
    chrome.storage.local.set({ [slot]: value });

    // refresh current focus ninja page
    chrome.tabs.query({ active: true, currentWindow: true, url: "*://*.poe.ninja/builds/*" }, function (tabs) {
        if (tabs.length > 0) chrome.tabs.update(tabs[0].id, { url: tabs[0].url });
    });
};

async function on_change_event() {
    if (await get_status("redirect-to") !== document.getElementById("redirect-to").value) {
        set_status("redirect-to", document.getElementById("redirect-to").value);
    }
    if (await get_status("lang") !== document.getElementById("lang").value) {
        set_status("lang", document.getElementById("lang").value);
    }
    if (await get_status("debug") !== document.getElementById("debug").value) {
        set_status("debug", document.getElementById("debug").value);
    }

    refresh_html();
};

async function refresh_html() {
    document.getElementById("redirect-to").value = await get_status("redirect-to");
    document.getElementById("lang").value = await get_status("lang");
    document.getElementById("debug").value = await get_status("debug");
};

function init() {
    var i18n_nodes = document.getElementsByClassName("i18n");
    for (var i18n_node of i18n_nodes) {
        var msg_name = i18n_node.innerText.replace(/__MSG_(?<name>\w+)__/, /$<name>/).replaceAll("/", "");
        i18n_node.innerText = chrome.i18n.getMessage(msg_name);
    }

    refresh_html();

    var css_node = document.createElement("link");
    css_node.href = "./modules/bootstrap.min.css";
    css_node.rel = "stylesheet";
    document.head.appendChild(css_node);

    var js_node = document.createElement("script");
    js_node.src = "./modules/bootstrap.bundle.min.js";
    document.body.appendChild(js_node);
};

// chrome.storage.local.clear();
init();

document.getElementById("redirect-to").addEventListener("change", on_change_event);
document.getElementById("lang").addEventListener("change", on_change_event);
document.getElementById("debug").addEventListener("change", on_change_event);