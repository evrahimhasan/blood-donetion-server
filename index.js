const express = require('express')
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 3000

const app = express()
app.use(cors())
app.use(express.json())



const { MongoClient, ServerApiVersion } = require('mongodb');
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

    app.post('/user', async (req, res) => {
      const userInfo = req.body
      userInfo.role = 'buyer'
      userInfo.createdAt = new Date()
      const result = await userCollection.insertOne(userInfo)
      res.send(result)
    })


    app.get('/user/role/:email', async (req, res) => {
      const {email} = req.params
      const query = { email: email }
      const result = await userCollection.findOne(query)
      console.log(result);
      res.send(result)
    })


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