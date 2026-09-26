// Does all Roblox API requests so the content script isn't blocked by CORS.

async function getJson(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function getUniverseId(placeId) {
  const data = await getJson(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
  );
  if (!data.universeId) throw new Error("No universe found for this place");
  return data.universeId;
}

async function getIcon(universeId, size) {
  const data = await getJson(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}` +
      `&returnPolicy=PlaceHolder&size=${size}&format=Png&isCircular=false`
  );
  return data.data && data.data[0] ? data.data[0] : null;
}

async function getGameInfo({ placeId, universeId, size }) {
  if (!universeId) universeId = await getUniverseId(placeId);

  const [details, votes, icon] = await Promise.all([
    getJson(`https://games.roblox.com/v1/games?universeIds=${universeId}`)
      .then((d) => (d.data && d.data[0]) || null)
      .catch(() => null),
    getJson(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`)
      .then((d) => (d.data && d.data[0]) || null)
      .catch(() => null),
    getIcon(universeId, size),
  ]);

  return { placeId, universeId, details, votes, icon };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  let job;
  if (msg.type === "getGameInfo") {
    job = getGameInfo(msg);
  } else if (msg.type === "getIcon") {
    job = getIcon(msg.universeId, msg.size);
  } else if (msg.type === "download") {
    job = chrome.downloads.download({ url: msg.url, filename: msg.filename });
  } else {
    return false;
  }
  job
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
  return true; // keep the channel open for the async response
});
