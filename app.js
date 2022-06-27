const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");
const app = express();
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server running at http://localhost:3000")
    );
  } catch (e) {
    console.log(`DB error:${e.message}`);
  }
};
initializeDBAndServer();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectedUser = `SELECT * FROM user WHERE username='${username}'`;
  const dbUser = await db.get(selectedUser);
  if (dbUser === undefined) {
    if (request.body.password.length >= 6) {
      const createUserQuery = `
            INSERT INTO 
              user (username,password,name,gender)
              VALUES ('${username}','${hashedPassword}',
              '${name}','${gender}');
        `;
      await db.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
let userId;
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectedUser = `SELECT * FROM user WHERE username='${username}'`;
  const dbUser = await db.get(selectedUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const getUserId = `SELECT user_id FROM user WHERE username='${payload.username}';`;
      userId = await db.get(getUserId);

      const jwtToken = jwt.sign(password, "MySecret");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authheader = request.headers["authorization"];
  if (authheader !== undefined) {
    jwtToken = authheader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "MySecret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  //console.log(userId);
  let userID = userId.user_id;
  console.log(userID);
  const getUserTweetsQuery = `
        SELECT 
            user.username AS username,
            tweet.tweet AS tweet,
            tweet.date_time AS dateTime
        FROM (user
            INNER JOIN follower
            ON user.user_id=follower.following_user_id)
            INNER JOIN tweet
            ON follower.following_user_id=tweet.user_id
        WHERE follower.follower_user_id=${userID}
        ORDER BY tweet.date_time DESC
        LIMIT 4;

    `;
  const tweetsList = await db.all(getUserTweetsQuery);
  response.send(tweetsList);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  let userID = userId.user_id;
  console.log(userID);
  const getUsernamesQuery = `
        SELECT name
        FROM user
        INNER JOIN follower
        ON user.user_id=follower.following_user_id
        WHERE follower.follower_user_id=${userID};

    `;
  const followersNamesList = await db.all(getUsernamesQuery);
  response.send(followersNamesList);
});
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let userID = userId.user_id;

  const getUsernamesQuery = `
        SELECT name 
        FROM user
        INNER JOIN follower
        ON user.user_id=follower.follower_user_id
        WHERE follower.following_user_id=${userID};

    `;
  const namesList = await db.all(getUsernamesQuery);
  response.send(namesList);
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  let userID = userId.user_id;
  const { tweetId } = request.params;
  const selectedTweetQuery = `
        SELECT 
            tweet.tweet,
            COUNT(like.like_id),
            COUNT(reply.reply_id),
            tweet.date_time 
        FROM (tweet
        INNER JOIN follower
        ON tweet.user_id=follower.following.user_id)
        (INNER JOIN reply ON reply.tweet_id=tweet.tweet_id)
        INNER JOIN like ON like.tweet_id=tweet.tweet_id
        WHERE follower.follower_user_id=${userID} AND
              tweet.tweet_id=${tweetId};
    `;
  const tweetsList = await db.get(selectedTweetQuery);
  response.send(tweetsList);
});
module.exports = app;
