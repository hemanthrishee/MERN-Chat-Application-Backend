const dotenv = require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const http = require("http");
const cors = require("cors");
const {Server} = require("socket.io");
const CryptoJS = require("crypto-js");

const app = express();
app.use(cors({
    origin: ["http://localhost:3000", "https://chat-app-mern-nbvr.onrender.com"]
}));
app.use(express.json());
const saltRounds = process.env.SALT_ROUNDS;

mongoose.connect(process.env.ATLAS);

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
});

const roomSchema = new mongoose.Schema({
    room: String,
    users: Array,
    messages: Array
});

const User = mongoose.model("User", userSchema);
const Room = mongoose.model("Room", roomSchema);

app.get("/get/:user", (req, res)=> {
    async function execute() {
        const roomGet = req.params.user;
        const room = await Room.findOne({room: roomGet});
        if (room)
        {
            res.json(room);
        }
        else
        {
            res.json({});
        }
    }
    execute();
});

app.post("/rooms", (req, res)=> {
    async function execute () {
        const room = req.body.room;
        console.log(room);
        const foundRoom = await Room.findOne({room: room});
        console.log(foundRoom);

        if (!foundRoom)
        {
            res.json({status: "yeah"});
        }
        else
        {
            res.json({status: "no"});
        }
    }
    execute();
});

app.post("/register", (req, res)=> {
    async function search() {
        const user = await User.findOne({email: req.body.email});
        if (!user)
        {
            bcrypt.hash(req.body.password, Number(saltRounds), function(err, hash) {
                const use = new User({
                    ...req.body,
                    password: hash
                });
                use.save();
            });
            res.json({status: "registered"});
        }
        else
        {
            res.json({status: "exists"});
        }
    }
    search();
});

app.post("/login", (req, res)=> {
    async function search() {
        const user = await User.findOne({email: req.body.email});
        if (!user)
        {
            res.json({status: "nope"});
        }
        else
        {
            const hash = user.password;
            bcrypt.compare(req.body.password, hash, function(err, result) {
                if(result)
                {
                    res.json({status: "yeah", name: user.name});
                }
                else
                {
                    res.json({status: "nope"});
                }
            });
        }
    }
    search();
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "https://chat-app-mern-nbvr.onrender.com"],
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log(socket.id);

    socket.on("send_message", (data) => {
        async function execute() {
            if (data.t === "announce" && data.message === `${data.username} left the chat`)
            {
                await Room.updateOne({room: data.room}, {$pull: {users: data.username}});
                await Room.updateOne({room: data.room}, {$pull: {users: ""}});
                const room = await Room.findOne({room: data.room});
                if (room)
                {
                    if (room.users.length === 0)
                    {
                        await Room.deleteOne({room: data.room});
                    }
                }
            }

            await Room.updateOne({room: data.room}, {$push: {messages: data}});
            socket.to(data.room).emit("recieve_message", data);
        }
        execute();
    });

    socket.on("join_room", (data)=> {
        async function execute() {
            socket.join(data.room);
            const room = await Room.findOne({room: data.room});
            if (room)
            {
                await Room.updateOne({room: data.room}, {$push: {users: data.username}});
            }
            else
            {
                const r = new Room({
                    room: data.room,
                    users: [data.username],
                    messages: []
                });
                await r.save();
            }
        }
        execute();
    });

    socket.on("disconnect", ()=> {
        console.log("User Disconnected", socket.id);
    });
});

server.listen(3001, () => {
    console.log("server is running on port 3001");
});