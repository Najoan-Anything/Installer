import path from "path";
import findProcess from "find-process";
import kill from "tree-kill";
import {shell} from "electron";
import {progress} from "../../stores/installation";
import {log} from "./log";

const platforms = {stable: "Discord", ptb: "Discord PTB", canary: "Discord Canary"};
export default async function killProcesses(channels, progressPerLoop, shouldRestart = true) {
    for (const channel of channels) {
        let processName = platforms[channel];
        if (process.platform === "darwin") processName = platforms[channel]; // Discord Canary and Discord PTB on Mac
        else processName = platforms[channel].replace(" ", ""); // DiscordCanary and DiscordPTB on Windows/Linux

        log(processName + " 종료 시도 중");
        try {
            const results = await findProcess("name", processName, true);
            if (!results || !results.length) {
                log(`✅ ${processName} 이(가) 실행 중이지 않습니다`);
                progress.set(progress.value + progressPerLoop);
                continue;
            }

            const parentPids = results.map(p => p.ppid);
            const discordPid = results.find(p => parentPids.includes(p.pid));
            const bin = process.platform === "darwin" ? path.resolve(discordPid.bin, "..", "..", "..") : discordPid.bin;
            await new Promise(r => kill(discordPid.pid, r));
            if (shouldRestart) setTimeout(() => shell.openPath(bin), 1000);
            progress.set(progress.value + progressPerLoop);
        }
        catch (err) {
            const symbol = shouldRestart ? "⚠️" : "❌";
            log(`${symbol} ${platforms[channel]}을(를) 종료할 수 없습니다`);
            log(`${symbol} ${err.message}`);
            return err;
        }
    }
}
