# Google Authentication Setup Guide

## Step 1: Create Google OAuth Application

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** or select existing one
3. **Enable Google+ API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Select "Web application"
   - Add authorized redirect URIs:
     - `http://192.168.0.236:5050/api/auth/google/callback`
     - `http://localhost:5050/api/auth/google/callback`
   - Copy the Client ID and Client Secret

## Step 2: Update Container Configuration

Edit your `container-station-google-auth.yml` file:

```yaml
environment:
  GOOGLE_CLIENT_ID: your-actual-google-client-id
  GOOGLE_CLIENT_SECRET: your-actual-google-client-secret
  GOOGLE_CALLBACK_URL: http://192.168.0.236:5050/api/auth/google/callback
```

## Step 3: Deploy to Container Station

1. Upload `container-station-google-auth.yml` to Container Station
2. Create the application
3. Wait for containers to start

## Step 4: Access Your Application

- **Application**: http://192.168.0.236:5050
- **Login**: http://192.168.0.236:5050/api/auth/google
- **Logout**: http://192.168.0.236:5050/api/logout

## Authentication Flow

1. User clicks "Login with Google"
2. Redirected to Google OAuth consent screen
3. User grants permission
4. Redirected back to your application
5. User session established
6. Access to all dashboard features

## Security Features

- Session-based authentication with PostgreSQL storage
- Secure cookies with httpOnly flag
- All API endpoints protected with authentication
- User data stored securely in database
- Automatic session cleanup

## Troubleshooting

### "Redirect URI mismatch" error
- Verify the callback URL in Google Cloud Console matches your NAS IP
- Ensure the port (5050) is included in the redirect URI

### Container won't start
- Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set
- Verify PostgreSQL container is healthy

### Can't access after login
- Check browser console for errors
- Verify static files are being served correctly