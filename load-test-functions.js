// 🎯 Load test helper functions

module.exports = {
  generateWalletAddress,
  generatePostContent,
  generateRandomVote
};

// 🔑 Generate fake Solana wallet address
function generateWalletAddress(context, events, done) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  context.vars.walletAddress = result;
  return done();
}

// 📝 Generate random post content
function generatePostContent(context, events, done) {
  const posts = [
    "Amazing crypto project! 🚀",
    "This is going to revolutionize Web3",
    "Love the community here ❤️",
    "When moon? 🌙",
    "HODL strong! 💎🙌", 
    "Best dApp I've ever used!",
    "Real-time features are incredible",
    "Smooth user experience 👌",
    "Great work developers! 💻",
    "Can't wait for next update"
  ];
  
  context.vars.postContent = posts[Math.floor(Math.random() * posts.length)];
  return done();
}

// 🗳️ Generate random vote type
function generateRandomVote(context, events, done) {
  const voteTypes = ['upvote', 'downvote'];
  context.vars.voteType = voteTypes[Math.floor(Math.random() * voteTypes.length)];
  return done();
} 