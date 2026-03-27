import { shopify } from "@/lib/shopify";
import { db } from "@/lib/db";
import { getCourierClient } from "@/lib/couriers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { orderId, courier = "delhivery" } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    // 1. Get order from DB
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Order not found in database" }, { status: 404 });
    }

    if (order.awb) {
      return NextResponse.json({ error: "Order already fulfilled" }, { status: 400 });
    }

    // 2. Create shipment with courier → get AWB
    const courierClient = getCourierClient(courier);
    const { awb, trackingUrl } = await courierClient.createShipment({
      orderName: order.shopifyOrderName,
      customerName: order.customerName,
      phone: order.phone,
      shippingAddress: order.shippingAddress,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      weight: order.weight ?? 0.5,
    });

    // 3. Push fulfillment + AWB to Shopify
    // We use fulfillmentCreateV2 mutation
    const mutation = `
      mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
        fulfillmentCreateV2(fulfillment: $fulfillment) {
          fulfillment {
            id
            status
            trackingInfo {
              number
              url
              company
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const { data, errors } = await shopify.request(mutation, {
      variables: {
        fulfillment: {
          lineItemsByFulfillmentOrder: [
            { fulfillmentOrderId: order.fulfillmentOrderId }
          ],
          trackingInfo: {
            number: awb,
            company: courier,
            url: trackingUrl,
          },
          notifyCustomer: true,
        }
      }
    });

    if (errors || data?.fulfillmentCreateV2?.userErrors?.length > 0) {
      console.error("Shopify Fulfillment Error:", errors || data.fulfillmentCreateV2.userErrors);
      return NextResponse.json({ 
        error: "Failed to update Shopify fulfillment",
        details: errors || data.fulfillmentCreateV2.userErrors 
      }, { status: 500 });
    }

    const shopifyFulfillmentId = data.fulfillmentCreateV2.fulfillment.id;

    // 4. Update DB with AWB + fulfillment ID
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        awb,
        trackingUrl,
        courier,
        shopifyFulfillmentId,
        status: "SHIPMENT_CREATED",
      }
    });

    return NextResponse.json({ 
      success: true, 
      awb, 
      trackingUrl,
      order: updatedOrder 
    });

  } catch (error) {
    console.error("Fulfillment Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
