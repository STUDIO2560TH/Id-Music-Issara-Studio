import requests, os, re, sys, json, subprocess

# Announces song IDs newly added to the Ids file to a Discord webhook.
# Usage: python announce_new_songs.py <git-ref-of-previous-Ids>
# Compares the Ids file in the working tree against the Ids file at that ref.

print("Announce script started.")

WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
IDS_FILE = "Ids"
LOG_FILES = ["asset_ids.json", "ignored_asset_ids.json"]

# Discord allows up to 4096 characters in an embed description
MAX_DESCRIPTION = 4000

if not WEBHOOK_URL:
    print("DISCORD_WEBHOOK_URL is not set. Skipping announcement.")
    sys.exit(0)

if len(sys.argv) < 2:
    print("Usage: python announce_new_songs.py <git-ref>")
    sys.exit(1)

old_ref = sys.argv[1]

def parse_ids(text):
    return re.findall(r"\d+", text)

def get_old_ids(ref):
    try:
        text = subprocess.check_output(["git", "show", f"{ref}:{IDS_FILE}"], text=True)
    except subprocess.CalledProcessError:
        print(f"Could not read {IDS_FILE} at {ref}; treating it as empty.")
        return set()
    return set(parse_ids(text))

def get_new_ids():
    if not os.path.exists(IDS_FILE):
        return []
    with open(IDS_FILE, "r") as f:
        return parse_ids(f.read())

def get_known_names():
    # Map asset ID -> song name, using the upload logs (filename without .mp3)
    names = {}
    for log_file in LOG_FILES:
        if os.path.exists(log_file):
            with open(log_file, "r") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    continue
            for filename, asset_id in data.items():
                names[str(asset_id)] = os.path.splitext(filename)[0]
    return names

def fetch_name_from_roblox(asset_id):
    try:
        res = requests.get(f"https://economy.roblox.com/v2/assets/{asset_id}/details", timeout=10)
        if res.status_code == 200:
            return res.json().get("Name")
    except requests.RequestException as e:
        print(f"Error fetching name for {asset_id}: {e}")
    return None

def send_embed(description, part, total_parts):
    title = "🎵 เพลงใหม่เข้าเกมแล้ว!"
    if total_parts > 1:
        title += f" ({part}/{total_parts})"
    payload = {
        "embeds": [{
            "title": title,
            "description": description,
            "color": 0x1DB954,
            "footer": {"text": "⚠️ บางเพลงอาจเล่นไม่ได้เพราะติดลิขสิทธิ์ หากเพลงไหนไม่มีเสียง ขออภัยด้วยนะครับ"}
        }]
    }
    res = requests.post(WEBHOOK_URL, json=payload, timeout=10)
    if res.status_code not in (200, 204):
        print(f"Error sending to Discord: {res.status_code} {res.text}")
        return False
    return True

old_ids = get_old_ids(old_ref)
added_ids = []
for asset_id in get_new_ids():
    if asset_id not in old_ids and asset_id not in added_ids:
        added_ids.append(asset_id)

if not added_ids:
    print("No new IDs found. Nothing to announce.")
    sys.exit(0)

print(f"Found {len(added_ids)} new ID(s): {added_ids}")

known_names = get_known_names()
lines = []
for asset_id in added_ids:
    name = known_names.get(asset_id) or fetch_name_from_roblox(asset_id) or "ไม่ทราบชื่อเพลง"
    lines.append(f"🎶 **{name}**\n`{asset_id}`")

header = f"เพิ่มเพลงใหม่ทั้งหมด **{len(added_ids)}** เพลง\n\n"

# Split into multiple embeds if the list is too long
chunks = []
current = header
for line in lines:
    if len(current) + len(line) + 1 > MAX_DESCRIPTION:
        chunks.append(current)
        current = ""
    current += line + "\n"
chunks.append(current)

failed = False
for i, chunk in enumerate(chunks, start=1):
    if not send_embed(chunk, i, len(chunks)):
        failed = True

if failed:
    sys.exit(1)

print("Announcement sent.")
