const iframe = document.getElementById("drawioiframe");
iframe?.setAttribute("frameborder", "0");

// --- Helpers ---
const syscaller = (typeof silverbullet !== "undefined" ? silverbullet.syscall : syscall);
// export const syscaller = syscall;

function base64ToPng(base64String) {
    const raw = base64String.split(",")[1] ?? "";
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    return new Blob([bytes], { type: "image/png" });
}

function base64ToSvg(base64String) {
    const raw = base64String.substring(base64String.indexOf(",") + 1);
    const text = atob(raw);
    return new TextEncoder().encode(text);
}

async function close() {
    window.removeEventListener("message", receive);
    await syscaller("editor.hidePanel", "modal");
}

async function convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsDataURL(blob);
    });
}
try {
    globalThis.silverbullet.addEventListener("file-open", (event) => {
        // console.log("silvebullet file-open", event.detail.data);
        // unused as file is read in 'init' 
    });
    globalThis.silverbullet.addEventListener("file-update", (event) => {
        // console.log("silvebullet file-update", event.detail.data);
        // post a message to init again
    });
    globalThis.silverbullet.addEventListener("request-save", (event) => {
        console.log("silvebullet request-save", event);
        silverbullet.sendMessage("file-saved", { data: window.diagramData });
    });
} catch (e) {
}
// --- Message handler ---
async function receive(evt) {
    if (!evt.data) return;

    let msg;
    try {
        msg = JSON.parse(evt.data);
    } catch {
        return; // ignore invalid JSON
    }

    const filename = iframe.getAttribute('drawio-path');
    const index = filename.lastIndexOf('.');
    const ext = index !== -1 ? filename.slice(index + 1) : '';

    switch (msg.event) {
        case "configure":
            iframe?.contentWindow?.postMessage(
                JSON.stringify({
                    action: "configure",
                    config: { defaultFonts: ["Humor Sans", "Helvetica", "Times New Roman"] },
                }),
                "*"
            );
            break;

        case "init": {
            let data = "";
            if (ext === "svg") {
                const filedata = await syscaller("space.readFile", filename);
                data = new TextDecoder().decode(filedata);
            } else if (ext === 'drawio') {
                const filedata = await syscaller("space.readFile", filename);
                data = filedata;
                // data = new TextDecoder().decode(filedata);
            } else if (ext === 'png') {
                const filedata = await syscaller("space.readFile", filename);
                data = await convertBlobToBase64(filedata);
            }
            iframe?.contentWindow?.postMessage(
                JSON.stringify({ action: "load", autosave: 1, xml: data }),
                "*"
            );
            break;
        }

        case "export": {
            console.log(`Exporting ${ext}`);
            let data;
            switch (ext) {
                case "svg":
                    data = base64ToSvg(msg.data);
                    break;
                case "png":
                    data = base64ToPng(msg.data);
                    break;
                default:
                    data = msg.xml; // This can be undefined
            }
            await syscaller("space.writeFile", filename, data);
            // syscaller("sync.performSpaceSync").then(() => {
            //     syscaller("editor.reloadUI");
            // })
            // await syscaller("editor.flashNotification", "Refresh page to view changes!");
            break;
        }

        case "autosave":
        case "save":
            if (ext === 'drawio') {
                // await syscaller("space.writeFile", filename, msg.xml);
                window.diagramData = msg.xml;
                globalThis.silverbullet.sendMessage("file-changed", { data: msg.xml });

            }
            else {
                iframe?.contentWindow?.postMessage(
                    JSON.stringify({
                        action: "export",
                        format: ext === "png" ? "xmlpng" : "xmlsvg",
                        xml: msg.xml, // mxfile
                        spin: "Updating page",
                    }),
                    "*"
                );
            }
            break;

        case "exit":
            close();
            syscaller("sync.performSpaceSync").then(() => {
                syscaller("editor.reloadUI");
            })
            await syscaller("editor.flashNotification", "Refresh page to view changes!");
            break;

        default:
            break;
    }
}

window.addEventListener("message", receive);

