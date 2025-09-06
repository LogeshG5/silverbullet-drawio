import {
  asset,
  editor,
  space,
  system
} from "@silverbulletmd/silverbullet/syscalls";
import { SlashCompletions } from "@silverbulletmd/silverbullet/types";
import { Base64 } from "npm:js-base64";

type DiagramType = "Widget" | "Attachment";

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
      return ext === "svg" || ext === "png" || ext === "drawio"
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
          src="${editorUrl}&saveAndExit=1&noSaveBtn=1&noExitBtn=1" 
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
          src="${editorUrl}&saveAndExit=0&noSaveBtn=1&noExitBtn=1" 
          drawio-path="${diagramPath}">
        </iframe>
      </div>
    `;
  return {
    html: html,
    script: drawioFrameScript
  };
}

async function createDiagram(diagramType: DiagramType): Promise<void | false> {
  const text = await editor.getText();
  const selection = await editor.getSelection();
  const { from, to } = selection;
  const selectedText = text.slice(from, to);

  // Ask for diagram name (default: selected text or empty)
  let diagramName = await editor.prompt(
    "Enter a diagram name:",
    selectedText || ""
  );
  if (!diagramName) return false; // user cancelled

  diagramName = ensureExtension(diagramName, diagramType);

  const directory = getCurrentDirectory(await editor.getCurrentPage());
  const filePath = `${directory}/${diagramName}`;

  if (await fileAlreadyExists(filePath)) {
    return false;
  }

  const ext = getFileExtension(filePath);
  await writeEmptyDrawioFile(ext, filePath);

  if (diagramType === "Widget") {
    await insertDrawioBlock(from, to, filePath);
  } else {
    await insertAttachment(from, to, diagramName, filePath);
  }
}


function ensureExtension(name: string, type: DiagramType): string {
  const ext = getFileExtension(name);

  if (type === "Widget") {
    return ext === "drawio" ? name : `${name}.drawio`;
  }

  if (type === "Attachment") {
    if (ext === "svg" || ext === "png") return name;
    editor.flashNotification("No extension provided, svg chosen", "info");
    return `${name}.svg`;
  }

  return name;
}

function getCurrentDirectory(pageName: string): string {
  const lastSlash = pageName.lastIndexOf("/");
  return lastSlash !== -1 ? pageName.substring(0, lastSlash) : pageName;
}

async function fileAlreadyExists(filePath: string): Promise<boolean> {
  if (await space.fileExists(filePath)) {
    const overwrite = await editor.confirm(
      "File already exists! Do you want to overwrite?"
    );
    return !overwrite;
  }
  return false;
}

async function writeEmptyDrawioFile(ext: string, filePath: string): Promise<void> {
  const sampleStr = await asset.readAsset(
    "drawio",
    `assets/sample.${ext}.base64`
  );

  // decode base64 → string
  const decoded = atob(sampleStr);

  // convert string → Uint8Array
  const uint8array = new TextEncoder().encode(decoded);
  await space.writeFile(filePath, uint8array);
}

async function insertDrawioBlock(from: number, to: number, filePath: string): Promise<void> {
  const block = `\`\`\`drawio
url:${filePath}
\`\`\``;
  await editor.replaceRange(from, to, block);
}

async function insertAttachment(from: number, to: number, name: string, filePath: string): Promise<void> {
  const link = `![${name}](${name})`;
  await editor.replaceRange(from, to, link);
  await drawIoEdit(filePath);
}

export async function createDiagramAsWidget(): Promise<void | false> {
  createDiagram("Widget");
}


export async function createDiagramAsAttachment(): Promise<void | false> {
  createDiagram("Attachment");
}


// Previewer iframe for the code widget
export async function showWidget(
  widgetContents: string
): Promise<{ html: string; script: string }> {
  const urlMatch = widgetContents.match(/url:\s*(.+)/i);
  const diagramPath = urlMatch ? urlMatch[1].trim() : null;

  if (!diagramPath || !(await space.fileExists(diagramPath))) {
    return { html: `<pre>File does not exist</pre>`, script: "" };
  }

  const drawioFrameScript = await asset.readAsset("drawio", "assets/drawioframe.js");
  const editorUrl = await getEditorUrl();
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
      <div style="width:100vw; height:500px;">
        <iframe 
          id="drawioiframe" 
          src="${editorUrl}&ui=min&saveAndExit=0&noSaveBtn=1&noExitBtn=1" 
          drawio-path="${diagramPath}" drawio-type='widget'>
        </iframe>
      </div>
    `;
  return {
    html: html,
    script: drawioFrameScript
  };
}

export function snippetSlashComplete(): SlashCompletions {
  return {
    options: [
      {
        label: "drawio",
        detail: "Create new Drawio diagram",
        invoke: "drawio.createDiagramAsWidget",
      },
    ],
  };
}
