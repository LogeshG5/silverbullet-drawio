import {
  asset,
  editor,
  space,
  system
} from "@silverbulletmd/silverbullet/syscalls";
import { Base64 } from "npm:js-base64";

function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop() ?? "";
  return ext.toLowerCase();
}


function getDiagrams(text: string): string[] {
  const regex = /\(([^)]+)\)/g;

  // return attached diagrams ![xx](xx.svg)
  return Array.from(text.matchAll(regex))
    .map(match => match[1])
    .filter(file => {
      const ext = getFileExtension(file);
      return ext === "svg" || ext === "png";
    });
}


async function getEditorUrl(): Promise<string> {
  const userConfig = await system.getConfig("drawio", {});
  return userConfig?.editorUrl ?? "https://embed.diagrams.net/?embed=1&spin=1&proto=json&configure=1";
}


async function drawIoEdit(diagramPath: string): Promise<void> {
  const drawioFrameScript = await asset.readAsset("drawio", "assets/drawioframe.js");
  const editorUrl = await getEditorUrl();

  await editor.showPanel(
    "modal",
    1,
    `
      <style>
        iframe {
          border: 0;
          position: fixed;
          inset: 0; /* shorthand for top/left/right/bottom: 0 */
          width: 100%;
          height: 100%;
        }
      </style>
      <div>
        <iframe 
          id="drawioiframe" 
          src="${editorUrl}" 
          drawio-path="${diagramPath}">
        </iframe>
      </div>
    `,
    drawioFrameScript
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
  if (matches.length === 1) {
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
  const sampleStr = await asset.readAsset(
    "drawio",
    `assets/sample.${ext}.base64`
  );

  // decode base64 → string
  const decoded = atob(sampleStr);

  // convert string → Uint8Array
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}


async function createSampleFile(filePath: string, ext: string): Promise<boolean> {
  // Check if file exists and confirm overwrite
  if (await space.fileExists(filePath)) {
    const overwrite = await editor.confirm(
      "File already exists! Do you want to overwrite?"
    );
    if (!overwrite) return false;
  }

  const uint8data = await getSampleAsset(ext);
  await space.writeFile(filePath, uint8data);

  return true;
}

export async function createDrawioDiagram(): Promise<void> {
  const text = await editor.getText();
  const { from, to } = await editor.getSelection();

  // Use selection or prompt for diagram name
  let diagramName = text.slice(from, to).trim();
  if (!diagramName) {
    diagramName = await editor.prompt("Enter a diagram name:", "sample.svg");
  }

  // Ensure valid extension
  let ext = getFileExtension(diagramName);
  if (ext !== "svg" && ext !== "png") {
    ext = "svg";
    diagramName += `.${ext}`;
  }

  const pageName = await editor.getCurrentPage();
  const directory = pageName.slice(0, pageName.lastIndexOf("/"));
  const filePath = `${directory}/${diagramName}`;

  // Create sample file or abort
  if (!(await createSampleFile(filePath, ext))) return;

  // Insert or replace selection with link
  const link = `![${diagramName}](${diagramName})`;
  await editor.replaceRange(from, to, link);

  // Open in editor
  await drawIoEdit(filePath);
}

export async function openDrawioEditor(): Promise<{
  html: string;
  script: string;
}> {
  const drawioFrameScript = await asset.readAsset("drawio", "assets/drawioframe.js");
  const editorUrl = await getEditorUrl();
  const diagramPath = await editor.getCurrentPage();
  const html = `
      <style>
        iframe {
          border: 0;
          position: fixed;
          inset: 0; /* shorthand for top/left/right/bottom: 0 */
          width: 100%;
          height: 100%;
        }
      </style>
      <div>
        <iframe 
          id="drawioiframe" 
          src="${editorUrl}" 
          drawio-path="${diagramPath}">
        </iframe>
      </div>
    `;
  return {
    html: html,
    script: drawioFrameScript
  };
}

// TODO Document editor
// TODO write a code widget
// TODO slashcommand
// TODO subdir config
