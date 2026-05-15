(function () {
  var currentTable = "products";
  var rows = [];

  var elStats = document.getElementById("stats");
  var elHead = document.getElementById("list-head");
  var elBody = document.getElementById("list-body");
  var elEmpty = document.getElementById("list-empty");
  var elEditor = document.getElementById("editor");
  var elForm = document.getElementById("form");
  var elMsg = document.getElementById("form-msg");

  function api(path, opts) {
    opts = opts || {};
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || r.statusText);
        return j;
      });
    });
  }

  function setTable(table) {
    currentTable = table;
    document.body.setAttribute("data-table", table);
    document.querySelectorAll("#tabs button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-table") === table);
    });
    closeEditor();
    loadList();
    loadStats();
  }

  function loadStats() {
    api("/api/admin/stats")
      .then(function (d) {
        if (!d.ok) throw new Error(d.error);
        elStats.textContent =
          "Sản phẩm: " +
          d.tables.products +
          " · Khách: " +
          d.tables.customers +
          " · Orders: " +
          d.tables.orders;
      })
      .catch(function (e) {
        elStats.textContent = "Lỗi: " + e.message;
      });
  }

  function listColumns() {
    if (currentTable === "products") {
      return ["id", "title", "slug", "price_hint"];
    }
    if (currentTable === "customers") {
      return ["id", "title", "slug", "tags"];
    }
    return ["id", "title", "slug", "category"];
  }

  function loadList() {
    var q = document.getElementById("search").value.trim();
    var url =
      "/api/admin/records?table=" +
      encodeURIComponent(currentTable) +
      (q ? "&q=" + encodeURIComponent(q) : "");
    api(url)
      .then(function (d) {
        rows = d.rows || [];
        renderList();
      })
      .catch(function (e) {
        rows = [];
        renderList();
        elEmpty.textContent = "Lỗi tải: " + e.message;
        elEmpty.classList.remove("hidden");
      });
  }

  function renderList() {
    var cols = listColumns();
    elHead.innerHTML =
      "<tr>" + cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr>";
    elBody.innerHTML = rows
      .map(function (row) {
        return (
          "<tr data-id=\"" +
          row.id +
          "\">" +
          cols
            .map(function (c) {
              var v = row[c] == null ? "" : String(row[c]);
              if (v.length > 48) v = v.slice(0, 45) + "…";
              return "<td>" + escapeHtml(v) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    elEmpty.classList.toggle("hidden", rows.length > 0);
    elBody.querySelectorAll("tr").forEach(function (tr) {
      tr.addEventListener("click", function () {
        openRow(Number(tr.getAttribute("data-id")));
      });
    });
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function openRow(id) {
    api("/api/admin/records?table=" + currentTable + "&id=" + id).then(function (d) {
      var row = d.row;
      document.getElementById("f-id").value = row.id;
      document.getElementById("f-slug").value = row.slug || "";
      document.getElementById("f-source").value = row.source_path || "";
      document.getElementById("f-title").value = row.title || "";
      document.getElementById("f-content").value = row.content || "";
      document.getElementById("f-price").value = row.price_hint || "";
      document.getElementById("f-tags").value = row.tags || "";
      document.getElementById("f-category").value = row.category || "";
      document.getElementById("f-related").value = row.related_product_slug || "";
      document.getElementById("editor-title").textContent = row.title || "Chi tiết";
      elEditor.classList.remove("hidden");
      elMsg.textContent = "";
      elBody.querySelectorAll("tr").forEach(function (tr) {
        tr.classList.toggle("selected", Number(tr.getAttribute("data-id")) === id);
      });
    });
  }

  function closeEditor() {
    elEditor.classList.add("hidden");
    elForm.reset();
    document.getElementById("f-id").value = "";
  }

  document.getElementById("tabs").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-table]");
    if (btn) setTable(btn.getAttribute("data-table"));
  });

  document.getElementById("search").addEventListener(
    "input",
    debounce(loadList, 300)
  );
  document.getElementById("btn-refresh").addEventListener("click", loadList);
  document.getElementById("btn-cancel").addEventListener("click", closeEditor);

  document.getElementById("btn-new").addEventListener("click", function () {
    closeEditor();
    document.getElementById("f-id").value = "";
    document.getElementById("f-slug").value = "moi-" + Date.now();
    document.getElementById("f-source").value =
      "manual/" + currentTable + "/" + Date.now() + ".md";
    document.getElementById("editor-title").textContent = "Thêm mới";
    elEditor.classList.remove("hidden");
  });

  elForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = document.getElementById("f-id").value;
    var body = {
      slug: document.getElementById("f-slug").value,
      source_path: document.getElementById("f-source").value,
      title: document.getElementById("f-title").value,
      content: document.getElementById("f-content").value,
    };
    if (currentTable === "products") {
      body.price_hint = document.getElementById("f-price").value || null;
    } else if (currentTable === "customers") {
      body.tags = document.getElementById("f-tags").value || null;
    } else {
      body.category = document.getElementById("f-category").value || null;
      body.related_product_slug =
        document.getElementById("f-related").value || null;
    }

    var method = id ? "PUT" : "POST";
    if (id) body.id = Number(id);

    api("/api/admin/records?table=" + currentTable, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function () {
        elMsg.className = "msg ok";
        elMsg.textContent = "Đã lưu.";
        loadList();
        loadStats();
        if (!id && method === "POST") closeEditor();
      })
      .catch(function (err) {
        elMsg.className = "msg err";
        elMsg.textContent = err.message;
      });
  });

  document.getElementById("btn-delete").addEventListener("click", function () {
    var id = document.getElementById("f-id").value;
    if (!id || !confirm("Xóa bản ghi này?")) return;
    api("/api/admin/records?table=" + currentTable + "&id=" + id, {
      method: "DELETE",
    })
      .then(function () {
        closeEditor();
        loadList();
        loadStats();
      })
      .catch(function (err) {
        elMsg.className = "msg err";
        elMsg.textContent = err.message;
      });
  });

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  setTable("products");
})();
