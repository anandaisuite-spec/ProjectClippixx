# Clipixx 🎬

Clipixx is a premium, modern platform designed for creators, fans, and stars. Whether you're an actor, comedian, musician, or influencer, Clipixx provides the ultimate interface to engage with your audience through a stunning, high-performance web experience.

## ✨ Features

- **💎 Premium UI/UX**: Built with a focus on aesthetics, featuring sleek dark modes, vibrant gradients, and glassmorphism.
- **🚀 High Performance**: Powered by Vite and React for lightning-fast loading and interactions.
- **🎭 Dynamic Animations**: Silky smooth transitions and micro-interactions powered by Framer Motion and GSAP.
- **🌓 Theme Support**: Seamless switching between elegant Dark Mode and refined Light Mode.
- **⚡ Real-time Backend**: Integrated with Supabase for secure authentication and high-speed data management.
- **📱 Fully Responsive**: Optimized for all devices, from desktops to mobile phones.

## 🛠️ Tech Stack

- **Frontend**: [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/) & [GSAP](https://greensock.com/gsap/)
- **Backend**: [Supabase](https://supabase.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18.0.0 or higher)
- npm or yarn
- A Supabase project

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/itsvickyl/clippixx.git
   cd clippixx
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

## 📦 Project Structure

- `src/components`: UI components, layout, and sections.
- `src/pages`: Main application pages (Home, Creator Page, etc.).
- `src/context`: Global state management (Themes, Auth).
- `supabase`: Database migrations and configuration.
- `public`: Static assets.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Built with ❤️ by [itsvickyl](https://github.com/itsvickyl)
