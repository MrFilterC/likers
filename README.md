# Likers

A real-time social voting platform where users submit creative content, vote on posts, and win rewards using Solana blockchain.

## Features

- **Real-time Voting**: Submit posts and vote on community content
- **60-second Rounds**: Dynamic round-based gameplay 
- **One Post Per Round**: Strategic submission system
- **Solana Integration**: Connect with Phantom, Solflare and other Solana wallets
- **Dark/Light Theme**: Beautiful UI with theme toggle
- **Admin Panel**: Manage winners and reward distribution
- **Leaderboard**: Track top performers and prizes
- **Live Rankings**: Real-time post ranking with visual indicators
- **Smart Notifications**: Post status and user feedback system

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Blockchain**: Solana Web3.js, Wallet Adapter
- **Database**: Supabase (PostgreSQL) with real-time subscriptions
- **UI Components**: Lucide React icons
- **Theme**: next-themes

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_ADMIN_WALLET_ADDRESS=your_admin_wallet_address
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Database Schema

The app uses Supabase with the following tables:

- `users`: Store wallet addresses
- `posts`: Store user submissions (one per user per round)
- `votes`: Track upvotes/downvotes with real-time updates
- `rounds`: Manage 60-second rounds with winner tracking
- `leaderboard`: Store winners and prize information

### Database Constraints

Run this SQL in Supabase to ensure data integrity:

```sql
ALTER TABLE posts ADD CONSTRAINT unique_user_post_per_round 
UNIQUE (user_id, round_id);

ALTER TABLE leaderboard ADD CONSTRAINT unique_post_id_leaderboard 
UNIQUE (post_id);
```

## Admin Panel

Access the admin panel at `/admin` with the configured admin wallet address to:

- Select round winners from current posts
- Add prize amounts and transaction hashes
- Edit and manage leaderboard entries
- Monitor live voting activity

## How It Works

1. Users connect their Solana wallet to join Likers
2. Submit ONE creative post per round (max 140 characters)
3. Community votes during 60-second rounds
4. Post with highest net score (upvotes - downvotes) wins
5. Admin sends SOL rewards and records transactions
6. Winners appear on the public leaderboard

## Key Features

### Real-time Experience
- Live vote counting and ranking updates
- Instant post status feedback
- Server-side winner determination for consistency
- Race condition protection

### Smart UI/UX
- Color-coded posts based on performance (green/red/gray borders)
- Top 3 posts highlighted with ranking badges
- "Mine" indicators for user's own posts
- Mobile-responsive design

## Development Notes

- Server-side winner determination prevents inconsistencies
- Real-time Supabase subscriptions for live updates
- Graceful handling of race conditions
- 60-second rounds optimized for engagement
- Comprehensive error handling and logging
