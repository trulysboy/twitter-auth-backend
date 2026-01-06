const express = require('express');
const session = require('cookie-session');
const cors = require('cors');
const dotenv = require('dotenv');
const { TwitterApi } = require('twitter-api-v2');

dotenv.config();
const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(session({
  name: 'session',
  keys: [process.env.SESSION_SECRET],
  maxAge: 24 * 60 * 60 * 1000
}));

// Twitter client
const client = new TwitterApi({
  clientId: process.env.TWITTER_CLIENT_ID,
  clientSecret: process.env.TWITTER_CLIENT_SECRET,
});

const callbackURL = process.env.TWITTER_CALLBACK_URL;

// Step 1: Redirect to Twitter
app.get('/auth/twitter', async (req, res) => {
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(callbackURL, { scope: ['tweet.read','users.read','offline.access'] });
  req.session.codeVerifier = codeVerifier;
  req.session.state = state;
  res.redirect(url);
});

// Step 2: Handle callback
app.get('/auth/twitter/callback', async (req, res) => {
  const { state, code } = req.query;
  if (!state || !req.session.state || state !== req.session.state) {
    return res.status(400).send('State mismatch');
  }

  try {
    const { client: loggedClient, accessToken, refreshToken } = await client.loginWithOAuth2({
      code,
      codeVerifier: req.session.codeVerifier,
      redirectUri: callbackURL,
    });

    const user = await loggedClient.v2.me();
    req.session.user = user.data;
    res.redirect(`${process.env.FRONTEND_URL}/apply`);
  } catch (e) {
    console.error(e);
    res.status(500).send('Login failed');
  }
});

// Session check
app.get('/session/me', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));