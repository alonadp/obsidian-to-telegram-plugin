# obsidian-to-telegram-plugin
![IMG_7483](https://github.com/user-attachments/assets/91790b7e-e2db-4c54-9df2-e710806c76b0)

Plugin for publishing Obsidian notes to Telegram channels with support for text and images.

## Features

-   Send notes to multiple Telegram channels
-   Image support
-   Markdown formatting
-   Easy channel management
-   Work only local

## Installation

-   Download latest release from GitHub
-   Extract files to your Obsidian plugins folder: .obsidian/plugins/obsidian-telegram-plugin/
-   Get bot token from @BotFather in Telegram
-   Enable plugin in Obsidian settings
-   Configure plugin settings:
    1.Add bot token
    2.Add channel IDs
    3.Restart Obsidian

## Usage

1. Open note
2. Right-click on the note
3. Select "отправить в Telegram"
4. Select target channel
5. Send!

## Configuration

### Bot Setup

1. Find @BotFather in Telegram
2. Send `/newbot`
3. Follow instructions
4. Copy bot token

### Channel Setup

1. Add bot as admin to channel
2. Get channel ID (@getidsbot)
3. Add channel in plugin settings

## Development

```bash
git clone https://github.com/yourusername/obsidian-telegram-plugin.git
cd obsidian-telegram-plugin
npm install
npm run build
```

## License

MIT
