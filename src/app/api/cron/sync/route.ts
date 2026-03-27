import { shopify } from "@/lib/shopify";
import { db } from "@/lib/db";
import { getCourierClient } from "@/lib/couriers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    // 1. Secure the cron endpoint
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Get all active (non-terminal) orders with an AWB
    const activeOrders = await db.order.findMany({
      where: {
        status: { notIn: ["DELIVERED", "RETURNED", "CANCELLED"] },
        awb: { not: null },
      },
    });

    let syncedCount = 0;

    for (const order of activeOrders) {
      try {
        if (!order.awb || !order.courier) continue;

        const courierClient = getCourierClient(order.courier);

        // 1. Poll courier for latest status + events
        const { status, events } = await courierClient.getStatus(order.awb);

        // 2. Save new tracking events to DB
        // Using upsert with the unique [orderId, timestamp] constraint
        for (const event of (events as any[])) {
          await db.trackingEvent.upsert({
            where: {
              orderId_timestamp: {
                orderId: order.id,
                timestamp: new Date(event.timestamp),
              },
            },
            update: {}, // No update needed if it exists
            create: {
              orderId: order.id,
              status: event.status,
              location: event.location,
              description: event.description,
              timestamp: new Date(event.timestamp),
            },
          });
        }

        // 3. Push updated tracking to Shopify (optional but keeps Shopify status in sync)
        if (order.shopifyFulfillmentId) {
          await shopify.request(`
            mutation updateTracking(
              $fulfillmentId: ID!
              $trackingInfoInput: FulfillmentTrackingInput!
            ) {
              fulfillmentTrackingInfoUpdateV2(
                fulfillmentId: $fulfillmentId
                trackingInfoInput: $trackingInfoInput
              ) {
                fulfillment { id status }
                userErrors { field message }
              }
            }
          `, {
            variables: {
              fulfillmentId: order.shopifyFulfillmentId,
              trackingInfoInput: {
                number: order.awb,
                company: order.courier,
                url: order.trackingUrl,
              }
            }
          });
        }

        // 4. Update order status in local DB
        await db.order.update({
          where: { id: order.id },
          data: { 
            status: status as any, // Cast to any to match enum if needed
            updatedAt: new Date() 
          },
        });

        syncedCount++;
      } catch (err) {
        console.error(`Failed to sync order ${order.shopifyOrderName}:`, err);
      }
    }

    return NextResponse.json({ success: true, synced: syncedCount });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
