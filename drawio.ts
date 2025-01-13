import {
  asset,
  editor,
  shell,
  system,
  space,
} from "@silverbulletmd/silverbullet/syscalls";
import { readSetting } from "$sb/lib/settings_page.ts";
import { Base64 } from "js-base64";

function getFileExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index !== -1 ? filename.slice(index + 1) : "";
}

function getDiagrams(text: string) {
  const regex = /\((.*?)\)/g;
  let matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const ext = getFileExtension(match[1]);
    if (ext == "svg" || ext == "png") {
      matches.push(match[1]);
    }
  }
  return matches;
}

async function getEditorUrl(): Promise<string> {
  const userConfig = await readSetting("drawio");
  let editorUrl = "";
  if (userConfig && userConfig.editorUrl) {
    editorUrl = userConfig.editorUrl;
  } else {
    editorUrl =
      "https://embed.diagrams.net/?embed=1&spin=1&proto=json&configure=1";
  }
  return editorUrl;
}

async function getXmlData(diagramPath: string): Promise<string> {
  let diagramData = await space.readAttachment(diagramPath);
  const ext = getFileExtension(diagramPath);
  if (ext == "svg") {
    diagramData = String.fromCharCode.apply(null, diagramData);
  } else if (ext == "png") {
    diagramData = "data:image/png;base64," + Base64.fromUint8Array(diagramData);
  }
  return diagramData;
}

async function drawIoEdit(diagramPath: string) {
  const drawioframe = await asset.readAsset("drawio", "assets/drawioframe.js");
  const editorUrl = await getEditorUrl();
  const diagramData = await getXmlData(diagramPath);
  await editor.showPanel(
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
        <div id="drawiodata" hidden>${diagramData}</div>
        <iframe id="draioiframe" src=${editorUrl} drawio-path='${diagramPath}'></iframe>
      </div>
    `,
    `${drawioframe}`
  );
}

export async function editDrawioDiagram() {
  const pageName = await editor.getCurrentPage();
  const directory = pageName.substring(0, pageName.lastIndexOf("/"));
  const text = await editor.getText();
  let matches = getDiagrams(text);

  let diagramPath = "";
  if (matches.length == 0) {
    editor.flashNotification(
      "No png or svg diagrams attached to this page!",
      "error"
    );
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
      await editor.flashNotification("No diagram selected!", "error");
      return;
    }
    diagramPath = directory + "/" + selectedDiagram.name;
  }

  await drawIoEdit(diagramPath);
}

async function getSampleAsset(ext: string): Promise<Uint8Array> {
  let uint8data: Uint8Array = new Uint8Array([0]);
  const sampleStr = await asset.readAsset(
    "drawio",
    "assets/sample." + ext + ".base64"
  );
  if (ext == "png") {
    uint8data = Uint8Array.from(atob(sampleStr), (c) => c.charCodeAt(0));
  } else if (ext == "svg") {
    const svg = atob(sampleStr);
    uint8data = Uint8Array.from(svg, (c) => c.charCodeAt(0));
  }
  return uint8data;
}

async function createSampleFile(
  filePath: string,
  ext: string
): Promise<boolean> {
  // Ask before overwriting
  const fileExists = await space.fileExists(filePath);
  if (fileExists) {
    const overwrite = await editor.confirm(
      "File already exist! Do you want to overwrite?"
    );
    if (!overwrite) {
      return false;
    }
  }
  const uint8data = await getSampleAsset(ext);
  space.writeFile(filePath, uint8data);
  return true;
}

export async function createDrawioDiagram() {
  // extract selected text from editor
  const text = await editor.getText();
  const selection = await editor.getSelection();
  const from = selection.from;
  let selectedText = text.slice(from, selection.to);

  let diagramName = selectedText;
  if (diagramName.length == 0) {
    // nothing was selected, prompt user
    diagramName = await editor.prompt("Enter a diagram name: ", "sample.svg");
  }

  let ext = getFileExtension(diagramName);
  if (ext != "svg" && ext != "png") {
    // extension not provided, choose svg as default for better quality
    ext = "svg";
    diagramName = diagramName + "." + ext;
  }

  const pageName = await editor.getCurrentPage();
  const directory = pageName.substring(0, pageName.lastIndexOf("/"));
  const filePath = directory + "/" + diagramName;

  if (!(await createSampleFile(filePath, ext))) {
    // file not created
    return;
  }

  // insert link or overwrite link text in editor
  const link = `![${diagramName}](${diagramName})`;
  await editor.replaceRange(from, selection.to, link);

  // open file in editor
  await drawIoEdit(filePath);
}
