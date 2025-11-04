const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

async function startClient() {
    console.log("🚀 Starting WhatsApp bot...");

    const client = new Client({
        authStrategy: new LocalAuth({ dataPath: './session_data' }),
        puppeteer: false
    });

    const events = [
        { id: 1, name: "Midnight Mixer – Dubai", location: "Dubai", date: "Feb 3", price: "$75", dressCode: "Cocktail", ageRestriction: true },
        { id: 2, name: "Sunset Yacht Party – Abu Dhabi", location: "Abu Dhabi", date: "Feb 10", price: "$120", dressCode: "All White", ageRestriction: true },
        { id: 3, name: "Elite Singles Dinner – Dubai", location: "Dubai", date: "Feb 16", price: "$90", dressCode: "Formal", ageRestriction: false },
        { id: 4, name: "Wine & Conversations – Doha", location: "Doha", date: "Mar 5", price: "$60", dressCode: "Smart Casual", ageRestriction: true }
    ];

    const userState = {};

    client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
    client.on('ready', () => console.log("✅ WhatsApp bot is ready!"));

    client.on('message', async (message) => {
        const user = message.from;
        const msg = message.body.trim();
        if (!userState[user]) userState[user] = { step: 'greeting', greeted: false };
        const state = userState[user];

        // If the user finished booking, wait for next message to restart
        if (state.step === 'end') {
            delete userState[user];
            message.reply("👋 Hi there! Welcome to *Date in Desert*, where real connections start at real events.\nReady to book your spot?\n1️⃣ Yes, let’s start\n2️⃣ Tell me more");
            userState[user] = { step: 'greeting', greeted: true };
            return;
        }

        // Auto greeting (first message)
        if (!state.greeted) {
            message.reply("👋 Hi there! Welcome to *Date in Desert*, where real connections start at real events.\nReady to book your spot?\n1️⃣ Yes, let’s start\n2️⃣ Tell me more");
            state.greeted = true;
            return;
        }

        switch (state.step) {
            // -------------------- GREETING --------------------
            case 'greeting':
                if (msg.includes('1') || msg.toLowerCase().includes('yes')) {
                    message.reply(
                        `Great! I’ll just need a few quick details to reserve your spot.
Please reply in this format:

1️⃣ Name: 
2️⃣ Phone Number: 
3️⃣ Email: 
4️⃣ Gender: Male / Female`
                    );
                    state.step = 'collect_all';
                } else if (msg.includes('2') || msg.toLowerCase().includes('tell me more')) {
                    message.reply("🌴 *Date in Desert* hosts premium social events across UAE and beyond — from mixers to yacht parties. Say *Yes* when you're ready to start!");
                }
                break;

            // -------------------- COLLECT DETAILS --------------------
            case 'collect_all':
                const lines = msg.split('\n').map(l => l.trim()).filter(l => l);
                if (lines.length >= 4) {
                    const [name, phone, email, gender] = lines;

                    if (!email.toLowerCase().endsWith('@gmail.com')) {
                        message.reply("⚠️ Please enter a valid Gmail address ending with *@gmail.com*.");
                        return;
                    }

                    state.name = name;
                    state.phone = phone;
                    state.email = email;
                    state.gender = gender;
                    state.step = 'show_events';

                    // Show events
                    let eventList = "🎉 Here are our upcoming events, pick one to explore details:\n";
                    events.forEach(e => eventList += `\n${e.id}. ${e.name} (${e.date})`);
                    eventList += "\n\nReply with the *event name* or *number* to see details.";
                    message.reply(eventList);
                } else {
                    message.reply(
                        `⚠️ Please reply with your details in this simple format (each line new):

Name
Phone Number
Email
Gender (Male / Female)`
                    );
                }
                break;

            // -------------------- SHOW EVENTS --------------------
            case 'show_events':
                const selectedEvent = events.find(e => e.id.toString() === msg || e.name.toLowerCase() === msg.toLowerCase());
                if (!selectedEvent) return message.reply("⚠️ Please reply with a valid event number or name.");

                state.selectedEvent = selectedEvent;

                if (selectedEvent.ageRestriction) {
                    state.step = 'verify_age';
                    message.reply("This event is strictly 21+. Please confirm your age:\n• I am 21 or above\n• I am below 21");
                } else {
                    state.step = 'event_options';
                    sendEventDetails(message, selectedEvent);
                }
                break;

            // -------------------- VERIFY AGE --------------------
            case 'verify_age':
                const ageMatch = msg.match(/\d+/);
                const age = ageMatch ? parseInt(ageMatch[0]) : null;
                const lowerMsg = msg.toLowerCase();

                if ((age !== null && age < 21) || lowerMsg.includes('below') || lowerMsg.includes('under')) {
                    message.reply("❌ Sorry! Our events are for guests aged 21+ only.\n\nDo you want to explore other events?\n1. Yes\n2. I’ll pass this one");
                    state.step = 'underage_response';
                } else if ((age !== null && age >= 21) || lowerMsg.includes('21+') || lowerMsg.includes('above 21')) {
                    message.reply("✅ Age verified! You’re eligible to attend our events.");
                    state.step = 'event_options';
                    sendEventDetails(message, state.selectedEvent);
                } else {
                    message.reply("⚠️ Please enter your age (e.g., 'I'm 22' or '21+').");
                }
                break;

            // -------------------- UNDERAGE RESPONSE --------------------
            case 'underage_response':
                if (msg.includes('1') || msg.toLowerCase().includes('yes')) {
                    let list = "Here are our upcoming events, pick one:\n";
                    events.forEach(e => list += `\n${e.id}. ${e.name} (${e.date})`);
                    list += "\n\nReply with the event name or number.";
                    message.reply(list);
                    state.step = 'show_events';
                } else if (msg.includes('2')) {
                    message.reply("No problem. Let us know if you change your mind. 🌟");
                    state.step = 'end'; // mark conversation ended
                }
                break;

            // -------------------- EVENT OPTIONS --------------------
            case 'event_options':
                if (msg.includes('1') || msg.toLowerCase().includes('yes')) {
                    message.reply("✅ Your booking request has been received! Our team will contact you soon 💬");
                    state.step = 'end'; // stop bot responses until next user message
                } else if (msg.includes('2')) {
                    let list = "Here are our upcoming events, pick one:\n";
                    events.forEach(e => list += `\n${e.id}. ${e.name} (${e.date})`);
                    list += "\n\nReply with the event name or number.";
                    message.reply(list);
                    state.step = 'show_events';
                } else if (msg.includes('3')) {
                    message.reply("💬 Our team will be in touch soon to answer your questions!");
                    state.step = 'end'; // also end chat here
                }
                break;
        }
    });

    // -------------------- EVENT DETAILS FUNCTION --------------------
    function sendEventDetails(message, event) {
        const details = `(Event Details):
Event: ${event.name}
Location: ${event.location}
Date: ${event.date}
Price: ${event.price}
Dress Code: ${event.dressCode}
Note: ${event.ageRestriction ? "21+ Wine & Social Evening" : ""}
Would you like to book this event?
Options:
1️⃣ Yes, Book
2️⃣ Show another event
3️⃣ Ask a question`;

        message.reply(details);
    }

    try {
        await client.initialize();
    } catch (err) {
        console.error("⚠️ Error initializing client:", err.message);
        console.log("🔁 Retrying in 10 seconds...");
        setTimeout(startClient, 10000);
    }
}

startClient();