import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import NewsFeed from "@/pages/NewsFeed";
import ArticleDetail from "@/pages/ArticleDetail";
import MediaLibrary from "@/pages/MediaLibrary";
import WatermarkSettings from "@/pages/WatermarkSettings";

function App() {
  useEffect(() => {
    document.title = "Chronicle | Newsroom";
  }, []);

  return (
    <div className="App min-h-screen bg-paper">
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<NewsFeed />} />
          <Route path="/article/:id" element={<ArticleDetail />} />
          <Route path="/media" element={<MediaLibrary />} />
          <Route path="/watermark" element={<WatermarkSettings />} />
        </Routes>
        <Toaster position="top-right" richColors offset={76} />
      </BrowserRouter>
    </div>
  );
}

export default App;
