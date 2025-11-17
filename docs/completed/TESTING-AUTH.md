# Testing Authentication - Quick Guide

## Your Credentials
```
Email: saagar@rainamusic.com
Password: Lane388Furong@
Role: ADMIN
```

## Backend Server
The backend API is running on: `http://localhost:3003`

---

## Test 1: Login

Test that you can log in and receive a JWT token:

```bash
curl -i -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"saagar@rainamusic.com","password":"Lane388Furong@"}'
```

**Expected Result:**
- Status: `200 OK`
- Response includes: `{"user":{...},"token":"..."}`
- Headers include: `set-cookie: auth_token=...`

---

## Test 2: Get Current User

Test the `/me` endpoint to verify your session:

```bash
# First, save your token from the login response
TOKEN="<paste-token-here>"

curl http://localhost:3003/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Result:**
```json
{
  "user": {
    "id": "...",
    "email": "saagar@rainamusic.com",
    "name": "Saagar",
    "role": "ADMIN"
  }
}
```

---

## Test 3: Access Protected Endpoint

Test that you can access the songs API with authentication:

```bash
# Using cookie (easier)
curl -i -c /tmp/cookies.txt -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"saagar@rainamusic.com","password":"Lane388Furong@"}'

# Now use the cookie to access songs
curl -b /tmp/cookies.txt "http://localhost:3003/api/songs?limit=2"
```

**Expected Result:**
- Status: `200 OK`
- Response includes: `{"data":[...],"pagination":{...}}`
- Should show 2 songs

---

## Test 4: Test Without Auth (Should Fail)

Verify that protected endpoints reject unauthenticated requests:

```bash
curl http://localhost:3003/api/songs
```

**Expected Result:**
- Status: `401 Unauthorized`
- Response: `{"error":"Unauthorized - Please log in"}`

---

## Test 5: Update a Song (Track Reviewer)

Test that updating a song tracks which user made the change:

```bash
# First, get a song ISRC
curl -b /tmp/cookies.txt "http://localhost:3003/api/songs?limit=1" | grep -o '"isrc":"[^"]*"' | head -1

# Then update it (replace ISRC_HERE with actual ISRC)
curl -i -b /tmp/cookies.txt -X PATCH http://localhost:3003/api/songs/ISRC_HERE \
  -H "Content-Type: application/json" \
  -d '{
    "ai_energy": "High",
    "ai_accessibility": "Commercial",
    "ai_subgenre_1": "House"
  }'
```

**Expected Result:**
- Status: `200 OK`
- Response shows: `"reviewed_by": "Saagar"` (your name!)
- The database now has `reviewedById` set to your user ID

---

## Test 6: Logout

Test the logout endpoint:

```bash
curl -i -b /tmp/cookies.txt -X POST http://localhost:3003/api/auth/logout
```

**Expected Result:**
- Status: `200 OK`
- Response: `{"message":"Logged out successfully"}`
- Cookie is cleared (Max-Age=0)

---

## Test 7: Verify Database Changes

Check that the database has your user and tracks reviews:

```bash
# Check users table
npx prisma studio
```

Then navigate to:
1. **Users table** - You should see only 1 user (you!)
2. **Songs table** - Find a song you updated and check:
   - `reviewed_by` = "Saagar"
   - `reviewed_by_id` = your user ID
   - `reviewed_at` = timestamp of when you updated it

---

## Quick Test Script

Save this to `test-auth.sh` and run `bash test-auth.sh`:

```bash
#!/bin/bash

echo "🔐 Testing Authentication System"
echo ""

# Test 1: Login
echo "Test 1: Login..."
RESPONSE=$(curl -s -c /tmp/cookies.txt -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"saagar@rainamusic.com","password":"Lane388Furong@"}')

if echo "$RESPONSE" | grep -q "token"; then
  echo "✅ Login successful"
else
  echo "❌ Login failed"
  exit 1
fi

echo ""

# Test 2: Get current user
echo "Test 2: Get current user..."
ME_RESPONSE=$(curl -s -b /tmp/cookies.txt http://localhost:3003/api/auth/me)

if echo "$ME_RESPONSE" | grep -q "ADMIN"; then
  echo "✅ Current user retrieved"
else
  echo "❌ Failed to get current user"
  exit 1
fi

echo ""

# Test 3: Access protected endpoint
echo "Test 3: Access protected endpoint..."
SONGS_RESPONSE=$(curl -s -b /tmp/cookies.txt "http://localhost:3003/api/songs?limit=1")

if echo "$SONGS_RESPONSE" | grep -q "pagination"; then
  echo "✅ Protected endpoint accessible"
else
  echo "❌ Failed to access protected endpoint"
  exit 1
fi

echo ""

# Test 4: Test without auth
echo "Test 4: Test without auth (should fail)..."
UNAUTH_RESPONSE=$(curl -s http://localhost:3003/api/songs)

if echo "$UNAUTH_RESPONSE" | grep -q "Unauthorized"; then
  echo "✅ Correctly rejected unauthenticated request"
else
  echo "❌ Should have rejected unauthenticated request"
  exit 1
fi

echo ""
echo "🎉 All tests passed!"
```

---

## What's Working Now

✅ **User Authentication**
- Secure password hashing (bcrypt)
- JWT token generation
- HTTP-only cookies for security
- Session management

✅ **Protected Endpoints**
- All song APIs require authentication
- Unauthorized requests are rejected
- Proper error messages

✅ **User Tracking**
- Every song update tracks WHO made the change
- `reviewedBy` stores the user's name
- `reviewedById` stores the user's ID
- `reviewedAt` stores the timestamp

✅ **Database**
- Only 1 user (you) in the database
- User model with roles (ADMIN/CURATOR)
- Foreign key relationships for tracking

---

## What's Next (Phase 3)

We still need to build:
1. **Login Page** - React component for the login form
2. **Auth Context** - React context to manage login state
3. **Protected Routes** - Redirect to login if not authenticated
4. **User Header** - Show logged-in user info + logout button
5. **Review Tracking UI** - Show who reviewed each song in the table

These will make it so you can:
- Visit the app in your browser
- See a login page instead of the song list
- Login with your credentials
- See your name in the header
- Logout when done
