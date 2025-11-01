"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

interface AcceptInvitationButtonProps {
  invitationId: string
}

export function AcceptInvitationButton({ invitationId }: AcceptInvitationButtonProps) {
  const router = useRouter()
  const [accepting, setAccepting] = useState(false)

  const handleAccept = async () => {
    try {
      setAccepting(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      // Call the database function to accept the invitation
      const { error } = await supabase.rpc("accept_contact_invitation", {
        invitation_id: invitationId,
      })

      if (error) {
        console.error("Error accepting invitation:", error)
        return
      }

      // Refresh the page to update the UI
      router.refresh()
    } catch (error) {
      console.error("Unexpected error accepting invitation:", error)
    } finally {
      setAccepting(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={handleAccept}
      disabled={accepting}
    >
      {accepting ? "Accepting..." : "Accept"}
    </Button>
  )
}

