"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const inviteContactSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type InviteContactFormValues = z.infer<typeof inviteContactSchema>

export function InviteContactForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<InviteContactFormValues>({
    resolver: zodResolver(inviteContactSchema),
    defaultValues: {
      email: "",
    },
  })

  const onSubmit = async (values: InviteContactFormValues) => {
    try {
      setSubmitting(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        form.setError("root", {
          message: "You must be logged in to invite contacts",
        })
        return
      }

      // Ensure app_users record exists (in case trigger didn't run or user signed up before trigger was added)
      const { data: existingAppUser, error: checkError } = await supabase
        .from("app_users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle()

      // If error is not a "not found" error, log it but continue
      if (checkError && checkError.code !== 'PGRST116') {
        console.error("Error checking app_users:", checkError)
      }

      if (!existingAppUser) {
        // Create app_users record if it doesn't exist
        const displayName = user.email
          ? user.email.split("@")[0]
          : `User ${user.id.slice(0, 8)}`
        
        const { error: appUserError } = await supabase
          .from("app_users")
          .upsert({
            id: user.id,
            display_name: displayName,
          }, {
            onConflict: 'id'
          })

        if (appUserError) {
          console.error("Error creating app_users record:", appUserError)
          form.setError("root", {
            message: `Failed to initialize user profile: ${appUserError.message}. Please try again or contact support.`,
          })
          return
        }
      }

      // Check if user is trying to invite themselves
      const userEmail = user.email
      if (userEmail?.toLowerCase() === values.email.toLowerCase()) {
        form.setError("root", {
          message: "You cannot invite yourself",
        })
        return
      }

      // Check if the user exists (for POC - only existing users can be invited)
      // We'll check by trying to find them in app_users via a server action
      // Since we can't query auth.users directly from client
      const checkUserResponse = await fetch('/api/check-user-exists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email.toLowerCase() }),
      })
      
      const checkUserData = await checkUserResponse.json()
      
      if (!checkUserData.exists) {
        form.setError("root", {
          message: "This user does not exist. For now, you can only invite users who already have an account.",
        })
        return
      }

      // Check if they're already contacts
      if (checkUserData.userId) {
        const { data: existingContact } = await supabase
          .from("contacts")
          .select("id")
          .eq("owner", user.id)
          .eq("contact_user", checkUserData.userId)
          .maybeSingle()

        if (existingContact) {
          form.setError("root", {
            message: "This user is already in your contacts",
          })
          return
        }
      }

      // Check if there's already a pending invitation
      const { data: existingInvitation } = await supabase
        .from("contact_invitations")
        .select("id")
        .eq("inviter_id", user.id)
        .eq("invitee_email", values.email.toLowerCase())
        .eq("status", "pending")
        .maybeSingle()

      if (existingInvitation) {
        form.setError("root", {
          message: "You have already sent an invitation to this email",
        })
        return
      }

      // Create the invitation
      const { error } = await supabase.from("contact_invitations").insert({
        inviter_id: user.id,
        invitee_email: values.email.toLowerCase(),
        invitee_user_id: checkUserData.userId || null,
        status: "pending",
      })

      if (error) {
        form.setError("root", {
          message: error.message || "Failed to send invitation",
        })
        return
      }

      // Reset form and refresh
      form.reset()
      router.refresh()
    } catch (error) {
      form.setError("root", {
        message: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a Contact</CardTitle>
        <CardDescription>
          Send an invitation to connect with someone who already has an account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {form.formState.errors.root && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {form.formState.errors.root.message}
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Email address <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="friend@example.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Sending invitation..." : "Send Invitation"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

