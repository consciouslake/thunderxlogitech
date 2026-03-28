import { getShopify } from "@/lib/shopify";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper to safely serialize objects with BigInt (Prisma-friendly)
function safeJson(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Sanitize the shop name - remove trailing slash and trim whitespace
  const rawShop = searchParams.get("shop");
  const shop = rawShop?.trim().replace(/\/$/, "");

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shopify = getShopify();
  const db = getDb();
  
  try {
    // 1. Get the session for this shop
    const session = await db.session.findFirst({
      where: { shop: { equals: shop, mode: 'insensitive' } },
    });

    if (!session || !session.accessToken) {
      console.warn(`No active session found for shop in DB: ${shop}`);
      return NextResponse.json({ 
        error: "Unauthorized", 
        message: "No session found for this shop. Please re-install the app." 
      }, { status: 401 });
    }

    // Initialize a temporary authenticated client for this request
    const client = new shopify.clients.Graphql({
      session: session as any,
    });

    // 2. Fetch unfulfilled and paid orders from Shopify
    const graphqlQuery = `
      query {
        orders(first: 50, query: "fulfillment_status:unfulfilled financial_status:paid") {
          edges {
            node {
              id
              name
              email
              phone
              shippingAddress {
                name
                address1
                city
                province
                zip
                country
              }
              fulfillmentOrders(first: 1) {
                edges {
                  node {
                    id
                    status
                  }
                }
              }
            }
          }
        }
      }
    `;

    console.log(`Syncing orders for sanitized shop: ${shop}...`);
    let response: any;
    try {
      response = await client.request(graphqlQuery);
    } catch (gqlErr: any) {
      console.error("Shopify Sync Request Failed:", gqlErr.message);
      // Fallback: return existing orders from DB if Shopify API fails
      const orders = await db.order.findMany({ 
        where: { shop: { equals: shop, mode: 'insensitive' } }, 
        orderBy: { createdAt: "desc" } 
      });
      return NextResponse.json(safeJson(orders));
    }
    
    const shopifyOrders = response?.data?.orders?.edges?.map((e: any) => e.node) || [];

    // 3. Upsert into local DB
    for (const o of shopifyOrders) {
      try {
        const fulfillmentOrderId = o.fulfillmentOrders?.edges?.[0]?.node?.id;
        
        if (!fulfillmentOrderId) {
          console.warn(`Skipping order ${o.name}: No fulfillment order found.`);
          continue;
        }

        await db.order.upsert({
          where: { shopifyOrderId: o.id },
          update: {
            fulfillmentOrderId: fulfillmentOrderId,
            shopifyOrderName: o.name,
            shop: shop,
          },
          create: {
            shopifyOrderId: o.id,
            shop: shop,
            shopifyOrderName: o.name,
            fulfillmentOrderId: fulfillmentOrderId,
            customerName: o.shippingAddress?.name ?? o.email ?? "Unknown",
            customerEmail: o.email ?? "",
            phone: o.phone ?? "",
            shippingAddress: o.shippingAddress?.address1 ?? "",
            city: o.shippingAddress?.city ?? "",
            state: o.shippingAddress?.province ?? "",
            pincode: o.shippingAddress?.zip ?? "",
          },
        });
      } catch (orderErr) {
        console.error(`Error syncing individual order ${o.name}:`, orderErr);
      }
    }

    // 4. Return synced orders from DB for this shop specifically
    const orders = await db.order.findMany({
      where: { shop: { equals: shop, mode: 'insensitive' } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(safeJson(orders));
  } catch (error: any) {
    console.error("Critical Route Error:", error);
    return NextResponse.json({ 
      error: "Route Failure", 
      message: error.message,
      details: String(error)
    }, { status: 500 });
  }
}
