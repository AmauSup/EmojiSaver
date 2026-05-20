async function load() {
  const emojis = await browser.runtime.sendMessage({ type: "emojis:get" });

  const container = document.getElementById("list");
  const empty = document.getElementById("empty");
  const count = document.getElementById("count");

  container.textContent = "";
  count.textContent = emojis.length;
  empty.hidden = emojis.length > 0;

  emojis.forEach(e => {
    const div = document.createElement("div");
    const img = document.createElement("img");
    const text = document.createElement("span");
    const code = document.createElement("code");

    img.src = e.url;
    img.alt = e.name || e.id;
    img.width = 32;
    img.height = 32;

    text.textContent = e.name ? `:${e.name}:` : "emoji";
    code.textContent = e.id;

    div.className = "emoji";
    div.append(img, text, code);

    container.appendChild(div);
  });

  return emojis;
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

document.getElementById("copy").addEventListener("click", async () => {
  const emojis = await load();
  await copyText(emojis.map((emoji) => emoji.id).join("\n"));
});

document.getElementById("copy-json").addEventListener("click", async () => {
  const emojis = await load();
  await copyText(JSON.stringify(emojis, null, 2));
});

document.getElementById("clear").addEventListener("click", async () => {
  await browser.runtime.sendMessage({ type: "emojis:clear" });
  await load();
});

load();
