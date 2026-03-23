# 🌾 Sajilo Khet – Agricultural Supply Chain System

## 📌 Description
Sajilo Khet is a web-based agricultural supply chain platform that connects farmers, cooperatives, warehouses, delivery services, and consumers.
The system helps manage product flow, user roles, and efficient distribution of agricultural goods.

## 🌐 Live Demo
👉 https://sad-project-ten.vercel.app/

## 🚀 Features

### 👨‍🌾 Farmer
- Manage products
- View dashboard

### 🏢 Cooperative
- Monitor farmers
- Handle product collection

### 🏬 Warehouse
- Store and manage inventory

### 🚚 Delivery System
- Track and manage deliveries

### 🛒 Consumer
- Browse and purchase products

### 🔐 Authentication
- User login & registration
- Admin login panel

## 🛠️ Tech Stack
- Frontend: React.js + Vite
- Backend: Supabase (PostgreSQL)
- Styling: CSS
- Deployment: Vercel

## ✅ Prerequisites
- Node.js (LTS recommended)
- npm (comes with Node)
- A Supabase project (URL + anon key)

## 📦 Installation
```bash
git clone https://github.com/nishadhungana/SAD-Project.git
cd SAD-Project
npm install
```

## 🔑 Environment Variables
This project uses Vite, so environment variables must be prefixed with `VITE_`.

Create a `.env` file in the project root:

```dotenv
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Note: Do **not** commit real secrets to git. If you have already committed secrets, rotate them in Supabase and update your deployment environment.

## ▶️ Running the App (Development)
```bash
npm run dev
```

## 🏗️ Build for Production
```bash
npm run build
```

## 👀 Preview Production Build Locally
```bash
npm run preview
```

## 🧹 Lint
```bash
npm run lint
```

## 🧪 Testing
There is a `test_order.js` script in the repository. If it is used for E2E / integration testing, document the required setup and run instructions here.

## 🗃️ Supabase Notes (High-Level)
This app uses Supabase for:
- Authentication (`supabase.auth.*`)
- Application data (tables like `profiles`, `products`, `inventory`, `orders`, etc.)

To run locally, ensure your Supabase project has the required tables and (if applicable) Row Level Security (RLS) policies.

## 🚀 Deployment (Vercel)
1. Import the repo into Vercel.
2. Configure environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy.

## 🤝 Contributing
Contributions are welcome.
- Fork the repo
- Create a feature branch
- Open a pull request

## 📄 License
No license file is currently included in the repository. If you intend others to use/modify this code, consider adding a LICENSE (e.g., MIT) and updating this section.
