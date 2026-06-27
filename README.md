# Google Photos Bulk Deleter

A Chrome extension to bulk delete your Google Photos in one click — no coding needed.

## Features
- **One-Click Deletion**: Automatically selects and deletes photos in batches.
- **Background Support**: Pin the progress UI to the page so you can close the extension popup without losing track.
- **Custom Targets**: Specify exactly how many photos you want to delete.
- **Detailed Logs**: View execution logs right in the popup.

## Installation
1. Download the `.crx` file from the releases.
2. Go to `chrome://extensions/` in Chrome.
3. Enable "Developer mode" in the top right corner.
4. Drag and drop the `.crx` file into the extensions page.

Alternatively, you can load it unpacked:
1. Clone or download this repository.
2. Go to `chrome://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked" and select the extension folder.

## Usage
1. Go to [Google Photos](https://photos.google.com).
2. Click on the extension icon in the toolbar.
3. Set your target deletion count and click **Start**.
4. (Optional) Click **Pin to Screen** if you want to close the popup but still monitor progress on the page.

## Credits
This extension was heavily inspired by the awesome work of **shtse8**. Check out the original script here:
[shtse8's Google-Photos-Delete-Tool](https://github.com/shtse8/Google-Photos-Delete-Tool/releases/tag/v2.0.5)

## Disclaimer
This moves photos to your Trash. Google keeps them there for 60 days before permanent deletion. Use at your own risk.
