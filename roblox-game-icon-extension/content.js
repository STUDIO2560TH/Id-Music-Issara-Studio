// Adds a "Game Icon (1:1)" panel to every Roblox game page (/games/<placeId>/...).

(() => {
  const PANEL_ID = "rgi-panel";
  const SIZES = ["150x150", "256x256", "512x512"];
  const DEFAULT_SIZE = "512x512";

  let currentPlaceId = null;
  let dismissedPlaceId = null;

  function getPlaceId() {
    const m = location.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?games\/(\d+)/i);
    return m ? m[1] : null;
  }

  // The game page exposes the universe id in its metadata element; use it when present.
  function getUniverseIdFromPage() {
    const meta = document.getElementById("game-detail-meta-data");
    const id = meta && meta.getAttribute("data-universe-id");
    return id && /^\d+$/.test(id) ? id : null;
  }

  function send(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!res || !res.ok) return reject(new Error((res && res.error) || "Unknown error"));
        resolve(res.result);
      });
    });
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) node.append(c);
    return node;
  }

  function fmt(n) {
    return typeof n === "number" ? n.toLocaleString() : "—";
  }

  function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return isNaN(d) ? "—" : d.toLocaleDateString();
  }

  function safeFileName(name) {
    return (name || "roblox-game").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 80) || "roblox-game";
  }

  function removePanel() {
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();
  }

  function findAnchor() {
    return (
      document.querySelector("#game-detail-page .game-main-content") ||
      document.querySelector(".game-main-content")
    );
  }

  function mountPanel(panel) {
    // Put it under the game's main section; fall back to a floating panel.
    const anchor = findAnchor();
    if (anchor && anchor.parentNode) {
      panel.classList.remove("rgi-floating");
      anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    } else {
      panel.classList.add("rgi-floating");
      document.body.append(panel);
    }
  }

  function buildPanel(placeId) {
    const img = el("img", { class: "rgi-icon", alt: "Game icon" });
    const status = el("div", { class: "rgi-status", text: "Loading…" });
    const title = el("div", { class: "rgi-title", text: "Game Icon (1:1)" });
    const info = el("dl", { class: "rgi-info" });

    const sizeSelect = el(
      "select",
      { class: "rgi-select", title: "Icon size" },
      SIZES.map((s) => el("option", { value: s, text: s }))
    );
    sizeSelect.value = DEFAULT_SIZE;

    const openBtn = el("a", { class: "rgi-btn", target: "_blank", rel: "noopener", text: "Open" });
    const dlBtn = el("button", { class: "rgi-btn", type: "button", text: "Download" });
    const copyBtn = el("button", { class: "rgi-btn", type: "button", text: "Copy URL" });
    const closeBtn = el("button", { class: "rgi-close", type: "button", title: "Hide", text: "×" });

    const panel = el("section", { id: PANEL_ID }, [
      el("div", { class: "rgi-header" }, [title, closeBtn]),
      el("div", { class: "rgi-body" }, [
        el("div", { class: "rgi-icon-wrap" }, [img]),
        el("div", { class: "rgi-side" }, [
          info,
          el("div", { class: "rgi-actions" }, [sizeSelect, openBtn, dlBtn, copyBtn]),
          status,
        ]),
      ]),
    ]);

    const state = { universeId: null, name: null, imageUrl: null };

    function setIcon(icon) {
      if (icon && icon.imageUrl) {
        state.imageUrl = icon.imageUrl;
        img.src = icon.imageUrl;
        openBtn.href = icon.imageUrl;
        status.textContent = icon.state && icon.state !== "Completed" ? `Icon state: ${icon.state}` : "";
      } else {
        state.imageUrl = null;
        img.removeAttribute("src");
        openBtn.removeAttribute("href");
        status.textContent = "No icon available.";
      }
    }

    function addRow(label, value, link) {
      const dd = el("dd");
      if (link) dd.append(el("a", { href: link, target: "_blank", rel: "noopener", text: value }));
      else dd.textContent = value;
      info.append(el("dt", { text: label }), dd);
    }

    function renderInfo(data) {
      info.textContent = "";
      const d = data.details || {};
      const v = data.votes || {};
      const likes = typeof v.upVotes === "number" ? v.upVotes : null;
      const dislikes = typeof v.downVotes === "number" ? v.downVotes : null;
      const ratio =
        likes !== null && dislikes !== null && likes + dislikes > 0
          ? `${Math.round((likes / (likes + dislikes)) * 100)}%`
          : "—";

      if (d.name) addRow("Name", d.name);
      if (d.creator) {
        const creatorUrl =
          d.creator.type === "Group"
            ? `https://www.roblox.com/communities/${d.creator.id}`
            : `https://www.roblox.com/users/${d.creator.id}/profile`;
        addRow("Creator", `${d.creator.name} (${d.creator.type})`, creatorUrl);
      }
      addRow("Place ID", String(data.placeId));
      addRow("Universe ID", String(data.universeId));
      if (d.playing !== undefined) addRow("Playing", fmt(d.playing));
      if (d.visits !== undefined) addRow("Visits", fmt(d.visits));
      if (d.favoritedCount !== undefined) addRow("Favorites", fmt(d.favoritedCount));
      if (likes !== null) addRow("Likes", `${fmt(likes)} / ${fmt(dislikes)} (${ratio})`);
      if (d.maxPlayers !== undefined) addRow("Max players", fmt(d.maxPlayers));
      if (d.genre) addRow("Genre", d.genre);
      if (d.created) addRow("Created", fmtDate(d.created));
      if (d.updated) addRow("Updated", fmtDate(d.updated));
    }

    sizeSelect.addEventListener("change", async () => {
      if (!state.universeId) return;
      status.textContent = "Loading…";
      try {
        setIcon(await send({ type: "getIcon", universeId: state.universeId, size: sizeSelect.value }));
      } catch (e) {
        status.textContent = `Error: ${e.message}`;
      }
    });

    dlBtn.addEventListener("click", async () => {
      if (!state.imageUrl) return;
      try {
        await send({
          type: "download",
          url: state.imageUrl,
          filename: `${safeFileName(state.name)}_${state.universeId}_${sizeSelect.value}.png`,
        });
      } catch (e) {
        status.textContent = `Download failed: ${e.message}`;
      }
    });

    copyBtn.addEventListener("click", async () => {
      if (!state.imageUrl) return;
      try {
        await navigator.clipboard.writeText(state.imageUrl);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy URL"), 1200);
      } catch {
        status.textContent = "Could not copy to clipboard.";
      }
    });

    closeBtn.addEventListener("click", () => {
      dismissedPlaceId = placeId;
      panel.remove();
    });

    (async () => {
      try {
        const data = await send({
          type: "getGameInfo",
          placeId,
          universeId: getUniverseIdFromPage(),
          size: sizeSelect.value,
        });
        if (getPlaceId() !== placeId) return; // user navigated away meanwhile
        state.universeId = data.universeId;
        state.name = data.details && data.details.name;
        renderInfo(data);
        setIcon(data.icon);
      } catch (e) {
        status.textContent = `Error: ${e.message}`;
      }
    })();

    return panel;
  }

  function update() {
    const placeId = getPlaceId();
    const panel = document.getElementById(PANEL_ID);

    if (placeId === currentPlaceId) {
      if (!placeId || placeId === dismissedPlaceId) return;
      if (!panel) return mountPanel(buildPanel(placeId));
      // Page content finished rendering after we mounted: move from floating into the page.
      if (panel.classList.contains("rgi-floating") && findAnchor()) mountPanel(panel);
      return;
    }

    currentPlaceId = placeId;
    removePanel();
    if (placeId && placeId !== dismissedPlaceId) mountPanel(buildPanel(placeId));
  }

  update();

  // Roblox is partly a single-page app: re-check when the URL changes,
  // and re-mount if the page re-renders and drops our panel.
  let lastUrl = location.href;
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        currentPlaceId = null;
      }
      update();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
