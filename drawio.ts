import {
  asset,
  editor,
  shell,
  system,
  space,
} from "@silverbulletmd/silverbullet/syscalls";
import { readSetting } from "$sb/lib/settings_page.ts";

function getFileExtension(filename) {
  const index = filename.lastIndexOf(".");
  return index !== -1 ? filename.slice(index + 1) : "";
}

function getDiagrams(text) {
  const regex = /\((.*?)\)/g;
  let matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const ext = getFileExtension(match[1]);
    if (ext == "svg") {
      matches.push(match[1]);
    }
  }
  return matches;
}

async function drawIoEdit(drawioeditor, diagramPath, diagramData) {
  const drawioframe = await asset.readAsset("drawio", "assets/drawioframe.js");
  editor.showPanel(
    "modal",
    1,
    `
      <style type="text/css">
        iframe {
          border: 0;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%
        }
      </style>
      <div>
        <div id="drawiodata">${diagramData}</div>
        <iframe id="draioiframe" src=${drawioeditor} drawio-path='${diagramPath}'></iframe>
      </div>
    `,

    `${drawioframe}`
  );
}

export async function edit() {
  const text = await editor.getText();
  const pageName = await editor.getCurrentPage();
  const directory = pageName.substring(0, pageName.lastIndexOf("/"));
  let matches = getDiagrams(text);

  let diagramPath = "";
  if (matches.length == 0) {
    editor.flashNotification("No diagrams found");
    return;
  }
  if (matches.length == 1) {
    diagramPath = directory + "/" + matches[0];
  } else {
    const options = matches.map((model) => ({
      name: model,
      description: "",
    }));
    const selectedDiagram = await editor.filterBox("Edit", options, "", "");
    if (!selectedDiagram) {
      await editor.flashNotification("No diagram selected.", "error");
      return;
    }
    diagramPath = directory + "/" + selectedDiagram.name;
  }
  const ext = getFileExtension(diagramPath);
  var diagramData = await space.readAttachment(diagramPath);
  diagramData = String.fromCharCode.apply(null, diagramData);

  const userConfig = await readSetting("drawio");
  let drawioeditor = "";
  if (userConfig && userConfig.editorUrl) {
    drawioeditor = userConfig.editorUrl;
  } else {
    drawioeditor =
      "https://embed.diagrams.net/?embed=1&spin=1&proto=json&configure=1";
  }
  await drawIoEdit(drawioeditor, diagramPath, diagramData);
}
