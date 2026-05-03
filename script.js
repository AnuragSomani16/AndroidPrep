// =================================================
// Android Senior Interview Prep — script.js
// =================================================

// Sidebar mobile toggle
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("mobile-toggle");
  const sidebar = document.getElementById("sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  }

  // Highlight active nav based on filename
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("#sidebar nav a").forEach(a => {
    if (a.getAttribute("href") === path) a.classList.add("active");
  });

  // Difficulty filter (mock interview page)
  const filterButtons = document.querySelectorAll(".filter-btn");
  if (filterButtons.length) {
    filterButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.filter;
        filterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll("details.qa").forEach(qa => {
          if (target === "all") {
            qa.classList.remove("hidden");
          } else if (qa.classList.contains("diff-q-" + target)) {
            qa.classList.remove("hidden");
          } else {
            qa.classList.add("hidden");
          }
        });
      });
    });
  }

  // Expand/collapse all controls (mock interview)
  const expandAll = document.getElementById("expand-all");
  const collapseAll = document.getElementById("collapse-all");
  if (expandAll) {
    expandAll.addEventListener("click", () => {
      document.querySelectorAll("details.qa:not(.hidden)").forEach(d => d.open = true);
    });
  }
  if (collapseAll) {
    collapseAll.addEventListener("click", () => {
      document.querySelectorAll("details.qa").forEach(d => d.open = false);
    });
  }

  // Search across questions on mock page
  const search = document.getElementById("qa-search");
  if (search) {
    search.addEventListener("input", e => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll("details.qa").forEach(qa => {
        if (!q) {
          qa.classList.remove("hidden");
          return;
        }
        const text = qa.textContent.toLowerCase();
        if (text.includes(q)) qa.classList.remove("hidden");
        else qa.classList.add("hidden");
      });
    });
  }
});
