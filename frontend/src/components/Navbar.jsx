import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Newspaper, Images, Stamp, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NEWS } from "@/constants/testIds/news";
import CreateArticleDialog from "@/components/CreateArticleDialog";

const NavItem = ({ to, label, icon: Icon, testId }) => {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      data-testid={testId}
      className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold tracking-tight transition-colors ${
        active ? "text-crimson" : "text-slate-600 hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={2.4} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
};

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link to="/" data-testid={NEWS.navbarLogo} className="flex items-center gap-2.5 group">
          <span className="grid h-9 w-9 place-items-center bg-ink text-white">
            <Newspaper className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="font-serif text-xl font-bold tracking-tight text-ink">
            CHRONICLE
            <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-crimson align-middle">
              Newsroom
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavItem to="/" label="News Feed" icon={Newspaper} testId={NEWS.navFeed} />
          <NavItem to="/media" label="Media Library" icon={Images} testId={NEWS.navMedia} />
          <NavItem to="/watermark" label="Watermark" icon={Stamp} testId={NEWS.navWatermark} />
          <Button
            data-testid={NEWS.createArticleButton}
            onClick={() => setOpen(true)}
            className="ml-2 rounded-full bg-crimson px-4 font-semibold text-white hover:bg-crimson-hover"
          >
            <PenLine className="mr-1.5 h-4 w-4" /> New Article
          </Button>
        </nav>
      </div>

      <CreateArticleDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(article) => {
          setOpen(false);
          navigate(`/article/${article.id}`);
        }}
      />
    </header>
  );
}
