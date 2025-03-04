# Obsidian Definition Highlights

A Chrome extension that highlights terms on webpages that match definitions stored in your Obsidian vault.

## Features

- Automatically highlights terms on webpages that you've defined in your Obsidian vault
- Shows a tooltip with a summary of your definition when hovering over highlighted terms
- Provides a direct link to open the full definition in Obsidian
- Works with definitions tagged as `type:definition` in your vault

## Requirements

- [Obsidian](https://obsidian.md/) with your personal knowledge base
- [Obsidian Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) installed and configured
- Chrome browser

## Setup

1. Install the Obsidian Local REST API plugin in Obsidian
2. Configure the plugin and generate an API key
3. Install this Chrome extension
4. Configure the extension with your vault name and API key

## How It Works

1. The extension securely connects to your Obsidian vault via the Local REST API
2. It retrieves notes tagged as `type:definition` from your vault
3. As you browse the web, it highlights terms that match your definitions
4. Hover over a highlighted term to see a summary from your notes
5. Click the "Open in Obsidian" link to jump directly to the full note

## Privacy & Security

- Your data never leaves your computer - the extension communicates directly with Obsidian on your local machine
- API keys are stored securely in Chrome's extension storage
- The extension only has access to notes explicitly marked as definitions

## Development

This project is open source. Contributions are welcome!
