# Railway Environment Variables Setup

## Required Environment Variables

Set these in Railway dashboard for the `hds-delivery-admin-backend` service:

| Variable | Value |
|----------|-------|
| `HDS_API_URL` | `https://api.homedelivery.com.au` |
| `HDS_EMAIL` | `tomi@workoutmeals.com.au` |
| `HDS_PASSWORD` | `Zadomspremni01!` |
| `PORT` | `3001` |
| `HDS_ADMIN_PASSWORD` | `deliver2024` |

## How to Set Variables in Railway

1. Go to: https://railway.app
2. Select the HDS project
3. Click the `hds-delivery-admin-backend` service
4. Go to the **Variables** tab
5. Add each variable with its value
6. Railway will auto-redeploy

## Verification

Once set, the sync job will test authentication automatically at 2 AM daily, or you can test manually:

```bash
curl -X GET "https://api-prod.railway.app/health"
```

If status is `ok`, authentication is working.
