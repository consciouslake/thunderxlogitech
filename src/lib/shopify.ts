import { createAdminApiClient } from "@shopify/admin-api-client";

export const shopify = createAdminApiClient({
  storeDomain: process.env.SHOPIFY_STORE_DOMAIN || "",
  apiVersion: "2025-01",
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN || "",
});
