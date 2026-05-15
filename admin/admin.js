(function () {
  /**
   * Routing ro rang: moi tab -> 1 view -> 1 bang Supabase.
   * - products, customers, knowledge: noi dung markdown (/data)
   * - orders: DON HANG ban hang (SePay), KHONG phai FAQ
   */
  var VIEWS = {
    products: {
      kind: "content",
      table: "products",
      label: "Sản phẩm",
      listSelect:
        "id, source_path, slug, title, price_hint, updated_at",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Tiêu đề" },
        { key: "slug", label: "Slug" },
        { key: "price_hint", label: "Giá gợi ý" },
      ],
      searchFields: ["title", "slug", "source_path"],
    },
    customers: {
      kind: "content",
      table: "customers",
      label: "Khách hàng",
      listSelect: "id, source_path, slug, title, tags, updated_at",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Tiêu đề" },
        { key: "slug", label: "Slug" },
        { key: "tags", label: "Tags" },
      ],
      searchFields: ["title", "slug", "source_path"],
    },
    knowledge: {
      kind: "content",
      table: "knowledge",
      label: "Kiến thức / FAQ",
      listSelect:
        "id, source_path, slug, title, category, updated_at",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Tiêu đề" },
        { key: "category", label: "Loại" },
        { key: "slug", label: "Slug" },
      ],
      searchFields: ["title", "slug", "source_path", "category"],
    },
    orders: {
      kind: "sales",
      table: "orders",
      label: "Đơn hàng",
      listSelect:
        "id, customer_name, customer_phone, amount, status, created_at",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "customer_name", label: "Khách hàng" },
        { key: "amount", label: "Số tiền" },
        { key: "status", label: "Trạng thái" },
        { key: "created_at", label: "Ngày mua" },
      ],
      searchFields: [
        "customer_name",
        "customer_phone",
        "customer_email",
        "status",
        "transfer_content",
      ],
    },
  };

  var currentView = "products";
  var rows = [];
  var supabase = null;

  var elStats = document.getElementById("stats");
  var elHead = document.getElementById("list-head");
  var elBody = document.getElementById("list-body");
  var elEmpty = document.getElementById("list-empty");
  var elEditor = document.getElementById("editor");
  var elFormContent = document.getElementById("form-content");
  var elFormOrder = document.getElementById("form-order");
  var elMsg = document.getElementById("form-msg");
  var btnNew = document.getElementById("btn-new");

  function cfg() {
    return VIEWS[currentView];
  }

  function initClient() {
    var c = window.__ADMIN_SUPABASE__ || {};
    var url = (c.url || "").trim();
    var key = (c.anonKey || "").trim();
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Không tải được Supabase SDK.");
    }
    if (!url || !key) {
      throw new Error("Thiếu cấu hình Supabase.");
    }
    return window.supabase.createClient(url, key);
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

  function formatMoney(n) {
    var num = Number(n) || 0;
    return num.toLocaleString("vi-VN") + "đ";
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("vi-VN");
    } catch (e) {
      return String(iso);
    }
  }

  function renderStatusBadge(status) {
    var s = String(status || "pending").toLowerCase();
    var cls = s === "success" ? "status-badge success" : "status-badge pending";
    return '<span class="' + cls + '">' + escapeHtml(s) + "</span>";
  }

  function setEmptyMessage(text, show) {
    elEmpty.textContent = text || "Không có dữ liệu";
    elEmpty.classList.toggle("hidden", !show);
  }

  function setStatsText(text) {
    elStats.textContent = text;
  }

  async function countTable(table) {
    var res = await supabase
      .from(table)
      .select("id", { count: "exact", head: true });
    if (res.error) throw res.error;
    return res.count || 0;
  }

  async function loadStats() {
    try {
      var keys = ["products", "customers", "knowledge", "orders"];
      var counts = await Promise.all(
        keys.map(function (k) {
          return countTable(VIEWS[k].table);
        })
      );
      setStatsText(
        "SP: " +
          counts[0] +
          " · KH: " +
          counts[1] +
          " · FAQ: " +
          counts[2] +
          " · Đơn: " +
          counts[3]
      );
    } catch (e) {
      setStatsText("Lỗi thống kê: " + (e.message || String(e)));
    }
  }

  function cellValue(row, col) {
    var v = row[col.key];
    if (col.key === "amount") return formatMoney(v);
    if (col.key === "created_at") return formatDate(v);
    if (col.key === "status") return renderStatusBadge(v);
    if (v == null) return "";
    var s = String(v);
    if (s.length > 48) return escapeHtml(s.slice(0, 45) + "…");
    return escapeHtml(s);
  }

  async function loadList() {
    var view = cfg();
    elBody.innerHTML = "";
    setEmptyMessage("Đang tải…", true);

    var q = document.getElementById("search").value.trim();
    var query = supabase
      .from(view.table)
      .select(view.listSelect)
      .order(view.kind === "sales" ? "created_at" : "id", {
        ascending: false,
      })
      .limit(200);

    if (q && view.searchFields.length) {
      var pattern = "%" + q + "%";
      var parts = view.searchFields.map(function (f) {
        return f + ".ilike." + pattern;
      });
      query = query.or(parts.join(","));
    }

    try {
      var res = await query;
      if (res.error) throw res.error;
      rows = res.data || [];
      renderList();
    } catch (e) {
      rows = [];
      renderList();
      setEmptyMessage("Lỗi: " + (e.message || String(e)), true);
    }
  }

  function renderList() {
    var view = cfg();
    elHead.innerHTML =
      "<tr>" +
      view.listColumns
        .map(function (c) {
          return "<th>" + escapeHtml(c.label) + "</th>";
        })
        .join("") +
      "</tr>";

    elBody.innerHTML = rows
      .map(function (row) {
        return (
          "<tr data-id=\"" +
          row.id +
          "\">" +
          view.listColumns
            .map(function (col) {
              return "<td>" + cellValue(row, col) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");

    setEmptyMessage("Không có dữ liệu", rows.length === 0);

    elBody.querySelectorAll("tr").forEach(function (tr) {
      tr.addEventListener("click", function () {
        openRow(Number(tr.getAttribute("data-id")));
      });
    });
  }

  function showContentForm() {
    elFormContent.classList.remove("hidden");
    elFormOrder.classList.add("hidden");
  }

  function showOrderForm() {
    elFormContent.classList.add("hidden");
    elFormOrder.classList.remove("hidden");
  }

  function updateFieldVisibility() {
    document.body.setAttribute("data-view", currentView);
    var isSales = cfg().kind === "sales";
    btnNew.style.display = isSales ? "none" : "block";
    document.getElementById("search").placeholder = isSales
      ? "Tìm khách, SĐT, trạng thái…"
      : "Tìm tiêu đề, slug, đường dẫn…";
  }

  async function openRow(id) {
    elMsg.textContent = "";
    var view = cfg();
    try {
      var res = await supabase
        .from(view.table)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw new Error("Không tìm thấy bản ghi.");
      var row = res.data;

      if (view.kind === "sales") {
        showOrderForm();
        document.getElementById("o-id").value = row.id;
        document.getElementById("o-name").value = row.customer_name || "";
        document.getElementById("o-phone").value = row.customer_phone || "";
        document.getElementById("o-email").value = row.customer_email || "";
        document.getElementById("o-amount").value = row.amount || 0;
        document.getElementById("o-status").value =
          row.status === "success" ? "success" : "pending";
        document.getElementById("o-note").value = row.product_note || "";
        document.getElementById("o-transfer").value =
          row.transfer_content || "";
        document.getElementById("o-created").textContent =
          "Ngày mua: " + formatDate(row.created_at);
        document.getElementById("editor-title").textContent =
          "Đơn #" + row.id + " — " + (row.customer_name || "Khách");
      } else {
        showContentForm();
        document.getElementById("f-id").value = row.id;
        document.getElementById("f-slug").value = row.slug || "";
        document.getElementById("f-source").value = row.source_path || "";
        document.getElementById("f-title").value = row.title || "";
        document.getElementById("f-content").value = row.content || "";
        document.getElementById("f-price").value = row.price_hint || "";
        document.getElementById("f-tags").value = row.tags || "";
        document.getElementById("f-category").value = row.category || "";
        document.getElementById("f-related").value =
          row.related_product_slug || "";
        document.getElementById("editor-title").textContent =
          row.title || "Chi tiết";
      }

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
    elFormContent.reset();
    elFormOrder.reset();
    document.getElementById("f-id").value = "";
    document.getElementById("o-id").value = "";
  }

  function setView(viewKey) {
    if (!VIEWS[viewKey]) return;
    currentView = viewKey;
    document.querySelectorAll("#tabs button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === viewKey);
    });
    updateFieldVisibility();
    closeEditor();
    loadList();
    loadStats();
  }

  document.getElementById("tabs").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-view]");
    if (btn) setView(btn.getAttribute("data-view"));
  });

  document.getElementById("search").addEventListener("input", debounce(loadList, 300));
  document.getElementById("btn-refresh").addEventListener("click", loadList);
  document.getElementById("btn-cancel").addEventListener("click", closeEditor);
  document.getElementById("btn-cancel-order").addEventListener("click", closeEditor);

  btnNew.addEventListener("click", function () {
    if (cfg().kind === "sales") return;
    closeEditor();
    showContentForm();
    document.getElementById("f-id").value = "";
    document.getElementById("f-slug").value = "moi-" + Date.now();
    document.getElementById("f-source").value =
      "manual/" + cfg().table + "/" + Date.now() + ".md";
    document.getElementById("editor-title").textContent = "Thêm mới";
    elEditor.classList.remove("hidden");
    elMsg.textContent = "";
  });

  elFormContent.addEventListener("submit", async function (e) {
    e.preventDefault();
    var view = cfg();
    if (view.kind !== "content") return;

    var id = document.getElementById("f-id").value;
    var payload = {
      source_path: document.getElementById("f-source").value,
      slug: document.getElementById("f-slug").value,
      title: document.getElementById("f-title").value,
      content: document.getElementById("f-content").value,
      updated_at: new Date().toISOString(),
    };
    if (currentView === "products") {
      payload.price_hint = document.getElementById("f-price").value || null;
    } else if (currentView === "customers") {
      payload.tags = document.getElementById("f-tags").value || null;
    } else if (currentView === "knowledge") {
      payload.category = document.getElementById("f-category").value || null;
      payload.related_product_slug =
        document.getElementById("f-related").value || null;
    }

    try {
      if (id) {
        var up = await supabase
          .from(view.table)
          .update(payload)
          .eq("id", Number(id));
        if (up.error) throw up.error;
      } else {
        var ins = await supabase.from(view.table).insert([payload]);
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

  elFormOrder.addEventListener("submit", async function (e) {
    e.preventDefault();
    var id = document.getElementById("o-id").value;
    if (!id) return;
    var payload = {
      customer_name: document.getElementById("o-name").value,
      customer_phone: document.getElementById("o-phone").value || null,
      customer_email: document.getElementById("o-email").value || null,
      amount: Number(document.getElementById("o-amount").value) || 0,
      status: document.getElementById("o-status").value,
      product_note: document.getElementById("o-note").value || null,
      updated_at: new Date().toISOString(),
    };
    try {
      var up = await supabase
        .from("orders")
        .update(payload)
        .eq("id", Number(id));
      if (up.error) throw up.error;
      elMsg.className = "msg ok";
      elMsg.textContent = "Đã cập nhật đơn.";
      await loadList();
      await loadStats();
    } catch (err) {
      elMsg.className = "msg err";
      elMsg.textContent = err.message || String(err);
    }
  });

  document.getElementById("btn-delete").addEventListener("click", async function () {
    var view = cfg();
    if (view.kind !== "content") return;
    var id = document.getElementById("f-id").value;
    if (!id || !confirm("Xóa bản ghi này?")) return;
    try {
      var del = await supabase.from(view.table).delete().eq("id", Number(id));
      if (del.error) throw del.error;
      closeEditor();
      await loadList();
      await loadStats();
    } catch (err) {
      elMsg.className = "msg err";
      elMsg.textContent = err.message || String(err);
    }
  });

  document.getElementById("btn-delete-order").addEventListener("click", async function () {
    var id = document.getElementById("o-id").value;
    if (!id || !confirm("Xóa đơn hàng này?")) return;
    try {
      var del = await supabase.from("orders").delete().eq("id", Number(id));
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
      setView("products");
    } catch (e) {
      setStatsText("Lỗi: " + (e.message || String(e)));
      setEmptyMessage("Không kết nối Supabase: " + (e.message || String(e)), true);
    }
  }

  boot();
})();
