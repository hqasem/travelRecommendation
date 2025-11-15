const btnClear = document.getElementById("clearBtn");
const btnSearch = document.getElementById("searchBtn");

(function () {
  const YEARS = ["year", "year2", "year3"];
  YEARS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = new Date().getFullYear();
  });

  // mobile nav toggle
  document.querySelectorAll(".nav-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const links = document.querySelectorAll(".nav a");
      links.forEach((a) => {
        a.style.display = a.style.display === "block" ? "" : "block";
      });
    });
  });

  // contact form (client-side mock)
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.elements["name"]?.value?.trim();
      const email = form.elements["email"]?.value?.trim();
      const message = form.elements["message"]?.value?.trim();
      const msgEl = document.getElementById("formMsg");

      if (!name || !email || !message) {
        msgEl.textContent = "Please fill all fields.";
        msgEl.style.color = "#ffcccb";
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        msgEl.textContent = "Please enter a valid email.";
        msgEl.style.color = "#ffcccb";
        return;
      }
      msgEl.textContent = "Thanks! Your message has been sent (mock).";
      msgEl.style.color = "#b9ffd5";
      form.reset();
    });
  }

  // ========== SEARCH AREA ==========
  const searchInput = document.getElementById("searchInput");
  const cardsContainer = document.getElementById("dest");
  const noResults = document.getElementById("noResults");

  if (!searchInput || !cardsContainer || !noResults) {
    console.warn(
      "Search elements missing. Make sure index.html contains #searchInput, #dest and #noResults."
    );
    return;
  }

  let allResults = [];
  let dataLoaded = false;
  let loadingEl = null;
  const FALLBACK_IMG =
    "https://via.placeholder.com/800x450?text=Image+not+available";

  // small helper to show loading text under nav/search
  function showLoading(text) {
    if (!loadingEl) {
      loadingEl = document.createElement("div");
      loadingEl.style.color = "#fff";
      loadingEl.style.marginTop = "8px";
      loadingEl.style.fontSize = "13px";
      loadingEl.id = "search-loading";
      // place it right after search input (if possible)
      searchInput.parentNode.insertBefore(loadingEl, searchInput.nextSibling);
    }
    loadingEl.textContent = text;
  }
  function hideLoading() {
    if (loadingEl) loadingEl.textContent = "";
  }

  // Fetch and flatten JSON data
  (function fetchData() {
    showLoading("Loading destinations...");
    fetch("./travel_recommendation_api.json", { cache: "no-store" })
      .then((resp) => {
        if (!resp.ok) throw new Error("Failed to fetch JSON: " + resp.status);
        return resp.json();
      })
      .then((data) => {
        const { countries = [], temples = [], beaches = [] } = data;
        const out = [];

        // Countries -> cities
        countries.forEach((country) => {
          const countryName = (country.name || "").toLowerCase();
          (country.cities || []).forEach((city) => {
            out.push({
              name: city.name || "Unknown",
              description: city.description || "",
              imageUrl:
                city.imageUrl && city.imageUrl !== ""
                  ? city.imageUrl
                  : FALLBACK_IMG,
              category: countryName,
              type: "city",
            });
          });
        });

        // Temples
        (temples || []).forEach((t) => {
          out.push({
            name: t.name || "Unknown",
            description: t.description || "",
            imageUrl:
              t.imageUrl && t.imageUrl !== "" ? t.imageUrl : FALLBACK_IMG,
            category: "temple",
            type: "temple",
          });
        });

        // Beaches
        (beaches || []).forEach((b) => {
          out.push({
            name: b.name || "Unknown",
            description: b.description || "",
            imageUrl:
              b.imageUrl && b.imageUrl !== "" ? b.imageUrl : FALLBACK_IMG,
            category: "beach",
            type: "beach",
          });
        });

        allResults = out;
        dataLoaded = true;
        hideLoading();
        console.info("Destinations loaded:", allResults.length);
      })
      .catch((err) => {
        hideLoading();
        dataLoaded = false;
        console.error("Error loading travel_recommendation_api.json", err);
        showLoading("Failed to load destinations (check console).");
      });
  })();

  // debounce helper
  function debounce(fn, wait = 220) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // render function for results array
  function renderResults(results) {
    cardsContainer.innerHTML = "";
    if (results.length === 0) {
      cardsContainer.style.display = "none";
      cardsContainer.classList.remove("show");
      noResults.style.display = "block";
      return;
    }

    // Show matching results
    cardsContainer.style.display = "flex";
    noResults.style.display = "none";
    cardsContainer.classList.add("show");

    results.forEach((item) => {
      const card = document.createElement("div");
      card.className = "card";
      // sanitize basic fields (avoid undefined)
      const img = item.imageUrl || FALLBACK_IMG;
      const name = item.name || "";
      const desc = item.description || "";
      const cat = item.category || "";

      card.innerHTML = `
        <img src="${img}" alt="${escapeHtml(
        name
      )}" onerror="this.src='${FALLBACK_IMG}'" />
        <div class="card-body">
          <h3>${escapeHtml(name)}</h3>
          <p>${escapeHtml(desc)}</p>
          <button class="btn small">Visit</button>
        </div>`;
      cardsContainer.appendChild(card);
    });
  }

  // simple escape to avoid injecting HTML if JSON is untrusted
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m];
    });
  }

  // Search logic: tokenized + category-aware
  function performSearchRaw(raw) {
    if (!dataLoaded) {
      // if data not ready, show loading message and bail
      showLoading("Still loading destinations — please wait...");
      return;
    } else {
      hideLoading();
    }

    const q = String(raw || "")
      .toLowerCase()
      .trim();
    if (!q) {
      cardsContainer.innerHTML = "";
      cardsContainer.style.display = "none";
      noResults.style.display = "none";
      return;
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    // two matching strategies:
    // 1) category-aware: if token matches 'beach' or 'temple' or a country name exactly (or included)
    // 2) name/description partial matches
    const results = allResults.filter((item) => {
      const combined =
        `${item.name} ${item.description} ${item.category}`.toLowerCase();

      // if any token explicitly names a category or country, require that filter (strict category)
      const categoryTokens = tokens.filter(
        (t) =>
          ["beach", "temple", "city", "country"].includes(t) ||
          allResults.some((x) => x.category && x.category.includes(t))
      );
      if (categoryTokens.length > 0) {
        // at least one category token present: require that all category tokens match item.category or name
        const catMatched = categoryTokens.every((ct) => {
          // match if token equals the item's category, or token is contained in category, or token in name
          return (
            (item.category || "").includes(ct) ||
            (item.name || "").toLowerCase().includes(ct)
          );
        });
        if (!catMatched) return false;
      }

      // now ensure other tokens appear somewhere in combined string
      const otherTokens = tokens.filter((t) => !categoryTokens.includes(t));
      const otherMatched = otherTokens.every((t) => combined.includes(t));

      // if there were no other tokens but category matched, accept
      return otherTokens.length === 0
        ? categoryTokens.length > 0
          ? true
          : false
        : otherMatched;
    });

    renderResults(results);
    // Scroll the results area into view when search runs
    const resultsArea = document.getElementById("searchResultsArea");
    if (resultsArea && results.length > 0) {
      resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  window.performSearchRaw = performSearchRaw;

  // debounce wrapper
  const debouncedSearch = debounce((e) => {
    const v = e && e.target ? e.target.value : e || "";
    performSearchRaw(v);
  }, 200);

  // wire event
  // searchInput.addEventListener('input', (e) => {
  //   // clear previous no-results while typing
  //   noResults.style.display = 'none';
  //   debouncedSearch(e);
  // });

  // // optional: allow pressing Enter to run immediate search (no debounce)
  // searchInput.addEventListener('keydown', (ev) => {
  //   if (ev.key === 'Enter') {
  //     ev.preventDefault();
  //     performSearchRaw(searchInput.value);
  //   }
  // });

  // expose for debugging
  window._travelSearch = {
    getResults: () => allResults,
    isLoaded: () => dataLoaded,
  };
})();

const searchBtn = document.getElementById('searchBtn');
const clearBtn  = document.getElementById('clearBtn');
const searchInput = document.getElementById('searchInput');

if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    window.performSearchRaw(searchInput.value);
  });
}

if (searchInput) {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.performSearchRaw(searchInput.value);
    }
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    const dest = document.getElementById('dest');
    const noRes = document.getElementById('noResults');
    if (dest) { dest.innerHTML = ''; dest.style.display = 'none'; }
    if (noRes) noRes.style.display = 'none';
    // remove animation class if present
    document.querySelector('.results-container')?.classList.remove('show');
  });
}
