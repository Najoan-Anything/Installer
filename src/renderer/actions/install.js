import {progress, status} from "../stores/installation";
import {remote, shell} from "electron";
import {promises as fs} from "fs";
import path from "path";
import phin from "phin";

import {log, lognewline} from "./utils/log";
import succeed from "./utils/succeed";
import fail from "./utils/fail";
import exists from "./utils/exists";
import reset from "./utils/reset";
import kill from "./utils/kill";
import {showRestartNotice} from "./utils/notices";
import doSanityCheck from "./utils/sanity";

const MAKE_DIR_PROGRESS = 30;
const DOWNLOAD_PACKAGE_PROGRESS = 60;
const INJECT_SHIM_PROGRESS = 90;
const RESTART_DISCORD_PROGRESS = 100;

const RELEASE_API = "https://api.github.com/repos/BetterDiscord/BetterDiscord/releases";

const bdFolder = path.join(remote.app.getPath("appData"), "BetterDiscord");
const bdDataFolder = path.join(bdFolder, "data");
const bdPluginsFolder = path.join(bdFolder, "plugins");
const bdThemesFolder = path.join(bdFolder, "themes");


async function makeDirectories(...folders) {
    const progressPerLoop = (MAKE_DIR_PROGRESS - progress.value) / folders.length;
    for (const folder of folders) {
        if (await exists(folder)) {
            log(`✅ 디렉토리가 존재합니다: ${folder}`);
            progress.set(progress.value + progressPerLoop);
            continue;
        }
        try {
            await fs.mkdir(folder);
            progress.set(progress.value + progressPerLoop);
            log(`✅ 디렉토리가 생성되었습니다: ${folder}`);
        }
        catch (err) {
            log(`❌ 디렉토리를 생성하지 못했습니다: ${folder}`);
            log(`❌ ${err.message}`);
            return err;
        }
    }
}

const getJSON = phin.defaults({method: "GET", parse: "json", followRedirects: true, headers: {"User-Agent": "BetterDiscord/Installer"}});
const downloadFile = phin.defaults({method: "GET", followRedirects: true, headers: {"User-Agent": "BetterDiscord/Installer", "Accept": "application/octet-stream"}});
async function downloadAsar() {
    try {
        const response = await downloadFile("https://betterdiscord.app/Download/betterdiscord.asar")
        const bdVersion = response.headers["x-bd-version"];
        if (200 <= response.statusCode && response.statusCode < 300) {
            log(`✅ 공식 웹사이트에서 BetterDiscord 버전 ${bdVersion} 을(를) 다운로드했습니다`);
            return response.body;
        }
        throw new Error(`상태 코드가 성공을 나타내지 않았습니다: ${response.statusCode}`);
    }
    catch (error) {
        log(`❌ 공식 웹사이트에서 패키지를 다운로드하지 못했습니다.`);
        log(`❌ ${error.message}`);
        log(`Github로 되돌아갑니다...`);
    }
    let assetUrl;
    let bdVersion;
    try {
        const response = await getJSON(RELEASE_API);
        const releases = response.body;
        const asset = releases && releases.length && releases[0].assets && releases[0].assets.find(a => a.name.toLowerCase() === "betterdiscord.asar");
        assetUrl = asset && asset.url;
        bdVersion = asset && releases[0].tag_name;
        if (!assetUrl) {
            let errMessage = "asset url을 얻을 수 없습니다";
            if (!asset) errMessage = "asset object를 얻을 수 없습니다";
            if (!releases) errMessage = "response body를 얻을 수 없습니다";
            if (!response) errMessage = "어떤 응답도 얻을 수 없습니다";
            throw new Error(errMessage);
        }
    }
    catch (error) {
        log(`❌ ${RELEASE_API}에서 asset URL을 가져오지 못했습니다`);
        log(`❌ ${error.message}`);
        throw error;
    }
    try {
        const response = await downloadFile(assetUrl);
        if (200 <= response.statusCode && response.statusCode < 300) {
            log(`✅ Github에서 BetterDiscord 버전 ${bdVersion} 을(를) 다운로드했습니다`);
            return response.body;
        }
        throw new Error(`상태 코드가 성공을 나타내지 않았습니다: ${response.statusCode}`);
    }
    catch (error) {
        log(`❌ ${assetUrl}에서 다운로드에 실패했습니다`);
        log(`❌ ${error.message}`);
        throw error;
    }
}

const asarPath = path.join(bdDataFolder, "betterdiscord.asar");
async function installAsar(fileContent) {
    try {
        const originalFs = require("original-fs").promises; // because electron doesn't like writing asar files
        await originalFs.writeFile(asarPath, fileContent);
    }
    catch (error) {
        log(`❌ 패키지를 디스크에 쓰지 못했습니다: ${asarPath}`);
        log(`❌ ${error.message}`);
        throw error;
    }
}

async function downloadAndInstallAsar() {
    try {
        const fileContent = await downloadAsar();
        await installAsar(fileContent);
    } 
    catch (error) {
        return error;
    }
}

async function injectShims(paths) {
    const progressPerLoop = (INJECT_SHIM_PROGRESS - progress.value) / paths.length;
    for (const discordPath of paths) {
        log("주입(Inject) 대상: " + discordPath);
        try {
            await fs.writeFile(path.join(discordPath, "index.js"), `require("${asarPath.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}");\nmodule.exports = require("./core.asar");`);
            log("✅ 주입(Injection) 성공");
            progress.set(progress.value + progressPerLoop);
        }
        catch (err) {
            log(`❌ ${discordPath}에 심(shims)을 주입할 수 없습니다`);
            log(`❌ ${err.message}`);
            return err;
        }
    }
}


export default async function(config) {
    await reset();
    const sane = doSanityCheck(config);
    if (!sane) return fail();


    const channels = Object.keys(config);
    const paths = Object.values(config);


    lognewline("필요한 디렉토리를 생성 중...");
    const makeDirErr = await makeDirectories(bdFolder, bdDataFolder, bdThemesFolder, bdPluginsFolder);
    if (makeDirErr) return fail();
    log("✅ 디렉토리가 생성되었습니다");
    progress.set(MAKE_DIR_PROGRESS);
    

    lognewline("asar 파일 다운로드 중");
    const downloadErr = await downloadAndInstallAsar();
    if (downloadErr) return fail();
    log("✅ 패키지가 다운로드되었습니다");
    progress.set(DOWNLOAD_PACKAGE_PROGRESS);


    lognewline("심(Shims) 주입(Inject) 중...");
    const injectErr = await injectShims(paths);
    if (injectErr) return fail();
    log("✅ 심(Shims)이 주입(Inject) 되었습니다");
    progress.set(INJECT_SHIM_PROGRESS);


    lognewline("Discord 재시작 하는 중...");
    const killErr = await kill(channels, (RESTART_DISCORD_PROGRESS - progress.value) / channels.length);
    if (killErr) showRestartNotice(); // No need to bail out and show failed
    else log("✅ Discord가 재시작 되었습니다");
    progress.set(RESTART_DISCORD_PROGRESS);


    //succeed();
    setTimeout(() => remote.app.exit(), 2000);
};
