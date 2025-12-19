const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express')
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 3000
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const crypto = require('crypto')

const app = express()
app.use(cors())
app.use(express.json())

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: 'unauthorize access' })
  }
  try {
    const idToken = token.split(' ')[1]
    const decoded = await admin.auth().verifyIdToken(idToken)
    console.log('decoded info:', decoded);
    req.decoded_email = decoded.email
    next()
  }
  catch (error) {
    return res.status(401).send({ message: 'unauthorize access' })
  }
}



const uri = "mongodb+srv://practice-11:0iix5UWbGhAok7BM@cluster0.83ib2ra.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    await client.connect();

    const database = client.db('practice-11DB')
    const userCollection = database.collection('user')
    const reequestsCollection = database.collection('request')

    app.post('/user', async (req, res) => {
      const userInfo = req.body
      userInfo.createdAt = new Date()
      userInfo.role = 'donor'
      userInfo.status = 'active'
      const result = await userCollection.insertOne(userInfo)
      res.send(result)
    })


    app.get('/users', verifyFBToken, async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })


    app.get('/user/role/:email', async (req, res) => {
      const { email } = req.params
      const query = { email: email }
      const result = await userCollection.findOne(query)
      console.log(result);
      res.send(result)
    })



    app.patch('/update/user/status', verifyFBToken, async (req, res) => {
      const { email, status } = req.query
      const query = { email: email }

      const updateStatus = {
        $set: {
          status: status
        }
      }
      const result = await userCollection.updateOne(query, updateStatus)
      res.send(result)
    })



    app.post('/requests', verifyFBToken, async (req, res) => {
      const data = req.body;
      data.createdAt = new Date();
      const result = await reequestsCollection.insertOne(data)
      res.send(result)
    })


    app.get('/my-request', verifyFBToken, async (req, res) => {
      const email = req.decoded_email;
      const page = Number(req.query.page);
      const size = Number(req.query.size);
      const status = req.query.status;

      let query = { requesterEmail: email };

      if (status) {
        query.status = status;
      }

      const result = await reequestsCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();

      const totalRequest = await reequestsCollection.countDocuments(query);

      res.send({ request: result, totalRequest });
    });



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Hello, Emran')
})

app.listen(port, () => {
  console.log(`server is running on ${port}`);
})