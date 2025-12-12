# Site NetBar

Site NetBar is a lightweight Chrome extension that displays improved network information for the current website in a fixed top or bottom bar. It provides real-time details about the server IP, client IP, DNS servers, and HTTP headers without cluttering the developer console.

## Features

*   **Network Information**: Displays the server IP, domain name, client IP (with country), host/PTR record, Nameservers (NS), and the Server HTTP header.
*   **Non-Intrusive Layout**: The bar overlays the page content. It can be positioned at the top or bottom of the viewport using the built-in "UP" and "DOWN" buttons.
*   **Customizable**: Adjust the opacity of the bar via the popup menu to ensure it does not obstruct the view of the webpage.
*   **Per-Site Control**: Easily toggle the extension on or off for specific domains.
*   **Rate Limit Protection**: Client IP checks are cached intelligently to prevent hitting API rate limits during heavy usage.

## Installation

Since this extension is designed for developers and power users, it can be installed manually:

1.  Clone or download this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the directory where you cloned the repository.

## Usage

Once installed, the NetBar will automatically appear on all websites.

*   **Positioning**: Click the "UP" or "DOWN" buttons on the right side of the bar to move it to the top or bottom of the screen. This preference is saved globally.
*   **Opacity**: Click the extension icon in the Chrome toolbar to open the settings popup. Use the slider to adjust the transparency of the bar.
*   **Disable on Site**: Uncheck "Enable on this site" in the popup menu to hide the bar for the current domain.
*   **Global Toggle**: Use the "Global Enable" switch in the popup to turn the extension off completely.

## Privacy

This extension performs DNS-over-HTTPS queries directly from the browser to resolve IP and NS records (using Cloudflare and Google DNS). It uses public IP APIs (ipapi.co, ipify.org) to determine the client IP address. No browsing history is collected or sent to any third-party analytics servers.
