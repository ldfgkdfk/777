import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Link as RouterLink, useLocation } from "react-router-dom";

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isAuthPage = location.pathname === "/auth";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <RouterLink to="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <img
            src="/algerian-avatar.svg"
            alt="Avatar — Vector image by VectorStock / HappyDwiS"
            className="inline-block size-7 rounded-md ring-1 ring-primary/30 object-cover"
          />
          Marrakech Online
        </RouterLink>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
              <Button variant="outline" onClick={logout}>Выйти</Button>
              {isHome ? (
                <a href="#new" className="hidden sm:block"><Button>Создать партию</Button></a>
              ) : null}
            </div>
          ) : !isAuthPage ? (
            <RouterLink to="/auth"><Button variant="outline">Вход / Регистрация</Button></RouterLink>
          ) : null}
        </div>
      </div>
    </header>
  );
}
