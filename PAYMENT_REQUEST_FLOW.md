# Payment Request Flow - Step by Step Breakdown

## Current Problem
Users cannot send payment requests to people who don't have accounts yet. The system requires selecting from existing contacts, and `to_user` must be a valid UUID.

## Desired Flow
1. User A creates payment request for User B (who doesn't have account)
2. User A sends payment request link via WhatsApp/SMS
3. User B clicks link
4. User B signs up (if needed)
5. User B sees the payment request and can respond

---

## Step-by-Step Implementation Plan

### Step 1: Database Schema Changes
**Modify `payment_requests` table:**
- Make `to_user` nullable (allow NULL)
- Add `to_email` field (TEXT, nullable)
- Add `to_phone` field (TEXT, nullable) 
- Add `share_token` field (UUID or TEXT, unique) - for the shareable link
- Add index on `share_token` for fast lookups
- Update foreign key constraint to allow NULL `to_user`

**Why:** Allows creating payment requests for non-users via email/phone

---

### Step 2: Update Payment Request Form
**Changes to `request-payment-form.tsx`:**
- Remove contact dropdown requirement
- Add input field for email OR phone number
- Add "or select existing contact" as optional
- When submitting, create payment request with:
  - `from_user`: current user ID
  - `to_user`: NULL (if new recipient) OR contact ID (if existing)
  - `to_email`: email if provided
  - `to_phone`: phone if provided
  - `share_token`: generate unique token

**Why:** Makes it frictionless - user can enter anyone's email/phone

---

### Step 3: Generate Shareable Link
**Create link format:**
- Pattern: `${BASE_URL}/pay/[share_token]` or `/payment-request/[share_token]`
- Store `share_token` in payment_requests table
- Generate unique token when payment request is created

**Why:** Friend can click link to see payment request

---

### Step 4: Auto-link Payment Requests on Signup
**Update signup trigger/function:**
- When new user signs up, check if their email/phone matches any pending payment requests
- Update those payment requests: set `to_user` = new user ID
- Keep `to_email`/`to_phone` for historical reference

**Why:** Friend signs up → automatically sees their pending requests

---

### Step 5: Create Payment Request Landing Page
**New page: `/pay/[token]` or `/payment-request/[token]`:**
- Look up payment request by `share_token`
- Show payment request details (amount, memo, from_user name)
- If user not logged in:
  - Show "Sign up to view and respond"
  - Link to signup page with token in URL/state
  - After signup, redirect back to payment request
- If user logged in:
  - Check if this payment request is for them (to_user matches OR email/phone matches)
  - Show payment request details
  - Show Accept/Decline buttons

**Why:** Friend can view and respond to payment request

---

### Step 6: Update Dashboard to Show Unlinked Requests
**Dashboard changes:**
- Show payment requests where `to_user` is NULL but `to_email`/`to_phone` matches current user
- Show "Pending - Awaiting signup" status
- After user signs up, these automatically link via Step 4

**Why:** Users can see requests sent to their email/phone even before signing up

---

### Step 7: Link Existing Requests (Migration)
**Data migration:**
- For existing payment requests where `to_user` exists:
  - Generate `share_token` for retroactive link sharing
  - Populate `to_email` from `app_users` email if available

---

## Optional: Simplify Contact System
The contact invitation system we built becomes optional now:
- **Option A:** Keep it for "trusted contacts" (people you frequently send requests to)
- **Option B:** Remove it entirely - users just enter email/phone each time
- **Option C:** Auto-create contacts when someone accepts a payment request

---

## Database Migration Summary
```sql
ALTER TABLE payment_requests 
  ALTER COLUMN to_user DROP NOT NULL,
  ADD COLUMN to_email TEXT,
  ADD COLUMN to_phone TEXT,
  ADD COLUMN share_token UUID UNIQUE DEFAULT gen_random_uuid();

CREATE INDEX payment_requests_share_token_idx ON payment_requests(share_token);
CREATE INDEX payment_requests_to_email_idx ON payment_requests(to_email) WHERE to_user IS NULL;
CREATE INDEX payment_requests_to_phone_idx ON payment_requests(to_phone) WHERE to_user IS NULL;
```

---

## Success Criteria
✅ User can send payment request to anyone (email/phone) without them having account
✅ Payment request generates shareable link
✅ Friend can click link and see payment request
✅ Friend can sign up and automatically see their pending requests
✅ Friend can accept/decline payment request after signing up
✅ No friction - everything works even if recipient doesn't have account initially

