# Roblox Game Icon Viewer (browser extension)

Adds a panel to every Roblox game page (`https://www.roblox.com/games/<placeId>/...`)
that shows the game's **square 1:1 icon** next to extra info:

- 1:1 game icon (150 / 256 / 512 px) with **Open**, **Download** and **Copy URL** buttons
- Name, creator (linked), Place ID, Universe ID
- Playing now, visits, favorites, likes/dislikes (with like ratio), max players
- Genre, created and last-updated dates

Example: open https://www.roblox.com/games/105767799784652/Clean-the-WORLD and the
panel appears under the game's thumbnail/Play section.

## Install (Chrome / Edge / Brave / Opera)

1. Download or clone this folder (`roblox-game-icon-extension`).
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `roblox-game-icon-extension` folder.
5. Open (or reload) any Roblox game page.

Click **×** on the panel to hide it for the current game.

## How it works

- `content.js` reads the place ID from the URL (and the universe ID from the page if
  available), then asks the background worker for data and draws the panel.
- `background.js` calls public Roblox APIs (no login or cookies are sent):
  - `apis.roblox.com/universes/v1/places/{placeId}/universe` – place → universe ID
  - `thumbnails.roblox.com/v1/games/icons` – the square game icon
  - `games.roblox.com/v1/games` – name, creator, visits, playing, etc.
  - `games.roblox.com/v1/games/votes` – likes / dislikes
