import { shopifyApi, ApiVersion } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/web-api";

let shopifyInstance: ReturnType<typeof shopifyApi> | null = null;

export const getShopify = () => {
  if (!shopifyInstance) {
    shopifyInstance = shopifyApi({
      apiKey: process.env.SHOPIFY_API_KEY || "",
      apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
      scopes: [
        "read_orders", 
        "write_fulfillments", 
        "read_fulfillments",
        "read_merchant_managed_fulfillment_orders",
        "write_merchant_managed_fulfillment_orders",
        "read_third_party_fulfillment_orders",
        "write_third_party_fulfillment_orders"
      ],
      hostName: process.env.APP_URL?.replace(/https?:\/\//, "") || "localhost:3000",
      apiVersion: "2024-10" as any, // Using stable version
      isEmbeddedApp: false,
    });
  }
  return shopifyInstance;
};
