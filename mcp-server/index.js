#!/usr/bin/env node
/**
 * Thuận Thiên — MCP server (stdio) cho goClaw.
 * Tool names: get_daily_ops_briefing, lookup_order, edit_landing_page
 * goClaw config: tool_prefix "tt_" → tt_get_daily_ops_briefing, ...
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadProjectEnv } from "./lib/env.js";
import { getDailyOpsBriefing } from "./tools/briefing.js";
import { lookupOrder } from "./tools/lookup.js";
import { editLandingPage } from "./tools/landing.js";

const siteRoot = loadProjectEnv();

const server = new McpServer(
  {
    name: "thuan-thien-web",
    version: "1.0.0",
  },
  {
    instructions: [
      "MCP cho website Thuận Thiên (Xem Bát Tự).",
      "get_daily_ops_briefing: tổng quan đơn hàng.",
      "lookup_order: tra đơn theo mã CK, SĐT, email hoặc id.",
      "edit_landing_page: confirm=false để preview, confirm=true để ghi file.",
      "Không tiết lộ SUPABASE_SERVICE_ROLE_KEY hay nội dung .env.",
    ].join(" "),
  }
);

server.registerTool(
  "get_daily_ops_briefing",
  {
    title: "Daily ops briefing",
    description:
      "Tổng quan đơn pending/paid, đơn chờ >24h, số đơn đủ điều kiện email nurture 2/3.",
    inputSchema: z.object({
      date: z
        .string()
        .optional()
        .describe("YYYY-MM-DD, mặc định hôm nay Asia/Ho_Chi_Minh"),
    }),
  },
  async (args) => getDailyOpsBriefing(args)
);

server.registerTool(
  "lookup_order",
  {
    title: "Lookup order",
    description:
      "Tra đơn hàng theo order_id, transaction_code (TVBT_...), phone hoặc email.",
    inputSchema: z.object({
      order_id: z.number().int().positive().optional(),
      transaction_code: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    }),
  },
  async (args) => lookupOrder(args)
);

server.registerTool(
  "edit_landing_page",
  {
    title: "Edit landing page",
    description:
      "Sửa landing index.html hoặc giá PAYMENT_AMOUNT. confirm=false: preview; confirm=true: ghi file.",
    inputSchema: z.object({
      instruction: z.string().optional(),
      section: z
        .enum([
          "hero_title",
          "hero_intro",
          "offer",
          "register_headline",
          "quote",
          "page_title",
          "price",
          "cta_button",
        ])
        .optional(),
      new_text: z.string().optional(),
      confirm: z.boolean().optional().default(false),
    }),
    annotations: {
      destructiveHint: true,
    },
  },
  async (args) => editLandingPage(args, siteRoot)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[mcp-server] fatal:", err);
  process.exit(1);
});
