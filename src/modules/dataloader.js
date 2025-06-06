import { get_status, set_status } from "./storage_utils.js";

class LocalDataLoader {
    static STATS_DATA_PATH = "./data/awakened poe trade/en_stats.min.json";
    static GEMS_DATA_PATH = "./data/com_preprocessed_gems_data.json";
    static TW_GEMS_DATA_PATH = "./data/tw_preprocessed_gems_data.json";
    static QUERY_PATH = "./data/query.json";
    static GEMS_QUERY_PATH = "./data/query_gems.json";

    async _fetch_json(path) {
        let res = false;

        await fetch(path).then((response) => response.json()).then((json) => res = json);

        return res;
    }

    async _can_fetch_again() {
        var data = await get_status("local_query_data");
        if (data === undefined || data === null) {
            // 如果 local_stats_data 不存在，則表示可以重新載入
            return true;
        }
        return false;
    }

    async get_data(data_name) {
        console.log("get local data: " + data_name);

        var data = await get_status(data_name);
        if (data === undefined || data === null)
            throw new Error(data_name + " is not available for `data_name`.");
        return data;
    }

    async update_data() {
        if (await this._can_fetch_again()) {
            console.log("Updating local data...");

            var local_stats_data;
            var local_gems_data;
            var local_tw_gems_data;
            var local_query_data;
            var local_gems_query_data;

            await fetch(LocalDataLoader.STATS_DATA_PATH)
                .then((response) => response.json())
                .then((json) => local_stats_data = json);
            await fetch(LocalDataLoader.GEMS_DATA_PATH)
                .then((response) => response.json())
                .then((json) => local_gems_data = json);
            await fetch(LocalDataLoader.TW_GEMS_DATA_PATH)
                .then((response) => response.json())
                .then((json) => local_tw_gems_data = json);
            await fetch(LocalDataLoader.QUERY_PATH)
                .then((response) => response.json())
                .then((json) => local_query_data = json);
            await fetch(LocalDataLoader.GEMS_QUERY_PATH)
                .then((response) => response.json())
                .then((json) => local_gems_query_data = json);

            set_status("local_stats_data", local_stats_data);
            set_status("local_gems_data", local_gems_data);
            set_status("local_tw_gems_data", local_tw_gems_data);
            set_status("local_query_data", local_query_data);
            set_status("local_gems_query_data", local_gems_query_data);

            console.log("Local data updated successfully.");
        }
    }
}

class OnlineDataLoader {
    static FETCH_ONLINE_URL_INTERVAL = 5 * 60 * 1000;    // ms, 5 min * 60 sec/min * 1000 ms/sec

    static ONLINE_STATS_DATA_VER_CHECK_URL = "https://api.github.com/repos/iwtba4188/poe_ninja_redirect_to_trade/contents/src/data/awakened%20poe%20trade/en_stats.json";
    static ONLINE_GEMS_DATA_VER_CHECK_URL = "https://api.github.com/repos/iwtba4188/poe_ninja_redirect_to_trade/contents/src/data/com_preprocessed_gems_data.json";
    static ONLINE_TW_GEMS_DATA_VER_CHECK_URL = "https://api.github.com/repos/iwtba4188/poe_ninja_redirect_to_trade/contents/src/data/tw_preprocessed_gems_data.json";

    static STATS_DATA_URL = "https://raw.githubusercontent.com/iwtba4188/poe_ninja_redirect_to_trade/main/src/data/awakened%20poe%20trade/en_stats.min.json";
    static GEMS_DATA_URL = "https://raw.githubusercontent.com/iwtba4188/poe_ninja_redirect_to_trade/main/src/data/com_preprocessed_gems_data.json";
    static TW_GEMS_DATA_URL = "https://raw.githubusercontent.com/iwtba4188/poe_ninja_redirect_to_trade/main/src/data/tw_preprocessed_gems_data.json";

