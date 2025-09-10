# SilverBullet plug for drawio diagrams

This plug adds [draw.io](https://www.drawio.com/) support to Silverbullet.

https://github.com/user-attachments/assets/09564ef5-d2e0-4500-9b1d-8a70b5ccacd5

## Installation

Add `ghr:LogeshG5/silverbullet-drawio` to the plugs array in your CONFIG page.

```lua
config.set {
  plugs = {
  "ghr:LogeshG5/silverbullet-drawio"
  }
}
```

Run Plugs: Update command and off you go!

## Usage

### Create New Diagram

Run `Draw.io Create diagram` command and type in the name of the diagram (or) type `/drawio` in the editor.

Draw.io code block will be added to the editor & the widget will open.

You can use `Navigate: Anything Picker` to open the file in full screen. 

### Edit Existing Diagram

Attach your diagrams to the page `![FlowChart](FlowChart.drawio.png)`.

Run `Draw.io Edit diagram`.

If multiple diagrams are present in a page, you will be prompted to choose one.


