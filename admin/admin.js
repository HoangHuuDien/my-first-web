(function () {
  var LOADING_MS = 5000;
  var TIMEOUT_MSG =
    "Không thể kết nối dữ liệu, vui lòng kiểm tra lại API Key";

  var VIEWS = {
    products: {
      kind: "content",
      table: "products",
      label: "Sản phẩm",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Tiêu đề" },
        { key: "slug", label: "Slug" },
        { key: "price_hint", label: "Giá gợi ý" },
      ],
    },
    customers: {
      kind: "content",
      table: "customers",
      label: "Khách hàng",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Tiêu đề" },
        { key: "slug", label: "Slug" },
        { key: "tags", label: "Tags" },
      ],
    },
    knowledge: {
      kind: "content",
      table: "knowledge",
      label: "Kiến thức / FAQ",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Tiêu đề" },
        { key: "category", label: "Loại" },
        { key: "slug", label: "Slug" },
      ],
    },
    orders: {
      kind: "sales",
      table: "orders",
      label: "Đơn hàng",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "customer_name", label: "Khách hàng" },
        { key: "amount", label: "Số tiền" },
        { key: "status", label: "Trạng thái" },
        { key: "created_at", label: "Ngày mua" },
      ],
    },
  };

  var currentView = "products";
  var rows = [];
  var statsToken = 0;
  var listToken = 0;

  var elStats = document.getElementById("stats");
  var elBanner = document.getElementById("admin-banner");
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

  function formatError(err) {
    if (!err) return TIMEOUT_MSG;
    if (err.name === "AbortError") return TIMEOUT_MSG;
    if (typeof err === "string") return err;
    return err.message || String(err);
  }

  function showBanner(text, isError) {
    if (!elBanner) return;
    if (!text) {
      elBanner.classList.add("hidden");
      elBanner.textContent = "";
      return;
    }
    elBanner.textContent = text;
    elBanner.classList.remove("hidden");
    elBanner.classList.toggle("err", !!isError);
  }

  function setStatsText(text, state) {
    elStats.textContent = text;
    elStats.classList.remove("loading", "err", "ok");
    if (state) elStats.classList.add(state);
  }

  function setEmptyMessage(text, show, isError) {
    elEmpty.textContent = text || "Không có dữ liệu";
    elEmpty.classList.toggle("hidden", !show);
    elEmpty.classList.toggle("err", !!isError);
  }

  function withLoadingTimeout(tokenRef, onTimeout) {
    return setTimeout(function () {
      if (tokenRef.current) onTimeout();
    }, LOADING_MS);
  }

  async function apiJson(path, options) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      ctrl.abort();
    }, LOADING_MS);

    try {
      var res = await fetch(path, {
        method: (options && options.method) || "GET",
        headers: Object.assign(
          { Accept: "application/json" },
          (options && options.headers) || {}
        ),
        body: options && options.body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      var json = null;
      try {
        json = await res.json();
      } catch (parseErr) {
        if (!res.ok) {
          throw new Error("HTTP " + res.status + " — phản hồi không hợp lệ");
        }
        throw parseErr;
      }

      if (!res.ok) {
        var msg =
          (json && json.error) ||
          "HTTP " + res.status + (json && json.code ? " (" + json.code + ")" : "");
        if (res.status === 503) {
          msg =
            (json && json.error) ||
            "Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trên Vercel.";
        }
        throw new Error(msg);
      }
      return json;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  function renderStatusBadge(status) {
    var s = String(status || "pending").toLowerCase();
    var cls = s === "success" ? "status-badge success" : "status-badge pending";
    return '<span class="' + cls + '">' + escapeHtml(s) + "</span>";
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

  async function loadStats() {
    var token = ++statsToken;
    var tokenRef = { current: true };
    setStatsText("Đang tải thống kê…", "loading");

    var timeoutId = withLoadingTimeout(tokenRef, function () {
      if (token !== statsToken) return;
      setStatsText(TIMEOUT_MSG, "err");
      showBanner(TIMEOUT_MSG, true);
    });

    try {
      var data = await apiJson("/api/admin/stats");
      if (token !== statsToken) return;
      tokenRef.current = false;
      clearTimeout(timeoutId);

      setStatsText(
        "SP: " +
          (data.products || 0) +
          " · KH: " +
          (data.customers || 0) +
          " · FAQ: " +
          (data.knowledge || 0) +
          " · Đơn: " +
          (data.orders || 0),
        "ok"
      );
      showBanner("", false);
    } catch (e) {
      if (token !== statsToken) return;
      tokenRef.current = false;
      clearTimeout(timeoutId);
      var msg = formatError(e);
      setStatsText("Lỗi thống kê: " + msg, "err");
      showBanner("Thống kê: " + msg, true);
    }
  }

  async function loadList() {
    var token = ++listToken;
    var tokenRef = { current: true };
    var view = cfg();
    elBody.innerHTML = "";
    setEmptyMessage("Đang tải…", true, false);

    var timeoutId = withLoadingTimeout(tokenRef, function () {
      if (token !== listToken) return;
      rows = [];
      renderList();
      setEmptyMessage(TIMEOUT_MSG, true, true);
    });

    var q = document.getElementById("search").value.trim();
    var url =
      "/api/admin/records?view=" +
      encodeURIComponent(currentView) +
      (q ? "&q=" + encodeURIComponent(q) : "");

    try {
      var res = await apiJson(url);
      if (token !== listToken) return;
      tokenRef.current = false;
      clearTimeout(timeoutId);
      rows = res.data || [];
      renderList();
    } catch (e) {
      if (token !== listToken) return;
      tokenRef.current = false;
      clearTimeout(timeoutId);
      rows = [];
      renderList();
      var msg = formatError(e);
      setEmptyMessage("Lỗi: " + msg, true, true);
      showBanner("Danh sách (" + view.label + "): " + msg, true);
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

    setEmptyMessage("Không có dữ liệu", rows.length === 0, false);

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
    elMsg.className = "msg";
    var view = cfg();

    try {
      var res = await apiJson(
        "/api/admin/records?view=" +
          encodeURIComponent(currentView) +
          "&id=" +
          encodeURIComponent(String(id))
      );
      var row = res.data;
      if (!row) throw new Error("Không tìm thấy bản ghi.");

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
        tr.classList.toggle(
          "selected",
          Number(tr.getAttribute("data-id")) === id
        );
      });
    } catch (e) {
      elMsg.className = "msg err";
      elMsg.textContent = formatError(e);
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
  document.getElementById("btn-refresh").addEventListener("click", function () {
    showBanner("", false);
    loadList();
    loadStats();
  });
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
        await apiJson("/api/admin/records", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            view: currentView,
            id: Number(id),
            payload: payload,
          }),
        });
      } else {
        await apiJson("/api/admin/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ view: currentView, payload: payload }),
        });
      }
      elMsg.className = "msg ok";
      elMsg.textContent = "Đã lưu.";
      await loadList();
      await loadStats();
      if (!id) closeEditor();
    } catch (err) {
      elMsg.className = "msg err";
      elMsg.textContent = formatError(err);
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
      await apiJson("/api/admin/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          view: "orders",
          id: Number(id),
          payload: payload,
        }),
      });
      elMsg.className = "msg ok";
      elMsg.textContent = "Đã cập nhật đơn.";
      await loadList();
      await loadStats();
    } catch (err) {
      elMsg.className = "msg err";
      elMsg.textContent = formatError(err);
    }
  });

  document.getElementById("btn-delete").addEventListener("click", async function () {
    var view = cfg();
    if (view.kind !== "content") return;
    var id = document.getElementById("f-id").value;
    if (!id || !confirm("Xóa bản ghi này?")) return;
    try {
      await apiJson(
        "/api/admin/records?view=" +
          encodeURIComponent(currentView) +
          "&id=" +
          encodeURIComponent(id),
        { method: "DELETE" }
      );
      closeEditor();
      await loadList();
      await loadStats();
    } catch (err) {
      elMsg.className = "msg err";
      elMsg.textContent = formatError(err);
    }
  });

  document.getElementById("btn-delete-order").addEventListener("click", async function () {
    var id = document.getElementById("o-id").value;
    if (!id || !confirm("Xóa đơn hàng này?")) return;
    try {
      await apiJson(
        "/api/admin/records?view=orders&id=" + encodeURIComponent(id),
        { method: "DELETE" }
      );
      closeEditor();
      await loadList();
      await loadStats();
    } catch (err) {
      elMsg.className = "msg err";
      elMsg.textContent = formatError(err);
    }
  });

  function boot() {
    setView("products");
  }

  boot();
})();
