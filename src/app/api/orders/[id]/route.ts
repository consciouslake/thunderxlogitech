import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  try {
    const resolvedParams = await params;
    const order = await db.order.findUnique({
      where: { id: resolvedParams.id },
      include: {
        trackingEvents: {
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Fetch Order Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
