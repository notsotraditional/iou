import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RequestPaymentForm } from "@/components/request-payment-form"
import { AcceptInvitationButton } from "@/components/accept-invitation-button"
import { PaymentActions } from "@/components/payment-actions"

async function getPaymentRequests(userId: string) {
  const supabase = await createClient()
  
  // Get payment requests where user is either sender or recipient
  const { data, error } = await supabase
    .from("payment_requests")
    .select(`
      *,
      from_user_profile:app_users!payment_requests_from_user_fkey(id, display_name),
      to_user_profile:app_users!payment_requests_to_user_fkey(id, display_name)
    `)
    .or(`from_user.eq.${userId},to_user.eq.${userId}`)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching payment requests:", error)
    return []
  }

  return data || []
}

async function getPendingInvitationsReceived(userId: string) {
  const supabase = await createClient()
  
  // Verify auth.uid() matches
  const { data: { user: authUser } } = await supabase.auth.getUser()
  console.log("Auth UID in function:", authUser?.id)
  console.log("Expected userId:", userId)
  
  // Just fetch invitations - skip profile join to avoid RLS issues
  const { data: invitations, error } = await supabase
    .from("contact_invitations")
    .select("id, invitee_email, status, created_at, inviter_id")
    .eq("invitee_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching received invitations:", error)
    console.error("Error details:", JSON.stringify(error, null, 2))
    return []
  }

  console.log("Successfully fetched invitations:", invitations?.length || 0)
  return invitations || []
}

function formatCurrency(cents: number, currency: string = "GBP"): string {
  const amount = cents / 100
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    case "settled":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    case "cancelled":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    default:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const paymentRequests = await getPaymentRequests(user.id)
  console.log("Current user ID:", user.id)
  console.log("Current user email:", user.email)
  const receivedInvitations = await getPendingInvitationsReceived(user.id)
  console.log("Received invitations:", receivedInvitations)

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">
          View and manage all your payment requests
        </p>
      </div>

      <Card className={`mb-6 ${receivedInvitations.length > 0 ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20" : ""}`}>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            {receivedInvitations.length > 0
              ? `You have ${receivedInvitations.length} pending invitation${receivedInvitations.length !== 1 ? "s" : ""} waiting for your response`
              : "No pending invitations at the moment"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {receivedInvitations.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground">
              When someone sends you a contact invitation, it will appear here for you to accept.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivedInvitations.map((invitation: any) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">
                        {invitation.inviter_id?.slice(0, 8) || "Unknown"}
                      </TableCell>
                      <TableCell>{invitation.invitee_email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(invitation.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AcceptInvitationButton invitationId={invitation.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-6">
        <RequestPaymentForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Requests</CardTitle>
          <CardDescription>
            All payment requests you've sent or received
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentRequests.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No payment requests found. Create your first payment request to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">From</TableHead>
                    <TableHead className="min-w-[120px]">To</TableHead>
                    <TableHead className="min-w-[100px]">Amount</TableHead>
                    <TableHead className="min-w-[200px]">Memo</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="min-w-[200px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentRequests.map((request: any) => {
                    const fromUserName = request.from_user_profile?.display_name || "Unknown"
                    const toUserName = request.to_user_profile?.display_name || "Unknown"

                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {fromUserName}
                        </TableCell>
                        <TableCell>
                          {toUserName}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(request.amount_cents, request.currency)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {request.memo || "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadgeClass(request.status)}`}
                          >
                            {request.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(request.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <PaymentActions
                            paymentRequestId={request.id}
                            currentUserId={user.id}
                            fromUserId={request.from_user}
                            toUserId={request.to_user}
                            status={request.status}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
