(() => {
  "use strict";

  const MAX_FILE_SIZE = 1_500_000;
  const RECENT_COUNT = 5; // versions récentes affichées, en plus de la v1
  const cfg = window.APP_CONFIG || {};
  const ADMIN_PIN = String(cfg.ADMIN_PIN || "2026");
  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const table = () => client.from("game_versions");

  const $ = id => document.getElementById(id);
  const els = {
    status: $("status"),
    stageVersion: $("stageVersion"),
    stageAuthor: $("stageAuthor"),
    stageMeta: $("stageMeta"),
    stageNote: $("stageNote"),
    stageDownload: $("stageDownload"),
    gameFrame: $("gameFrame"),
    versionCount: $("versionCount"),
    historyList: $("historyList"),
    uploadForm: $("uploadForm"),
    contributor: $("contributor"),
    changeNote: $("changeNote"),
    gameFile: $("gameFile"),
    fileName: $("fileName"),
    uploadBtn: $("uploadBtn"),
    formMessage: $("formMessage"),
    adminLoginForm: $("adminLoginForm"),
    adminPin: $("adminPin"),
    adminLoggedIn: $("adminLoggedIn"),
    adminLogoutBtn: $("adminLogoutBtn"),
    adminMessage: $("adminMessage")
  };

  let versions = [];          // métadonnées affichées (sans le HTML)
  let total = 0;
  let current = null;         // version affichée dans le jeu
  const htmlCache = new Map(); // id -> contenu HTML, chargé à la demande
  let isAdmin = sessionStorage.getItem("jeu-ia-admin") === "1";

  const META = "id, contributor, change_note, created_at";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function formatDate(iso) {
    return new Intl.DateTimeFormat("fr-BE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  }

  function setMessage(el, text, kind = "") {
    el.textContent = text;
    el.className = `message ${kind}`.trim();
  }

  async function ensureInitialVersion() {
    const { count, error } = await table().select("id", { count: "exact", head: true });
    if (error) throw error;
    if ((count || 0) > 0) return;
    const response = await fetch("starter-game.html", { cache: "no-store" });
    if (!response.ok) throw new Error("Impossible de charger le jeu de départ.");
    const { error: insertError } = await table().insert({
      contributor: "Version de départ",
      change_note: "Jeu initial : déplacer le carré et attraper les pièces jaunes.",
      html_content: await response.text()
    });
    if (insertError) throw insertError;
  }

  // Charge uniquement les métadonnées : les N dernières versions + la toute première.
  async function fetchVersions() {
    const [recent, first] = await Promise.all([
      table().select(META, { count: "exact" }).order("id", { ascending: false }).limit(RECENT_COUNT),
      table().select(META).order("id", { ascending: true }).limit(1)
    ]);
    if (recent.error) throw recent.error;
    if (first.error) throw first.error;
    total = recent.count ?? recent.data.length;
    versions = [...recent.data];
    const original = first.data[0];
    if (original && !versions.some(v => v.id === original.id)) versions.push(original);
  }

  async function getHtml(id) {
    if (htmlCache.has(id)) return htmlCache.get(id);
    const { data, error } = await table().select("html_content").eq("id", id).single();
    if (error) throw error;
    htmlCache.set(id, data.html_content);
    return data.html_content;
  }

  function renderHistory() {
    els.versionCount.textContent = total > versions.length
      ? `${total} versions au total — les ${RECENT_COUNT} dernières et l’originale sont affichées.`
      : `${total} version${total > 1 ? "s" : ""}.`;

    const latestId = versions[0]?.id;
    const originalId = versions[versions.length - 1]?.id;
    const hidden = total - versions.length;

    els.historyList.innerHTML = versions.map(v => `
      ${v.id === originalId && hidden > 0 ? '<div class="gap">···</div>' : ""}
      <div class="version ${current?.id === v.id ? "active" : ""}" data-id="${v.id}" role="button" tabindex="0">
        <span class="pill">v${v.id}</span>
        <span class="version-text">
          <strong>${escapeHtml(v.contributor)}${v.id === latestId ? " · dernière" : ""}</strong>
          <span title="${escapeHtml(v.change_note)}">${escapeHtml(v.change_note)}</span>
        </span>
        ${isAdmin && v.id !== 1 ? `<button class="btn btn-danger" data-delete="${v.id}" type="button">Supprimer</button>` : "<span></span>"}
      </div>
    `).join("");
  }

  function renderAdmin() {
    els.adminLoginForm.hidden = isAdmin;
    els.adminLoggedIn.hidden = !isAdmin;
  }

  async function play(version) {
    if (!version) return;
    current = version;
    els.stageVersion.textContent = `v${version.id}`;
    els.stageAuthor.textContent = version.contributor;
    els.stageMeta.textContent = formatDate(version.created_at);
    els.stageNote.textContent = version.change_note;
    els.stageDownload.disabled = true;
    renderHistory();
    try {
      const html = await getHtml(version.id);
      if (current !== version) return; // une autre version a été choisie entre-temps
      els.gameFrame.srcdoc = html;
      els.stageDownload.disabled = false;
    } catch (error) {
      console.error(error);
      els.stageNote.textContent = `Impossible de charger cette version : ${error.message}`;
    }
  }

  function safeFileName(name) {
    return String(name || "contributeur")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
      .toLowerCase() || "contributeur";
  }

  function download(version) {
    const html = htmlCache.get(version.id);
    if (!html) return;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `jeu-ia-v${version.id}-${safeFileName(version.contributor)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Révoquer trop tôt peut annuler le téléchargement dans certains navigateurs.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function looksLikeHtml(content) {
    const lower = content.toLowerCase();
    return lower.includes("<html") && lower.includes("<script") && lower.includes("</html>");
  }

  async function deleteVersion(id) {
    const version = versions.find(v => v.id === id);
    if (!isAdmin || !version || version.id === 1) return;
    if (!confirm(`Supprimer définitivement la v${version.id} de ${version.contributor} ?\n\nCette action est irréversible.`)) return;
    const { data, error } = await table().delete().eq("id", id).select("id");
    if (error) { alert(`Suppression impossible : ${error.message}`); return; }
    if (!data || data.length === 0) { alert("La base de données a refusé la suppression."); return; }
    htmlCache.delete(id);
    await fetchVersions();
    if (current?.id === id) await play(versions[0]);
    else renderHistory();
  }

  // --- Événements ---

  els.stageDownload.addEventListener("click", () => current && download(current));

  els.historyList.addEventListener("click", event => {
    const del = event.target.closest("[data-delete]");
    if (del) { deleteVersion(Number(del.dataset.delete)); return; }
    const row = event.target.closest(".version");
    if (row) play(versions.find(v => v.id === Number(row.dataset.id)));
  });
  els.historyList.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest(".version");
    if (!row || event.target !== row) return;
    event.preventDefault();
    play(versions.find(v => v.id === Number(row.dataset.id)));
  });

  els.gameFile.addEventListener("change", () => {
    els.fileName.textContent = els.gameFile.files?.[0]?.name || "Choisir le fichier HTML…";
  });

  els.uploadForm.addEventListener("submit", async event => {
    event.preventDefault();
    setMessage(els.formMessage, "");
    const file = els.gameFile.files?.[0];
    const contributor = els.contributor.value.trim();
    const changeNote = els.changeNote.value.trim();

    if (!contributor || !changeNote || !file) {
      setMessage(els.formMessage, "Indique ton nom, ce que tu as ajouté, et choisis le fichier.", "error");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".html")) {
      setMessage(els.formMessage, "Le fichier doit être au format .html.", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage(els.formMessage, "Le fichier est trop volumineux. Limite : 1,5 Mo.", "error");
      return;
    }

    els.uploadBtn.disabled = true;
    els.uploadBtn.textContent = "Publication…";
    try {
      const htmlContent = await file.text();
      if (!looksLikeHtml(htmlContent)) throw new Error("Ce fichier ne ressemble pas à un jeu HTML complet.");
      const { data, error } = await table()
        .insert({ contributor, change_note: changeNote, html_content: htmlContent })
        .select(META).single();
      if (error) throw error;
      htmlCache.set(data.id, htmlContent);
      els.uploadForm.reset();
      els.fileName.textContent = "Choisir le fichier HTML…";
      setMessage(els.formMessage, `v${data.id} publiée. Le relais est passé !`, "success");
      await fetchVersions();
      await play(versions.find(v => v.id === data.id) || data);
    } catch (error) {
      console.error(error);
      setMessage(els.formMessage, error.message || "La publication a échoué.", "error");
    } finally {
      els.uploadBtn.disabled = false;
      els.uploadBtn.textContent = "Publier";
    }
  });

  els.adminLoginForm.addEventListener("submit", event => {
    event.preventDefault();
    if (els.adminPin.value.trim() !== ADMIN_PIN) {
      setMessage(els.adminMessage, "Code incorrect.", "error");
      return;
    }
    sessionStorage.setItem("jeu-ia-admin", "1");
    isAdmin = true;
    els.adminPin.value = "";
    setMessage(els.adminMessage, "");
    renderAdmin();
    renderHistory();
  });

  els.adminLogoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("jeu-ia-admin");
    isAdmin = false;
    renderAdmin();
    renderHistory();
  });

  async function init() {
    renderAdmin();
    try {
      await ensureInitialVersion();
      await fetchVersions();
      els.status.textContent = "● En ligne";
      els.status.className = "status ok";
      await play(versions[0]);
    } catch (error) {
      console.error(error);
      els.status.textContent = "Erreur de connexion";
      els.status.className = "status error";
      els.stageAuthor.textContent = "Impossible de charger le jeu";
      els.stageNote.textContent = error.message;
    }
  }

  init();
})();
