const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
      const totaluser = await userCollection.countDocuments()
      res.send({ user: result, totaluser })
    })


    app.get('/user/role/:email', async (req, res) => {
      const { email } = req.params
      const query = { email: email }
      const result = await userCollection.findOne(query)
      console.log(result);
      res.send(result)
    })


    // status change api
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


    // role change
    app.patch('/update/role', verifyFBToken, async (req, res) => {
      const { email, role } = req.query;

      const query = { email };
      const updateRole = {
        $set: {
          role: role
        }
      };

      const result = await userCollection.updateOne(query, updateRole);
      res.send(result);
    });


    // Request
    app.post('/requests', verifyFBToken, async (req, res) => {
      const data = req.body;
      data.createdAt = new Date();
      const result = await reequestsCollection.insertOne(data)
      res.send(result)
    })

    // My Request
    app.get('/my-request', verifyFBToken, async (req, res) => {
      const email = req.decoded_email;
      const page = Number(req.query.page);
      const size = Number(req.query.size);
      const status = req.query.status;

      let query = { requesterEmail: email };

      if (status) {
        query.donationStatus = status;
      }

      const result = await reequestsCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();

      const totalRequest = await reequestsCollection.countDocuments(query);

      res.send({ request: result, totalRequest });
    });


    // All Request
    app.get("/all-request", verifyFBToken, async (req, res) => {
      const size = Number(req.query.size);
      const page = Number(req.query.page);
      const status = req.query.status;

      let query = {};
      if (status) {
        query.donationStatus = status;
      }

      const result = await reequestsCollection
        .find(query)
        .limit(size)
        .skip(size * page)
        .toArray();

      const totalRequest = await reequestsCollection.countDocuments(query);

      res.send({ request: result, totalRequest });
    });



    // Recent Request
    app.get("/recent-request", verifyFBToken, async (req, res) => {
      const result = await reequestsCollection.find().sort({ createdAt: -1 }).limit(3).toArray()
      res.send(result)
    })



    // delete request
    app.delete("/Delete-request", verifyFBToken, async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const result = await reequestsCollection.deleteOne(query);
      res.send(result);
    });


    // view request 
    app.get("/Dashboard/view-request/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) }
      const result = await reequestsCollection.findOne(query)
      res.send(result)
    })

    // Done Request
    app.patch("/done-request", verifyFBToken, async (req, res) => {
      const { id, status } = req.query;
      const query = { _id: new ObjectId(id) }
      const update = {
        $set: {
          donationStatus: status
        }
      }
      const result = await reequestsCollection.updateOne(query, update)
      res.send(result)
    })


    // Canceled Request
    app.patch("/cancel-request", verifyFBToken, async (req, res) => {
      const { id, status } = req.query;
      console.log(id, status);
      const query = { _id: new ObjectId(id) }

      const update = {
        $set: {
          donationStatus: status
        }
      }
      const result = await reequestsCollection.updateOne(query, update)
      res.send(result)
    })


    // Donation Request
    app.get("/donation-page", async (req, res) => {
      const query = { donationStatus: "pending" }
      const result = await reequestsCollection.find(query).toArray()
      res.send(result)
    })


    // Donation Details
    app.get("/donation-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reequestsCollection.findOne(query)
      res.send(result)
    })


    // Donate
    app.patch("/donate", verifyFBToken, async (req, res) => {
      const { status, id } = req.query;
      const query = { _id: new ObjectId(id) }
      const update = {
        $set: {
          donationStatus: status
        }
      }
      const result = await reequestsCollection.updateOne(query, update)
      res.send(result)
    })



    // Search
    app.get("/search-requests", async (req, res) => {
      const { bloodGroup, district, upazila } = req.query;

      const query = {};
      if (!query) {
        return;
      }
      if (bloodGroup) {
        query.bloodGroup = bloodGroup.replace(/ /g, "+").trim()
      }
      if (district && district !== "Chose Your District") {
        query.recipientDistrict = district
      }
      if (upazila && upazila !== "Chose Your Upazila") {
        query.recipientUpazila = upazila
      }
      console.log(query);
      const result = await reequestsCollection.find(query).toArray()
      res.send(result)
    });




    // payment
    app.post('/create-payment-checkout', async (req, res) => {
      const information = req.body
      const amount = parseInt(information.donateAmount) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: amount,
              product_data: {
                name: 'Please Donate'
              }
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        metadata: {
          donorName: information.donorName
        },
        customer_email: information.donorEmail,
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`
      })
      res.send({ url: session.url })
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