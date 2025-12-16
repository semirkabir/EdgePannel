# Installing Node.js on Windows

## Option 1: Using winget (Recommended)

Run this command in PowerShell (you'll need to accept the terms when prompted):

```powershell
winget install OpenJS.NodeJS.LTS
```

After installation:
1. **Close and reopen your PowerShell terminal** (or restart your computer)
2. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

## Option 2: Manual Installation

1. Visit: https://nodejs.org/
2. Download the **LTS (Long Term Support)** version for Windows
3. Run the installer and follow the setup wizard
4. Make sure to check "Add to PATH" during installation
5. **Restart your PowerShell terminal** after installation
6. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

## After Installation

Once Node.js is installed, you can run your project:

```powershell
# Install dependencies
npm install

# Run the development server
npm run dev
```

## Troubleshooting

If `npm` is still not recognized after installation:
1. Close and reopen your terminal
2. If that doesn't work, restart your computer
3. Verify Node.js is in your PATH:
   ```powershell
   $env:PATH -split ';' | Select-String -Pattern 'node'
   ```






