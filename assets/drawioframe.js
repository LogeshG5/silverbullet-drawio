var iframe = document.getElementById('draioiframe')
iframe.setAttribute('frameborder', '0');

function base64ToPng(base64String) {
    base64String = base64String.split(',')[1]
    const arr = Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
    const blob = new Blob([arr], { type: 'image/png' });
    return blob;
}

function base64ToSvg(base64String) {
    base64String = base64String.substring(base64String.indexOf(',') + 1)
    const text = atob(base64String);
    svg = new TextEncoder().encode(text)
    return svg;
}

var close = async function () {
    window.removeEventListener('message', receive);
    await syscall("editor.hidePanel", "modal");
};

var receive = async function (evt) {
    if (evt.data.length < 1) return;
    var msg = JSON.parse(evt.data);

    const filename = iframe.getAttribute('drawio-path');
    const index = filename.lastIndexOf('.');
    const ext = index !== -1 ? filename.slice(index + 1) : '';

    // If configure=1 URL parameter is used the application
    // waits for this message. For configuration options see
    // https://desk.draw.io/support/solutions/articles/16000058316
    if (msg.event == 'configure') {
        iframe.contentWindow.postMessage(JSON.stringify({
            action: 'configure',
            config: { defaultFonts: ["Humor Sans", "Helvetica", "Times New Roman"] }
        }), '*');
    }
    else if (msg.event == 'init') {
        const dataDiv = document.getElementById('drawiodata');
        let data = "";
        if (ext == 'svg') {
            const svgele = dataDiv.getElementsByTagName('svg')[0];
            data = new XMLSerializer().serializeToString(svgele);
        }
        else {
            data = dataDiv.innerHTML;
        }
        iframe.contentWindow.postMessage(JSON.stringify({
            action: 'load',
            autosave: 1,
            xml: data
        }), '*');

    }
    else if (msg.event == 'export') {
        const diagramPath = iframe.getAttribute('drawio-path');
        let data = '';
        if (ext == 'svg') {
            data = base64ToSvg(msg.data);
        }
        else {
            data = base64ToPng(msg.data);
        }
        await syscall("space.writeFile", diagramPath, data);
        // ISSUE: reloadPage does not work before or after close
        await syscall("editor.reloadPage");
        await syscall("editor.flashNotification", "Refresh page to view changes!");
        close();
    }
    else if (msg.event == 'autosave') {
    }
    else if (msg.event == 'save') {
        // Call export
        iframe.contentWindow.postMessage(JSON.stringify({
            action: 'export',
            format: ext == 'png' ? 'xmlpng' : 'xmlsvg',
            xml: msg.xml,
            spin: 'Updating page'
        }), '*');
    }
    else if (msg.event == 'exit') {
        close();
    }

};

window.addEventListener('message', receive);