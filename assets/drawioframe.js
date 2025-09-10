const iframe = document.getElementById("drawioiframe");
iframe?.setAttribute("frameborder", "0");

function getExt(filename) {
    const index = filename.lastIndexOf('.');
    const ext = index !== -1 ? filename.slice(index + 1) : '';
    return ext;
}
const type = iframe.getAttribute('drawio-type');
let filename = iframe.getAttribute('drawio-path');
let ext = getExt(filename);

// --- Helpers ---
const syscaller = (typeof silverbullet !== "undefined" ? silverbullet.syscall : syscall);

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
    syscaller("sync.performSpaceSync").then(() => {
        syscaller("editor.reloadUI");
    })
    await syscaller("editor.flashNotification", "Refresh page to view changes!");
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

// --- SB Message handler ---
try {
    globalThis.silverbullet.addEventListener("file-open", async (event) => {
        filename = event.detail.meta.name;
        ext = getExt(filename);

        iframe?.contentWindow?.postMessage(
            JSON.stringify({ action: "load", autosave: 1, xml: event.detail.data }),
            "*"
        );
    });
    globalThis.silverbullet.addEventListener("file-update", async (event) => {
        filename = event.detail.meta.name;
        ext = getExt(filename);

        iframe?.contentWindow?.postMessage(
            JSON.stringify({ action: "load", autosave: 1, xml: event.detail.data }),
            "*"
        );
    });
    globalThis.silverbullet.addEventListener("request-save", (event) => {
        silverbullet.sendMessage("file-saved", { data: window.diagramData });
    });
} catch (e) {
}

async function getFile(ext, filename) {
    let data = "";
    try {
        data = await syscaller("space.readFile", filename);

        switch (ext) {
            case "svg":
                data = new TextDecoder().decode(data);
                break;

            case "drawio":
                if (data instanceof Uint8Array)
                    data = new TextDecoder().decode(data);
                break;

            case "png":
                data = await convertBlobToBase64(data);
                break;

            default:
                console.warn(`Unsupported extension: ${ext}`);
                return data;
        }
    } catch (err) {
        console.error(`Failed to load file ${filename}:`, err);
        return data;
    }

    return data;
}

function getExportData(ext, data) {
    switch (ext) {
        case "svg":
            data = base64ToSvg(data);
            break;
        case "png":
            data = base64ToPng(data);
            break;
    }
    return data;
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
            let data = await getFile(ext, filename);
            iframe?.contentWindow?.postMessage(
                JSON.stringify({ action: "load", autosave: 1, xml: data }),
                "*"
            );
            break;
        }

        case "export": {
            const data = getExportData(ext, msg.data);
            await syscaller("space.writeFile", filename, data);
            break;
        }

        case "autosave":
        case "save":
            if (ext === 'drawio') {
                if (type === 'widget') {
                    await syscaller("space.writeFile", filename, msg.xml);
                }
                else {
                    window.diagramData = msg.xml;
                    globalThis.silverbullet.sendMessage("file-changed", { data: msg.xml });
                }
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
            // Notify save is done
            iframe?.contentWindow?.postMessage(
                JSON.stringify({ action: "status", messageKey: "allChangesSaved", modified: false }),
                "*"
            );
            if (msg.exit) close();

            break;

        case "exit":
            close();
            break;

        default:
            break;
    }
}

window.addEventListener("message", receive);

