// import * as bootstrap from "./modules/bootstrap.bundle.min.js";
import { get_status, set_status } from "./modules/storage_utils.js";

let setting_ids = ["redirect-to", "lang", "mods-file-mode", "trade-type", "debug"];

function refresh_page() {
    // refresh current focus ninja page
    chrome.tabs.query({ active: true, currentWindow: true, url: "*://*.poe.ninja/*/builds/*" }, function (tabs) {
        if (tabs.length > 0) chrome.tabs.update(tabs[0].id, { url: tabs[0].url });
    });
}

async function on_change_event() {
    for (var id of setting_ids) {
        if (await get_status(id) !== document.getElementById(id).value) {
            await set_status(id, document.getElementById(id).value);
            refresh_page();
        }
    }

    update_select_elements();
};

function init_chrome_i18n() {
    var i18n_nodes = document.getElementsByClassName("i18n");
    console.log("i18n nodes:", i18n_nodes);
    for (var i18n_node of i18n_nodes) {
        var msg_name;
        if (i18n_node.title) {    // a tags
            msg_name = i18n_node.title.replace(/__MSG_(\w+)__/, "$1").replaceAll("/", "").trim();
            i18n_node.title = chrome.i18n.getMessage(msg_name);
        } else {
            // other tags
            msg_name = i18n_node.innerText.replace(/__MSG_(\w+)__/, "$1").replaceAll("/", "").trim();
            i18n_node.innerText = chrome.i18n.getMessage(msg_name);
        }
        console.log("i18n node:", i18n_node, "msg_name:", msg_name, "msg:", chrome.i18n.getMessage(msg_name));
    }
};

async function update_select_elements() {
    const statuses = await chrome.storage.local.get(setting_ids);

    document.getElementById("redirect-to").value = statuses["redirect-to"] || "com";
    document.getElementById("lang").value = statuses["lang"] || "en";
    document.getElementById("mods-file-mode").value = statuses["mods-file-mode"] || "build-in";
    document.getElementById("trade-type").value = statuses["trade-type"] || "available";
    document.getElementById("debug").value = statuses["debug"] || "off";
};

function init_bs5_tooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new window.bootstrap.Tooltip(tooltipTriggerEl));
};

async function init() {
    // init version
    document.getElementById("version").innerText = chrome.i18n.getMessage("version_label") + " v" + chrome.runtime.getManifest().version;
    document.getElementById("whats-new-link").setAttribute("href", "https://github.com/iwtba4188/poe_ninja_redirect_to_trade/releases/tag/v" + chrome.runtime.getManifest().version);

    init_chrome_i18n();

    await update_select_elements();

    init_bs5_tooltips();
};

// chrome.storage.local.clear();
await init();

for (var id of setting_ids) {
    document.getElementById(id).addEventListener("change", on_change_event);
}