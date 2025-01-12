var iframe = document.getElementById('draioiframe')
iframe.setAttribute('frameborder', '0');

var close = async function () {
    window.removeEventListener('message', receive);
    await syscall("editor.hidePanel", "modal");
};

var receive = async function (evt) {
    if (evt.data.length < 1) return;
    var msg = JSON.parse(evt.data);

    // If configure=1 URL parameter is used the application
    // waits for this message. For configuration options see
    // https://desk.draw.io/support/solutions/articles/16000058316
    if (msg.event == 'configure') {
        // Configuration example
        iframe.contentWindow.postMessage(JSON.stringify({
            action: 'configure',
            config: { defaultFonts: ["Humor Sans", "Helvetica", "Times New Roman"] }
        }), '*');
    }
    else if (msg.event == 'init') {
        // Avoids unescaped < and > from innerHTML for valid XML
        const filename = iframe.getAttribute('drawio-path');
        const index = filename.lastIndexOf('.');
        const ext = index !== -1 ? filename.slice(index + 1) : '';
        const dataDiv = document.getElementById('drawiodata');
        let data = "";
        if (ext == 'svg') {
            const svgele = dataDiv.getElementsByTagName('svg')[0];
            data = new XMLSerializer().serializeToString(svgele);
        }
        else {
            data = dataDiv;
        }
        iframe.contentWindow.postMessage(JSON.stringify({
            action: 'load',
            autosave: 1,
            xml: data
        }), '*');

    }
    else if (msg.event == 'export') {
        // Extracts SVG DOM from data URI to enable links
        const svg = atob(msg.data.substring(msg.data.indexOf(',') + 1));
        const svge = new TextEncoder().encode(svg)
        diagramPath = iframe.getAttribute('drawio-path');
        await syscall("space.writeFile", diagramPath, svge);
        await syscall("editor.reloadPage"); //not working
        close();
    }
    else if (msg.event == 'autosave') {
    }
    else if (msg.event == 'save') {
        // Call export
        iframe.contentWindow.postMessage(JSON.stringify({
            action: 'export',
            format: 'xmlsvg', xml: msg.xml, spin: 'Updating page'
        }), '*');
    }
    else if (msg.event == 'exit') {
        close();
    }

};

window.addEventListener('message', receive);