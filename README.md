# DON HUNT live boards

Stream boards for DON HUNT breaks, hosted on GitHub Pages at **https://donhunt.breaksgpt.com**.
They read the team's existing DON_HUNT Google Sheet, so nothing about how the sheet is filled in changes.
Built to be read on a TV behind the ripper through a TikTok camera: max 24 spots, huge type, solid color blocks.

| Board | Address | Reads | Center panel |
|---|---|---|---|
| $1 Start Auction | `/auction/` | `AUCTION` + `AUCTION_CHASE` | High bid + leader (crown on the leading spot) |
| $10 Pre-Fill | `/prefill/` | `$10` + `$10_CHASE` | Spots filled, no leader |
| $30 A Pack | `/pack/` | `$30` + `$30_CHASE` | Packs sold, no leader |
| Custom Auction | `/custom/` | any tabs picked in Settings | Leader on/off, 1-24 spots, labels, or type names on the board |

## Switching tabs: the optional LIVE tab
Add a tab named `LIVE`: column A = board (`AUCTION`, `$10`, `$30`, `CUSTOM`), column B = the tab that board should show, column C = chase tab (optional).
Change column B and the board switches within a few seconds. No LIVE tab or a blank cell = the default tabs below.

## Sheet format (unchanged from how the team already works)
- Board tab: column A spot number (1-24), B username, C bid (`FREE` shows a red FREE tag), D note (`winner` shows a WINNER tag).
- Chase tab: B1 picture link (Google Drive share links work), B2 chase name, B3 prize. The board plays a reveal when it changes.
- Optional chase-tab rows (label in A, value in B): `Box`, `Title`, `Subtitle`, `Price`, `Banner`, `Status`, `Show Leader`, and `Chase 2 Image URL` / `Chase 2 Name` / `Chase 2 Value` (up to Chase 4).
- The sheet must stay shared as **Anyone with the link: Viewer**.
- If Google hiccups, the board keeps showing the last good info; only the host sees a message.

## Rewards and real slab photos
- Every reward lives in the board's `_CHASE` tab: picture in B1, name in B2, prize in B3. Up to 4 rewards: add rows `Chase 2 Image URL` / `Chase 2 Name` / `Chase 2 Value` (same for 3 and 4).
- **Picture Link Maker** (`/picture/`): drag a product photo from any website (or paste a link / Drive link / cert number), it checks the picture loads, and gives a Copy button for the exact link to paste in the sheet.
- Boards auto-fix Google Images result links, Drive, Dropbox and imgur links, and use the sharpest eBay photo size. Web-page links, plain text, or pictures that won't load show a host-only warning.
- Picture cell accepts any image link, a Google Drive share link (file shared "Anyone with the link"), **or a PSA cert number / psacard.com/cert link**.
- PSA cert: the board asks the **DON HUNT PSA Helper** (a Google Apps Script web app owned by johnathansaalfeld@gmail.com, code in `apps-script/PsaProxy.gs`, URL in `assets/config.js`) for PSA's own photo of that slab. The PSA token lives only in that script's Script Properties (`PSA_TOKEN`), never in the sheet or this repo. Nothing to set up on stream computers.
- The helper only answers for certs typed in a tab whose name contains CHASE, and remembers each cert forever, so PSA's 100/day limit isn't a problem.
- Status 2026-09-16: PSA returns "Access to this API is limited to approved customers" for the token, so PSA must approve the account (collectors-apis@collectors.com) before cert photos appear. Until then, paste the photo link itself (right-click the slab photo on the psacard.com cert page > Copy image address).
- Changing the helper: edit the script, then Deploy > Manage deployments > Edit > Version: New version (keeps the same URL).

## Address options
- `?clean=1` hides all buttons and messages (use for OBS Browser Sources)
- `?tab=9_13_26_AUC` shows an old board tab; `?chase=$30_CHASE` a different chase tab
- `?sheet=<sheet id or link>` uses a different Google Sheet
- `?layout=wide` or `?layout=tall` forces a layout (default follows the screen shape)
- `?transparent=1` removes the background

## Settings
`assets/config.js` holds the sheet ID and how often boards check it (every 4 seconds).

## Hosting
GitHub Pages from the `main` branch root. `CNAME` holds `donhunt.breaksgpt.com`; DNS at IONOS (breaksgpt.com) has a CNAME record `donhunt` pointing to `<github-username>.github.io`.
