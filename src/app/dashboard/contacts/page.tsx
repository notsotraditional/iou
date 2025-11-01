import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InviteContactForm } from "@/components/invite-contact-form"

async function getContacts(userId: string) {
  const supabase = await createClient()
  
  // Fetch contacts for this user
  const { data: contactsData, error: contactsError } = await supabase
    .from("contacts")
    .select("id, contact_user, name")
    .eq("owner", userId)

  if (contactsError) {
    console.error("Error fetching contacts:", contactsError)
    return []
  }

  if (!contactsData || contactsData.length === 0) {
    return []
  }

  // Filter out null contact_user
  const validContacts = contactsData.filter(c => c.contact_user !== null)

  if (validContacts.length === 0) {
    return []
  }

  // Fetch profile data for contact users
  const userIds = validContacts.map(c => c.contact_user).filter(Boolean) as string[]
  let profileMap = new Map<string, { id: string; display_name: string | null }>()
  
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("app_users")
      .select("id, display_name")
      .in("id", userIds)
    
    if (profiles) {
      profileMap = new Map(profiles.map(p => [p.id, { id: p.id, display_name: p.display_name }]))
    }
  }

  // Combine contacts with their profiles
  const contactsWithProfiles = validContacts.map(contact => ({
    ...contact,
    contact_user_profile: profileMap.get(contact.contact_user as string) || null
  }))

  // Sort by display_name if available, otherwise by name
  return contactsWithProfiles.sort((a, b) => {
    const nameA = a.contact_user_profile?.display_name || a.name || ""
    const nameB = b.contact_user_profile?.display_name || b.name || ""
    return nameA.localeCompare(nameB)
  })
}

async function getPendingInvitationsSent(userId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("contact_invitations")
    .select("id, invitee_email, status, created_at")
    .eq("inviter_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching sent invitations:", error)
    return []
  }

  return data || []
}

async function getPendingInvitationsReceived(userId: string) {
  const supabase = await createClient()
  
  // Get user email to check invitations by email or user ID
  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  if (!user?.email) {
    return []
  }

  const { data, error } = await supabase
    .from("contact_invitations")
    .select(`
      id,
      invitee_email,
      status,
      created_at,
      inviter_profile:app_users!contact_invitations_inviter_fkey(id, display_name)
    `)
    .or(`invitee_user_id.eq.${userId},invitee_email.eq.${user.email}`)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching received invitations:", error)
    return []
  }

  return data || []
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default async function ContactsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const contacts = await getContacts(user.id)
  const sentInvitations = await getPendingInvitationsSent(user.id)
  const receivedInvitations = await getPendingInvitationsReceived(user.id)

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        <p className="text-muted-foreground">
          Manage your contacts and invitations
        </p>
      </div>

      <div className="mb-6">
        <InviteContactForm />
      </div>

      {receivedInvitations.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              Invitations you've received that are waiting for your response
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                        {invitation.inviter_profile?.display_name || "Unknown"}
                      </TableCell>
                      <TableCell>{invitation.invitee_email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(invitation.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={acceptInvitationAction}>
                          <input type="hidden" name="invitationId" value={invitation.id} />
                          <Button type="submit" size="sm">
                            Accept
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {sentInvitations.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Sent Invitations</CardTitle>
            <CardDescription>
              Invitations you've sent that are waiting for acceptance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sentInvitations.map((invitation: any) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">
                        {invitation.invitee_email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(invitation.created_at)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Pending
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Contacts</CardTitle>
          <CardDescription>
            People you can send payment requests to
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No contacts yet. Invite someone to get started!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Display Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact: any) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.name}
                      </TableCell>
                      <TableCell>
                        {contact.contact_user_profile?.display_name || "Unknown"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Accept invitation server action
async function acceptInvitationAction(formData: FormData) {
  "use server"
  
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const invitationId = formData.get("invitationId") as string

  if (!invitationId) {
    return
  }

  // Call the database function to accept the invitation
  const { error } = await supabase.rpc("accept_contact_invitation", {
    invitation_id: invitationId,
  })

  if (error) {
    console.error("Error accepting invitation:", error)
  }

  // Redirect to refresh the page
  redirect("/dashboard/contacts")
}

