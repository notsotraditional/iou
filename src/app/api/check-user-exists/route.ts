import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if a user with this email exists in auth.users
    // We'll query app_users which should have all users
    // Since app_users.id references auth.users.id, we can find them
    // But we need to match by email from auth.users
    
    // Actually, we can't directly query auth.users from here either
    // But we can check app_users and assume if they have an app_users record,
    // they exist. However, we can't match by email from app_users since email isn't stored there.
    
    // Alternative: Check auth.users via SQL function or check if we can find the user
    // The simplest approach for POC: check if any user exists with this email
    // We'll need to use a database function or query auth schema
    
    // For POC simplicity, let's check app_users and also try to find via contact_invitations
    // If someone has been invited before or has an app_users record, they might exist
    // Actually, the best way is to check auth.users via a server-side function
    
    // Since we're server-side, we can use the admin client or execute SQL
    // For now, let's check by trying to find if there's a user with this email
    // We'll use a database function to check auth.users
    
    const { data, error } = await supabase.rpc('check_user_exists_by_email', {
      user_email: email.toLowerCase()
    })

    if (error) {
      // If function doesn't exist, we'll create it, or fallback to checking app_users
      // For now, return that user doesn't exist if we can't check
      console.error('Error checking user:', error)
      
      // Fallback: Check if email matches any existing user by looking at contact_invitations
      // where invitee_user_id is set (meaning they accepted an invitation)
      const { data: invitedUser } = await supabase
        .from('contact_invitations')
        .select('invitee_user_id')
        .eq('invitee_email', email.toLowerCase())
        .not('invitee_user_id', 'is', null)
        .maybeSingle()
      
      if (invitedUser?.invitee_user_id) {
        // User was invited and accepted, so they exist
        return NextResponse.json({
          exists: true,
          userId: invitedUser.invitee_user_id
        })
      }
      
      // For POC, assume user doesn't exist if we can't verify
      return NextResponse.json({
        exists: false,
        userId: null
      })
    }

    // The function returns user_exists and user_id
    const result = Array.isArray(data) && data.length > 0 ? data[0] : null
    
    return NextResponse.json({
      exists: result?.user_exists || false,
      userId: result?.user_id || null
    })
  } catch (error) {
    console.error('Error in check-user-exists:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

