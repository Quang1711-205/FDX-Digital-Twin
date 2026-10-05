# FDX Digital Twin - DENSO Logistics Digital Twin

A 3D Digital Twin simulation for automotive component manufacturing logistics built with React, Vite, and Three.js.

## 🚀 Features
- **3D Factory & Logistics Twin**: Real-time Three.js 3D visual simulation of warehouse racks, picking/kitting, staging pallets, AMR/Forklift transport lanes, and assembly lines.
- **Dynamic 3D Labels Projection**: Automatic projection of 3D spatial labels overlaying the scene.
- **What-If Scenario Simulation**: Test different AMR fleet sizes and extra transport shifts with instant bottleneck and delay impact calculations.
- **AI Recommendation System**: Automated evaluation of risk vs. cost for logistics scenario decision-making.
- **JSON Mock Data Separation**: Modular JSON data structures located in `src/json/`.

## 🛠 Tech Stack
- **Framework**: React 19 + Vite
- **3D Engine**: Three.js
- **Styling**: CSS (TailwindCSS / Custom CSS design system)
- **Language**: TypeScript

## 📦 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Production Build
```bash
npm run build
```
