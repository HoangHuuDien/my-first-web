/**
 * Map section → extract / replace trong index.html hoặc .env (price).
 */
export const SECTION_IDS = [
  "hero_title",
  "hero_intro",
  "offer",
  "register_headline",
  "quote",
  "page_title",
  "price",
  "cta_button",
];

const HTML_SECTIONS = {
  hero_title: {
    label: "Tiêu đề hero (h1.main-title)",
    extract(html) {
      return matchInner(html, /<h1\s+class="main-title"[^>]*>([\s\S]*?)<\/h1>/i);
    },
    replace(html, newInner) {
      return replaceOnce(
        html,
        /<h1\s+class="main-title"[^>]*>[\s\S]*?<\/h1>/i,
        `<h1 class="main-title">\n        ${newInner}\n      </h1>`
      );
    },
    formatNewText(text) {
      const t = text.trim();
      if (t.includes("<")) return t;
      const lines = t.split(/\n+/).filter(Boolean);
      if (lines.length <= 1) {
        return `<span class="title-line">${escapeHtml(lines[0] || t)}</span>`;
      }
      return lines
        .map((line, i) => {
          const cls =
            i === lines.length - 1 && lines.length > 1
              ? "standout title-line"
              : "title-line";
          return `<span class="${cls}">${escapeHtml(line)}</span>`;
        })
        .join("\n        ");
    },
  },
  hero_intro: {
    label: "Intro hero (p.intro-text)",
    extract(html) {
      return matchInner(html, /<p\s+class="intro-text"[^>]*>([\s\S]*?)<\/p>/i);
    },
    replace(html, newInner) {
      return replaceOnce(
        html,
        /<p\s+class="intro-text"[^>]*>[\s\S]*?<\/p>/i,
        `<p class="intro-text">${escapeHtml(newInner)}</p>`
      );
    },
    formatNewText(text) {
      return text.trim();
    },
  },
  offer: {
    label: "Khối offer hero (.hero .offer-card)",
    extract(html) {
      return matchInner(
        html,
        /<section\s+class="hero"[^>]*>[\s\S]*?<div class="offer-card">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/i
      );
    },
    replace(html, newInner) {
      return replaceOnce(
        html,
        /(<section\s+class="hero"[^>]*>[\s\S]*?<div\s+class="offer-card">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/section>)/i,
        `$1\n        ${newInner}\n      $2`
      );
    },
    formatNewText(text) {
      return text.trim();
    },
  },
  register_headline: {
    label: "Headline form đăng ký",
    extract(html) {
      return matchInner(
        html,
        /<section\s+class="register-section"[^>]*>[\s\S]*?<h3\s+class="offer-heading"[^>]*>([\s\S]*?)<\/h3>/i
      );
    },
    replace(html, newInner) {
      return replaceOnce(
        html,
        /(<section\s+class="register-section"[^>]*>[\s\S]*?<h3\s+class="offer-heading"[^>]*>)[\s\S]*?(<\/h3>)/i,
        `$1${newInner}$2`
      );
    },
    formatNewText(text) {
      const t = text.trim();
      if (t.includes("<")) return t;
      return `<span class="icon">📩</span>${escapeHtml(t)}`;
    },
  },
  quote: {
    label: "Quote cuối form",
    extract(html) {
      return matchInner(html, /<div\s+class="quote"[^>]*>([\s\S]*?)<\/div>/i);
    },
    replace(html, newInner) {
      return replaceOnce(
        html,
        /<div\s+class="quote"[^>]*>[\s\S]*?<\/div>/i,
        `<div class="quote">${newInner}</div>`
      );
    },
    formatNewText(text) {
      return formatQuoteInner(text);
    },
  },
  page_title: {
    label: "Thẻ <title>",
    extract(html) {
      return matchInner(html, /<title>([\s\S]*?)<\/title>/i);
    },
    replace(html, newInner) {
      return replaceOnce(
        html,
        /<title>[\s\S]*?<\/title>/i,
        `<title>${escapeHtml(newInner)}</title>`
      );
    },
    formatNewText(text) {
      return text.trim();
    },
  },
  cta_button: {
    label: "Nút submit form",
    extract(html) {
      return matchInner(
        html,
        /<button\s+class="cta-btn-red contact-submit"[^>]*>([\s\S]*?)<\/button>/i
      );
    },
    replace(html, newInner) {
      return replaceOnce(
        html,
        /<button\s+class="cta-btn-red contact-submit"[^>]*>[\s\S]*?<\/button>/i,
        `<button class="cta-btn-red contact-submit" type="submit">${escapeHtml(newInner)}</button>`
      );
    },
    formatNewText(text) {
      return text.trim();
    },
  },
};

function formatQuoteInner(text) {
  const raw = String(text).trim();
  const authorMatch = raw.match(/\n\s*[-—]\s*(.+)$/);
  if (authorMatch) {
    const body = raw
      .slice(0, authorMatch.index)
      .trim()
      .replace(/^["“]|["”]$/g, "");
    return `\n        “${escapeHtml(body)}”\n        <span class="quote-author">— ${escapeHtml(authorMatch[1].trim())}</span>\n      `;
  }
  const clean = raw.replace(/^["“]|["”]$/g, "");
  if (raw.includes("quote-author")) return raw;
  return `\n        “${escapeHtml(clean)}”\n      `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function matchInner(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function replaceOnce(html, re, replacement) {
  if (!re.test(html)) return null;
  return html.replace(re, replacement);
}

export function getHtmlSection(section) {
  return HTML_SECTIONS[section] || null;
}

export function stripHtmlTags(s) {
  return String(s)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
