# Dokploy Database Connection Fix

We successfully identified your Dokploy instance and the correct Internal Database URL.

## 1. Access Your Dokploy Dashboard
Go to: **http://72.62.131.136:3000**
(Login with your Dokploy credentials if asked)

## 2. Update Environment Variables
1. Navigate to your **Application** (e.g., `edgepannel`).
2. Click on the **Environment** tab.
3. Click **Add Variable** (or Edit `DATABASE_URL`).
4. Enter the following:

**Key**: `DATABASE_URL`
**Value**: 
```
postgresql://postgres:pwoikjyikvcl3afa@edgepannel-db-f9ebm5:5432/postgres
```
*(This is the internal connection string found in your local configuration)*

## 3. Redeploy
1. Click **Save**.
2. Click **Redeploy**.

## 4. Why This Works
Your application was trying to connect to `localhost` (the container itself) or missing the URL entirely. By providing the internal hostname `edgepannel-db-f9ebm5`, your app can now reach the database container within the Dokploy network.
