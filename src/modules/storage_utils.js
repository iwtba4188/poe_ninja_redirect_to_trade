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
};

export { get_status, set_status };