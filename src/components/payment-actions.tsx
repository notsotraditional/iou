"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

interface PaymentActionsProps {
  paymentRequestId: string
  currentUserId: string
  fromUserId: string
  toUserId: string
  status: string
}

export function PaymentActions({
  paymentRequestId,
  currentUserId,
  fromUserId,
  toUserId,
  status,
}: PaymentActionsProps) {
  const router = useRouter()
  const [updating, setUpdating] = useState(false)
  const [action, setAction] = useState<string | null>(null)

  const isRecipient = toUserId === currentUserId
  const isSender = fromUserId === currentUserId
  const isPending = status === "pending"

  const handleUpdateStatus = async (newStatus: "settled" | "cancelled") => {
    try {
      setUpdating(true)
      setAction(newStatus)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      console.log("Updating payment request:", {
        paymentRequestId,
        newStatus,
        url: `/api/payment-requests/${paymentRequestId}/update-status`,
      })

      const response = await fetch(
        `/api/payment-requests/${paymentRequestId}/update-status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error("Error updating payment request:", data.error)
        alert(data.error || "Failed to update payment request")
        return
      }

      // Refresh the page to update the UI
      router.refresh()
    } catch (error) {
      console.error("Unexpected error updating payment request:", error)
      alert("An unexpected error occurred. Please try again.")
    } finally {
      setUpdating(false)
      setAction(null)
    }
  }

  // Don't show actions if payment is not pending
  if (!isPending) {
    return null
  }

  return (
    <div className="flex gap-2">
      {isRecipient && (
        <>
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => handleUpdateStatus("settled")}
            disabled={updating}
            className="bg-green-600 hover:bg-green-700"
          >
            {updating && action === "settled" ? "Marking..." : "Mark as Paid"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleUpdateStatus("cancelled")}
            disabled={updating}
          >
            {updating && action === "cancelled" ? "Rejecting..." : "Reject"}
          </Button>
        </>
      )}
      {isSender && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleUpdateStatus("cancelled")}
          disabled={updating}
        >
          {updating && action === "cancelled" ? "Cancelling..." : "Cancel"}
        </Button>
      )}
    </div>
  )
}