    /**
     * 每經過 FETCH_ONLINE_URL_INTERVAL 才能再次確認 GitHub 狀態，避免 429 Too Many Requests
     * @returns {Boolean} 是否可以再次傳送請求了
     */
    async _can_fetch_again() {
        var now_time = Date.now();
        var last_fetch_time = await get_status("last-fetch-time");

        if (!last_fetch_time || ((now_time - Number(last_fetch_time)) >= OnlineDataLoader.FETCH_ONLINE_URL_INTERVAL)) {
            await set_status("last-fetch-time", now_time);
            return true;
        }

        return false;
    }

    /**
     * 確認上次 fet`ch 的 online 詞綴表的 sha 和 online 的是否一致
     * @returns {Boolean} 線上詞綴表是否有更新
     */
    async _has_newer_data_version() {
        var local_stats_data_sha = await get_status("stats-data-sha");
        var local_gems_data_sha = await get_status("gems-data-sha");
        var local_tw_gems_data_sha = await get_status("tw-gems-data-sha");

        var github_stats_data_sha = (await this._fetch_json(OnlineDataLoader.ONLINE_STATS_DATA_VER_CHECK_URL)).sha;
        var github_gems_data_sha = (await this._fetch_json(OnlineDataLoader.ONLINE_GEMS_DATA_VER_CHECK_URL)).sha;
        var github_tw_gems_data_sha = (await this._fetch_json(OnlineDataLoader.ONLINE_TW_GEMS_DATA_VER_CHECK_URL)).sha;

        var local_shas = [local_stats_data_sha, local_gems_data_sha, local_tw_gems_data_sha];
        var github_shas = [github_stats_data_sha, github_gems_data_sha, github_tw_gems_data_sha];
        var slot_keys = ["stats-data-sha", "gems-data-sha", "tw-gems-data-sha"];

        var flag = false;
        for (var i = 0; i < 3; i++) {
            if (!local_shas[i] || local_shas[i] !== github_shas[i]) {
                flag = true;
                await set_status(slot_keys[i], github_shas[i]);
            }
        }

        return flag;
    };

    /**
     * 使用 fecth 方法取得該網頁的資料
     * @param {string} target_uri 目標網頁或 local file
     * @returns {string} @param target_uri 轉換為 JSON 的結果
     */
    async _fetch_json(target_uri) {
        var res;

        await fetch(target_uri).then(
            function (response) {
                if (response.status === 200 || /^./.test(target_uri))
                    return response.json();
                else
                    throw new Error("Request failed: " + response.status);
            }
        ).then(function (data) {
            res = data;
            // console.log(res);
        }).catch(function (error) {
            console.error(error);
        });

        return res;
    }

    async get_data(data_name) {
        console.log("get online data: " + data_name);

        var data = await get_status(data_name);
        if (data === undefined || data === null)
            throw new Error(data_name + " is not available for `data_name`.");
        return data;
    }

    /**
     * 更新線上詞綴表的資料
     * @returns {None}
     */
    async update_data() {
        if (await this._can_fetch_again() && await this._has_newer_data_version()) {
            console.log("Updating online data...");
            var online_stats_data;
            var online_gems_data;
            var online_tw_gems_data;

            await fetch(OnlineDataLoader.STATS_DATA_URL)
                .then((response) => response.json())
                .then((json) => online_stats_data = json);
            await fetch(OnlineDataLoader.GEMS_DATA_URL)
                .then((response) => response.json())
                .then((json) => online_gems_data = json);
            await fetch(OnlineDataLoader.TW_GEMS_DATA_URL)
                .then((response) => response.json())
                .then((json) => online_tw_gems_data = json);

            set_status("online_stats_data", online_stats_data);
            set_status("online_gems_data", online_gems_data);
            set_status("online_tw_gems_data", online_tw_gems_data);

            console.log("Online data updated successfully.");
        }
    }

}

export { LocalDataLoader, OnlineDataLoader };