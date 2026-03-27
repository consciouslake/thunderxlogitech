import { shopify } from "@/lib/shopify";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Fetch unfulfilled and paid orders from Shopify
    const query = `
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

    const { data, errors } = await shopify.request(query);

    if (errors) {
      console.error("Shopify API Error:", errors);
      return NextResponse.json({ error: "Failed to fetch orders from Shopify" }, { status: 500 });
    }

    const shopifyOrders = data.orders.edges.map((e: any) => e.node);

    // 2. Upsert into local DB
    for (const o of shopifyOrders) {
      const fulfillmentOrderId = o.fulfillmentOrders.edges[0]?.node?.id;
      
      if (!fulfillmentOrderId) continue;

      await db.order.upsert({
        where: { shopifyOrderId: o.id },
        update: {
          fulfillmentOrderId: fulfillmentOrderId,
          shopifyOrderName: o.name,
        },
        create: {
          shopifyOrderId: o.id,
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
    }

    // 3. Return synced orders from DB
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Sync Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
