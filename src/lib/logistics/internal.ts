import { db } from "@/lib/db";
import { shopify } from "@/lib/shopify";

export class InternalLogisticsClient {
  /**
   * Generate a unique internal AWB (e.g., DAL-10001)
   */
  async createShipment(data: {
    orderName: string;
    customerName: string;
    phone: string | null;
    shippingAddress: string;
    city: string;
    state: string;
    pincode: string;
    weight: number;
  }) {
    console.log("Creating internal shipment for:", data.orderName);
    
    // Generate a simple unique AWB: DAL + timestamp-random
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    const awb = `DAL-${timestamp}-${random}`;
    
    // In a real app, you might save this to a separate 'Shipments' table
    // but for now, we'll return it to the caller who updates the 'Order' table.
    
    return {
      awb,
      trackingUrl: `/track/${awb}`, // Internal tracking URL
    };
  }

  /**
   * Update the status of an order and push to Shopify
   */
  async updateStatus(orderId: string, newStatus: string, location?: string, description?: string) {
    // 1. Update the local DB
    const order = await db.order.update({
      where: { id: orderId },
      data: {
        status: newStatus as any,
        updatedAt: new Date(),
      },
    });

    // 2. Add tracking event
    await db.trackingEvent.create({
      data: {
        orderId,
        status: newStatus,
        location: location || "Internal Warehouse",
        description: description || `Status updated to ${newStatus.toLowerCase().replace(/_/g, " ")}`,
        timestamp: new Date(),
      },
    });

    // 3. Push tracking info update to Shopify
    if (order.shopifyFulfillmentId && order.awb) {
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
            company: "Internal Carrier",
            url: `${process.env.APP_URL || "https://daluci-logistics.vercel.app"}/track/${order.awb}`,
          }
        }
      });
    }

    return order;
  }

  /**
   * Mock getStatus for internal logistics (Satisfies sync job)
   */
  async getStatus(awb: string): Promise<{ status: string; events: any[] }> {
    // In an internal system, status is pulled directly from our own DB
    // This is just a mock to satisfy the existing sync job logic if needed.
    return {
      status: "IN_TRANSIT",
      events: []
    };
  }
}
