const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;


// middleware
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.orv8anl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// console.log(uri)

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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const campsCollection = client.db('medicalCamp').collection('availableCamps');
    const userCollection = client.db('medicalCamp').collection('users');
    const regCampCollection = client.db('medicalCamp').collection('regCamp');

    // token
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
      res.send({ token })
    })

    // verify token
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization)
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
      // next()
    }


    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();

    }



    // user related api
    app.get("/users/:email", async (req, res) => {
      // console.log(req.headers)
      const email = req.params.email;
      const query = { email: email }
      const result = await userCollection.findOne(query);
      res.send(result)
    })

    app.get('/users/admin/:email', verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      // console.log("user inside decoded",req.decoded)
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    })


    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null })
      }

      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const updateUser = req.body;
      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          ...updateUser
        }
      }
      const result = await userCollection.updateOne(query, updatedDoc)
      res.send(result)
    })



    // camps related apis 
    app.get("/camps", async (req, res) => {
      // const query = {};
      // const options = {
      //   sort: { participantCount: -1 } 
      // };
      const result = await campsCollection.find().toArray()
      // const result = await campsCollection.find(query, options).toArray()
      res.send(result);
    })

    app.post("/camps", async (req, res) => {
      const newCamp = req.body;
      const result = await campsCollection.insertOne(newCamp);
      res.send(result)
    })

    app.get("/camps/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await campsCollection.findOne(query)
      res.send(result)
    })

    app.delete("/camps/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await campsCollection.deleteOne(query)
      res.send(result)
    })

    app.patch("/camps/:id", async (req, res) => {
      const id = req.params.id;
      const item = req.body;
      // console.log(item)
      const query = { _id: new ObjectId(id) }
      // const options = { upsert: true };
      const updatedDoc = {
        $set: {
          ...item
        }
      }
      const result = await campsCollection.updateOne(query, updatedDoc)
      res.send(result)
    })


    // save registered camp to the database
    app.post('/joinCamp', async (req, res) => {
      const joinCamp = req.body;
      console.log(joinCamp)
      const query = {
        participantEmail: joinCamp.participantEmail,
        campId: joinCamp.campId
      }
      const alreadyJoin = await regCampCollection.findOne(query)
      if (alreadyJoin) {
        return res.status(400).send('You have already join for this camp')
      }
      const result = await regCampCollection.insertOne(joinCamp)

      const updatedDoc = {
        $inc: { participantCount: 1 }
      }
      const joinQuery = { _id: new ObjectId(joinCamp.campId) }
      const updatedCamp = await campsCollection.updateOne(joinQuery, updatedDoc)
      res.send(updatedCamp)
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get("/", (req, res) => {
  res.send("medical camp is running properly")
})

app.listen(port, () => {
  console.log(`Medical camp is running on port ${port}`)
})