const express = require('express')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');


const stripe = require("stripe")('sk_test_51MSFzbGk3QfbJiMcsqL1UPl95CGQ4zuA9vzlgYy8aodGEOs7jobqIhTQfdnH50XILCQVSJhL5kSDosjGgjT3ZV2v00SYnQOh85');

require('dotenv').config()

const app = express()
const port = process.env.PORT || 5000
app.use(express.json());
app.use(cors())
app.use(express.json())

// cons uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ohpemee.mongodb.net/?retryWrites=true&w=majority`;
const uri = 'mongodb://mohid:f2WoP4JTiUqYoftX@ac-advgvfk-shard-00-00.ohpemee.mongodb.net:27017,ac-advgvfk-shard-00-01.ohpemee.mongodb.net:27017,ac-advgvfk-shard-00-02.ohpemee.mongodb.net:27017/?ssl=true&replicaSet=atlas-4xy0vv-shard-0&authSource=admin&retryWrites=true&w=majority'
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// verify token
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_VAR, function (err, decoded) {
        if (err) {
            return res.status(403).send({ massage: 'forbidden' })
        }
        req.decoded = decoded;
        next();
    });
}


async function run() {
    try {
        await client.connect()
        console.log('connected')
        const toolsCollection = client.db('tool-house').collection('tools');
        const usersCollection = client.db('tool-house').collection('users');
        const ordersCollection = client.db('tool-house').collection('orders');
        const paymentsCollection = client.db('tool-house').collection('payments');
        const reviewsCollection = client.db('tool-house').collection('review');


        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email
            const requesterAccount = await usersCollection.findOne({ email: requester })

            if (requesterAccount.roll === 'admin') {
                next()
            } else {
                res.status(403).send({ massage: 'Forbidden' })
            }
        }


        app.post('/tools', verifyJWT, async (req, res) => {

            const tools = req.body;
            const result =await toolsCollection.insertOne(tools);
            res.send(result)

        })
        app.get('/tools', async (req, res) => {

            const tools = await toolsCollection.find({}).toArray()
            res.send(tools)

        })
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const item = await toolsCollection.findOne({ _id: ObjectId(id) });
            res.send(item)

        })

        app.get('/myOrders/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const filter = { email: email };
            const myOrders = await ordersCollection.find(filter).toArray()
            res.send(myOrders)

        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {

                $set: user
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_VAR, { expiresIn: '365d' })
            res.send({ result, token })

        })

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await usersCollection.find({}).toArray()
            res.send(users)
        })
        app.get('/singleUser/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const user = await usersCollection.findOne({ email: email });
            res.send(user)
        })

        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.roll === 'admin'
            res.send({ admin: isAdmin })
        })
        app.delete('/deleteUser/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { roll: 'admin' }
            }
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)

        })


        app.put('/user/update/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const data = req.body
            const filter = { email: email };
            const updateDoc = {
                $set: {
                    location: data.location,
                    education: data.education,
                    phnNumber: data.phnNumber
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)

        })


        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const price = req.body.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const orderId = payment.orderId
            const transactionId = payment.transactionId
            const filter = { _id: ObjectId(orderId) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: transactionId

                }
            }
            const updatedResult = await ordersCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })
        app.post('/order', verifyJWT, async (req, res) => {

            const order = req.body;
            const result = await ordersCollection.insertOne(order);
            res.send(result)

        })
        app.get('/orders/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const orderPayment = await ordersCollection.findOne(filter)
            res.send(orderPayment)

        })
        app.delete('/deleteOrder/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(filter);
            res.send(result);
        })

        app.post('/review', verifyJWT, async (req, res) => {

            const review = req.body;
            const result = reviewsCollection.insertOne(review);
            res.send(result)

        })

        app.get('/reviews/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await reviewsCollection.find(filter).toArray();
            res.send(result)

        })

    } finally {

    }

}

run().catch(console.dir)


app.get('/', async (req, res) => {
    res.send('This is  deployment in render')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})



// https://tools-house.onrender.com/