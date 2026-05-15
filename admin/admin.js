(function () {
  var TABLES = ["products", "customers", "orders"];
  var LIST_SELECT = {
    products: "id, source_path, slug, title, price_hint, updated_at",
    customers: "id, source_path, slug, title, tags, updated_at",
    orders: "id, source_path, slug, title, category, updated_at",
  };
  var LIST_COLUMNS = {
    products: ["id", "title", "slug", "price_hint"],
    customers: ["id", "title", "slug", "tags"],
    orders: ["id", "title", "slug", "category"],
  };

  var currentTable = "products";
  var rows = [];
  var supabase = null;

  var elStats = document.getElementById("stats");
  var elHead = document.getElementById("list-head");
  var elBody = document.getElementById("list-body");
  var elEmpty = document.getElementById("list-empty");
  var elEditor = document.getElementById("editor");
  var elForm = document.getElementById("form");
  var elMsg = document.getElementById("form-msg");

  function initClient() {
    var cfg = window.__ADMIN_SUPABASE__ || {};
    var url = (cfg.url || "").trim();
    var key = (cfg.anonKey || "").trim();
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Không tải được Supabase SDK.");
    }
    if (!url || !key) {
      throw new Error("Thiếu SUPABASE_URL hoặc anon key trong cấu hình Admin.");
    }
    return window.supabase.createClient(url, key);
  }

  function setStatsText(text) {
    elStats.textContent = text;
  }

  function setEmptyMessage(text, show) {
    elEmpty.textContent = text || "Không có dữ liệu";
    elEmpty.classList.toggle("hidden", !show);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  async function countTable(table) {
    var res = await supabase.from(table).select("id", { count: "exact", head: true });
    if (res.error) throw res.error;
    return res.count || 0;
  }

  async function loadStats() {
    try {
      var counts = await Promise.all(TABLES.map(countTable));
      setStatsText(
        "Sản phẩm: " +
          counts[0] +
          " · Khách: " +
          counts[1] +
          " · Orders: " +
          counts[2]
      );
    } catch (e) {
      setStatsText("Lỗi thống kê: " + (e.message || String(e)));
    }
  }

  async function loadList() {
    elBody.innerHTML = "";
    setEmptyMessage("Đang tải…", true);

    var q = document.getElementById("search").value.trim();
    var query = supabase
      .from(currentTable)
      .select(LIST_SELECT[currentTable])
      .order("id", { ascending: true })
      .limit(200);

    if (q) {
      var pattern = "%" + q + "%";
      query = query.or(
        "title.ilike." +
          pattern +
          ",slug.ilike." +
          pattern +
          ",source_path.ilike." +
          pattern
      );
    }

    try {
      var res = await query;
      if (res.error) throw res.error;
      rows = res.data || [];
      renderList();
    } catch (e) {
      rows = [];
      renderList();
      setEmptyMessage("Lỗi tải: " + (e.message || String(e)), true);
    }
  }

  function renderList() {
    var cols = LIST_COLUMNS[currentTable];
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

    if (rows.length === 0) {
      setEmptyMessage("Không có dữ liệu", true);
    } else {
      setEmptyMessage("", false);
    }

    elBody.querySelectorAll("tr").forEach(function (tr) {
      tr.addEventListener("click", function () {
        openRow(Number(tr.getAttribute("data-id")));
      });
    });
  }

  async function openRow(id) {
    elMsg.textContent = "";
    try {
      var res = await supabase
        .from(currentTable)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw new Error("Không tìm thấy bản ghi.");
      var row = res.data;
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
      elBody.querySelectorAll("tr").forEach(function (tr) {
        tr.classList.toggle("selected", Number(tr.getAttribute("data-id")) === id);
      });
    } catch (e) {
      elMsg.className = "msg err";
      elMsg.textContent = e.message || String(e);
    }
  }

  function closeEditor() {
    elEditor.classList.add("hidden");
    elForm.reset();
    document.getElementById("f-id").value = "";
  }

  function buildRowPayload() {
    var ts = new Date().toISOString();
    var row = {
      source_path: document.getElementById("f-source").value,
      slug: document.getElementById("f-slug").value,
      title: document.getElementById("f-title").value,
      content: document.getElementById("f-content").value,
      updated_at: ts,
    };
    if (currentTable === "products") {
      row.price_hint = document.getElementById("f-price").value || null;
    } else if (currentTable === "customers") {
      row.tags = document.getElementById("f-tags").value || null;
    } else {
      row.category = document.getElementById("f-category").value || null;
      row.related_product_slug = document.getElementById("f-related").value || null;
    }
    return row;
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

  document.getElementById("tabs").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-table]");
    if (btn) setTable(btn.getAttribute("data-table"));
  });

  document.getElementById("search").addEventListener("input", debounce(loadList, 300));
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
    elMsg.textContent = "";
  });

  elForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var id = document.getElementById("f-id").value;
    var payload = buildRowPayload();
    try {
      if (id) {
        var up = await supabase.from(currentTable).update(payload).eq("id", Number(id));
        if (up.error) throw up.error;
      } else {
        var ins = await supabase.from(currentTable).insert([payload]).select("id").single();
        if (ins.error) throw ins.error;
      }
      elMsg.className = "msg ok";
      elMsg.textContent = "Đã lưu.";
      await loadList();
      await loadStats();
      if (!id) closeEditor();
    } catch (err) {
      elMsg.className = "msg err";
      elMsg.textContent = err.message || String(err);
    }
  });

  document.getElementById("btn-delete").addEventListener("click", async function () {
    var id = document.getElementById("f-id").value;
    if (!id || !confirm("Xóa bản ghi này?")) return;
    try {
      var del = await supabase.from(currentTable).delete().eq("id", Number(id));
      if (del.error) throw del.error;
      closeEditor();
      await loadList();
      await loadStats();
    } catch (err) {
      elMsg.className = "msg err";
      elMsg.textContent = err.message || String(err);
    }
  });

  async function boot() {
    try {
      supabase = initClient();
      setTable("products");
    } catch (e) {
      setStatsText("Lỗi: " + (e.message || String(e)));
      setEmptyMessage("Không kết nối được Supabase: " + (e.message || String(e)), true);
    }
  }

  boot();
})();
