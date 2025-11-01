# Simplified POC Plan: Invite Existing Users Only

## Current State
- Contact invitation system exists but has RLS/database errors
- Payment requests require selecting from contacts
- `payment_requests.to_user` is NOT NULL (must be existing user)

## POC Scope (V1)
**Goal:** Make it work for existing users only - simple and frictionless

### What We Need to Fix:
1. ✅ Fix contact invitation system (already built, just needs to work)
2. ✅ Fix payment request form to show accepted contacts
3. ✅ Make sure invite → accept → send payment request flow works

### Current Issues:
- RLS policies on `app_users` - ✅ FIXED
- Foreign key constraint on `contact_invitations.inviter_id` - ✅ FIXED  
- Missing `app_users` records - ✅ FIXED with upsert

---

## V2 Compatibility Check

### Current Structure Impact on V2:
**Will NOT prevent V2** - Here's why:

1. **`payment_requests.to_user` is NOT NULL**
   - **V1:** Works fine (only existing users)
   - **V2 Migration:** Simple ALTER TABLE to make it nullable
   - ✅ No blocker

2. **Foreign key constraint `payment_requests_to_user_fkey`**
   - **V1:** Works fine (only existing users)
   - **V2 Migration:** Can drop constraint, make nullable, add back with different rules
   - ✅ No blocker

3. **No `to_email` or `to_phone` fields yet**
   - **V1:** Don't need them
   - **V2 Migration:** Just ADD COLUMN
   - ✅ No blocker

4. **No `share_token` field yet**
   - **V1:** Don't need it
   - **V2 Migration:** Just ADD COLUMN
   - ✅ No blocker

---

## V2 Migration Path (Future)

When ready for V2, we'll need:

```sql
-- Step 1: Add new fields
ALTER TABLE payment_requests 
  ADD COLUMN to_email TEXT,
  ADD COLUMN to_phone TEXT,
  ADD COLUMN share_token UUID UNIQUE DEFAULT gen_random_uuid();

-- Step 2: Make to_user nullable
ALTER TABLE payment_requests 
  ALTER COLUMN to_user DROP NOT NULL;

-- Step 3: Update foreign key (if needed)
-- May need to drop and recreate with different ON DELETE behavior

-- Step 4: Add indexes
CREATE INDEX payment_requests_share_token_idx ON payment_requests(share_token);
CREATE INDEX payment_requests_to_email_idx ON payment_requests(to_email) WHERE to_user IS NULL;
```

**Estimated Migration Time:** ~5 minutes, zero downtime if done carefully

---

## Recommendation

**For POC:**
✅ Keep current structure (to_user NOT NULL)
✅ Fix the invitation system bugs
✅ Get it working for existing users only
✅ Test the flow: Invite → Accept → Send Payment Request

**For V2:**
✅ Migration is straightforward
✅ No structural blockers
✅ Can add fields/make nullable without breaking existing data

---

## Current Fixes Needed (POC)

Let's focus on making the invitation system work:

1. **Fix the invitation form** - Ensure app_users exists before creating invitation
2. **Fix the accept flow** - Make sure accepting invitation creates contacts properly
3. **Fix payment request form** - Make sure it shows accepted contacts

The structure itself is fine for V2 migration!

