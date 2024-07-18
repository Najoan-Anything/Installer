import {log} from "./log";
import {action} from "../../stores/installation";

export default function doSanityCheck(config) {
    const paths = Object.values(config);
    if (paths && paths.length) {
        const name = action.value;
        log(`설치를 시작하는 중...`);
        return true;
    }

    log("❌ 내부적으로 문제가 발생했습니다.");
    return false;
}
