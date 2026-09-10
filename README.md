# AQUA-CAST 

> Real-time urban flood risk modeling and predictive inundation forecasting system.

AQUA-CAST is an interactive monitoring and simulation platform designed to predict street-level flood inundation using live sensor data and Machine Learning temporal forecasting. The system provides early warnings to disaster management teams and municipal authorities before extreme weather events occur.

---

##  Key Features

* **Real-time Rainfall Monitoring:** Tracks baseline ambient precipitation via IoT weather sensor inputs.
* **Predictive Simulation (Lookahead Slider):** Interactive slider allowing operators to simulate cloudburst scenarios up to 1 hour in advance.
* **Inundation Threshold Alerts:** Dynamic alert banners that automatically trigger when simulated rainfall exceeds safe absorption capacities (e.g., predicted flooding `>25cm`).
* **Hotspot Localization:** Identifies specific high-risk urban intersections and low-lying zones (e.g., Hindmata Junction, Dadar) for targeted emergency response.

---

##  System Architecture

1. **Data Ingestion:** Live precipitation metrics ($mm/hr$) stream into the backend pipeline.
2. **Predictive Modeling:** Time-series ML model projects surface run-off and drainage capacities for the chosen lookahead window (+1:00 hr).
3. **Frontend Dashboard:** React/Vue dashboard renders real-time telemetry, interactive scenario controls, and spatial warning banners.

---

##  Getting Started

### Prerequisites

* Node.js (v18+)
* Python 3.9+ (for ML pipeline & backend services)

### Installation

1. Clone the Repository
   ```bash
   git clone [https://github.com/your-username/aqua-cast.git](https://github.com/your-username/aqua-cast.git)
   cd aqua-cast
2. frontend setup
   cd frontend
   npm install
   npm run dev
3.cd backend
  pip install -r requirements.txt
  python main.py
