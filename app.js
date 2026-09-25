(() => {
  "use strict";

  const MAX_FILE_SIZE = 1_500_000;
  const LOCAL_KEY = "jeu-ia-en-chaine-versions-v1";
  const cfg = window.APP_CONFIG || {};
  const remoteEnabled = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const client = remoteEnabled ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  const els = {
    modeBadge: document.getElementById("modeBadge"),
    latestVersion: document.getElementById("latestVersion"),
    latestMeta: document.getElementById("latestMeta"),
    latestNote: document.getElementById("latestNote"),
    testLatestBtn: document.getElementById("testLatestBtn"),
    downloadLatestBtn: document.getElementById("downloadLatestBtn"),
    downloadHint: document.getElementById("downloadHint"),
    testerTitle: document.getElementById("testerTitle"),
    testerEmpty: document.getElementById("testerEmpty"),
    gameFrame: document.getElementById("gameFrame"),
    closeTesterBtn: document.getElementById("closeTesterBtn"),
    uploadForm: document.getElementById("uploadForm"),
    contributor: document.getElementById("contributor"),
    changeNote: document.getElementById("changeNote"),
    gameFile: document.getElementById("gameFile"),
    fileName: document.getElementById("fileName"),
    testFileBtn: document.getElementById("testFileBtn"),
    testFileMessage: document.getElementById("testFileMessage"),
    confirmedTest: document.getElementById("confirmedTest"),
    uploadBtn: document.getElementById("uploadBtn"),
    formMessage: document.getElementById("formMessage"),
    historyList: document.getElementById("historyList"),
    versionCount: document.getElementById("versionCount"),
    adminDetails: document.getElementById("adminDetails"),
    adminLoggedOut: document.getElementById("adminLoggedOut"),
    adminLoggedIn: document.getElementById("adminLoggedIn"),
    adminLoginForm: document.getElementById("adminLoginForm"),
    adminPin: document.getElementById("adminPin"),
    adminLoginBtn: document.getElementById("adminLoginBtn"),
    adminLogoutBtn: document.getElementById("adminLogoutBtn"),
    adminMessage: document.getElementById("adminMessage")
  };

  let versions = [];
  let downloadUrls = [];
  let isAdmin = sessionStorage.getItem("jeu-ia-admin") === "1";
  const ADMIN_PIN = String(cfg.ADMIN_PIN || "2026");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setMessage(text, kind = "") {
    els.formMessage.textContent = text;
    els.formMessage.className = `form-message ${kind}`.trim();
  }

  function formatDate(iso) {
    return new Intl.DateTimeFormat("fr-BE", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  }

  function normalizedVersion(row) {
    return {
      id: Number(row.id),
      contributor: row.contributor || "Anonyme",
      change_note: row.change_note || "",
      html_content: row.html_content || "",
      created_at: row.created_at || new Date().toISOString()
    };
  }

  async function loadStarterHtml() {
    const response = await fetch("starter-game.html", { cache: "no-store" });
    if (!response.ok) throw new Error("Impossible de charger le jeu de départ.");
    return response.text();
  }

  function getLocalVersions() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map(normalizedVersion) : [];
    } catch {
      return [];
    }
  }

  function saveLocalVersions(list) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  }

  async function ensureInitialVersion() {
    if (remoteEnabled) {
      const { count, error } = await client.from("game_versions").select("id", { count: "exact", head: true });
      if (error) throw error;
      if ((count || 0) === 0) {
        const starter = await loadStarterHtml();
        const { error: insertError } = await client.from("game_versions").insert({
          contributor: "Version de départ",
          change_note: "Jeu initial : déplacer le carré et attraper les pièces jaunes.",
          html_content: starter
        });
        if (insertError) throw insertError;
      }
    } else {
      const local = getLocalVersions();
      if (local.length === 0) {
        const starter = await loadStarterHtml();
        saveLocalVersions([{
          id: 1,
          contributor: "Version de départ",
          change_note: "Jeu initial : déplacer le carré et attraper les pièces jaunes.",
          html_content: starter,
          created_at: new Date().toISOString()
        }]);
      }
    }
  }

  async function fetchVersions() {
    if (remoteEnabled) {
      const { data, error } = await client
        .from("game_versions")
        .select("id, contributor, change_note, html_content, created_at")
        .order("id", { ascending: false });
      if (error) throw error;
      versions = (data || []).map(normalizedVersion);
    } else {
      versions = getLocalVersions().sort((a, b) => b.id - a.id);
    }
    render();
  }

  function setAdminMessage(text, kind = "") {
    if (!els.adminMessage) return;
    els.adminMessage.textContent = text;
    els.adminMessage.className = `form-message ${kind}`.trim();
  }

  function refreshAdminState() {
    isAdmin = sessionStorage.getItem("jeu-ia-admin") === "1";
    renderAdminState();
  }

  function renderAdminState() {
    if (!els.adminLoggedOut || !els.adminLoggedIn) return;
    els.adminLoggedOut.hidden = Boolean(isAdmin);
    els.adminLoggedIn.hidden = !isAdmin;
  }

  function render() {
    // Keep object URLs alive while their links are displayed. Revoking them
    // immediately after a click can cancel the download in some browsers.
    downloadUrls.forEach(url => URL.revokeObjectURL(url));
    downloadUrls = [];
    const latest = versions[0];
    els.modeBadge.textContent = remoteEnabled ? "● Mode collaboratif" : "● Démo locale";
    els.modeBadge.style.color = remoteEnabled ? "var(--success)" : "var(--warning)";

    els.versionCount.textContent = `${versions.length} version${versions.length > 1 ? "s" : ""}`;

    if (latest) {
      els.latestVersion.textContent = `v${latest.id}`;
      els.latestMeta.textContent = `${latest.contributor} · ${formatDate(latest.created_at)}`;
      els.latestNote.textContent = latest.change_note;
      els.testLatestBtn.disabled = false;
      setDownloadLink(els.downloadLatestBtn, latest);
      els.downloadLatestBtn.classList.remove("is-disabled");
      els.downloadLatestBtn.removeAttribute("aria-disabled");
    } else {
      els.latestVersion.textContent = "—";
      els.latestMeta.textContent = "Aucune version disponible";
      els.latestNote.textContent = "";
      els.testLatestBtn.disabled = true;
      els.downloadLatestBtn.removeAttribute("href");
      els.downloadLatestBtn.removeAttribute("download");
      els.downloadLatestBtn.classList.add("is-disabled");
      els.downloadLatestBtn.setAttribute("aria-disabled", "true");
    }

    if (!versions.length) {
      els.historyList.innerHTML = '<div class="empty-history">Aucune version pour le moment.</div>';
      return;
    }

    els.historyList.innerHTML = versions.map((v, index) => `
      <article class="version-row">
        <div class="version-pill">v${v.id}${index === 0 ? " ★" : ""}</div>
        <div class="version-info">
          <strong>${escapeHtml(v.contributor)}</strong>
          <p>${escapeHtml(v.change_note)}</p>
          <div class="version-date">${formatDate(v.created_at)}</div>
        </div>
        <div class="version-actions">
          <button class="btn btn-ghost" data-action="test" data-id="${v.id}">Tester</button>
          <a class="btn btn-secondary" data-action="download" data-id="${v.id}" href="${downloadUrl(v)}" download="${downloadName(v)}">Télécharger</a>
          ${isAdmin && v.id !== 1 ? `<button class="btn btn-danger" data-action="delete" data-id="${v.id}">Supprimer</button>` : ""}
          ${isAdmin && v.id === 1 ? `<span class="version-protected">v1 protégée</span>` : ""}
        </div>
      </article>
    `).join("");
  }

  function getVersion(id) {
    return versions.find(v => v.id === Number(id));
  }

  function testVersion(version) {
    if (!version) return;
    els.testerTitle.textContent = `Tester v${version.id} — ${version.contributor}`;
    els.testerEmpty.hidden = true;
    els.gameFrame.hidden = false;
    els.gameFrame.srcdoc = version.html_content;
    document.querySelector(".tester-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeTester() {
    els.gameFrame.srcdoc = "";
    els.gameFrame.hidden = true;
    els.testerEmpty.hidden = false;
    els.testerTitle.textContent = "Tester une version";
  }

  function safeFileName(name) {
    return String(name || "contributeur")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "contributeur";
  }

  function downloadName(version) {
    return `jeu-ia-v${version.id}-${safeFileName(version.contributor)}.html`;
  }

  function downloadUrl(version) {
    const blob = new Blob([version.html_content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    downloadUrls.push(url);
    return url;
  }

  function setDownloadLink(link, version) {
    link.href = downloadUrl(version);
    link.download = downloadName(version);
  }

  function looksLikeHtml(content) {
    const lower = content.toLowerCase();
    return lower.includes("<html") && lower.includes("<script") && lower.includes("</html>");
  }

  async function publishVersion({ contributor, changeNote, htmlContent }) {
    if (remoteEnabled) {
      const { error } = await client.from("game_versions").insert({
        contributor,
        change_note: changeNote,
        html_content: htmlContent
      });
      if (error) throw error;
    } else {
      const local = getLocalVersions();
      const nextId = local.reduce((max, v) => Math.max(max, Number(v.id) || 0), 0) + 1;
      local.push({
        id: nextId,
        contributor,
        change_note: changeNote,
        html_content: htmlContent,
        created_at: new Date().toISOString()
      });
      saveLocalVersions(local);
    }
  }

  async function deleteVersion(version) {
    if (!remoteEnabled || !isAdmin || !version || version.id === 1) return;
    const ok = window.confirm(`Supprimer définitivement la v${version.id} de ${version.contributor} ?\n\nCette action est irréversible.`);
    if (!ok) return;

    const { error } = await client.from("game_versions").delete().eq("id", version.id);
    if (error) {
      window.alert(`Suppression impossible : ${error.message}`);
      return;
    }
    closeTester();
    await fetchVersions();
  }

  els.testLatestBtn.addEventListener("click", () => testVersion(versions[0]));
  els.downloadLatestBtn.addEventListener("click", () => {
    if (versions.length) els.downloadHint.textContent = "Téléchargement demandé. Si rien ne se passe, fais un clic droit sur ce lien, puis « Enregistrer le lien sous… ».";
  });
  els.closeTesterBtn.addEventListener("click", closeTester);

  els.gameFile.addEventListener("change", () => {
    els.fileName.textContent = els.gameFile.files?.[0]?.name || "Choisir un fichier…";
    els.testFileBtn.disabled = !els.gameFile.files?.length;
    els.testFileMessage.textContent = "";
  });

  els.testFileBtn.addEventListener("click", async () => {
    const file = els.gameFile.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".html") || file.size > MAX_FILE_SIZE) {
      els.testFileMessage.textContent = "Choisis un fichier .html de 1,5 Mo maximum.";
      return;
    }
    const html = await file.text();
    if (!looksLikeHtml(html)) {
      els.testFileMessage.textContent = "Ce fichier ne ressemble pas à un jeu HTML complet.";
      return;
    }
    els.testFileMessage.textContent = "Aperçu de ton fichier affiché ci-dessus. Vérifie le jeu avant de publier.";
    testVersion({ id: "à publier", contributor: file.name, html_content: html });
  });

  els.historyList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const version = getVersion(button.dataset.id);
    if (button.dataset.action === "test") testVersion(version);
    if (button.dataset.action === "delete") deleteVersion(version);
  });

  if (els.adminLoginForm) {
    els.adminLoginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      setAdminMessage("");
      if (String(els.adminPin.value) !== ADMIN_PIN) {
        setAdminMessage("Code incorrect.", "error");
        return;
      }
      sessionStorage.setItem("jeu-ia-admin", "1");
      els.adminPin.value = "";
      refreshAdminState();
      render();
      setAdminMessage("");
    });
  }

  if (els.adminLogoutBtn) {
    els.adminLogoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("jeu-ia-admin");
      refreshAdminState();
      render();
    });
  }

  els.uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("");

    const file = els.gameFile.files?.[0];
    const contributor = els.contributor.value.trim();
    const changeNote = els.changeNote.value.trim();

    if (!file || !contributor || !changeNote || !els.confirmedTest.checked) {
      setMessage("Complète tous les champs et confirme que tu as testé le jeu.", "error");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".html")) {
      setMessage("Le fichier doit être au format .html.", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage("Le fichier est trop volumineux. Limite : 1,5 Mo.", "error");
      return;
    }

    els.uploadBtn.disabled = true;
    els.uploadBtn.textContent = "Publication…";

    try {
      const htmlContent = await file.text();
      if (!looksLikeHtml(htmlContent)) {
        throw new Error("Ce fichier ne ressemble pas à un fichier HTML complet contenant le jeu.");
      }
      await publishVersion({ contributor, changeNote, htmlContent });
      els.uploadForm.reset();
      els.fileName.textContent = "Choisir un fichier…";
      els.testFileBtn.disabled = true;
      setMessage("Nouvelle version publiée. Le relais est prêt !", "success");
      await fetchVersions();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "La publication a échoué.", "error");
    } finally {
      els.uploadBtn.disabled = false;
      els.uploadBtn.textContent = "Publier cette version";
    }
  });

  async function init() {
    try {
      await ensureInitialVersion();
      refreshAdminState();
      await fetchVersions();
    } catch (error) {
      console.error(error);
      els.modeBadge.textContent = "Erreur de connexion";
      els.modeBadge.style.color = "var(--danger)";
      els.historyList.innerHTML = `<div class="empty-history">Impossible de charger les versions : ${escapeHtml(error.message)}</div>`;
    }
  }

  init();
})();
