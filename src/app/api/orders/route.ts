import { getShopify } from "@/lib/shopify";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shopify = getShopify();
  const db = getDb();
  
  try {
    // 1. Get the session for this shop
    const session = await db.session.findFirst({
      where: { shop },
    });

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized. Please install the app." }, { status: 401 });
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

    const response: any = await client.request(graphqlQuery);
    
    if (!response?.data?.orders?.edges) {
      console.error("Invalid Shopify GraphQL Response:", response);
      // If we have some orders in DB but sync failed, just return them
      const orders = await db.order.findMany({ where: { shop }, orderBy: { createdAt: "desc" } });
      return NextResponse.json(orders);
    }

    const shopifyOrders = response.data.orders.edges.map((e: any) => e.node);

    // 2. Upsert into local DB
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
        console.error(`Failed to sync individual order ${o.name}:`, orderErr);
        // Don't crash the whole sync if one order fails
      }
    }

    // 3. Return synced orders from DB for this shop specifically
    const orders = await db.order.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("Sync Error:", error);
    return NextResponse.json({ 
      error: "Sync Failed", 
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    }, { status: 500 });
  }
}
