# SilverBullet plug for drawio diagrams

This plug adds [draw.io](https://www.drawio.com/) support to Silverbullet.

## Installation

Run the {[Plugs: Add]} command and paste in: `github:logeshg5/silverbullet-drawio/drawio.plug.js`

## Usage

### Create New Diagram

Run `Draw.io Create diagram` command and type in the name of the diagram.

(or)

In the editor, type the name of the diagram e.g., `flowchar.drawio.svg`, select it and run `Draw.io Create diagram` command.

Draw.io editor will open. Make your changes and click save.

Note: You will have to refresh the page to view the updates.

### Edit Existing Diagram

Attach your diagrams to the page `![FlowChart](FlowChart.drawio.png)`.

Run `Draw.io Edit diagram`.

If multiple diagrams are present in a page, you will be prompted to choose one.

Note: You will have to refresh the page to view the updates.

## Configuration

This is optional.

Editor URL can be configured using the SETTINGS page (default values shown):

```yaml
drawio:
  editorUrl: https://embed.diagrams.net/?embed=1&spin=1&proto=json&configure=1
```
