# NEER — Farmer AI Assistant 🌾🤖

**NEER** (meaning 'water' in Sanskrit/Hindi, symbolizing the lifeblood of agriculture) is a premium, AI-powered agricultural intelligence platform designed for small and mid-scale Indian farmers. It provides hyper-local, actionable insights through a modern, accessible interface.

---

## 🌟 Core Features

### 🩺 **Crop Doctor (Vision AI Detection)**
A multi-step diagnostic pipeline that identifies crop diseases from images.
- **Validation**: Ensures the uploaded image is actually a plant.
- **Precision Diagnosis**: Differentiates between similar fungal spots (e.g., Bipolaris vs. Cercospora).
- **Hybrid Treatment**: Merges trusted Knowledge Base (KB) data with real-time AI generation for organic and chemical solutions.
- **Regional Mapping**: Filters disease possibilities based on the farmer's specific state in India.

### 💬 **NEER AI Chat (Smart Orchestrator)**
A professional agricultural consultant powered by a **cascading model architecture**.
- **Native Orchestration**: Directly calls optimized Python tools for weather and schemes (PM-Kisan, KCC, etc.).
- **Concision**: Delivers direct, expert-level advice without conversational filler.
- **Multi-lingual**: Fully functional in both Hindi and English.

### 📜 **Scheme Navigator**
An automated recommendation engine for Indian government agricultural schemes.
- Matches farmers to schemes like **PM-KISAN**, **KCC**, and **PMFBY** based on land size, state, and crop types.
- Provides direct markdown links to official portals.

### 🌤️ **Weather Scout & Farm Advisor**
Hyper-local weather intelligence integrated with farming tasks.
- **Task Specificity**: Advises whether to spray, irrigate, or harvest based on real-time precipitation probabilities.
- **Hourly Forecasts**: Granular weather data specifically tailored for agricultural windows.

### 🤝 **Community Hub & Mandi Bidding**
A social platform where farmers can interact and trade.
- **Discussion Boards**: Share insights on local pest outbreaks or crop success.
- **Mandi Listing**: Farmers can post crop prices, and buyers can submit bids in real-time.

### 📅 **Intelligent Crop Calendar**
AI-generated 12-month farming schedules customized by state and crop, helping farmers plan their entire season in advance.

---

## 🛠️ Technology Stack

### **Frontend**
- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **UI Design**: Modern "Glassmorphism" aesthetics, micro-animations, and responsive layout.
- **Icons**: Lucide-React / Font-Awesome integration.

### **Backend**
- **Engine**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Data Persistence**: [Supabase](https://supabase.com/) (PostgreSQL) for profiles, history, and community posts.
- **AI Models**: Google Gemini (2.0 Flash, 2.0 Flash-Lite, 2.5 Flash-Lite) using a cascading retry system to mitigate rate limits.

### **AI Orchestration**
- **Native Tools**: `SchemeNavigator` and `WeatherScout` are integrated directly into the backend.
- **Function Calling**: Uses Gemini's native function-calling capabilities for reliable tool usage.

---

## 🏗️ Architecture & Infrastructure

### **The Cascading Model System**
To handle API quotas on free-tier models, NEER implements a **Cascading Failure Pattern**:
1. Try **Gemini 2.0 Flash** (Primary).
2. On rate limit (429), fall back to **2.0 Flash-Lite**.
3. On further limit, try **2.5 Flash-Lite**.
This effectively multiplies the available RPM (Requests Per Minute).

### **Native AI Orchestration**
The backend acts as an intelligent host. When a user asks a complex question about weather or money, the advisor:
1. Identifies the intent and selects the appropriate tool (`get_farming_weather` or `find_government_schemes`).
2. Executes the Python logic (e.g., calling Open-Meteo or searching the Scheme DB).
3. Relays the grounded result back to the user through the chat interface.

---

## 🚀 Getting Started

### **Prerequisites**
- Python 3.9+
- Node.js & npm
- Google Gemini API Key
- Supabase Project URL & Key

### **Backend Setup**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
```

### **Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

---

## 📱 Applications
- **Disease Prevention**: Early detection via image analysis saves crops before they reach a critical state.
- **Financial Inclusion**: Navigating the complex landscape of government subsidies and insurance.
- **Hyper-local Advisory**: Moving away from generic "state-wide" weather to field-specific advice.
- **Market Exposure**: Direct Mandi-style bidding to reduce reliance on middlemen.
