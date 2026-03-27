import { shopifyApi, ApiVersion } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/web-api";

let shopifyInstance: ReturnType<typeof shopifyApi> | null = null;

export const getShopify = () => {
  if (!shopifyInstance) {
    shopifyInstance = shopifyApi({
      apiKey: process.env.SHOPIFY_API_KEY || "",
      apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
      scopes: ["read_orders", "write_fulfillments", "read_fulfillments"],
      hostName: process.env.APP_URL?.replace(/https?:\/\//, "") || "localhost:3000",
      apiVersion: "2025-01" as any, // Using the latest version from dashboard
      isEmbeddedApp: false,
    });
  }
  return shopifyInstance;
};
