"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  MapPin, 
  User, 
  Calendar, 
  ExternalLink,
  ChevronRight,
  AlertCircle,
  RefreshCw
} from "lucide-react";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fulfilling, setFulfilling] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [resolvedParams.id]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${resolvedParams.id}`);
      const data = await res.json();
      setOrder(data);
    } catch (error) {
      console.error("Failed to fetch order:", error);
    } finally {
      setLoading(false);
    }
  };

  const fulfillOrder = async () => {
    setFulfilling(true);
    try {
      const res = await fetch("/api/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: resolvedParams.id, courier: "delhivery" }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrder();
      } else {
        alert(data.error || "Fulfillment failed");
      }
    } catch (error) {
      console.error("Fulfillment error:", error);
    } finally {
      setFulfilling(false);
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${resolvedParams.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrder();
      } else {
        alert(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Update error:", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading order details...</div>;
  if (!order) return <div className="p-8 text-center text-slate-500">Order not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-6 transition">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{order.shopifyOrderName}</h2>
                  <div className="flex items-center text-slate-500 mt-1">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                  ${order.status === "DELIVERED" ? "bg-emerald-100 text-emerald-700" : 
                    order.status === "PENDING" ? "bg-amber-100 text-amber-700" : 
                    "bg-blue-100 text-blue-700"}`}
                >
                  {order.status.replace(/_/g, " ")}
                </div>
              </div>

              {order.status === "PENDING" && (
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center text-indigo-700 text-sm font-medium">
                    <Package className="w-4 h-4 mr-2" />
                    Ready for fulfillment
                  </div>
                  <button 
                    onClick={fulfillOrder}
                    disabled={fulfilling}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {fulfilling ? "Processing..." : "Create Shipment"}
                  </button>
                </div>
              )}

              {order.status !== "PENDING" && order.status !== "DELIVERED" && (
                <div className="mt-8 bg-slate-50 border border-slate-200 p-6 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-indigo-600" />
                    Update Logistics Status
                  </h3>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">New Status</label>
                      <select 
                        id="status-select"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        defaultValue={order.status}
                        onChange={(e) => updateOrderStatus(e.target.value)}
                      >
                        <option value="SHIPMENT_CREATED">Shipment Created</option>
                        <option value="IN_TRANSIT">In Transit</option>
                        <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="FAILED_DELIVERY">Failed Delivery</option>
                        <option value="RETURNED">Returned</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Tracking Timeline */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Tracking Timeline</h3>
              <div className="space-y-6">
                {!order.trackingEvents || order.trackingEvents.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 italic">
                    {order.awb ? "Awaiting first tracking update from courier..." : "Fulfill the order to start tracking."}
                  </div>
                ) : (
                  order.trackingEvents.map((event: any, i: number) => (
                    <div key={event.id} className="relative pl-8 group">
                      {/* Line */}
                      {i !== order.trackingEvents.length - 1 && (
                        <div className="absolute left-[11px] top-6 w-[2px] h-full bg-slate-100" />
                      )}
                      
                      {/* Dot */}
                      <div className={`absolute left-0 top-1.5 w-[24px] h-[24px] rounded-full flex items-center justify-center border-4 border-white shadow-sm
                        ${i === 0 ? "bg-indigo-600" : "bg-slate-300"}`} 
                      >
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>

                      <div>
                        <p className={`font-bold ${i === 0 ? "text-slate-900" : "text-slate-500"}`}>
                          {event.status.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm text-slate-400 mt-0.5">
                          {new Date(event.timestamp).toLocaleString()} • {event.location || "System"}
                        </p>
                        {event.description && (
                          <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg inline-block italic">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Sidebar - Customer Info */}
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Customer Info</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <User className="w-4 h-4 text-slate-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{order.customerName}</p>
                    <p className="text-sm text-slate-500">{order.customerEmail}</p>
                    <p className="text-sm text-slate-500">{order.phone}</p>
                  </div>
                </div>
                <div className="flex items-start border-t border-slate-50 pt-4">
                  <MapPin className="w-4 h-4 text-slate-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Shipping Address</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {order.shippingAddress}
                      {", "}{order.city}
                      {", "}{order.state}
                      {" - "}{order.pincode}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-indigo-900 p-6 rounded-xl shadow-sm text-white">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-5 h-5 opacity-80" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Logistics Tips</h3>
              </div>
              <ul className="text-sm space-y-3 opacity-90 leading-relaxed">
                <li>• Estimated delivery: 3-5 business days.</li>
                <li>• Ensure pincode matches the city.</li>
                <li>• Weight is set to default 0.5kg.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
