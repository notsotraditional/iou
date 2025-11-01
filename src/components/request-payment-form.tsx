"use client"

import { useState, useEffect } from "react"
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

const requestPaymentSchema = z.object({
  contactId: z.string().min(1, "Please select a contact"),
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
    },
    { message: "Please enter a valid amount" }
  ),
  memo: z.string().optional(),
})

type RequestPaymentFormValues = z.infer<typeof requestPaymentSchema>

interface Contact {
  id: string
  display_name: string
}

export function RequestPaymentForm() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<RequestPaymentFormValues>({
    resolver: zodResolver(requestPaymentSchema),
    defaultValues: {
      contactId: "",
      amount: "",
      memo: "",
    },
  })

  useEffect(() => {
    async function fetchContacts() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        console.log("[RequestPaymentForm] Fetching contacts for userId:", user.id)
        
        // Simplest possible query for POC - just get all contacts for this owner
        const { data: contactsData, error: contactsError } = await supabase
          .from("contacts")
          .select("contact_user")
          .eq("owner", user.id)

        console.log("[RequestPaymentForm] Query result:", { 
          dataLength: contactsData?.length || 0, 
          error: contactsError 
        })

        if (contactsError) {
          console.error("[RequestPaymentForm] Error fetching contacts:", contactsError)
          setContacts([])
          return
        }

        if (!contactsData || contactsData.length === 0) {
          console.log("[RequestPaymentForm] No contacts found")
          setContacts([])
          return
        }

        // Filter out null contact_user in JavaScript (simpler than SQL for POC)
        const validContacts = contactsData.filter((c: any) => c.contact_user !== null)
        console.log("[RequestPaymentForm] Valid contacts (after filtering nulls):", validContacts.length)

        if (validContacts.length === 0) {
          setContacts([])
          return
        }

        // Fetch profile data separately for all contact users
        const userIds = validContacts.map((c: any) => c.contact_user).filter(Boolean) as string[]
        console.log("[RequestPaymentForm] Fetching profiles for userIds:", userIds)
        
        let profileMap = new Map<string, string>()
        
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from("app_users")
            .select("id, display_name")
            .in("id", userIds)
          
          console.log("[RequestPaymentForm] Profiles result:", { 
            profilesLength: profiles?.length || 0, 
            error: profilesError 
          })
          
          if (profilesError) {
            console.error("[RequestPaymentForm] Error fetching profiles:", profilesError)
          } else if (profiles) {
            profileMap = new Map(profiles.map((p: any) => [p.id, p.display_name || "Unknown"]))
          }
        }

        // Transform the data to match the Contact interface
        const transformedContacts = validContacts
          .map((contact: any) => ({
            id: contact.contact_user,
            display_name: profileMap.get(contact.contact_user) || "Unknown",
          }))
          .filter((contact: Contact) => contact.id)
          .sort((a, b) => a.display_name.localeCompare(b.display_name))
        
        console.log("[RequestPaymentForm] Final transformed contacts:", transformedContacts.length)
        setContacts(transformedContacts)
      } catch (error) {
        console.error("Error:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchContacts()
  }, [])

  const onSubmit = async (values: RequestPaymentFormValues) => {
    try {
      setSubmitting(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        form.setError("root", {
          message: "You must be logged in to create a payment request",
        })
        return
      }

      // Convert amount from pounds to cents
      const amountCents = Math.round(parseFloat(values.amount) * 100)

      const { error } = await supabase.from("payment_requests").insert({
        from_user: user.id,
        to_user: values.contactId,
        amount_cents: amountCents,
        currency: "GBP",
        memo: values.memo || null,
        status: "pending",
      })

      if (error) {
        form.setError("root", {
          message: error.message || "Failed to create payment request",
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
        <CardTitle>Request Payment</CardTitle>
        <CardDescription>
          Send a payment request to one of your contacts
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
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Select contact <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    {loading ? (
                      <Input disabled placeholder="Loading contacts..." />
                    ) : (
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        <option value="">-- Select a contact --</option>
                        {contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.display_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Amount (£) <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="memo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What for</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="e.g., Dinner, Rent, etc."
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
              disabled={submitting || loading}
            >
              {submitting ? "Creating request..." : "Request Payment"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

