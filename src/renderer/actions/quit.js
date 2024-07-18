import {remote} from "electron";
export default async function() {
    const confirmation = await remote.dialog.showMessageBox(remote.BrowserWindow.getFocusedWindow(), {
        type: "question",
        title: "확실합니까?",
        message: "설치를 종료하시겠습니까?",
        noLink: true,
        cancelId: 1,
        buttons: ["종료", "취소"]
    });

    if (confirmation.response === 0) {
        remote.app.exit();
    }
}
