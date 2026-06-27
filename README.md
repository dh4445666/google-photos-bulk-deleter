# Google Photos Bulk Deleter

A Chrome extension to bulk delete your Google Photos in one click — no coding or console help needed.

## Features
- **One-Click Deletion**: Automatically selects and deletes photos in batches.
- **Background Support**: Pin the progress UI to the page so you can close the extension popup without losing track.
- **Custom Targets**: Specify exactly how many photos you want to delete.
- **Detailed Logs**: View execution logs right in the popup.

## Installation & Usage

### Option 1: Standalone Application (Easiest)
You do **not** need to install any extension! Simply download the standalone executable for your operating system from the [Releases](https://github.com/dh4445666/google-photos-bulk-deleter/releases) page.

**Windows**:
1. Download `gdpd-Windows.exe` and double click it.
2. It will open a Chrome browser. Log into your Google account if asked.
3. The tool will automatically inject the control panel into the Google Photos page!

**Linux**:
1. Download `gdpd-Linux`.
2. Make it executable (`chmod +x gdpd-Linux`) and run it in your terminal.
3. Use the browser that pops up just like the Windows instructions.

### Option 2: Browser Extension
If you prefer to install it as an extension:
1. Download `gpdt-extension.zip` from [Releases](https://github.com/dh4445666/google-photos-bulk-deleter/releases).
2. Extract the folder.
3. In Chrome, go to `chrome://extensions/`.
4. Enable **Developer mode** in the top right.
5. Click **Load unpacked** and select the extracted folder.
6. Go to Google Photos and click the extension icon to begin.


## Credits
This extension was heavily inspired by the awesome work of **shtse8**. Check out the original script here:
[shtse8's Google-Photos-Delete-Tool](https://github.com/shtse8/Google-Photos-Delete-Tool/releases/tag/v2.0.5)

## Disclaimer
This moves photos to your Trash. Google keeps them there for 60 days before permanent deletion. Use at your own risk.
