const express = require('express');
const mqtt = require('mqtt');
const path = require('path');
const util = require('util');
const fs = require('fs');
const bodyParser = require('body-parser');
const app = express();

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
// Create variables for MQTT use here
const myTopic = 'andrea/messages'

app.use(bodyParser.json());
function read(filePath = './message.json') {
    return readFile(path.resolve(__dirname, filePath)).then(data => JSON.parse(data));
}
function write(data, filePath = './message.json') {
    return writeFile(path.resolve(__dirname, filePath), JSON.stringify(data));
}

function generateMessageId() {
    const timestamp = Date.now().toString(36); // Convert timestamp to base 36 to include letters
    const randomComponent = Math.random().toString(36).substring(2, 8); // Generate random base 36 string
    return `${timestamp}-${randomComponent}`; // Combine timestamp and random component
}

// create an MQTT instance
const client = mqtt.connect({
    host: '18.198.188.151',
    port: 21883
});

// Check that you are connected to MQTT and subscribe to a topic (connect event)
client.on('connect', () => {
    console.log('Connected to MQTT broker');
    // Subscribe to a topic
    client.subscribe(myTopic, (err) => {
        if (err) {
            console.error('Error subscribing to topic:', err);
        } else {
            console.log('Subscribed to topic: andrea/messages');
        }
    });
});

// handle instance where MQTT will not connect (error event)
client.on('error', (err) => {
    console.error('Error with MQTT client:', err);
});

// Handle when a subscribed message comes in (message event)
client.on('message', async (topic, message) => {
    // Handle incoming message from MQTT broker
    console.log('Received message from topic:', topic);
    const newMessage = JSON.parse(message.toString());
    // Write the new message to the JSON file
    try {
        const messages = await read();
        messages.push(newMessage);
        await write(messages);
        console.log('Message written to JSON file:', newMessage);
    } catch (error) {
        console.error('Error writing message to JSON file:', error);
    }
});

// Route to serve the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// route to serve the JSON array from the file message.json when requested from the home page
app.get('/messages', async (req, res) => {
    try {
        const messages = await read();
        res.json(messages);
    } catch (error) {
        console.error('Error reading messages from JSON file:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to serve the page to add a message
app.get('/add', (req, res) => {
    res.sendFile(path.join(__dirname, 'message.html'));
});

//Route to show a selected message. Note, it will only show the message as text. No html needed
app.get('/:id', async (req, res) => {
    try {
        const messages = await read();
        const selectedMessage = messages.find(msg => msg.id === req.params.id);
        if (selectedMessage) {
            res.send(selectedMessage.msg);
        } else {
            res.status(404).send('Message not found');
        }
    } catch (error) {
        console.error('Error reading messages from JSON file:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to CREATE a new message on the server and publish to mqtt broker
app.post('/', (req, res) => {
    try {
        const { topic, msg } = req.body;
        const newMessage = {
            id: generateMessageId(),
            topic,
            msg
        };
    // Publish the new message to MQTT broker
    client.publish(myTopic, JSON.stringify(newMessage), (err) => {
        if (err) {
            console.error('Error publishing message to MQTT broker:', err);
            res.status(500).send('Error publishing message');
        } else {
            res.sendStatus(200);
        }
    });
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).send('Error processing message');
    }
});

// Route to delete a message by id (Already done for you)

app.delete('/:id', async (req, res) => {
    try {
        const messages = await read();
        write(messages.filter(c => c.id !== req.params.id));
        res.sendStatus(200);
    } catch (e) {
        res.sendStatus(200);
    }
});

// listen to the port
app.listen(3000);