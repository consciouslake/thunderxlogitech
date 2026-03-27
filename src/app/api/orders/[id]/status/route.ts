import { InternalLogisticsClient } from "@/lib/logistics/internal";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { status, location, description } = await req.json();

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    const logistics = new InternalLogisticsClient();
    const updatedOrder = await logistics.updateStatus(
      resolvedParams.id, 
      status, 
      location, 
      description
    );

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Status Update Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
