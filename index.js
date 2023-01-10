const express = require('express')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');


require('dotenv').config()

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ohpemee.mongodb.net/?retryWrites=true&w=majority`;

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



        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email
            const requesterAccount = await usersCollection.findOne({ email: requester })

            if (requesterAccount.roll === 'admin') {
                next()
            } else {
                res.status(403).send({ massage: 'Forbidden' })
            }
        }


        app.post('/tools', async (req, res) => {

            const tools = req.body;
            const result = toolsCollection.insertOne(tools);
            res.send(result)

        })
        app.get('/tools', async (req, res) => {

            const tools = await toolsCollection.find({}).toArray()
            res.send(tools)

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

        app.get('/user',verifyJWT, async (req, res) => {
            const users = await usersCollection.find({}).toArray()
            res.send(users)
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