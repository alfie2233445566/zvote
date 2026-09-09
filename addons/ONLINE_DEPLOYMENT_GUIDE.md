# ZVote Online Deployment Guide: Netlify, Free Backend & Polygon Amoy Testnet

This guide walks you through sending the complete ZVote stack online:
1. **Blockchain**: Deploy the smart contract to Polygon Amoy Testnet (`chainId: 80002`).
2. **Backend**: Host the Express + Prisma API on **Render.com** with a free **Neon.tech** or **Render PostgreSQL** database.
3. **Frontend**: Host the React + Vite web application on **Netlify** with automatic SSL and SPA routing.

---

## Part 1: Deploy Smart Contract to Polygon Amoy Testnet

### Step 1: Check your wallet and get free testnet POL
1. Open a terminal in the `blockchain` directory:
   ```bash
   cd blockchain
   node scripts/check_amoy_wallet.js
   ```
2. The script displays your configured **Wallet Address** (e.g. `0xe59f02b5D114cdEa89e519ca608C16d13738c418`).
3. If your balance is `0.0 POL`, get free testnet POL in 30 seconds from any of these faucets:
   - **Polygon Official Faucet**: [faucet.polygon.technology](https://faucet.polygon.technology/) (select Polygon PoS -> Amoy)
   - **Alchemy Amoy Faucet**: [alchemy.com/faucets/polygon-amoy](https://www.alchemy.com/faucets/polygon-amoy)
   - **QuickNode Amoy Faucet**: [faucet.quicknode.com/polygon/amoy](https://faucet.quicknode.com/polygon/amoy)
4. Re-run `node scripts/check_amoy_wallet.js` to confirm your balance is funded.

### Step 2: Deploy the ZVote Contract
Run the deployment script:
```bash
npx hardhat run scripts/deploy.js --network amoy
```
The script will output:
```
Deploying ZVote to network: amoy...
Deployer balance: 0.2 POL
Waiting for deployment transaction to be mined...
✅ ZVote deployed at: 0xYourDeployedContractAddress
```
Copy this contract address! You will use it in **Part 2** and **Part 3**.

---

## Part 2: Deploy the Backend to Free Server (Render.com + Neon Database)

### Option A: 1-Click Setup with Neon.tech (Recommended for Database)
1. **Create Free Database on [Neon.tech](https://neon.tech/)**:
   - Sign up for free (no credit card required).
   - Create a project named `zvote`.
   - Copy the PostgreSQL connection string (`DATABASE_URL`), which looks like:
     `postgresql://zvote_owner:password@ep-xyz.us-east-2.aws.neon.tech/zvote?sslmode=require`

2. **Deploy Backend Web Service on [Render.com](https://render.com/)**:
   - Sign up for free on Render.
   - Click **New +** -> **Web Service**.
   - Connect your GitHub repository containing the ZVote code (or use the root `render.yaml` blueprint).
   - Configure the following settings:
     - **Name**: `zvote-backend`
     - **Root Directory**: `backend`
     - **Environment**: `Node`
     - **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy && npm run seed`
     - **Start Command**: `npm start`
     - **Plan**: `Free`
   - In **Environment Variables**, add:
     - `DATABASE_URL`: *(Your Neon PostgreSQL connection string)*
     - `NODE_ENV`: `production`
     - `PORT`: `10000`
     - `JWT_SECRET`: *(A random 32-character secret string)*
     - `RPC_URL`: `https://polygon-amoy.drpc.org`
     - `CONTRACT_ADDRESS`: *(The contract address from Part 1)*
     - `PRIVATE_KEY`: *(Your funded deployer private key from blockchain/.env)*
     - `CORS_ORIGIN`: `https://your-site-name.netlify.app` *(update once you create your Netlify site)*
3. Click **Deploy Web Service**.
4. Once deployed, Render will provide your public backend URL (e.g. `https://zvote-backend.onrender.com`).
   - Test it by visiting: `https://zvote-backend.onrender.com/api/health`
   - It should return: `{"status":"ok","service":"zvote-backend"}`.

---

## Part 3: Deploy the Frontend to Netlify

We have already configured [netlify.toml](file:///c:/Users/USER/Desktop/ZVote-2/netlify.toml), [frontend/netlify.toml](file:///c:/Users/USER/Desktop/ZVote-2/frontend/netlify.toml), and [public/_redirects](file:///c:/Users/USER/Desktop/ZVote-2/frontend/public/_redirects) for seamless single-page application routing.

### Method 1: Git Integration (Recommended for Continuous Deployment)
1. Push your repository to GitHub.
2. Go to [app.netlify.com](https://app.netlify.com/) and click **Add new site** -> **Import an existing project**.
3. Select your GitHub repository.
4. Netlify will automatically detect the settings from `netlify.toml`:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. Click **Environment variables** -> **Add a variable**:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://zvote-backend.onrender.com` *(your backend URL from Part 2)*
6. Click **Deploy ZVote**.
7. Netlify will deploy your site in ~30 seconds and give you a live URL (e.g. `https://zvote.netlify.app`).

### Method 2: Instant Drag-and-Drop (Netlify Drop)
If you want to put the site online right now without Git:
1. Ensure your frontend is built with your live backend URL in `frontend/.env`:
   ```env
   VITE_API_URL=https://zvote-backend.onrender.com
   ```
2. Build the production bundle:
   ```bash
   cd frontend
   npm run build
   ```
3. Open [app.netlify.com/drop](https://app.netlify.com/drop) in your browser.
4. Drag and drop the `frontend/dist` folder directly into the browser.
5. Your frontend is instantly online with global CDN caching and free HTTPS!

---

## Part 4: End-to-End Live Verification Checklist

Once all three pieces are online:

1. **Visit your Netlify URL** (`https://your-site.netlify.app`).
2. **Log in as Administrator**:
   - Student/Admin ID: `ADMIN001`
   - Password: `Admin@123!`
3. **Upload Voter Roster**:
   - Upload `test_students.csv` in the **Register Voters** panel.
   - Download the generated credentials.
4. **Create a Live Election**:
   - Create a School-Wide Election (e.g., "2026/2027 SRC General Election").
   - Add positions and candidates.
   - Click **Create & Launch Election** (this automatically deploys the ballot contract and registers candidates on Polygon Amoy).
5. **Vote as a Student**:
   - Log in with one of the student IDs from the roster.
   - Cast a vote for your chosen candidates.
   - Confirm you receive a real Polygon transaction hash (`txHash`).
6. **Verify on Polygonscan**:
   - Click the **Verify on Polygonscan** link or paste the transaction hash into [amoy.polygonscan.com](https://amoy.polygonscan.com/).
   - Confirm the transaction is permanently sealed into an Amoy block!
