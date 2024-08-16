import * as bootstrap from "./modules/bootstrap.bundle.min.js";

/**
 * init key value if needed
 * @returns {None}
 */
async function init_status() {
    var val = (await chrome.storage.local.get());
    for (var slot of ["redirect-to", "lang", "mods-file-mode", "debug"]) {
        if (!(slot in val)) {
            if (slot === "redirect-to") chrome.storage.local.set({ [slot]: "com" });
            else if (slot === "lang") chrome.storage.local.set({ [slot]: "en" });
            else if (slot === "mods-file-mode") chrome.storage.local.set({ [slot]: "build-in" });
            else if (slot === "debug") chrome.storage.local.set({ [slot]: "off" });
        }
    }
};

/**
 * 用 key 取得 chrome.storage.local 的 value
 * @param {string} slot 要取得的 key
 * @returns {string} 用 key 取得的 value 
 */
async function get_status(slot) {
    var val = (await chrome.storage.local.get([slot]))[slot];

    return val;
};

/**
 * 設定 chrome.storage.local 的 key: value pair
 * @param {string} slot 要設定的 key
 * @param {string} value 要設定的 value
 */
async function set_status(slot, value) {
    chrome.storage.local.set({ [slot]: value });

    if (slot === "mods-file-mode" && value === "build-in") {
        set_status("stats-data-sha", undefined);
        set_status("gems-data-sha", undefined);
        set_status("tw-gems-data-sha", undefined);
    }

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
    if (await get_status("mods-file-mode") !== document.getElementById("mods-file-mode").value) {
        set_status("mods-file-mode", document.getElementById("mods-file-mode").value);
    }
    if (await get_status("debug") !== document.getElementById("debug").value) {
        set_status("debug", document.getElementById("debug").value);
    }

    update_select_elements();
};

function init_chrome_i18n() {
    var i18n_nodes = document.getElementsByClassName("i18n");
    for (var i18n_node of i18n_nodes) {
        if (i18n_node.title) {    // a tags
            msg_name = i18n_node.title.replace(/__MSG_(?<name>\w+)__/, /$<name>/).replaceAll("/", "");
            i18n_node.title = chrome.i18n.getMessage(msg_name);
        }
        else {    // other tags
            var msg_name = i18n_node.innerText.replace(/__MSG_(?<name>\w+)__/, /$<name>/).replaceAll("/", "");
            i18n_node.innerText = chrome.i18n.getMessage(msg_name);
        }
    }
};

async function update_select_elements() {
    document.getElementById("redirect-to").value = await get_status("redirect-to");
    document.getElementById("lang").value = await get_status("lang");
    document.getElementById("mods-file-mode").value = await get_status("mods-file-mode");
    document.getElementById("debug").value = await get_status("debug");
};

function init_bs5_tooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new window.bootstrap.Tooltip(tooltipTriggerEl));
};

function init() {
    init_status();

    init_chrome_i18n();

    update_select_elements();

    // init bootstrap 5 css and js
    var css_node = document.createElement("link");
    css_node.href = "./modules/bootstrap.min.css";
    css_node.rel = "stylesheet";
    document.head.appendChild(css_node);

    var js_node = document.createElement("script");
    js_node.src = "./modules/bootstrap.bundle.min.js";
    document.body.appendChild(js_node);

    init_bs5_tooltips();

    // init version
    document.getElementById("version").innerText = "v" + chrome.runtime.getManifest().version;
};

// chrome.storage.local.clear();
init();

document.getElementById("redirect-to").addEventListener("change", on_change_event);
document.getElementById("lang").addEventListener("change", on_change_event);
document.getElementById("mods-file-mode").addEventListener("change", on_change_event);
document.getElementById("debug").addEventListener("change", on_change_event);