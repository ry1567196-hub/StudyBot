# StudyBot – Your AI Study Assistant 📚

StudyBot is an AI-powered study assistant designed to help students learn, revise, and prepare for exams more effectively.

It provides multiple study tools in one platform, including an AI Chatbot, Notes Generator, Flashcards, and Quiz Generator.

## ✨ Features

- **AI Chatbot:** Ask academic questions and get AI-generated answers.
- **Smart Notes Generator:** Generate study notes on different topics.
- **Flashcards:** Create flashcards to improve memory and revision.
- **Quiz Generator:** Generate quizzes with different difficulty levels.
- **User Authentication:** Register and log in securely.
- **Database Integration:** Store user-related data using MongoDB.
- **Responsive Design:** Access the application through a clean and user-friendly interface.

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Website structure |
| CSS3 | Styling and responsive design |
| JavaScript | Frontend functionality |
| Node.js | Backend runtime |
| Express.js | Backend framework and API routes |
| MongoDB | Database |
| Mongoose | MongoDB object modeling |
| Gemini API | AI-powered responses |
| JWT | Authentication |
| bcryptjs | Password hashing |

## 📂 Project Structure

```text
StudyBot/
│
├── models/
│   └── User.js
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── server.js
```

## ⚙️ Installation and Setup

Follow these steps to run StudyBot locally.

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the Project Folder

```bash
cd StudyBot-AI-Study-Assistant
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root folder and add your credentials.

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_secret_key
```

Use the exact environment variable names required by your `server.js` file.

**Important:** Never upload your actual `.env` file or API keys to GitHub.

### 5. Start the Server

```bash
node server.js
```

### 6. Open the Application

Open your browser and visit:

```text
http://localhost:3000
```

## 🎯 Project Objective

The main objective of StudyBot is to make studying easier and more interactive by combining AI-powered learning tools into a single platform.

It helps students understand concepts, prepare notes, revise important topics, and test their knowledge.

## 🔮 Future Scope

- Voice-based AI interaction.
- Personalized learning recommendations.
- Study progress tracking.
- More advanced AI learning tools.
- Deployment for public access.

## 👨‍💻 Project Information

**Project Name:** StudyBot – Your AI Study Assistant

**Project Type:** Mini Project

**Domain:** Artificial Intelligence / Web Development

**Purpose:** Smart and interactive student learning platform.

---

⭐ If you find this project interesting, consider giving this repository a star!