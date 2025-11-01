import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { status: newStatus } = await request.json()
    
    // Extract ID from params (handling both Promise and direct params)
    let paymentRequestId: string | undefined
    
    if (params instanceof Promise) {
      const resolvedParams = await params
      paymentRequestId = resolvedParams?.id
    } else {
      paymentRequestId = params?.id
    }
    
    // Fallback: extract ID from URL path if params didn't work
    if (!paymentRequestId) {
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      const idIndex = pathParts.indexOf('payment-requests')
      if (idIndex >= 0 && pathParts[idIndex + 1]) {
        paymentRequestId = pathParts[idIndex + 1]
      }
    }

    console.log("Update status request:", { paymentRequestId, newStatus, url: request.url })

    if (!paymentRequestId) {
      console.error("Missing payment request ID", { params, url: request.url })
      return NextResponse.json(
        { error: "Payment request ID is required" },
        { status: 400 }
      )
    }

    if (!newStatus || !["settled", "cancelled"].includes(newStatus)) {
      return NextResponse.json(
        { error: "Valid status is required (settled or cancelled)" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // First, check if the payment request exists and user has permission
    const { data: paymentRequest, error: fetchError } = await supabase
      .from("payment_requests")
      .select("id, from_user, to_user, status")
      .eq("id", paymentRequestId)
      .single()

    if (fetchError || !paymentRequest) {
      return NextResponse.json(
        { error: "Payment request not found" },
        { status: 404 }
      )
    }

    // Check if payment is already in a final state
    if (paymentRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Payment request is already in a final state" },
        { status: 400 }
      )
    }

    // Check permissions:
    // - Recipients can mark as settled or cancelled
    // - Senders can only cancel their own requests
    const isRecipient = paymentRequest.to_user === user.id
    const isSender = paymentRequest.from_user === user.id

    if (!isRecipient && !isSender) {
      return NextResponse.json(
        { error: "You don't have permission to update this payment request" },
        { status: 403 }
      )
    }

    // Senders can only cancel, recipients can settle or cancel
    if (isSender && newStatus === "settled") {
      return NextResponse.json(
        { error: "Only the recipient can mark a payment as settled" },
        { status: 403 }
      )
    }

    // Update the payment request status
    const { error: updateError } = await supabase
      .from("payment_requests")
      .update({ status: newStatus })
      .eq("id", paymentRequestId)

    if (updateError) {
      console.error("Error updating payment request:", updateError)
      return NextResponse.json(
        { error: "Failed to update payment request" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
    })
  } catch (error) {
    console.error("Error in update-status route:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

