# DON HUNT live boards

Stream boards for DON HUNT breaks, hosted on GitHub Pages at **https://donhunt.wackymclovin.com**.
Every board reads a Google Sheet, so games are changed in the sheet, not in code.

| Board | Address | Leader |
|---|---|---|
| $1 Start Auction | `/auction/` | High Bid + High Bidder |
| $10 Pre-Fill | `/prefill/` | none (spots filled bar) |
| $30 A Pack | `/pack/` | none (packs sold bar) |
| Custom Auction | `/custom/` | on/off, plus on-screen Settings |

## How the sheet drives the boards
- The **BOARDS** tab (must stay the first tab) has one row per board. Column B, **LIVE TAB**, is the game tab that board shows. Change it and the board fades over to the new game within a few seconds.
- Every game tab starts with `DON HUNT GAME` in A1 and has three sections: **SETTINGS** (title, box, price, spots, banner, status, leader on/off), **HITS** (up to 8: pull, prize, odds, color, image link), and **SPOTS**/**PACKS** (number, owner, bid, hit pulled).
- Make new games by duplicating a `TEMPLATE` tab. Optional: paste `apps-script/DonHunt.gs` into Extensions > Apps Script for a DON HUNT menu that does it in one click.
- The sheet must be shared as **Anyone with the link: Viewer**. Keep every cell formatted as Plain text (the template already is).
- If a tab name is wrong or Google hiccups, the board keeps showing the last good game and only the host sees a message.

## Address options
- `?clean=1` hides all buttons and messages (use for OBS Browser Sources)
- `?board=auction-2` follows another BOARDS row (two auctions at once)
- `?tab=9-16 Auction 2` shows one tab and ignores BOARDS
- `?sheet=<sheet id or link>` uses a different Google Sheet
- `?layout=wide` or `?layout=tall` forces a layout (default follows the screen shape)
- `?transparent=1` removes the background

## Settings
`assets/config.js` holds the default sheet ID and how often boards check it.

## Hosting
GitHub Pages from the `main` branch root. `CNAME` holds `donhunt.wackymclovin.com`; DNS at Hover has a CNAME record `donhunt` pointing to `<github-username>.github.io`.
